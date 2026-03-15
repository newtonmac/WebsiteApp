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

    var sectionKwhPerMile: Double {     // kWh/mi for this leg
        sectionDistanceMiles > 0 ? sectionEnergyKwh / sectionDistanceMiles : 0
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
         finalBatteryPct: Double, finalSection: FinalSection? = nil) {
        self.route = route
        self.routeName = route.name
        self.distanceMiles = route.distance * 0.000621371
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
         finalBatteryPct: Double, finalSection: FinalSection? = nil) {
        self.route = nil
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
class EVRouteService {
    var routes: [RouteResult] = []
    var isLoading = false
    var errorMessage: String?

    private let googleAPIKey = "AIzaSyBEjpKpb_xMnZgrkTBOKMefOdaqkmQHS-8"

    // Charging parameters (defaults, overridden by settings)
    private var minBatteryPct = 15.0
    private var chargeTargetPct = 80.0
    private var startBatteryPct = 100.0

    func planRoute(from origin: CLLocationCoordinate2D,
                   to destination: CLLocationCoordinate2D,
                   stops: [CLLocationCoordinate2D] = [],
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
            let mkRoutes = try await fetchDirections(
                from: origin, to: destination, stops: stops,
                avoidHighways: avoidHighways, avoidTolls: avoidTolls
            )
            var results: [RouteResult] = []

            for route in mkRoutes {
                let points = sampleRoutePoints(route: route, count: 80)
                let elevations = await fetchElevations(for: points)
                let profile = buildElevationProfile(points: points, elevations: elevations, totalDistance: route.distance)
                let energy = estimateEnergy(profile: profile, route: route, vehicle: vehicle)
                let score = computeScore(energy: energy, route: route)
                let totalBatteryPct = (energy.totalKwh / vehicle.batteryKwh) * 100

                // Calculate charging stops if needed
                let chargingPlan = calculateChargingStops(
                    profile: profile,
                    points: points,
                    route: route,
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
                    efficiency: (route.distance * 0.000621371) / max(energy.totalKwh, 0.01),
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
        route: MKRoute,
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

        // Pre-compute per-segment energy (kWh) and store for leg aggregation
        let segmentCount = profile.count - 1
        var segmentEnergyKwh: [Double] = []
        var segmentEnergyPcts: [Double] = []
        let avgSpeedMps = route.distance / max(1, route.expectedTravelTime)

        for i in 1..<profile.count {
            let segKwh = segmentEnergy(
                profile: profile, index: i, vehicle: vehicle, avgSpeedMps: avgSpeedMps
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

    private func fetchDirections(from origin: CLLocationCoordinate2D,
                                  to destination: CLLocationCoordinate2D,
                                  stops: [CLLocationCoordinate2D],
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

    // MARK: - Elevation (Open Elevation API — no key required)

    private func fetchElevations(for points: [CLLocationCoordinate2D]) async -> [Double] {
        // Open Elevation API accepts up to ~500 points per POST
        let chunkSize = 200
        var allElevations: [Double] = []

        for chunkStart in stride(from: 0, to: points.count, by: chunkSize) {
            let chunkEnd = min(chunkStart + chunkSize, points.count)
            let chunk = Array(points[chunkStart..<chunkEnd])
            let elevations = await fetchElevationOpenElevation(chunk)
            allElevations.append(contentsOf: elevations)
        }

        // If all zeros, try Open-Meteo as fallback
        if allElevations.allSatisfy({ $0 == 0 }) {
            print("Open Elevation returned all zeros, trying Open-Meteo fallback...")
            return await fetchElevationsOpenMeteo(points)
        }

        return allElevations
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
            print("Open Elevation: JSON error: \(error)")
            return Array(repeating: 0, count: points.count)
        }

        print("Open Elevation: requesting \(points.count) points")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse {
                print("Open Elevation HTTP \(httpResponse.statusCode)")
            }

            let decoded = try JSONDecoder().decode(OpenElevationResponse.self, from: data)
            let elevs = decoded.results.map { $0.elevation }
            let minE = elevs.min() ?? 0
            let maxE = elevs.max() ?? 0
            print("Open Elevation: \(elevs.count) pts, range \(String(format: "%.1f", minE))m - \(String(format: "%.1f", maxE))m")
            return elevs
        } catch {
            print("Open Elevation error: \(error)")
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

            var components = URLComponents(string: "https://api.open-meteo.com/v1/elevation")!
            components.queryItems = [
                URLQueryItem(name: "latitude", value: lats),
                URLQueryItem(name: "longitude", value: lngs)
            ]

            guard let url = components.url else {
                allElevations.append(contentsOf: Array(repeating: 0, count: chunk.count))
                continue
            }

            print("Open-Meteo: requesting \(chunk.count) points")

            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                let decoded = try JSONDecoder().decode(OpenMeteoElevationResponse.self, from: data)
                print("Open-Meteo: got \(decoded.elevation.count) elevations")
                allElevations.append(contentsOf: decoded.elevation)
            } catch {
                print("Open-Meteo error: \(error)")
                allElevations.append(contentsOf: Array(repeating: 0, count: chunk.count))
            }
        }

        return allElevations
    }

    // MARK: - Route Sampling

    private func sampleRoutePoints(route: MKRoute, count: Int) -> [CLLocationCoordinate2D] {
        let polyline = route.polyline
        let pointCount = polyline.pointCount
        guard pointCount > 1 else { return [] }

        var allPoints: [CLLocationCoordinate2D] = []
        let mapPoints = polyline.points()
        for i in 0..<pointCount {
            allPoints.append(mapPoints[i].coordinate)
        }

        var cumDist: [Double] = [0]
        for i in 1..<allPoints.count {
            let loc1 = CLLocation(latitude: allPoints[i-1].latitude, longitude: allPoints[i-1].longitude)
            let loc2 = CLLocation(latitude: allPoints[i].latitude, longitude: allPoints[i].longitude)
            cumDist.append(cumDist.last! + loc1.distance(from: loc2))
        }

        let totalDist = cumDist.last ?? 1
        var sampled: [CLLocationCoordinate2D] = []

        for i in 0..<count {
            let targetDist = totalDist * Double(i) / Double(count - 1)
            var segIdx = 0
            while segIdx < cumDist.count - 1 && cumDist[segIdx + 1] < targetDist {
                segIdx += 1
            }
            if segIdx >= allPoints.count - 1 {
                sampled.append(allPoints.last!)
                continue
            }
            let segLen = cumDist[segIdx + 1] - cumDist[segIdx]
            let t = segLen > 0 ? (targetDist - cumDist[segIdx]) / segLen : 0
            let lat = allPoints[segIdx].latitude + t * (allPoints[segIdx + 1].latitude - allPoints[segIdx].latitude)
            let lon = allPoints[segIdx].longitude + t * (allPoints[segIdx + 1].longitude - allPoints[segIdx].longitude)
            sampled.append(CLLocationCoordinate2D(latitude: lat, longitude: lon))
        }

        return sampled
    }

    // MARK: - Elevation Profile

    private func buildElevationProfile(points: [CLLocationCoordinate2D],
                                        elevations: [Double],
                                        totalDistance: Double) -> [ElevationPoint] {
        guard points.count == elevations.count, points.count >= 3 else { return [] }

        var smoothed = elevations
        for i in 1..<(elevations.count - 1) {
            smoothed[i] = (elevations[i-1] + elevations[i] + elevations[i+1]) / 3.0
        }

        let totalMiles = totalDistance * 0.000621371
        var profile: [ElevationPoint] = []

        for i in 0..<points.count {
            let dist = totalMiles * Double(i) / Double(points.count - 1)
            var grade = 0.0
            if i > 0 {
                let loc1 = CLLocation(latitude: points[i-1].latitude, longitude: points[i-1].longitude)
                let loc2 = CLLocation(latitude: points[i].latitude, longitude: points[i].longitude)
                let segDist = loc1.distance(from: loc2)
                if segDist > 0 {
                    grade = ((smoothed[i] - smoothed[i-1]) / segDist) * 100
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

    // MARK: - Per-Segment Physics Energy

    /// Compute energy (kWh) for a single segment using physics:
    ///   F_roll  = Crr × m × g × cos(θ)
    ///   F_aero  = 0.5 × ρ × Cd × A × v²
    ///   F_grade = m × g × sin(θ)
    ///
    /// Speed comes from MKRoute.expectedTravelTime (Apple uses speed limits),
    /// adjusted per-segment for steep grades.
    private func segmentEnergy(
        profile: [ElevationPoint], index i: Int,
        vehicle: EVVehicle, avgSpeedMps: Double
    ) -> Double {
        let segDistMiles = profile[i].distance - profile[i - 1].distance
        let segDistMeters = segDistMiles * EVConstants.metersPerMile
        let gradePct = profile[i].grade
        let theta = atan(gradePct / 100.0)

        // Adjust speed for steep grades
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

        if segEnergyJoules > 0 {
            return segEnergyJoules / (EVConstants.joulesPerKwh * EVConstants.drivetrainEfficiency)
        } else {
            return segEnergyJoules / EVConstants.joulesPerKwh * vehicle.regenEff
        }
    }

    /// Physics-based total energy estimation for a route.
    private func estimateEnergy(profile: [ElevationPoint], route: MKRoute, vehicle: EVVehicle) -> EnergyResult {
        let avgSpeedMps = route.distance / max(1, route.expectedTravelTime)

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
                profile: profile, index: i, vehicle: vehicle, avgSpeedMps: avgSpeedMps
            )
        }

        let totalKwh = max(0.1, totalEnergy)
        let avgGrade = grades.isEmpty ? 0 : grades.reduce(0, +) / Double(grades.count)

        return EnergyResult(totalKwh: totalKwh, gain: totalGain, loss: totalLoss, avgGrade: avgGrade, peakGrade: peakGrade)
    }

    // MARK: - Route Scoring

    private func computeScore(energy: EnergyResult, route: MKRoute) -> Double {
        let energyScore = energy.totalKwh * 0.80
        let timeScore = (route.expectedTravelTime / 3600) * 0.10
        let gradeScore = energy.peakGrade * 0.05
        return energyScore + timeScore + gradeScore
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
