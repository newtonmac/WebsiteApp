import Foundation
import SwiftUI
import CoreLocation
import MapKit

// MARK: - Debug Logging

/// Debug-only logging — stripped from release builds
@inline(__always)
func evLog(_ message: @autoclosure () -> String) {
    #if DEBUG
    print(message())
    #endif
}

// MARK: - Shared Constants

enum EVConstants {
    static let metersPerFoot: Double = 0.3048
    static let feetPerMeter: Double = 3.28084
    static let metersPerMile: Double = 1609.34
    static let milesPerMeter: Double = 0.000621371
    static let joulesPerKwh: Double = 3_600_000
    static let kmPerMile: Double = 1.60934

    // Physics
    static let drivetrainEfficiency: Double = 0.88
    static let gravity: Double = 9.81           // m/s²

    // Default map center (San Diego)
    static let defaultCoordinate = CLLocationCoordinate2D(latitude: 32.72, longitude: -117.16)
}

// MARK: - Shared Formatting

/// Format a duration in minutes to "Xh Ym" or "Ym"
func formatDuration(_ minutes: Double) -> String {
    let hrs = Int(minutes) / 60
    let mins = Int(minutes) % 60
    return hrs > 0 ? "\(hrs)h \(mins)m" : "\(mins)m"
}

// MARK: - Battery Color

/// Returns a color representing a battery percentage level
func batteryLevelColor(_ percent: Double) -> Color {
    if percent < 20 { return EVTheme.accentRed }
    if percent < 40 { return EVTheme.accentYellow }
    return EVTheme.accentGreen
}

/// Returns a color for battery overlay chart lines (blue/yellow/red)
func batteryChartColor(_ percent: Double) -> Color {
    if percent < 15 { return EVTheme.accentRed }
    if percent < 30 { return EVTheme.accentYellow }
    return EVTheme.accentBlue
}

// MARK: - ChargerNetwork Color Extension

extension ChargerNetwork {
    /// SwiftUI Color for this network
    var colorValue: Color {
        Color(hex: color)
    }
}

// MARK: - Nearest Charger

/// Find the nearest charger to a coordinate from a list
func nearestCharger(to coordinate: CLLocationCoordinate2D, from chargers: [EVCharger]) -> EVCharger? {
    var best: EVCharger?
    var bestDist = Double.greatestFiniteMagnitude
    let lat = coordinate.latitude, lon = coordinate.longitude
    for charger in chargers {
        let dlat = (charger.coordinate.latitude - lat) * .pi / 180
        let dlon = (charger.coordinate.longitude - lon) * .pi / 180
        let ml = lat * .pi / 180
        let a = dlat*dlat + cos(ml)*cos(ml)*dlon*dlon
        let dist = 6_371_000 * 2 * atan2(sqrt(a), sqrt(1-a))
        if dist < bestDist { bestDist = dist; best = charger }
    }
    return best
}

// MARK: - Battery Profile (matches EVRouteService.segmentEnergy exactly)

/// Compute battery percentage at each elevation profile point.
/// Uses the same EPA-calibrated two-component model as EVRouteService.segmentEnergy:
///   1. Flat baseline: segDistMiles × vehicle.effKwhMi
///   2. Grade correction: physics-based potential energy change
/// Shared between ElevationChartView, EVRoutePlannerView, and EVRoutePDFGenerator.
func computeBatteryProfile(
    profile: [ElevationPoint],
    vehicle: EVVehicle,
    chargingStops: [ChargingStop],
    startPct: Double,
    chargeTargetPct: Double
) -> [Double] {
    guard profile.count >= 2 else { return [] }

    var batteryPcts: [Double] = [startPct]
    batteryPcts.reserveCapacity(profile.count)
    var currentPct = startPct
    let stopDistances = chargingStops.map { $0.distanceMiles }

    for i in 1..<profile.count {
        let segDistMiles = profile[i].distance - profile[i - 1].distance
        guard segDistMiles > 0 else { batteryPcts.append(currentPct); continue }
        let elevDiff = profile[i].elevation - profile[i - 1].elevation  // meters

        // Flat baseline — EPA-calibrated (same as segmentEnergy)
        let flatKwh = segDistMiles * vehicle.effKwhMi

        // Grade correction — potential energy physics
        let gradeJ = vehicle.weightKg * EVConstants.gravity * elevDiff
        let segKwh: Double
        if elevDiff > 0 {
            segKwh = flatKwh + gradeJ / (EVConstants.joulesPerKwh * EVConstants.drivetrainEfficiency)
        } else {
            segKwh = max(0, flatKwh - abs(gradeJ) / EVConstants.joulesPerKwh * vehicle.regenEff)
        }

        // Apply charging stops (battery jumps to chargeTargetPct at stop distances)
        for stopDist in stopDistances {
            if stopDist > profile[i - 1].distance && stopDist <= profile[i].distance {
                currentPct = chargeTargetPct
            }
        }

        let segPct = (max(0, segKwh) / vehicle.batteryKwh) * 100
        currentPct -= segPct
        currentPct = max(0, min(100, currentPct))
        batteryPcts.append(currentPct)
    }

    return batteryPcts
}

// MARK: - Elevation Formatting

/// Convert meters to feet
func metersToFeet(_ meters: Double) -> Int {
    Int(meters * EVConstants.feetPerMeter)
}

// MARK: - Route Sampling

/// Evenly sample `count` points along an MKPolyline by arc length.
/// Used for both single-leg (MKRoute) and multi-leg (raw MKPolyline) routes.
func samplePolylinePoints(polyline: MKPolyline, count: Int) -> [CLLocationCoordinate2D] {
    let n = polyline.pointCount
    guard n > 1, count > 0 else { return [] }
    let pts = polyline.points()

    // Build cumulative distance array — call pts() ONCE outside the loop
    var cumDist: [Double] = [0]
    cumDist.reserveCapacity(n)
    for i in 1..<n {
        let p1 = pts[i-1].coordinate, p2 = pts[i].coordinate
        // Fast Haversine approximation for short segments (avoids CLLocation allocation)
        let dlat = (p2.latitude  - p1.latitude)  * .pi / 180
        let dlon = (p2.longitude - p1.longitude) * .pi / 180
        let midLat = (p1.latitude + p2.latitude) * 0.5 * .pi / 180
        let a = dlat*dlat + cos(midLat) * cos(midLat) * dlon*dlon
        let d = 6_371_000 * 2 * atan2(sqrt(a), sqrt(1-a))
        cumDist.append(cumDist[i-1] + d)
    }

    let total = cumDist[n-1]
    var sampled: [CLLocationCoordinate2D] = []
    sampled.reserveCapacity(count)

    for i in 0..<count {
        let target = total * Double(i) / Double(max(1, count - 1))
        var lo = 0, hi = n - 2
        while lo < hi {
            let mid = (lo + hi) / 2
            if cumDist[mid + 1] < target { lo = mid + 1 } else { hi = mid }
        }
        if lo >= n - 1 { sampled.append(pts[n-1].coordinate); continue }
        let segLen = cumDist[lo+1] - cumDist[lo]
        let t = segLen > 0 ? (target - cumDist[lo]) / segLen : 0
        let p1 = pts[lo].coordinate, p2 = pts[lo+1].coordinate
        sampled.append(CLLocationCoordinate2D(
            latitude:  p1.latitude  + t * (p2.latitude  - p1.latitude),
            longitude: p1.longitude + t * (p2.longitude - p1.longitude)
        ))
    }
    return sampled
}

/// Convenience wrapper — sample points from an MKRoute's polyline.
func sampleRoutePoints(route: MKRoute, count: Int) -> [CLLocationCoordinate2D] {
    samplePolylinePoints(polyline: route.polyline, count: count)
}
