import SwiftUI
import CoreLocation

// MARK: - Shared Constants

enum EVConstants {
    static let metersPerFoot: Double = 0.3048
    static let feetPerMeter: Double = 3.28084
    static let metersPerMile: Double = 1609.34
    static let joulesPerKwh: Double = 3_600_000

    // Physics
    static let airDensity: Double = 1.225       // kg/m³ at sea level
    static let drivetrainEfficiency: Double = 0.88
    static let gravity: Double = 9.81           // m/s²
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
    let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
    var best: EVCharger?
    var bestDist = Double.greatestFiniteMagnitude
    for charger in chargers {
        let dist = location.distance(from: CLLocation(latitude: charger.coordinate.latitude, longitude: charger.coordinate.longitude))
        if dist < bestDist {
            bestDist = dist
            best = charger
        }
    }
    return best
}

// MARK: - Physics-Based Battery Profile

/// Compute battery percentage at each elevation profile point using physics model.
/// Shared between ElevationChartView and EVRoutePDFGenerator.
func computeBatteryProfile(
    profile: [ElevationPoint],
    vehicle: EVVehicle,
    chargingStops: [ChargingStop],
    avgSpeedMps: Double,
    startPct: Double,
    chargeTargetPct: Double
) -> [Double] {
    guard profile.count >= 2 else { return [] }

    var batteryPcts: [Double] = [startPct]
    var currentPct = startPct
    let stopDistances = chargingStops.map { $0.distanceMiles }

    for i in 1..<profile.count {
        let segDistMiles = profile[i].distance - profile[i - 1].distance
        let segDistMeters = segDistMiles * EVConstants.metersPerMile
        let gradePct = profile[i].grade
        let theta = atan(gradePct / 100.0)

        let gradeSpeedFactor: Double
        if gradePct > 6 { gradeSpeedFactor = 0.75 }
        else if gradePct > 3 { gradeSpeedFactor = 0.88 }
        else if gradePct < -6 { gradeSpeedFactor = 0.90 }
        else { gradeSpeedFactor = 1.0 }
        let segSpeed = avgSpeedMps * gradeSpeedFactor

        let fRoll = vehicle.rollingResistance * vehicle.weightKg * EVConstants.gravity * cos(theta)
        let fAero = 0.5 * EVConstants.airDensity * vehicle.dragCoeff * vehicle.frontalArea * segSpeed * segSpeed
        let fGrade = vehicle.weightKg * EVConstants.gravity * sin(theta)
        let fTotal = fRoll + fAero + fGrade

        let segEnergyJoules = fTotal * segDistMeters
        let segEnergyKwh: Double
        if segEnergyJoules > 0 {
            segEnergyKwh = segEnergyJoules / (EVConstants.joulesPerKwh * EVConstants.drivetrainEfficiency)
        } else {
            segEnergyKwh = segEnergyJoules / EVConstants.joulesPerKwh * vehicle.regenEff
        }

        let segPct = (max(0, segEnergyKwh) / vehicle.batteryKwh) * 100

        for stopDist in stopDistances {
            if stopDist > profile[i - 1].distance && stopDist <= profile[i].distance {
                currentPct = chargeTargetPct
            }
        }

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
