import Foundation
import MapKit
import Observation

struct EVCharger: Identifiable {
    let id: String
    let name: String
    let network: ChargerNetwork
    let coordinate: CLLocationCoordinate2D
    let address: String
    let connectors: [String]
    let speedKw: Double?
    let hours: String?
    let pricing: String?
    let stallCount: Int?
}

enum ChargerNetwork: String, CaseIterable {
    case tesla = "Tesla Supercharger"
    case electrifyAmerica = "Electrify America"
    case evgo = "EVgo"
    case chargePoint = "ChargePoint"
    case blink = "Blink"
    case evConnect = "EV Connect"

    var abbreviation: String {
        switch self {
        case .tesla: return "T"
        case .electrifyAmerica: return "EA"
        case .evgo: return "EG"
        case .chargePoint: return "CP"
        case .blink: return "BL"
        case .evConnect: return "EC"
        }
    }

    var color: String {
        switch self {
        case .tesla: return "#e31937"
        case .electrifyAmerica: return "#0072ce"
        case .evgo: return "#00aaef"
        case .chargePoint: return "#48b84e"
        case .blink: return "#ff6f00"
        case .evConnect: return "#5cbf14"
        }
    }

    var nrelNetworkName: String {
        switch self {
        case .tesla: return "Tesla"
        case .electrifyAmerica: return "Electrify America"
        case .evgo: return "eVgo"
        case .chargePoint: return "ChargePoint"
        case .blink: return "Blink"
        case .evConnect: return "EV Connect"
        }
    }
}

@Observable
class EVChargerService {
    var chargers: [EVCharger] = []
    var isLoading = false

    private let nrelAPIKey = "S8BQYZzqG6TBnADBFb60EYDUiLsRcxgJovLJ76Bg"
    private var cache: [String: [NRELStation]] = [:]

    func findChargersAlongRoute(_ route: MKRoute, radiusMiles: Double = 3.0) async {
        isLoading = true
        chargers = []

        let searchPoints = sampleSearchPoints(route: route, count: 6)
        var allChargers: [EVCharger] = []
        var seenIds = Set<String>()

        await withTaskGroup(of: [EVCharger].self) { group in
            for point in searchPoints {
                group.addTask {
                    await self.fetchNRELChargers(near: point, radiusMiles: radiusMiles)
                }
            }

            for await results in group {
                for charger in results {
                    if !seenIds.contains(charger.id) {
                        seenIds.insert(charger.id)
                        allChargers.append(charger)
                    }
                }
            }
        }

        chargers = allChargers
        isLoading = false
    }

    // MARK: - NREL AFDC API

    private func fetchNRELChargers(near point: CLLocationCoordinate2D, radiusMiles: Double) async -> [EVCharger] {
        let cacheKey = "\(String(format: "%.4f", point.latitude)),\(String(format: "%.4f", point.longitude))"
        if let cached = cache[cacheKey] {
            return cached.map { mapStationToCharger($0) }
        }

        var components = URLComponents(string: "https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json")!
        components.queryItems = [
            URLQueryItem(name: "api_key", value: nrelAPIKey),
            URLQueryItem(name: "latitude", value: "\(point.latitude)"),
            URLQueryItem(name: "longitude", value: "\(point.longitude)"),
            URLQueryItem(name: "radius", value: "\(radiusMiles)"),
            URLQueryItem(name: "fuel_type", value: "ELEC"),
            URLQueryItem(name: "limit", value: "20"),
            URLQueryItem(name: "status", value: "E")
        ]

        guard let url = components.url else { return [] }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(NRELResponse.self, from: data)
            print("NREL: Found \(response.fuel_stations.count) stations near \(String(format: "%.4f", point.latitude)),\(String(format: "%.4f", point.longitude))")
            cache[cacheKey] = response.fuel_stations
            return response.fuel_stations.map { mapStationToCharger($0) }
        } catch {
            print("NREL fetch error: \(error)")
            return []
        }
    }

    private func mapStationToCharger(_ station: NRELStation) -> EVCharger {
        let network = identifyNetwork(station.ev_network ?? "")
        let connectors = parseConnectors(station.ev_connector_types ?? [])

        return EVCharger(
            id: "\(station.id)",
            name: station.station_name,
            network: network,
            coordinate: CLLocationCoordinate2D(latitude: station.latitude, longitude: station.longitude),
            address: [station.street_address, station.city, station.state].compactMap { $0 }.joined(separator: ", "),
            connectors: connectors,
            speedKw: station.ev_dc_fast_num.flatMap { $0 > 0 ? Double($0) * 50 : nil },
            hours: station.access_days_time,
            pricing: station.ev_pricing,
            stallCount: station.ev_dc_fast_num
        )
    }

    private func identifyNetwork(_ networkStr: String) -> ChargerNetwork {
        let lower = networkStr.lowercased()
        if lower.contains("tesla") { return .tesla }
        if lower.contains("electrify") { return .electrifyAmerica }
        if lower.contains("evgo") || lower.contains("e vgo") { return .evgo }
        if lower.contains("chargepoint") { return .chargePoint }
        if lower.contains("blink") { return .blink }
        if lower.contains("ev connect") { return .evConnect }
        return .chargePoint // default
    }

    private func parseConnectors(_ types: [String]) -> [String] {
        types.map { type in
            switch type.uppercased() {
            case "CHADEMO": return "CHAdeMO"
            case "J1772": return "J1772"
            case "J1772COMBO": return "CCS"
            case "TESLA", "NACS": return "NACS/Tesla"
            default: return type
            }
        }
    }

    // MARK: - Helpers

    private func sampleSearchPoints(route: MKRoute, count: Int) -> [CLLocationCoordinate2D] {
        let polyline = route.polyline
        let pointCount = polyline.pointCount
        guard pointCount > 1 else { return [] }

        let mapPoints = polyline.points()
        var points: [CLLocationCoordinate2D] = []

        for i in 0..<count {
            let idx = Int(Double(i) / Double(count - 1) * Double(pointCount - 1))
            points.append(mapPoints[min(idx, pointCount - 1)].coordinate)
        }

        return points
    }

    private func isChargerNearRoute(_ coord: CLLocationCoordinate2D, route: MKRoute, maxDistanceMiles: Double) -> Bool {
        let chargerLoc = CLLocation(latitude: coord.latitude, longitude: coord.longitude)
        let polyline = route.polyline
        let pointCount = polyline.pointCount
        let mapPoints = polyline.points()
        let maxMeters = maxDistanceMiles * 1609.34

        // Check every 10th point for performance
        let step = max(1, pointCount / 50)
        for i in stride(from: 0, to: pointCount, by: step) {
            let routePoint = mapPoints[i].coordinate
            let routeLoc = CLLocation(latitude: routePoint.latitude, longitude: routePoint.longitude)
            if chargerLoc.distance(from: routeLoc) <= maxMeters {
                return true
            }
        }
        return false
    }
}

// MARK: - NREL API Models

struct NRELResponse: Codable {
    let fuel_stations: [NRELStation]
}

struct NRELStation: Codable {
    let id: Int
    let station_name: String
    let latitude: Double
    let longitude: Double
    let street_address: String?
    let city: String?
    let state: String?
    let ev_network: String?
    let ev_connector_types: [String]?
    let ev_dc_fast_num: Int?
    let access_days_time: String?
    let ev_pricing: String?
}
