import Foundation
import MapKit
import Observation

struct ChargingStop: Identifiable {
    let id = UUID()
    let distanceMiles: Double       // distance from origin where stop occurs
    let coordinate: CLLocationCoordinate2D
    let arrivalBatteryPct: Double   // battery % when arriving at charger
    let departureBatteryPct: Double // battery % after charging (target 80%)
    let energyToAddKwh: Double      // kWh to charge
    let stopNumber: Int
    let estimatedChargeMinutes: Double  // estimated time to charge

    // Per-section stats (section = previous stop/origin → this stop)
    let sectionDistanceMiles: Double    // miles for this leg
    let sectionEnergyKwh: Double        // energy consumed on this leg
    let sectionElevationGain: Double    // meters gained on this leg
    let sectionElevationLoss: Double    // meters lost on this leg

    var sectionEfficiency: Double {     // mi/kWh for this leg
        sectionEnergyKwh > 0 ? sectionDistanceMiles / sectionEnergyKwh : 0
    }

}

/// Stats for the final section (last stop → destination)
struct FinalSection {
    let distanceMiles: Double
    let energyKwh: Double
    let elevationGain: Double
    let elevationLoss: Double

    var efficiency: Double {
        energyKwh > 0 ? distanceMiles / energyKwh : 0
    }

    var kwhPerMile: Double {
        distanceMiles > 0 ? energyKwh / distanceMiles : 0
    }
}

struct RouteResult: Identifiable {
    let id = UUID()
    let route: MKRoute?
    let customPolyline: MKPolyline?   // used for multi-stop routes instead of route.polyline
    let routeName: String
    let distanceMiles: Double
    let durationMinutes: Double      // driving time only
    let elevationGain: Double
    let elevationLoss: Double
    let energyKwh: Double           // total energy for full trip (no stops)
    let batteryPctUsed: Double      // total % if no charging
    let efficiency: Double
    let averageGrade: Double
    let peakGrade: Double
    let elevationProfile: [ElevationPoint]
    let score: Double
    let chargingStops: [ChargingStop]
    let finalBatteryPct: Double     // battery % at destination (after charging stops)
    let finalSection: FinalSection?         // stats for last stop → destination
    let waypointDistancesMiles: [Double]    // cumulative distances where user stops occur
    let waypointNames: [String]             // user-typed stop names

    var remainingBatteryPct: Double { finalBatteryPct }
    var needsCharging: Bool { !chargingStops.isEmpty }

    /// Total charging time across all stops
    var totalChargingMinutes: Double {
        chargingStops.reduce(0) { $0 + $1.estimatedChargeMinutes }
    }

    /// Total trip time = driving + charging stops
    var totalTripMinutes: Double {
        durationMinutes + totalChargingMinutes
    }

    /// Standard init from a real MKRoute
    init(route: MKRoute, elevationGain: Double, elevationLoss: Double, energyKwh: Double,
         batteryPctUsed: Double, efficiency: Double, averageGrade: Double, peakGrade: Double,
         elevationProfile: [ElevationPoint], score: Double, chargingStops: [ChargingStop],
         finalBatteryPct: Double, finalSection: FinalSection? = nil,
         customPolyline: MKPolyline? = nil,
         waypointDistancesMiles: [Double] = [], waypointNames: [String] = []) {
        self.route = route
        self.customPolyline = customPolyline
        self.waypointDistancesMiles = waypointDistancesMiles
        self.waypointNames = waypointNames
        self.routeName = route.name
        self.distanceMiles = route.distance * EVConstants.milesPerMeter
        self.durationMinutes = route.expectedTravelTime / 60
        self.elevationGain = elevationGain
        self.elevationLoss = elevationLoss
        self.energyKwh = energyKwh
        self.batteryPctUsed = batteryPctUsed
        self.efficiency = efficiency
        self.averageGrade = averageGrade
        self.peakGrade = peakGrade
        self.elevationProfile = elevationProfile
        self.score = score
        self.chargingStops = chargingStops
        self.finalBatteryPct = finalBatteryPct
        self.finalSection = finalSection
    }

    /// Preview init without MKRoute
    init(routeName: String, distanceMiles: Double, durationMinutes: Double,
         elevationGain: Double, elevationLoss: Double, energyKwh: Double,
         batteryPctUsed: Double, efficiency: Double, averageGrade: Double, peakGrade: Double,
         elevationProfile: [ElevationPoint], score: Double, chargingStops: [ChargingStop],
         finalBatteryPct: Double, finalSection: FinalSection? = nil,
         customPolyline: MKPolyline? = nil,
         waypointDistancesMiles: [Double] = [], waypointNames: [String] = []) {
        self.route = nil
        self.customPolyline = customPolyline
        self.waypointDistancesMiles = waypointDistancesMiles
        self.waypointNames = waypointNames
        self.routeName = routeName
        self.distanceMiles = distanceMiles
        self.durationMinutes = durationMinutes
        self.elevationGain = elevationGain
        self.elevationLoss = elevationLoss
        self.energyKwh = energyKwh
        self.batteryPctUsed = batteryPctUsed
        self.efficiency = efficiency
        self.averageGrade = averageGrade
        self.peakGrade = peakGrade
        self.elevationProfile = elevationProfile
        self.score = score
        self.chargingStops = chargingStops
        self.finalBatteryPct = finalBatteryPct
        self.finalSection = finalSection
    }
}

struct ElevationPoint {
    let distance: Double
    let elevation: Double
    let grade: Double
}

@Observable
@MainActor
class EVRouteService {
    var routes: [RouteResult] = []
    var isLoading = false
    var errorMessage: String?

    // Charging parameters (defaults, overridden by settings)
    private var minBatteryPct = 15.0
    private var chargeTargetPct = 80.0
    private var startBatteryPct = 100.0

    // Elevation cache: keyed by "lat,lon" grid (rounded to 2 decimal places ~1km grid)
    private var elevationCache: [String: Double] = [:]

    private func cacheKey(_ coord: CLLocationCoordinate2D) -> String {
        String(format: "%.2f,%.2f", coord.latitude, coord.longitude)
    }

    func planRoute(from origin: CLLocationCoordinate2D,
                   to destination: CLLocationCoordinate2D,
                   stops: [CLLocationCoordinate2D] = [],
                   stopNames: [String] = [],
                   vehicle: EVVehicle,
                   startBattery: Double = 100,
                   minBattery: Double = 15,
                   chargeTarget: Double = 80,
                   avoidHighways: Bool = false,
                   avoidTolls: Bool = false,
                   preferredChargerSpeedKw: Double = 150,
                   preferredStopMinutes: Double = 30) async {
        isLoading = true
        errorMessage = nil
        routes = []

        // Apply settings
        self.startBatteryPct = startBattery
        self.minBatteryPct = minBattery
        self.chargeTargetPct = chargeTarget

        do {
            if stops.isEmpty {
                // Simple origin → destination, show alternate routes
                let mkRoutes = try await fetchDirections(
                    from: origin, to: destination,
                    avoidHighways: avoidHighways, avoidTolls: avoidTolls
                )
                guard !mkRoutes.isEmpty else {
                    errorMessage = "No routes found between these locations."
                    isLoading = false
                    return
                }
                // Sample points for all routes first (fast, no network)
                let allPoints = mkRoutes.map { sampleRoutePoints(route: $0, count: 80) }

                // Fetch elevations for ALL alternate routes CONCURRENTLY
                // Previously serial: route1 → route2 → route3 (3× wait time)
                // Now parallel: all routes fetch elevation simultaneously
                var allElevations: [[Double]] = Array(repeating: [], count: mkRoutes.count)
                await withTaskGroup(of: (Int, [Double]).self) { group in
                    for (i, pts) in allPoints.enumerated() {
                        group.addTask { (i, await self.fetchElevations(for: pts)) }
                    }
                    for await (i, elevs) in group { allElevations[i] = elevs }
                }

                // Build results (CPU-only, instant)
                var results: [RouteResult] = []
                for (i, route) in mkRoutes.enumerated() {
                    let points = allPoints[i]
                    let elevations = allElevations[i]
                    let profile = buildElevationProfile(points: points, elevations: elevations, totalDistance: route.distance)
                    let energy = estimateEnergy(profile: profile, route: route, vehicle: vehicle)
                    let score = computeScore(energy: energy, route: route)
                    let totalBatteryPct = (energy.totalKwh / vehicle.batteryKwh) * 100

                    let chargingPlan = calculateChargingStops(
                        profile: profile,
                        points: points,
                        vehicle: vehicle,
                        totalEnergyKwh: energy.totalKwh,
                        preferredChargerSpeedKw: preferredChargerSpeedKw,
                        minStopMinutes: preferredStopMinutes
                    )

                    results.append(RouteResult(
                        route: route,
                        elevationGain: energy.gain,
                        elevationLoss: energy.loss,
                        energyKwh: energy.totalKwh,
                        batteryPctUsed: totalBatteryPct,
                        efficiency: (route.distance * EVConstants.milesPerMeter) / max(energy.totalKwh, 0.01),
                        averageGrade: energy.avgGrade,
                        peakGrade: energy.peakGrade,
                        elevationProfile: profile,
                        score: score,
                        chargingStops: chargingPlan.stops,
                        finalBatteryPct: chargingPlan.finalBatteryPct,
                        finalSection: chargingPlan.finalSection
                    ))
                }
                routes = results.sorted { $0.score < $1.score }

            } else {
                // Multi-stop: chain legs through each waypoint
                let waypoints = [origin] + stops + [destination]
                if let result = try await fetchMultiLegRoute(
                    waypoints: waypoints,
                    waypointNames: stopNames,
                    vehicle: vehicle,
                    avoidHighways: avoidHighways,
                    avoidTolls: avoidTolls,
                    preferredChargerSpeedKw: preferredChargerSpeedKw,
                    minStopMinutes: preferredStopMinutes
                ) {
                    routes = [result]
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Charging Stop Calculation

    private struct ChargingPlan {
        let stops: [ChargingStop]
        let finalBatteryPct: Double
        let finalSection: FinalSection?
    }

    /// Estimate DC fast charging time in minutes using a realistic charging curve.
    /// Charging slows as battery fills: ~peak rate up to 50%, ~60% rate from 50-80%, ~30% rate above 80%.
    /// minStopMinutes is the minimum time at a stop (parking, plugging in, etc.)
    private func estimateChargeTime(
        fromPct: Double, toPct: Double,
        batteryKwh: Double, peakChargeKw: Double,
        minStopMinutes: Double
    ) -> Double {
        guard toPct > fromPct, peakChargeKw > 0 else { return minStopMinutes }

        var totalMinutes = 0.0
        // Break into 3 charging rate bands
        let bands: [(upperPct: Double, rateFactor: Double)] = [
            (50, 1.0),   // up to 50%: full speed
            (80, 0.60),  // 50-80%: 60% of peak
            (100, 0.30)  // 80-100%: 30% of peak
        ]

        var currentPct = fromPct
        for band in bands {
            guard currentPct < toPct else { break }
            let bandEnd = min(toPct, band.upperPct)
            guard bandEnd > currentPct else { continue }

            let pctRange = bandEnd - currentPct
            let kwhToAdd = (pctRange / 100.0) * batteryKwh
            let effectiveKw = peakChargeKw * band.rateFactor
            totalMinutes += (kwhToAdd / effectiveKw) * 60.0
            currentPct = bandEnd
        }

        // Enforce minimum stop duration (walk to charger, plug in, pay, etc.)
        return max(totalMinutes, minStopMinutes)
    }

    private func calculateChargingStops(
        profile: [ElevationPoint],
        points: [CLLocationCoordinate2D],
        vehicle: EVVehicle,
        totalEnergyKwh: Double,
        preferredChargerSpeedKw: Double = 150,
        minStopMinutes: Double = 10
    ) -> ChargingPlan {
        let totalBatteryPct = (totalEnergyKwh / vehicle.batteryKwh) * 100

        // If trip fits within battery with 15% remaining, no stops needed
        if totalBatteryPct <= (startBatteryPct - minBatteryPct) {
            return ChargingPlan(stops: [], finalBatteryPct: startBatteryPct - totalBatteryPct, finalSection: nil)
        }

        // Need charging stops — simulate the trip segment by segment
        var currentBatteryPct = startBatteryPct
        var stops: [ChargingStop] = []
        var stopNumber = 1
        guard profile.count >= 2, points.count >= 2 else {
            return ChargingPlan(stops: [], finalBatteryPct: max(0, startBatteryPct - totalBatteryPct), finalSection: nil)
        }

        let segmentCount = profile.count - 1
        var segmentEnergyKwh: [Double] = []
        var segmentEnergyPcts: [Double] = []

        for i in 1..<profile.count {
            let segKwh = segmentEnergy(
                profile: profile, index: i, vehicle: vehicle
            )
            let clampedKwh = max(0, segKwh)
            segmentEnergyKwh.append(clampedKwh)
            segmentEnergyPcts.append((clampedKwh / vehicle.batteryKwh) * 100)
        }

        // Track per-section accumulators (section = previous stop/origin → current stop)
        var sectionStartSegment = 0
        var sectionStartDistance = 0.0

        /// Aggregate section stats from segStart..<segEnd
        func sectionStats(from segStart: Int, to segEnd: Int, startDist: Double, endDist: Double) -> (distance: Double, energy: Double, gain: Double, loss: Double) {
            var energy = 0.0
            var gain = 0.0
            var loss = 0.0
            for s in segStart..<segEnd {
                energy += segmentEnergyKwh[s]
                let elevDiff = profile[s + 1].elevation - profile[s].elevation
                if elevDiff > 0 { gain += elevDiff }
                else { loss += abs(elevDiff) }
            }
            return (endDist - startDist, energy, gain, loss)
        }

        // Walk through segments, inserting charging stops when battery would drop below threshold
        for i in 0..<segmentCount {
            let energyNeeded = segmentEnergyPcts[i]

            // Check if we'd drop below minimum after this segment
            if currentBatteryPct - energyNeeded < minBatteryPct {
                // Need to charge before this segment
                let pointIdx = min(i, points.count - 1)
                let arrivalPct = currentBatteryPct

                // Skip stop if already at or above charge target (e.g. downhill regen)
                guard arrivalPct < chargeTargetPct else {
                    currentBatteryPct -= energyNeeded
                    currentBatteryPct = max(0, currentBatteryPct)
                    continue
                }

                let energyToAdd = (chargeTargetPct - arrivalPct) / 100.0 * vehicle.batteryKwh

                // Compute per-section stats for the section ending at this stop
                let leg = sectionStats(from: sectionStartSegment, to: i, startDist: sectionStartDistance, endDist: profile[i].distance)

                let chargeMinutes = estimateChargeTime(
                    fromPct: arrivalPct, toPct: chargeTargetPct,
                    batteryKwh: vehicle.batteryKwh,
                    peakChargeKw: preferredChargerSpeedKw,
                    minStopMinutes: minStopMinutes
                )

                stops.append(ChargingStop(
                    distanceMiles: profile[i].distance,
                    coordinate: points[pointIdx],
                    arrivalBatteryPct: arrivalPct,
                    departureBatteryPct: chargeTargetPct,
                    energyToAddKwh: max(0, energyToAdd),
                    stopNumber: stopNumber,
                    estimatedChargeMinutes: chargeMinutes,
                    sectionDistanceMiles: leg.distance,
                    sectionEnergyKwh: leg.energy,
                    sectionElevationGain: leg.gain,
                    sectionElevationLoss: leg.loss
                ))

                // Reset section accumulators
                sectionStartSegment = i
                sectionStartDistance = profile[i].distance

                currentBatteryPct = chargeTargetPct
                stopNumber += 1
            }

            currentBatteryPct -= energyNeeded
            currentBatteryPct = max(0, currentBatteryPct)
        }

        // Compute final section stats (last stop → destination)
        let totalDist = profile.last?.distance ?? 0
        let fSec = sectionStats(from: sectionStartSegment, to: segmentCount, startDist: sectionStartDistance, endDist: totalDist)
        let finalSection = FinalSection(
            distanceMiles: fSec.distance,
            energyKwh: fSec.energy,
            elevationGain: fSec.gain,
            elevationLoss: fSec.loss
        )

        return ChargingPlan(stops: stops, finalBatteryPct: max(0, currentBatteryPct), finalSection: finalSection)
    }

    // MARK: - MapKit Directions

    /// Single-leg directions (origin → destination, no stops). Returns alternate routes.
    private func fetchDirections(from origin: CLLocationCoordinate2D,
                                  to destination: CLLocationCoordinate2D,
                                  avoidHighways: Bool = false,
                                  avoidTolls: Bool = false) async throws -> [MKRoute] {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: origin))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination))
        request.transportType = .automobile
        request.requestsAlternateRoutes = true
        if avoidHighways { request.highwayPreference = .avoid }
        if avoidTolls { request.tollPreference = .avoid }

        let directions = MKDirections(request: request)
        let response = try await directions.calculate()
        return response.routes
    }

    /// Multi-leg directions: calculates each leg separately and stitches results.
    /// MapKit does not support waypoints natively, so we chain separate requests.
    /// Elevation is fetched concurrently across all legs to avoid sequential API delays.
    private func fetchMultiLegRoute(
        waypoints: [CLLocationCoordinate2D],
        waypointNames: [String] = [],
        vehicle: EVVehicle,
        avoidHighways: Bool,
        avoidTolls: Bool,
        preferredChargerSpeedKw: Double,
        minStopMinutes: Double
    ) async throws -> RouteResult? {
        guard waypoints.count >= 2 else { return nil }
        let legCount = waypoints.count - 1

        // Step 1: Calculate all MKRoute legs concurrently
        var legs: [MKRoute?] = Array(repeating: nil, count: legCount)
        try await withThrowingTaskGroup(of: (Int, MKRoute?).self) { group in
            for i in 0..<legCount {
                group.addTask {
                    let req = MKDirections.Request()
                    req.source = MKMapItem(placemark: MKPlacemark(coordinate: waypoints[i]))
                    req.destination = MKMapItem(placemark: MKPlacemark(coordinate: waypoints[i + 1]))
                    req.transportType = .automobile
                    if avoidHighways { req.highwayPreference = .avoid }
                    if avoidTolls { req.tollPreference = .avoid }
                    let response = try await MKDirections(request: req).calculate()
                    return (i, response.routes.first)
                }
            }
            for try await (idx, route) in group {
                legs[idx] = route
            }
        }

        // Step 2: Sample points for each leg (fewer points per leg = faster elevation fetch)
        let pointsPerLeg = max(15, 40 / legCount)
        var legPointSets: [[CLLocationCoordinate2D]] = []
        for leg in legs {
            guard let leg = leg else { legPointSets.append([]); continue }
            legPointSets.append(sampleRoutePoints(route: leg, count: pointsPerLeg))
        }

        // Step 3: Fetch elevations for all legs CONCURRENTLY
        var allLegElevations: [[Double]] = Array(repeating: [], count: legCount)
        await withTaskGroup(of: (Int, [Double]).self) { group in
            for (i, pts) in legPointSets.enumerated() {
                guard !pts.isEmpty else { continue }
                group.addTask {
                    let elevs = await self.fetchElevations(for: pts)
                    return (i, elevs)
                }
            }
            for await (idx, elevs) in group {
                allLegElevations[idx] = elevs
            }
        }

        // Step 4: Build combined polyline + elevation profile
        var allPolylineCoords: [CLLocationCoordinate2D] = []
        var totalDistanceM: Double = 0
        var totalTimeS: Double = 0
        var combinedProfile: [ElevationPoint] = []
        var distanceOffsetMiles: Double = 0
        var waypointDistances: [Double] = []  // cumulative miles at each stop junction

        for i in 0..<legCount {
            guard let leg = legs[i] else { continue }
            let pts = legPointSets[i]
            let elevs = allLegElevations[i]

            // Collect polyline coords (skip first point after leg 0 to avoid duplicates)
            let pCount = leg.polyline.pointCount
            let mapPts = leg.polyline.points()
            let startIdx = i == 0 ? 0 : 1
            for j in startIdx..<pCount {
                allPolylineCoords.append(mapPts[j].coordinate)
            }

            // Build this leg's elevation profile, offset by cumulative distance
            var legProfile = buildElevationProfile(points: pts, elevations: elevs, totalDistance: leg.distance)
            if distanceOffsetMiles > 0 {
                legProfile = legProfile.map {
                    ElevationPoint(distance: $0.distance + distanceOffsetMiles, elevation: $0.elevation, grade: $0.grade)
                }
                legProfile = Array(legProfile.dropFirst())
            }
            combinedProfile.append(contentsOf: legProfile)

            totalDistanceM += leg.distance
            totalTimeS += leg.expectedTravelTime
            distanceOffsetMiles += leg.distance * EVConstants.milesPerMeter
            // Record junction distance for all legs except the last (destination)
            if i < legCount - 1 {
                waypointDistances.append(distanceOffsetMiles)
            }
        }

        guard !combinedProfile.isEmpty else { return nil }

        let combinedPolyline = MKPolyline(coordinates: allPolylineCoords, count: allPolylineCoords.count)
        let energy = estimateEnergyFromProfile(combinedProfile, vehicle: vehicle)
        let totalBatteryPct = (energy.totalKwh / vehicle.batteryKwh) * 100

        let chargingPlan = calculateChargingStopsFromProfile(
            profile: combinedProfile,
            vehicle: vehicle,
            totalEnergyKwh: energy.totalKwh,
            preferredChargerSpeedKw: preferredChargerSpeedKw,
            minStopMinutes: minStopMinutes
        )

        let stopCount = waypoints.count - 2
        let stopLabel = stopCount == 1 ? "1 stop" : "\(stopCount) stops"

        // Fix charging stop coordinates: interpolate real positions from combined polyline.
        // Precompute cumDist ONCE for all stops — avoids O(n) rebuild per stop.
        let polyCumDist: [Double] = {
            var d: [Double] = [0]
            d.reserveCapacity(allPolylineCoords.count)
            for i in 1..<allPolylineCoords.count {
                let dlat = (allPolylineCoords[i].latitude  - allPolylineCoords[i-1].latitude)  * .pi / 180
                let dlon = (allPolylineCoords[i].longitude - allPolylineCoords[i-1].longitude) * .pi / 180
                let ml = allPolylineCoords[i-1].latitude * .pi / 180
                let a = dlat*dlat + cos(ml)*cos(ml)*dlon*dlon
                d.append(d[i-1] + 6_371_000 * 2 * atan2(sqrt(a), sqrt(1-a)))
            }
            return d
        }()
        let enrichedStops = chargingPlan.stops.map { stop -> ChargingStop in
            let coord = interpolateCoordinate(
                coords: allPolylineCoords,
                cumDist: polyCumDist,
                targetMiles: stop.distanceMiles
            )
            return ChargingStop(
                distanceMiles: stop.distanceMiles,
                coordinate: coord,
                arrivalBatteryPct: stop.arrivalBatteryPct,
                departureBatteryPct: stop.departureBatteryPct,
                energyToAddKwh: stop.energyToAddKwh,
                stopNumber: stop.stopNumber,
                estimatedChargeMinutes: stop.estimatedChargeMinutes,
                sectionDistanceMiles: stop.sectionDistanceMiles,
                sectionEnergyKwh: stop.sectionEnergyKwh,
                sectionElevationGain: stop.sectionElevationGain,
                sectionElevationLoss: stop.sectionElevationLoss
            )
        }

        return RouteResult(
            routeName: "Via \(stopLabel)",
            distanceMiles: totalDistanceM * EVConstants.milesPerMeter,
            durationMinutes: totalTimeS / 60,
            elevationGain: energy.gain,
            elevationLoss: energy.loss,
            energyKwh: energy.totalKwh,
            batteryPctUsed: totalBatteryPct,
            efficiency: distanceOffsetMiles / max(energy.totalKwh, 0.01),
            averageGrade: energy.avgGrade,
            peakGrade: energy.peakGrade,
            elevationProfile: combinedProfile,
            score: energy.totalKwh * 0.80 + (totalTimeS / 3600) * 0.15,  // matches computeScore weights
            chargingStops: enrichedStops,
            finalBatteryPct: chargingPlan.finalBatteryPct,
            finalSection: chargingPlan.finalSection,
            customPolyline: combinedPolyline,
            waypointDistancesMiles: waypointDistances,
            waypointNames: waypointNames
        )
    }

    /// Energy estimation from a profile (no MKRoute needed).
    private func estimateEnergyFromProfile(_ profile: [ElevationPoint], vehicle: EVVehicle) -> EnergyResult {
        var totalEnergy = 0.0
        var totalGain = 0.0
        var totalLoss = 0.0
        var grades: [Double] = []
        var peakGrade = 0.0

        for i in 1..<profile.count {
            let elevDiff = profile[i].elevation - profile[i - 1].elevation
            let absGrade = abs(profile[i].grade)
            grades.append(absGrade)
            peakGrade = max(peakGrade, absGrade)
            if elevDiff > 0 { totalGain += elevDiff }
            else { totalLoss += abs(elevDiff) }
            totalEnergy += segmentEnergy(profile: profile, index: i, vehicle: vehicle)
        }

        let totalKwh = max(0.1, totalEnergy)
        let avgGrade = grades.isEmpty ? 0 : grades.reduce(0, +) / Double(grades.count)
        return EnergyResult(totalKwh: totalKwh, gain: totalGain, loss: totalLoss, avgGrade: avgGrade, peakGrade: peakGrade)
    }

    /// Charging stop calculation that works from a profile + speed (no MKRoute needed).
    private func calculateChargingStopsFromProfile(
        profile: [ElevationPoint],
        vehicle: EVVehicle,
        totalEnergyKwh: Double,
        preferredChargerSpeedKw: Double,
        minStopMinutes: Double
    ) -> ChargingPlan {
        guard profile.count >= 2 else {
            return ChargingPlan(stops: [], finalBatteryPct: max(0, startBatteryPct - (totalEnergyKwh / vehicle.batteryKwh) * 100), finalSection: nil)
        }

        let totalBatteryPct = (totalEnergyKwh / vehicle.batteryKwh) * 100
        if totalBatteryPct <= (startBatteryPct - minBatteryPct) {
            return ChargingPlan(stops: [], finalBatteryPct: startBatteryPct - totalBatteryPct, finalSection: nil)
        }

        // Use profile-distributed coordinate placeholders (coordinates unused for display)
        let fakePoints = profile.map { _ in CLLocationCoordinate2D(latitude: 0, longitude: 0) }

        return calculateChargingStops(
            profile: profile,
            points: fakePoints,
            vehicle: vehicle,
            totalEnergyKwh: totalEnergyKwh,
            preferredChargerSpeedKw: preferredChargerSpeedKw,
            minStopMinutes: minStopMinutes
        )
    }

    // MARK: - Elevation (Open Elevation API — no key required)

    private func fetchElevations(for points: [CLLocationCoordinate2D]) async -> [Double] {
        // Check cache first — skip API for already-known coordinates
        var result: [Double] = Array(repeating: 0, count: points.count)
        var uncachedIndices: [Int] = []
        var uncachedPoints: [CLLocationCoordinate2D] = []

        for (i, pt) in points.enumerated() {
            if let cached = elevationCache[cacheKey(pt)] {
                result[i] = cached
            } else {
                uncachedIndices.append(i)
                uncachedPoints.append(pt)
            }
        }

        if uncachedPoints.isEmpty {
            evLog("Elevation: all \(points.count) points served from cache")
            return result
        }

        evLog("Elevation: \(points.count - uncachedPoints.count) cached, \(uncachedPoints.count) to fetch")

        // Fetch uncached points — chunks run concurrently for lower latency
        let chunkSize = 200
        let chunkCount = Int(ceil(Double(uncachedPoints.count) / Double(chunkSize)))
        var fetchedElevations: [Double] = Array(repeating: 0, count: uncachedPoints.count)

        await withTaskGroup(of: (Int, [Double]).self) { group in
            for ci in 0..<chunkCount {
                let start = ci * chunkSize
                let end = min(start + chunkSize, uncachedPoints.count)
                let chunk = Array(uncachedPoints[start..<end])
                group.addTask {
                    return (start, await self.fetchElevationOpenElevation(chunk))
                }
            }
            for await (start, elevs) in group {
                for (j, e) in elevs.enumerated() where start + j < fetchedElevations.count {
                    fetchedElevations[start + j] = e
                }
            }
        }

        // Fallback if all zeros
        if fetchedElevations.allSatisfy({ $0 == 0 }) {
            evLog("Open Elevation returned all zeros, trying Open-Meteo fallback...")
            fetchedElevations = await fetchElevationsOpenMeteo(uncachedPoints)
        }

        // Evict oldest entries if cache exceeds 500 (keep last 400)
        if elevationCache.count > 400 {
            let toRemove = elevationCache.keys.prefix(elevationCache.count - 400)
            toRemove.forEach { elevationCache.removeValue(forKey: $0) }
        }
        for (i, idx) in uncachedIndices.enumerated() {
            let elev = i < fetchedElevations.count ? fetchedElevations[i] : 0
            result[idx] = elev
            elevationCache[cacheKey(uncachedPoints[i])] = elev
        }

        return result
    }

    /// Primary: Open Elevation API (POST, no API key)
    private func fetchElevationOpenElevation(_ points: [CLLocationCoordinate2D]) async -> [Double] {
        guard let url = URL(string: "https://api.open-elevation.com/api/v1/lookup") else {
            return Array(repeating: 0, count: points.count)
        }

        let locations = points.map { ["latitude": $0.latitude, "longitude": $0.longitude] }
        let body: [String: Any] = ["locations": locations]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            evLog("Open Elevation: JSON error: \(error)")
            return Array(repeating: 0, count: points.count)
        }

        evLog("Open Elevation: requesting \(points.count) points")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse {
                evLog("Open Elevation HTTP \(httpResponse.statusCode)")
            }

            let decoded = try JSONDecoder().decode(OpenElevationResponse.self, from: data)
            let elevs = decoded.results.map { $0.elevation }
            let minE = elevs.min() ?? 0
            let maxE = elevs.max() ?? 0
            evLog("Open Elevation: \(elevs.count) pts, range \(String(format: "%.1f", minE))m - \(String(format: "%.1f", maxE))m")
            return elevs
        } catch {
            evLog("Open Elevation error: \(error)")
            return Array(repeating: 0, count: points.count)
        }
    }

    /// Fallback: Open-Meteo Elevation API (GET, no API key)
    private func fetchElevationsOpenMeteo(_ points: [CLLocationCoordinate2D]) async -> [Double] {
        // Open-Meteo accepts comma-separated lat/lng lists via GET
        let chunkSize = 100
        var allElevations: [Double] = []

        for chunkStart in stride(from: 0, to: points.count, by: chunkSize) {
            let chunkEnd = min(chunkStart + chunkSize, points.count)
            let chunk = Array(points[chunkStart..<chunkEnd])

            let lats = chunk.map { String($0.latitude) }.joined(separator: ",")
            let lngs = chunk.map { String($0.longitude) }.joined(separator: ",")

            guard var components = URLComponents(string: "https://api.open-meteo.com/v1/elevation") else {
                allElevations.append(contentsOf: Array(repeating: 0, count: chunk.count))
                continue
            }
            components.queryItems = [
                URLQueryItem(name: "latitude", value: lats),
                URLQueryItem(name: "longitude", value: lngs)
            ]

            guard let url = components.url else {
                allElevations.append(contentsOf: Array(repeating: 0, count: chunk.count))
                continue
            }

            evLog("Open-Meteo: requesting \(chunk.count) points")

            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                let decoded = try JSONDecoder().decode(OpenMeteoElevationResponse.self, from: data)
                evLog("Open-Meteo: got \(decoded.elevation.count) elevations")
                allElevations.append(contentsOf: decoded.elevation)
            } catch {
                evLog("Open-Meteo error: \(error)")
                allElevations.append(contentsOf: Array(repeating: 0, count: chunk.count))
            }
        }

        return allElevations
    }

    // MARK: - Elevation Profile

    private func buildElevationProfile(points: [CLLocationCoordinate2D],
                                        elevations: [Double],
                                        totalDistance: Double) -> [ElevationPoint] {
        guard points.count == elevations.count, points.count >= 3 else { return [] }

        // Three-pass smoothing — suppresses GPS noise and elevation API spikes
        // that would otherwise create unrealistic grade values
        var smoothed = elevations
        for _ in 0..<3 {
            var pass = smoothed
            for i in 1..<(smoothed.count - 1) {
                pass[i] = (smoothed[i-1] + smoothed[i] + smoothed[i+1]) / 3.0
            }
            smoothed = pass
        }

        let totalMiles = totalDistance * EVConstants.milesPerMeter
        var profile: [ElevationPoint] = []

        for i in 0..<points.count {
            let dist = totalMiles * Double(i) / Double(points.count - 1)
            var grade = 0.0
            if i > 0 {
                // Fast flat-earth approximation — avoids CLLocation allocation in hot loop
                let dlat = (points[i].latitude  - points[i-1].latitude)  * .pi / 180
                let dlon = (points[i].longitude - points[i-1].longitude) * .pi / 180
                let midLat = points[i-1].latitude * .pi / 180
                let a = dlat*dlat + cos(midLat) * cos(midLat) * dlon*dlon
                let segDist = 6_371_000 * 2 * atan2(sqrt(a), sqrt(1-a))
                if segDist > 0 {
                    grade = ((smoothed[i] - smoothed[i-1]) / segDist) * 100
                    grade = max(-30, min(30, grade))  // clamp: GPS/API spikes can produce impossible grades
                }
            }
            profile.append(ElevationPoint(distance: dist, elevation: smoothed[i], grade: grade))
        }

        return profile
    }

    // MARK: - Energy Estimation

    private struct EnergyResult {
        let totalKwh: Double
        let gain: Double
        let loss: Double
        let avgGrade: Double
        let peakGrade: Double
    }

    // MARK: - Per-Segment Energy (EPA-calibrated baseline + physics grade correction)

    /// Two-component energy model:
    ///
    /// 1. FLAT BASELINE: segDistMiles × vehicle.effKwhMi
    ///    — Uses the vehicle's real-world combined efficiency rating.
    ///    — Already includes rolling resistance, aero drag, and auxiliary loads
    ///      (HVAC, thermal management, accessories) at typical driving conditions.
    ///    — This eliminates the systematic underestimation of the pure physics model
    ///      which previously omitted ~3-5 kW of constant auxiliary loads.
    ///
    /// 2. GRADE CORRECTION: physics-based potential energy change
    ///    — Climbing: extra energy = m × g × Δh / (J/kWh × drivetrain_efficiency)
    ///    — Descending: energy saved = m × g × |Δh| / J/kWh × regen_efficiency
    ///
    /// This gives accurate results for both flat routes (matches EPA rating)
    /// and hilly routes (correctly penalizes climbs / credits descents).
    private func segmentEnergy(
        profile: [ElevationPoint], index i: Int,
        vehicle: EVVehicle
    ) -> Double {
        let segDistMiles = profile[i].distance - profile[i - 1].distance
        guard segDistMiles > 0 else { return 0 }  // skip degenerate segments
        let elevDiff = profile[i].elevation - profile[i - 1].elevation  // meters, positive = climb

        // Flat baseline — EPA-calibrated real-world consumption
        let flatEnergyKwh = segDistMiles * vehicle.effKwhMi

        // Grade energy — potential energy physics
        let gradeEnergyJoules = vehicle.weightKg * EVConstants.gravity * elevDiff

        if elevDiff > 0 {
            // Climbing: add extra energy on top of flat baseline
            let climbingExtra = gradeEnergyJoules / (EVConstants.joulesPerKwh * EVConstants.drivetrainEfficiency)
            return flatEnergyKwh + climbingExtra
        } else {
            // Descending: recover some energy via regen, but never go below 0
            // regenEff accounts for motor power limits, friction braking, regen losses
            let regenRecovery = abs(gradeEnergyJoules) / EVConstants.joulesPerKwh * vehicle.regenEff
            return max(0, flatEnergyKwh - regenRecovery)
        }
    }

    /// Physics-based total energy estimation for a route.
    private func estimateEnergy(profile: [ElevationPoint], route: MKRoute, vehicle: EVVehicle) -> EnergyResult {
        var totalEnergy = 0.0
        var totalGain = 0.0
        var totalLoss = 0.0
        var grades: [Double] = []
        var peakGrade = 0.0

        for i in 1..<profile.count {
            let elevDiff = profile[i].elevation - profile[i - 1].elevation
            let absGrade = abs(profile[i].grade)
            grades.append(absGrade)
            peakGrade = max(peakGrade, absGrade)
            if elevDiff > 0 { totalGain += elevDiff }
            else if elevDiff < 0 { totalLoss += abs(elevDiff) }

            totalEnergy += segmentEnergy(
                profile: profile, index: i, vehicle: vehicle
            )
        }

        let totalKwh = max(0.1, totalEnergy)
        let avgGrade = grades.isEmpty ? 0 : grades.reduce(0, +) / Double(grades.count)

        return EnergyResult(totalKwh: totalKwh, gain: totalGain, loss: totalLoss, avgGrade: avgGrade, peakGrade: peakGrade)
    }

    // MARK: - Route Scoring

    private func computeScore(energy: EnergyResult, route: MKRoute) -> Double {
        // Weights: 80% energy efficiency, 15% time, 5% peak grade = 100%
        let energyScore = energy.totalKwh * 0.80
        let timeScore = (route.expectedTravelTime / 3600) * 0.15
        let gradeScore = energy.peakGrade * 0.05
        return energyScore + timeScore + gradeScore
    }

    /// Interpolate a coordinate at targetMiles along a polyline with pre-built cumDist.
    /// Caller should compute cumDist once and reuse across multiple stops.
    private func interpolateCoordinate(
        coords: [CLLocationCoordinate2D],
        cumDist: [Double],
        targetMiles: Double
    ) -> CLLocationCoordinate2D {
        guard coords.count >= 2, let totalMeters = cumDist.last, totalMeters > 0 else {
            return coords.first ?? CLLocationCoordinate2D(latitude: 0, longitude: 0)
        }
        let clampedTarget = min(targetMiles * EVConstants.metersPerMile, totalMeters)

        // Binary search
        var lo = 0, hi = cumDist.count - 2
        while lo < hi {
            let mid = (lo + hi) / 2
            if cumDist[mid + 1] < clampedTarget { lo = mid + 1 } else { hi = mid }
        }

        let segLen = cumDist[lo + 1] - cumDist[lo]
        let t = segLen > 0 ? (clampedTarget - cumDist[lo]) / segLen : 0
        let p1 = coords[lo], p2 = coords[min(lo + 1, coords.count - 1)]
        return CLLocationCoordinate2D(
            latitude:  p1.latitude  + t * (p2.latitude  - p1.latitude),
            longitude: p1.longitude + t * (p2.longitude - p1.longitude)
        )
    }
}

// MARK: - Open Elevation API Models

struct OpenElevationResponse: Codable {
    let results: [OpenElevationResult]
}

struct OpenElevationResult: Codable {
    let elevation: Double
    let latitude: Double
    let longitude: Double
}

// MARK: - Open-Meteo Elevation API Models

struct OpenMeteoElevationResponse: Codable {
    let elevation: [Double]
}
