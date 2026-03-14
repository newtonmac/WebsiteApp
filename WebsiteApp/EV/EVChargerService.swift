import Foundation
import MapKit
import Observation

struct EVCharger: Identifiable, Hashable {
    let id: String
    let name: String
    let network: ChargerNetwork
    let coordinate: CLLocationCoordinate2D
    let address: String
    let rating: Double?
    let reviewCount: Int?
    let isOpen: Bool?
    let placeId: String?

    // NREL details (loaded on tap)
    var nrelDetails: NRELChargerDetails?

    var totalChargers: Int {
        (nrelDetails?.level2Count ?? 0) + (nrelDetails?.dcFastCount ?? 0)
    }

    static func == (lhs: EVCharger, rhs: EVCharger) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

struct NRELChargerDetails {
    let dcFastCount: Int
    let level2Count: Int
    let level1Count: Int
    let connectors: [ConnectorDetail]
    let hours: String?
    let pricing: String?
    let nrelNetwork: String?

    struct ConnectorDetail {
        let type: String
        let kw: Double?
        let count: Int?

        var displayString: String {
            var s = type
            if let kw, kw > 0 { s += " \(Int(kw)) kW" }
            if let count, count > 0 { s += " (\(count))" }
            return s
        }
    }
}

enum ChargerNetwork: String, CaseIterable {
    case tesla = "Tesla Supercharger"
    case electrifyAmerica = "Electrify America"
    case evgo = "EVgo"
    case chargePoint = "ChargePoint"
    case blink = "Blink"
    case evConnect = "EV Connect"
    case shell = "Shell Recharge"

    var abbreviation: String {
        switch self {
        case .tesla: return "T"
        case .electrifyAmerica: return "EA"
        case .evgo: return "EG"
        case .chargePoint: return "CP"
        case .blink: return "BL"
        case .evConnect: return "EC"
        case .shell: return "SH"
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
        case .shell: return "#fbce07"
        }
    }

    var searchQuery: String {
        switch self {
        case .tesla: return "Tesla Supercharger"
        case .electrifyAmerica: return "Electrify America charging station"
        case .evgo: return "EVgo charging station"
        case .chargePoint: return "ChargePoint charging station"
        case .blink: return "Blink charging station"
        case .evConnect: return "EV Connect charging station"
        case .shell: return "Shell Recharge charging station"
        }
    }
}

@Observable
class EVChargerService {
    var chargers: [EVCharger] = []
    var isLoading = false

    // NREL detail loading state per charger
    var nrelLoadingIds = Set<String>()
    var nrelErrorIds = Set<String>()

    private let googleAPIKey = "AIzaSyBEjpKpb_xMnZgrkTBOKMefOdaqkmQHS-8"
    private let nrelAPIKey = "S8BQYZzqG6TBnADBFb60EYDUiLsRcxgJovLJ76Bg"
    private var nrelCache: [String: NRELChargerDetails] = [:]
    private var placesCache: [String: [GooglePlaceResult]] = [:]

    // MARK: - Layer 1: Google Places (route discovery)

    func findChargersAlongRoute(_ route: MKRoute) async {
        isLoading = true
        chargers = []

        let routeMiles = route.distance * 0.000621371
        // Sample every ~8 miles, up to 60 points for long routes
        let sampleCount = max(5, min(60, Int(routeMiles / 8) + 1))
        let searchPoints = sampleRoutePoints(route: route, count: sampleCount)
        let searchRadius = 8000 // 8km (~5 miles) radius per point

        var allChargers: [EVCharger] = []
        var seenIds = Set<String>()

        // Single broad query per point — identify network from result names
        let batchSize = 8
        for batchStart in stride(from: 0, to: searchPoints.count, by: batchSize) {
            let batchEnd = min(batchStart + batchSize, searchPoints.count)
            let batch = Array(searchPoints[batchStart..<batchEnd])

            await withTaskGroup(of: [EVCharger].self) { group in
                for point in batch {
                    group.addTask {
                        await self.searchGooglePlaces(query: "EV charging station", near: point, radiusMeters: searchRadius)
                    }
                }

                for await results in group {
                    for charger in results {
                        if !seenIds.contains(charger.id) {
                            seenIds.insert(charger.id)
                            if self.isWithinMileOfRoute(charger.coordinate, route: route) {
                                allChargers.append(charger)
                            }
                        }
                    }
                }
            }
        }

        print("EV Chargers: \(allChargers.count) stations via Google Places (\(String(format: "%.0f", routeMiles)) mi, \(sampleCount) search points)")
        chargers = allChargers
        isLoading = false
    }

    private func searchGooglePlaces(query: String, near point: CLLocationCoordinate2D, radiusMeters: Int) async -> [EVCharger] {
        let cacheKey = "\(String(format: "%.2f", point.latitude)),\(String(format: "%.2f", point.longitude))"
        if let cached = placesCache[cacheKey] {
            return cached.map { mapPlaceToCharger($0) }
        }

        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let urlStr = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=\(point.latitude),\(point.longitude)&radius=\(radiusMeters)&keyword=\(encoded)&type=electric_vehicle_charging_station&key=\(googleAPIKey)"

        guard let url = URL(string: urlStr) else { return [] }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(GooglePlacesResponse.self, from: data)
            if let status = response.status, status != "OK" && status != "ZERO_RESULTS" {
                print("Google Places status: \(status) near \(String(format: "%.3f", point.latitude)),\(String(format: "%.3f", point.longitude))")
            }
            placesCache[cacheKey] = response.results
            return response.results.map { mapPlaceToCharger($0) }
        } catch {
            print("Google Places error: \(error)")
            return []
        }
    }

    private func mapPlaceToCharger(_ place: GooglePlaceResult) -> EVCharger {
        let network = identifyNetwork(place.name)
        return EVCharger(
            id: place.place_id,
            name: place.name,
            network: network,
            coordinate: CLLocationCoordinate2D(latitude: place.geometry.location.lat, longitude: place.geometry.location.lng),
            address: place.vicinity ?? place.formatted_address ?? "",
            rating: place.rating,
            reviewCount: place.user_ratings_total,
            isOpen: place.opening_hours?.open_now,
            placeId: place.place_id
        )
    }

    private func identifyNetwork(_ name: String) -> ChargerNetwork {
        let lower = name.lowercased()
        if lower.contains("tesla") || lower.contains("supercharger") { return .tesla }
        if lower.contains("electrify america") { return .electrifyAmerica }
        if lower.contains("evgo") || lower.contains("ev go") { return .evgo }
        if lower.contains("chargepoint") || lower.contains("charge point") { return .chargePoint }
        if lower.contains("blink") { return .blink }
        if lower.contains("ev connect") { return .evConnect }
        if lower.contains("shell") || lower.contains("greenlots") { return .shell }
        return .chargePoint // default for generic stations
    }

    // MARK: - Layer 2: NREL Details (on tap)

    func loadNRELDetails(for charger: EVCharger) async {
        guard charger.nrelDetails == nil else { return }
        guard !nrelLoadingIds.contains(charger.id) else { return }

        // Check cache first
        if let cached = nrelCache[charger.id] {
            updateChargerDetails(id: charger.id, details: cached)
            return
        }

        nrelLoadingIds.insert(charger.id)
        nrelErrorIds.remove(charger.id)

        let details = await fetchNRELDetails(for: charger)

        if let details {
            nrelCache[charger.id] = details
            updateChargerDetails(id: charger.id, details: details)
        } else {
            nrelErrorIds.insert(charger.id)
        }

        nrelLoadingIds.remove(charger.id)
    }

    private func updateChargerDetails(id: String, details: NRELChargerDetails) {
        if let idx = chargers.firstIndex(where: { $0.id == id }) {
            chargers[idx].nrelDetails = details
        }
    }

    private func fetchNRELDetails(for charger: EVCharger) async -> NRELChargerDetails? {
        var components = URLComponents(string: "https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json")!
        components.queryItems = [
            URLQueryItem(name: "api_key", value: nrelAPIKey),
            URLQueryItem(name: "latitude", value: "\(charger.coordinate.latitude)"),
            URLQueryItem(name: "longitude", value: "\(charger.coordinate.longitude)"),
            URLQueryItem(name: "radius", value: "0.5"),
            URLQueryItem(name: "fuel_type", value: "ELEC"),
            URLQueryItem(name: "limit", value: "10"),
            URLQueryItem(name: "status", value: "E")
        ]

        guard let url = components.url else { return nil }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(NRELResponse.self, from: data)

            // Fuzzy match by name
            let bestMatch = findBestNRELMatch(for: charger.name, in: response.fuel_stations)
            guard let station = bestMatch else {
                print("NREL: No match for '\(charger.name)' among \(response.fuel_stations.count) stations")
                return nil
            }

            print("NREL: Matched '\(charger.name)' -> '\(station.station_name)'")
            return mapStationToDetails(station)
        } catch {
            print("NREL detail fetch error: \(error)")
            return nil
        }
    }

    private func findBestNRELMatch(for name: String, in stations: [NRELStation]) -> NRELStation? {
        guard !stations.isEmpty else { return nil }

        let nameLower = name.lowercased()
        var bestScore = 0
        var bestStation: NRELStation?

        for station in stations {
            let stationLower = station.station_name.lowercased()
            var score = 0

            // Exact match
            if stationLower == nameLower { return station }

            // Contains match
            if stationLower.contains(nameLower) || nameLower.contains(stationLower) {
                score += 50
            }

            // Word overlap
            let nameWords = Set(nameLower.split(separator: " ").map(String.init))
            let stationWords = Set(stationLower.split(separator: " ").map(String.init))
            let overlap = nameWords.intersection(stationWords).count
            score += overlap * 10

            // Network name match
            let networkNames = ["tesla", "supercharger", "electrify", "evgo", "chargepoint", "blink", "shell"]
            for net in networkNames {
                if nameLower.contains(net) && stationLower.contains(net) {
                    score += 30
                }
            }

            if score > bestScore {
                bestScore = score
                bestStation = station
            }
        }

        // Return best match if it has at least some relevance, otherwise return closest station
        return bestScore > 0 ? bestStation : stations.first
    }

    private func mapStationToDetails(_ station: NRELStation) -> NRELChargerDetails {
        let dcFast = station.ev_dc_fast_num ?? 0
        let level2 = station.ev_level2_evse_num ?? 0
        let level1 = station.ev_level1_evse_num ?? 0

        // Build connector details with kW ratings
        var connectors: [NRELChargerDetails.ConnectorDetail] = []
        for type in station.ev_connector_types ?? [] {
            let (displayName, kw) = connectorInfo(type)
            connectors.append(NRELChargerDetails.ConnectorDetail(
                type: displayName,
                kw: kw,
                count: nil
            ))
        }

        return NRELChargerDetails(
            dcFastCount: dcFast,
            level2Count: level2,
            level1Count: level1,
            connectors: connectors,
            hours: station.access_days_time,
            pricing: station.ev_pricing,
            nrelNetwork: station.ev_network
        )
    }

    private func connectorInfo(_ type: String) -> (String, Double?) {
        switch type.uppercased() {
        case "CHADEMO": return ("CHAdeMO", 50)
        case "J1772": return ("J1772", 6.2)
        case "J1772COMBO": return ("CCS", 150)
        case "TESLA", "NACS": return ("NACS/Tesla", 250)
        case "J1772 COMBO": return ("CCS", 150)
        default: return (type, nil)
        }
    }

    // MARK: - Route Sampling

    func sampleRoutePoints(route: MKRoute, count: Int) -> [CLLocationCoordinate2D] {
        let polyline = route.polyline
        let pointCount = polyline.pointCount
        guard pointCount > 1, count > 0 else { return [] }

        let mapPoints = polyline.points()

        var cumDist: [Double] = [0]
        for i in 1..<pointCount {
            let p1 = mapPoints[i-1].coordinate
            let p2 = mapPoints[i].coordinate
            let d = CLLocation(latitude: p1.latitude, longitude: p1.longitude)
                .distance(from: CLLocation(latitude: p2.latitude, longitude: p2.longitude))
            cumDist.append(cumDist.last! + d)
        }

        let totalDist = cumDist.last ?? 1
        var sampled: [CLLocationCoordinate2D] = []

        for i in 0..<count {
            let targetDist = totalDist * Double(i) / Double(max(1, count - 1))
            var segIdx = 0
            while segIdx < cumDist.count - 1 && cumDist[segIdx + 1] < targetDist {
                segIdx += 1
            }
            if segIdx >= pointCount - 1 {
                sampled.append(mapPoints[pointCount - 1].coordinate)
                continue
            }
            let segLen = cumDist[segIdx + 1] - cumDist[segIdx]
            let t = segLen > 0 ? (targetDist - cumDist[segIdx]) / segLen : 0
            let p1 = mapPoints[segIdx].coordinate
            let p2 = mapPoints[segIdx + 1].coordinate
            let lat = p1.latitude + t * (p2.latitude - p1.latitude)
            let lon = p1.longitude + t * (p2.longitude - p1.longitude)
            sampled.append(CLLocationCoordinate2D(latitude: lat, longitude: lon))
        }

        return sampled
    }

    private func isWithinMileOfRoute(_ coord: CLLocationCoordinate2D, route: MKRoute) -> Bool {
        let chargerLoc = CLLocation(latitude: coord.latitude, longitude: coord.longitude)
        let polyline = route.polyline
        let pointCount = polyline.pointCount
        let mapPoints = polyline.points()
        let maxMeters = 1609.34

        let step = max(1, pointCount / 100)
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

// MARK: - Google Places API Models

struct GooglePlacesResponse: Decodable {
    let results: [GooglePlaceResult]
    let status: String?
}

struct GooglePlaceResult: Decodable {
    let place_id: String
    let name: String
    let geometry: GoogleGeometry
    let vicinity: String?
    let formatted_address: String?
    let rating: Double?
    let user_ratings_total: Int?
    let opening_hours: GoogleOpeningHours?
}

struct GoogleGeometry: Decodable {
    let location: GoogleLatLng
}

struct GoogleLatLng: Decodable {
    let lat: Double
    let lng: Double
}

struct GoogleOpeningHours: Decodable {
    let open_now: Bool?
}

// MARK: - NREL API Models

struct NRELResponse: Decodable {
    let fuel_stations: [NRELStation]

    enum CodingKeys: String, CodingKey {
        case fuel_stations
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        fuel_stations = (try? container.decode([NRELStation].self, forKey: .fuel_stations)) ?? []
    }
}

struct NRELStation: Decodable {
    let id: Int
    let station_name: String
    let latitude: Double
    let longitude: Double
    let street_address: String?
    let city: String?
    let state: String?
    let ev_network: String?
    let ev_connector_types: [String]?
    let ev_level1_evse_num: Int?
    let ev_level2_evse_num: Int?
    let ev_dc_fast_num: Int?
    let access_days_time: String?
    let ev_pricing: String?

    enum CodingKeys: String, CodingKey {
        case id, latitude, longitude, city, state
        case station_name, street_address, ev_network
        case ev_connector_types, ev_level1_evse_num, ev_level2_evse_num, ev_dc_fast_num
        case access_days_time, ev_pricing
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        station_name = (try? c.decode(String.self, forKey: .station_name)) ?? "Unknown"
        latitude = try c.decode(Double.self, forKey: .latitude)
        longitude = try c.decode(Double.self, forKey: .longitude)
        street_address = try? c.decode(String.self, forKey: .street_address)
        city = try? c.decode(String.self, forKey: .city)
        state = try? c.decode(String.self, forKey: .state)
        ev_network = try? c.decode(String.self, forKey: .ev_network)
        ev_connector_types = try? c.decode([String].self, forKey: .ev_connector_types)
        ev_level1_evse_num = try? c.decode(Int.self, forKey: .ev_level1_evse_num)
        ev_level2_evse_num = try? c.decode(Int.self, forKey: .ev_level2_evse_num)
        ev_dc_fast_num = try? c.decode(Int.self, forKey: .ev_dc_fast_num)
        access_days_time = try? c.decode(String.self, forKey: .access_days_time)
        ev_pricing = try? c.decode(String.self, forKey: .ev_pricing)
    }
}
