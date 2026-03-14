import Foundation
import MapKit
import Observation

struct EVCharger: Identifiable, Hashable {
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
    let level2Count: Int?
    let dcFastCount: Int?

    var totalChargers: Int {
        (level2Count ?? 0) + (dcFastCount ?? 0)
    }

    static func == (lhs: EVCharger, rhs: EVCharger) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
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
}

@Observable
class EVChargerService {
    var chargers: [EVCharger] = []
    var isLoading = false

    private let nrelAPIKey = "S8BQYZzqG6TBnADBFb60EYDUiLsRcxgJovLJ76Bg"
    private var cache: [String: [NRELStation]] = [:]
    private var ocmCache: [String: [OCMStation]] = [:]

    /// Search for chargers within 1 mile of the entire route, sampling every ~10 miles
    func findChargersAlongRoute(_ route: MKRoute) async {
        isLoading = true
        chargers = []

        let routeMiles = route.distance * 0.000621371
        // Sample every ~10 miles, minimum 3 points, max 30
        let sampleCount = max(3, min(30, Int(routeMiles / 10) + 1))
        let searchPoints = sampleRoutePoints(route: route, count: sampleCount)
        let searchRadius = 1.5 // search 1.5mi from each point, filter to 1mi from route

        var allChargers: [EVCharger] = []
        var seenIds = Set<String>()

        // Fetch in batches of 5 to avoid overwhelming the API
        let batchSize = 5
        for batchStart in stride(from: 0, to: searchPoints.count, by: batchSize) {
            let batchEnd = min(batchStart + batchSize, searchPoints.count)
            let batch = Array(searchPoints[batchStart..<batchEnd])

            await withTaskGroup(of: [EVCharger].self) { group in
                for point in batch {
                    group.addTask {
                        await self.fetchNRELChargers(near: point, radiusMiles: searchRadius)
                    }
                }

                for await results in group {
                    for charger in results {
                        if !seenIds.contains(charger.id) {
                            seenIds.insert(charger.id)
                            // Only keep chargers within 1 mile of the actual route path
                            if self.isWithinMileOfRoute(charger.coordinate, route: route) {
                                allChargers.append(charger)
                            }
                        }
                    }
                }
            }
        }

        print("EV Chargers: \(allChargers.count) stations within 1 mile of route (\(String(format: "%.0f", routeMiles)) mi, \(sampleCount) search points)")

        // Supplement with Open Charge Map speed data
        let enriched = await enrichWithOCMSpeeds(chargers: allChargers, searchPoints: searchPoints)
        chargers = enriched
        isLoading = false
    }

    // MARK: - NREL AFDC API

    private func fetchNRELChargers(near point: CLLocationCoordinate2D, radiusMiles: Double) async -> [EVCharger] {
        let cacheKey = "\(String(format: "%.3f", point.latitude)),\(String(format: "%.3f", point.longitude))"
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
            let (data, response) = try await URLSession.shared.data(from: url)
            if let httpResponse = response as? HTTPURLResponse {
                print("NREL HTTP \(httpResponse.statusCode) for \(String(format: "%.3f", point.latitude)),\(String(format: "%.3f", point.longitude))")
            }
            let decoder = JSONDecoder()
            let nrelResponse = try decoder.decode(NRELResponse.self, from: data)
            print("NREL: \(nrelResponse.fuel_stations.count) stations found")
            cache[cacheKey] = nrelResponse.fuel_stations
            return nrelResponse.fuel_stations.map { mapStationToCharger($0) }
        } catch {
            print("NREL fetch error: \(error)")
            // Try to print raw response for debugging
            if let url = components.url,
               let (data, _) = try? await URLSession.shared.data(from: url),
               let raw = String(data: data, encoding: .utf8) {
                print("NREL raw response (first 500): \(String(raw.prefix(500)))")
            }
            return []
        }
    }

    private func mapStationToCharger(_ station: NRELStation) -> EVCharger {
        let network = identifyNetwork(station.ev_network ?? "")
        let connectors = parseConnectors(station.ev_connector_types ?? [])
        let dcFast = station.ev_dc_fast_num ?? 0
        let level2 = station.ev_level2_evse_num ?? 0

        // Speed will be filled in by OCM enrichment; use network estimate as fallback for DC Fast
        let speed: Double? = dcFast > 0 ? networkMaxSpeed(network) : nil

        return EVCharger(
            id: "\(station.id)",
            name: station.station_name,
            network: network,
            coordinate: CLLocationCoordinate2D(latitude: station.latitude, longitude: station.longitude),
            address: [station.street_address, station.city, station.state].compactMap { $0 }.joined(separator: ", "),
            connectors: connectors,
            speedKw: speed,
            hours: station.access_days_time,
            pricing: station.ev_pricing,
            stallCount: dcFast + level2,
            level2Count: level2 > 0 ? level2 : nil,
            dcFastCount: dcFast > 0 ? dcFast : nil
        )
    }

    private func networkMaxSpeed(_ network: ChargerNetwork) -> Double {
        switch network {
        case .tesla: return 250
        case .electrifyAmerica: return 350
        case .evgo: return 350
        case .chargePoint: return 240
        case .blink: return 150
        case .evConnect: return 200
        case .shell: return 150
        }
    }

    private func identifyNetwork(_ networkStr: String) -> ChargerNetwork {
        let lower = networkStr.lowercased()
        if lower.contains("tesla") { return .tesla }
        if lower.contains("electrify") { return .electrifyAmerica }
        if lower.contains("evgo") || lower.contains("e vgo") { return .evgo }
        if lower.contains("chargepoint") { return .chargePoint }
        if lower.contains("blink") { return .blink }
        if lower.contains("ev connect") { return .evConnect }
        if lower.contains("shell") || lower.contains("greenlots") { return .shell }
        return .chargePoint
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

    // MARK: - Open Charge Map (speed supplement)

    /// Fetch OCM stations near a point to get real kW data
    private func fetchOCMStations(near point: CLLocationCoordinate2D, radiusMiles: Double) async -> [OCMStation] {
        let cacheKey = "ocm_\(String(format: "%.2f", point.latitude)),\(String(format: "%.2f", point.longitude))"
        if let cached = ocmCache[cacheKey] { return cached }

        let radiusKm = radiusMiles * 1.60934
        let urlStr = "https://api.openchargemap.io/v3/poi/?output=json&latitude=\(point.latitude)&longitude=\(point.longitude)&distance=\(radiusKm)&distanceunit=KM&maxresults=50&compact=true&verbose=false"

        guard let url = URL(string: urlStr) else { return [] }

        do {
            var request = URLRequest(url: url)
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            let (data, _) = try await URLSession.shared.data(for: request)
            let stations = try JSONDecoder().decode([OCMStation].self, from: data)
            ocmCache[cacheKey] = stations
            print("OCM: \(stations.count) stations near \(String(format: "%.3f", point.latitude)),\(String(format: "%.3f", point.longitude))")
            return stations
        } catch {
            print("OCM fetch error: \(error)")
            return []
        }
    }

    /// Match NREL chargers with OCM data by proximity to get real kW speeds
    private func enrichWithOCMSpeeds(chargers: [EVCharger], searchPoints: [CLLocationCoordinate2D]) async -> [EVCharger] {
        // Fetch OCM data for a subset of search points (every other to reduce API calls)
        var allOCM: [OCMStation] = []
        var seenOCMIds = Set<Int>()

        let ocmPoints = stride(from: 0, to: searchPoints.count, by: 3).map { searchPoints[$0] }
        for point in ocmPoints {
            let stations = await fetchOCMStations(near: point, radiusMiles: 2.0)
            for s in stations {
                if !seenOCMIds.contains(s.ID) {
                    seenOCMIds.insert(s.ID)
                    allOCM.append(s)
                }
            }
        }

        guard !allOCM.isEmpty else {
            print("OCM: No data available, using NREL estimates")
            return chargers
        }

        print("OCM: \(allOCM.count) unique stations for speed matching")

        // Match each NREL charger to nearest OCM station within 200m
        return chargers.map { charger in
            let chargerLoc = CLLocation(latitude: charger.coordinate.latitude, longitude: charger.coordinate.longitude)
            var bestMatch: OCMStation?
            var bestDist = Double.greatestFiniteMagnitude

            for ocm in allOCM {
                guard let lat = ocm.AddressInfo?.Latitude, let lon = ocm.AddressInfo?.Longitude else { continue }
                let dist = chargerLoc.distance(from: CLLocation(latitude: lat, longitude: lon))
                if dist < bestDist && dist < 200 { // within 200 meters
                    bestDist = dist
                    bestMatch = ocm
                }
            }

            guard let match = bestMatch else { return charger }

            // Extract max kW from OCM connections
            let maxKw = match.Connections?.compactMap { $0.PowerKW }.max()
            guard let realSpeed = maxKw, realSpeed > 0 else { return charger }

            // Return updated charger with real speed from OCM
            return EVCharger(
                id: charger.id,
                name: charger.name,
                network: charger.network,
                coordinate: charger.coordinate,
                address: charger.address,
                connectors: charger.connectors,
                speedKw: realSpeed,
                hours: charger.hours,
                pricing: charger.pricing,
                stallCount: charger.stallCount,
                level2Count: charger.level2Count,
                dcFastCount: charger.dcFastCount
            )
        }
    }

    // MARK: - Route Sampling

    /// Evenly sample points along the route polyline
    private func sampleRoutePoints(route: MKRoute, count: Int) -> [CLLocationCoordinate2D] {
        let polyline = route.polyline
        let pointCount = polyline.pointCount
        guard pointCount > 1, count > 0 else { return [] }

        let mapPoints = polyline.points()

        // Build cumulative distance array
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

    /// Check if a coordinate is within 1 mile of any point on the route
    private func isWithinMileOfRoute(_ coord: CLLocationCoordinate2D, route: MKRoute) -> Bool {
        let chargerLoc = CLLocation(latitude: coord.latitude, longitude: coord.longitude)
        let polyline = route.polyline
        let pointCount = polyline.pointCount
        let mapPoints = polyline.points()
        let maxMeters = 1609.34 // 1 mile

        // Check every few points along the polyline
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
    let ev_level2_evse_num: Int?
    let ev_dc_fast_num: Int?
    let access_days_time: String?
    let ev_pricing: String?

    enum CodingKeys: String, CodingKey {
        case id, latitude, longitude, city, state
        case station_name, street_address, ev_network
        case ev_connector_types, ev_level2_evse_num, ev_dc_fast_num
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
        ev_level2_evse_num = try? c.decode(Int.self, forKey: .ev_level2_evse_num)
        ev_dc_fast_num = try? c.decode(Int.self, forKey: .ev_dc_fast_num)
        access_days_time = try? c.decode(String.self, forKey: .access_days_time)
        ev_pricing = try? c.decode(String.self, forKey: .ev_pricing)
    }
}

// MARK: - Open Charge Map Models

struct OCMStation: Decodable {
    let ID: Int
    let AddressInfo: OCMAddressInfo?
    let Connections: [OCMConnection]?
}

struct OCMAddressInfo: Decodable {
    let Latitude: Double?
    let Longitude: Double?
}

struct OCMConnection: Decodable {
    let PowerKW: Double?
    let ConnectionTypeID: Int?
    let Quantity: Int?
}
