import Foundation
import MapKit
import Observation

struct RouteResult: Identifiable {
    let id = UUID()
    let route: MKRoute
    let elevationGain: Double      // meters
    let elevationLoss: Double      // meters
    let energyKwh: Double          // total energy consumed
    let batteryPctUsed: Double     // % of battery used
    let efficiency: Double         // miles per kWh
    let averageGrade: Double       // %
    let peakGrade: Double          // %
    let elevationProfile: [ElevationPoint]
    let score: Double              // lower = better

    var distanceMiles: Double { route.distance * 0.000621371 }
    var durationMinutes: Double { route.expectedTravelTime / 60 }
    var remainingBatteryPct: Double { max(0, 100 - batteryPctUsed) }
}

struct ElevationPoint {
    let distance: Double   // cumulative miles
    let elevation: Double  // meters
    let grade: Double      // percent
}

@Observable
class EVRouteService {
    var routes: [RouteResult] = []
    var isLoading = false
    var errorMessage: String?

    private let googleAPIKey = "AIzaSyBEjpKpb_xMnZgrkTBOKMefOdaqkmQHS-8"

    func planRoute(from origin: CLLocationCoordinate2D,
                   to destination: CLLocationCoordinate2D,
                   stops: [CLLocationCoordinate2D] = [],
                   vehicle: EVVehicle) async {
        isLoading = true
        errorMessage = nil
        routes = []

        do {
            let mkRoutes = try await fetchDirections(from: origin, to: destination, stops: stops)
            var results: [RouteResult] = []

            for route in mkRoutes {
                let points = sampleRoutePoints(route: route, count: 80)
                let elevations = await fetchElevations(for: points)
                let profile = buildElevationProfile(points: points, elevations: elevations, totalDistance: route.distance)
                let energy = estimateEnergy(profile: profile, route: route, vehicle: vehicle)
                let score = computeScore(energy: energy, route: route)

                results.append(RouteResult(
                    route: route,
                    elevationGain: energy.gain,
                    elevationLoss: energy.loss,
                    energyKwh: energy.totalKwh,
                    batteryPctUsed: (energy.totalKwh / vehicle.batteryKwh) * 100,
                    efficiency: (route.distance * 0.000621371) / max(energy.totalKwh, 0.01),
                    averageGrade: energy.avgGrade,
                    peakGrade: energy.peakGrade,
                    elevationProfile: profile,
                    score: score
                ))
            }

            routes = results.sorted { $0.score < $1.score }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - MapKit Directions

    private func fetchDirections(from origin: CLLocationCoordinate2D,
                                  to destination: CLLocationCoordinate2D,
                                  stops: [CLLocationCoordinate2D]) async throws -> [MKRoute] {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: origin))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination))
        request.transportType = .automobile
        request.requestsAlternateRoutes = true

        let directions = MKDirections(request: request)
        let response = try await directions.calculate()
        return response.routes
    }

    // MARK: - Elevation (Google Elevation API)

    private func fetchElevations(for points: [CLLocationCoordinate2D]) async -> [Double] {
        let chunkSize = 250
        var allElevations: [Double] = []

        for chunkStart in stride(from: 0, to: points.count, by: chunkSize) {
            let chunkEnd = min(chunkStart + chunkSize, points.count)
            let chunk = Array(points[chunkStart..<chunkEnd])
            let elevations = await fetchElevationChunk(chunk)
            allElevations.append(contentsOf: elevations)
        }

        return allElevations
    }

    private func fetchElevationChunk(_ points: [CLLocationCoordinate2D]) async -> [Double] {
        let locations = points.map { "\($0.latitude),\($0.longitude)" }.joined(separator: "|")
        let urlString = "https://maps.googleapis.com/maps/api/elevation/json?locations=\(locations)&key=\(googleAPIKey)"

        guard let url = URL(string: urlString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? urlString) else {
            return Array(repeating: 0, count: points.count)
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(GoogleElevationResponse.self, from: data)
            if response.status == "OK" {
                return response.results.map { $0.elevation }
            }
        } catch {
            // Fallback: return zeros
        }

        return Array(repeating: 0, count: points.count)
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

        // Calculate cumulative distances
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
            // Find the segment containing this distance
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

        // 3-point moving average smoothing
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

    private func estimateEnergy(profile: [ElevationPoint], route: MKRoute, vehicle: EVVehicle) -> EnergyResult {
        let distMiles = route.distance * 0.000621371
        let baseEnergy = distMiles * vehicle.effKwhMi

        var elevEnergy = 0.0
        var regenEnergy = 0.0
        var totalGain = 0.0
        var totalLoss = 0.0
        var grades: [Double] = []
        var peakGrade = 0.0

        for i in 1..<profile.count {
            let elevDiff = profile[i].elevation - profile[i-1].elevation
            let gradePct = abs(profile[i].grade)
            grades.append(gradePct)
            peakGrade = max(peakGrade, gradePct)

            if elevDiff > 0 {
                // Climbing: motor efficiency degrades with steeper grades
                totalGain += elevDiff
                let motorEff = max(0.60, 0.88 - gradePct * 0.015)
                elevEnergy += (vehicle.weightKg * 9.81 * elevDiff) / (3_600_000 * motorEff)
            } else if elevDiff < 0 {
                // Descending: regen recovery with grade-dependent penalty
                totalLoss += abs(elevDiff)
                let regenPenalty = max(0.30, vehicle.regenEff - gradePct * 0.02)
                regenEnergy += (vehicle.weightKg * 9.81 * abs(elevDiff)) / 3_600_000 * regenPenalty
            }
        }

        let totalKwh = max(0.1, baseEnergy + elevEnergy - regenEnergy)
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

// MARK: - Google Elevation API Models

struct GoogleElevationResponse: Codable {
    let results: [GoogleElevationResult]
    let status: String
}

struct GoogleElevationResult: Codable {
    let elevation: Double
    let location: GoogleLatLng
    let resolution: Double?
}

struct GoogleLatLng: Codable {
    let lat: Double
    let lng: Double
}
