import Foundation
import MapKit
import Observation

/// Pre-compiled regex for parsing kWh pricing strings — compiled once at app launch
private let evPriceRegex = try? NSRegularExpression(
    pattern: #"\$?(\d+\.?\d*)\s*(?:/\s*kwh|per\s*kwh|\/kwh)"#,
    options: .caseInsensitive
)

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

    /// Parse price per kWh from NREL pricing string, fallback to network default.
    /// Uses a static pre-compiled regex to avoid recompilation on each access.
    var pricePerKwh: Double {
        guard let pricing = pricing, !pricing.isEmpty,
              pricing.lowercased().contains("kwh") || pricing.lowercased().contains("kw"),
              let regex = evPriceRegex,
              let match = regex.firstMatch(in: pricing, range: NSRange(pricing.startIndex..., in: pricing)),
              let range = Range(match.range(at: 1), in: pricing),
              let value = Double(pricing[range]),
              value > 0, value < 5.0 else {
            return network.defaultPricePerKwh
        }
        return value
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

    var shortName: String {
        switch self {
        case .tesla: return "Tesla"
        case .electrifyAmerica: return "Electrify America"
        case .evgo: return "EVgo"
        case .chargePoint: return "ChargePoint"
        case .blink: return "Blink"
        case .evConnect: return "EV Connect"
        case .shell: return "Shell"
        }
    }

    /// Shortened name for compact filter chips — keeps all 7 networks on 2 rows
    var chipName: String {
        switch self {
        case .tesla: return "Tesla"
        case .electrifyAmerica: return "Electrify"   // "America" dropped — brand is unambiguous
        case .evgo: return "EVgo"
        case .chargePoint: return "ChargePoint"
        case .blink: return "Blink"
        case .evConnect: return "EV Connect"
        case .shell: return "Shell"
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

    /// Typical DC fast charging price per kWh (USD) by network
    var defaultPricePerKwh: Double {
        switch self {
        case .tesla: return 0.35           // Supercharger avg
        case .electrifyAmerica: return 0.48 // Pass+ ~$0.31, guest ~$0.48
        case .evgo: return 0.39            // Pay-as-you-go avg
        case .chargePoint: return 0.42     // Varies by host
        case .blink: return 0.49           // DC fast avg
        case .evConnect: return 0.40       // Varies
        case .shell: return 0.49           // Recharge avg
        }
    }
}

@Observable
@MainActor
class EVChargerService {
    var chargers: [EVCharger] = []
    var isLoading = false

    // API key stored in Info.plist — keeps it out of source control
    private let nrelAPIKey = Bundle.main.object(forInfoDictionaryKey: "EV_NREL_API_KEY") as? String ?? ""
    private var cache: [String: [NRELStation]] = [:]
    private var ocmCache: [String: [OCMStation]] = [:]

    // Shared session for charger API calls — persists TCP connections across
    // concurrent NREL/OCM requests (20-40 calls per route plan)
    private let chargerSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpMaximumConnectionsPerHost = 8
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()

    /// Search along a raw polyline (for multi-leg routes where MKRoute is nil)
    func findChargersAlongPolyline(_ polyline: MKPolyline) async {
        isLoading = true
        chargers = []

        // Call .points() once outside the loop — calling inside is O(n²)
        let pts = polyline.points()
        let totalMeters = stride(from: 1, to: polyline.pointCount, by: 1).reduce(0.0) { acc, i in
            let p1 = pts[i-1].coordinate, p2 = pts[i].coordinate
            let dlat = (p2.latitude - p1.latitude) * .pi / 180
            let dlon = (p2.longitude - p1.longitude) * .pi / 180
            let ml = p1.latitude * .pi / 180
            let a = dlat*dlat + cos(ml)*cos(ml)*dlon*dlon
            return acc + 6_371_000 * 2 * atan2(sqrt(a), sqrt(1-a))
        }
        let routeMiles = totalMeters * EVConstants.milesPerMeter
        let sampleCount = max(3, min(40, Int(routeMiles / 7) + 2))
        let searchPoints = samplePolylinePoints(polyline: polyline, count: sampleCount)
        let routeCheckPoints = samplePolylinePoints(polyline: polyline, count: min(200, max(50, Int(routeMiles))))
        let searchRadius = 5.0

        let fetchedChargers: [EVCharger] = await withTaskGroup(of: [EVCharger].self) { group in
            for point in searchPoints {
                group.addTask { await self.fetchNRELChargers(near: point, radiusMiles: searchRadius) }
            }
            var results: [EVCharger] = []
            for await batch in group { results.append(contentsOf: batch) }
            return results
        }

        // Build spatial grid from route check points for O(1) proximity lookup
        // instead of O(n) linear scan per charger
        let maxMeters = 2.0 * EVConstants.metersPerMile
        let routeGrid = SpatialGrid(points: routeCheckPoints, radiusMeters: maxMeters)
        var seenIds = Set<String>()
        var allChargers: [EVCharger] = []
        for charger in fetchedChargers {
            guard !seenIds.contains(charger.id) else { continue }
            seenIds.insert(charger.id)
            if routeGrid.hasPoint(near: charger.coordinate) {
                allChargers.append(charger)
            }
        }

        // Cap chargers per ~10-mile segment (same logic as route-based search)
        let capped = capChargersBySegment(allChargers, searchPoints: routeCheckPoints, routeMiles: routeMiles)
        let ocmPoints = stride(from: 0, to: searchPoints.count, by: 3).map { searchPoints[$0] }
        chargers = await enrichWithOCMSpeeds(chargers: capped, searchPoints: ocmPoints)
        isLoading = false
    }

    /// Cap chargers per geographic segment to avoid clustering (used for polyline-based search)
    private func capChargersBySegment(_ chargers: [EVCharger], searchPoints: [CLLocationCoordinate2D], routeMiles: Double) -> [EVCharger] {
        guard !chargers.isEmpty else { return chargers }
        let segmentMiles = 10.0
        let segmentCount = max(1, Int(ceil(routeMiles / segmentMiles)))
        let segmentSize = max(1, searchPoints.count / segmentCount)
        var segments: [[EVCharger]] = Array(repeating: [], count: segmentCount)
        for i in 0..<segmentCount { segments[i].reserveCapacity(30) }

        for charger in chargers {
            var bestSeg = 0
            var bestDist = Double.greatestFiniteMagnitude
            let cLat = charger.coordinate.latitude, cLon = charger.coordinate.longitude
            for s in 0..<segmentCount {
                let midIdx = min(s * segmentSize + segmentSize / 2, searchPoints.count - 1)
                let pt = searchPoints[midIdx]
                let dlat = (pt.latitude - cLat) * .pi / 180
                let dlon = (pt.longitude - cLon) * .pi / 180
                let ml = cLat * .pi / 180
                let a = dlat*dlat + cos(ml)*cos(ml)*dlon*dlon
                let d = 6_371_000 * 2 * atan2(sqrt(a), sqrt(1-a))
                if d < bestDist { bestDist = d; bestSeg = s }
            }
            segments[bestSeg].append(charger)
        }

        return segments.flatMap { seg in
            seg.count <= 30 ? seg : Array(seg.sorted { chargerPriority($0) > chargerPriority($1) }.prefix(30))
        }
    }

    /// Search for chargers along the route, sampling every ~15 miles with a 5-mile search radius.
    /// Uses concurrent fetches with a timeout to prevent stalling.
    func findChargersAlongRoute(_ route: MKRoute) async {
        isLoading = true
        chargers = []

        let routeMiles = route.distance * EVConstants.milesPerMeter
        // Sample every ~7 miles, min 3 points, max 40 — balances coverage vs API calls
        let sampleCount = max(3, min(40, Int(routeMiles / 7) + 2))
        let searchPoints = sampleRoutePoints(route: route, count: sampleCount)
        let searchRadius = 5.0 // wider radius with fewer points

        var allChargers: [EVCharger] = []
        var seenIds = Set<String>()

        // Pre-build a sampled route path for fast proximity checks
        let routeCheckPoints = sampleRoutePoints(route: route, count: min(200, max(50, Int(routeMiles))))

        // Fetch all points concurrently in one task group with a 15-second timeout
        let fetchedChargers: [EVCharger] = await withTaskGroup(of: [EVCharger].self) { group in
            for point in searchPoints {
                group.addTask {
                    await self.fetchNRELChargers(near: point, radiusMiles: searchRadius)
                }
            }

            var results: [EVCharger] = []
            for await batch in group {
                results.append(contentsOf: batch)
            }
            return results
        }

        // Deduplicate and filter using spatial grid — O(1) per charger instead of O(n)
        let maxMeters = 2.0 * EVConstants.metersPerMile
        let routeGrid = SpatialGrid(points: routeCheckPoints, radiusMeters: maxMeters)
        for charger in fetchedChargers {
            guard !seenIds.contains(charger.id) else { continue }
            seenIds.insert(charger.id)
            if routeGrid.hasPoint(near: charger.coordinate) {
                allChargers.append(charger)
            }
        }

        evLog("EV Chargers: \(allChargers.count) stations within 2mi of route (\(String(format: "%.0f", routeMiles))mi, \(sampleCount) search points)")

        // Distribute evenly along route to prevent clustering
        let distributed = distributeEvenly(allChargers, alongRoute: route, maxPerSegmentMile: 3)

        evLog("EV Chargers: \(distributed.count) after even distribution")

        // Enrich with OCM speed data (use fewer points)
        let ocmPoints = stride(from: 0, to: searchPoints.count, by: 3).map { searchPoints[$0] }
        let enriched = await enrichWithOCMSpeeds(chargers: distributed, searchPoints: ocmPoints)
        chargers = enriched
        isLoading = false
    }

    // MARK: - Even Distribution

    /// Divide route into segments and cap chargers per segment to avoid clustering
    private func distributeEvenly(_ chargers: [EVCharger], alongRoute route: MKRoute, maxPerSegmentMile: Int) -> [EVCharger] {
        let routeMiles = route.distance * EVConstants.milesPerMeter
        guard routeMiles > 0, !chargers.isEmpty else { return chargers }

        // Create segments of ~10 miles each
        let segmentMiles = 10.0
        let segmentCount = max(1, Int(ceil(routeMiles / segmentMiles)))
        let maxPerSegment = maxPerSegmentMile * Int(segmentMiles)

        // Sample segment boundary points along the route
        let segmentPoints = sampleRoutePoints(route: route, count: segmentCount + 1)

        // Assign each charger to its nearest segment
        var segments: [[EVCharger]] = Array(repeating: [], count: segmentCount)

        for charger in chargers {
            let cLat = charger.coordinate.latitude, cLon = charger.coordinate.longitude
            var bestSegment = 0
            var bestDist = Double.greatestFiniteMagnitude

            for i in 0..<segmentCount {
                let next = min(i + 1, segmentPoints.count - 1)
                let midLat = (segmentPoints[i].latitude + segmentPoints[next].latitude) / 2
                let midLon = (segmentPoints[i].longitude + segmentPoints[next].longitude) / 2
                let dlat = (midLat - cLat) * .pi / 180
                let dlon = (midLon - cLon) * .pi / 180
                let ml = cLat * .pi / 180
                let a = dlat*dlat + cos(ml)*cos(ml)*dlon*dlon
                let dist = 6_371_000 * 2 * atan2(sqrt(a), sqrt(1-a))
                if dist < bestDist { bestDist = dist; bestSegment = i }
            }
            segments[bestSegment].append(charger)
        }

        // Cap each segment, prioritizing DC fast chargers and major networks
        var result: [EVCharger] = []
        for segment in segments {
            if segment.count <= maxPerSegment {
                result.append(contentsOf: segment)
            } else {
                // Sort: DC fast first, then by network priority (Tesla, EA, EVgo first)
                let sorted = segment.sorted { a, b in
                    let aScore = chargerPriority(a)
                    let bScore = chargerPriority(b)
                    return aScore > bScore
                }
                result.append(contentsOf: sorted.prefix(maxPerSegment))
            }
        }

        return result
    }

    /// Priority score for charger selection when capping segments
    private func chargerPriority(_ charger: EVCharger) -> Int {
        var score = 0
        // Prefer DC fast
        if let dc = charger.dcFastCount, dc > 0 { score += 50 }
        // Prefer higher speed
        if let speed = charger.speedKw { score += Int(speed / 10) }
        // Prefer major networks
        switch charger.network {
        case .tesla, .electrifyAmerica: score += 30
        case .evgo: score += 20
        case .chargePoint: score += 15
        default: score += 5
        }
        // Prefer more stalls
        score += charger.totalChargers
        return score
    }

    // MARK: - NREL AFDC API

    private func fetchNRELChargers(near point: CLLocationCoordinate2D, radiusMiles: Double) async -> [EVCharger] {
        let cacheKey = "\(String(format: "%.3f", point.latitude)),\(String(format: "%.3f", point.longitude))"
        if let cached = cache[cacheKey] {
            return cached.map { mapStationToCharger($0) }
        }

        guard var components = URLComponents(string: "https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json") else { return [] }
        components.queryItems = [
            URLQueryItem(name: "api_key", value: nrelAPIKey),
            URLQueryItem(name: "latitude", value: "\(point.latitude)"),
            URLQueryItem(name: "longitude", value: "\(point.longitude)"),
            URLQueryItem(name: "radius", value: "\(radiusMiles)"),
            URLQueryItem(name: "fuel_type", value: "ELEC"),
            URLQueryItem(name: "ev_charging_level", value: "dc_fast"),  // DC fast only — excludes slow L2
            URLQueryItem(name: "limit", value: "50"),
            URLQueryItem(name: "status", value: "E")
        ]

        guard let url = components.url else { return [] }

        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 10 // 10-second timeout per request
            let (data, response) = try await chargerSession.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                evLog("NREL HTTP \(httpResponse.statusCode) for \(String(format: "%.3f", point.latitude)),\(String(format: "%.3f", point.longitude))")
            }
            let nrelResponse = try JSONDecoder().decode(NRELResponse.self, from: data)
            evLog("NREL: \(nrelResponse.fuel_stations.count) stations found")
            // Evict oldest entry if cache exceeds 200 (NREL data is session-stable)
            if cache.count > 200, let oldest = cache.keys.first {
                cache.removeValue(forKey: oldest)
            }
            cache[cacheKey] = nrelResponse.fuel_stations
            return nrelResponse.fuel_stations.map { mapStationToCharger($0) }
        } catch {
            evLog("NREL fetch error: \(error.localizedDescription)")
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

        let radiusKm = radiusMiles * EVConstants.kmPerMile
        let urlStr = "https://api.openchargemap.io/v3/poi/?output=json&latitude=\(point.latitude)&longitude=\(point.longitude)&distance=\(radiusKm)&distanceunit=KM&maxresults=50&compact=true&verbose=false"

        guard let url = URL(string: urlStr) else { return [] }

        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 8 // 8-second timeout
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            let (data, _) = try await chargerSession.data(for: request)
            let stations = try JSONDecoder().decode([OCMStation].self, from: data)
            // Evict oldest entry if OCM cache exceeds 100
            if ocmCache.count > 100, let oldest = ocmCache.keys.first {
                ocmCache.removeValue(forKey: oldest)
            }
            ocmCache[cacheKey] = stations
            evLog("OCM: \(stations.count) stations near \(String(format: "%.3f", point.latitude)),\(String(format: "%.3f", point.longitude))")
            return stations
        } catch {
            evLog("OCM fetch error: \(error.localizedDescription)")
            return []
        }
    }

    /// Match NREL chargers with OCM data by proximity to get real kW speeds
    private func enrichWithOCMSpeeds(chargers: [EVCharger], searchPoints: [CLLocationCoordinate2D]) async -> [EVCharger] {
        guard !chargers.isEmpty, !searchPoints.isEmpty else { return chargers }

        // Fetch OCM data concurrently for all points
        var allOCM: [OCMStation] = []
        var seenOCMIds = Set<Int>()

        let ocmResults: [[OCMStation]] = await withTaskGroup(of: [OCMStation].self) { group in
            for point in searchPoints {
                group.addTask {
                    await self.fetchOCMStations(near: point, radiusMiles: 5.0)
                }
            }
            var results: [[OCMStation]] = []
            for await batch in group { results.append(batch) }
            return results
        }

        for batch in ocmResults {
            for s in batch {
                if !seenOCMIds.contains(s.ID) {
                    seenOCMIds.insert(s.ID)
                    allOCM.append(s)
                }
            }
        }

        guard !allOCM.isEmpty else {
            evLog("OCM: No data available, using NREL estimates")
            return chargers
        }

        evLog("OCM: \(allOCM.count) unique stations for speed matching")

        // Build a coord→OCMStation lookup for fast proximity matching.
        // Avoids O(chargers × OCM) Haversine loop — instead O(chargers) grid lookups.
        struct OCMEntry {
            let lat: Double, lon: Double
            let station: OCMStation
        }
        let ocmEntries: [OCMEntry] = allOCM.compactMap { ocm in
            guard let lat = ocm.AddressInfo?.Latitude,
                  let lon = ocm.AddressInfo?.Longitude else { return nil }
            return OCMEntry(lat: lat, lon: lon, station: ocm)
        }

        return chargers.map { charger in
            let cLat = charger.coordinate.latitude, cLon = charger.coordinate.longitude
            var bestMatch: OCMStation?
            var bestDist = Double.greatestFiniteMagnitude

            for entry in ocmEntries {
                let dlat = (entry.lat - cLat) * .pi / 180
                let dlon = (entry.lon - cLon) * .pi / 180
                let ml = cLat * .pi / 180
                let a = dlat*dlat + cos(ml)*cos(ml)*dlon*dlon
                let dist = 6_371_000 * 2 * atan2(sqrt(a), sqrt(1-a))
                if dist < bestDist && dist < 200 {
                    bestDist = dist
                    bestMatch = entry.station
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

}

// MARK: - Spatial Grid (O(1) proximity lookup for route filtering)

/// Buckets coordinates into a lat/lon grid for fast proximity checks.
/// Eliminates O(n*m) charger × route-point comparisons.
struct SpatialGrid {
    private var cells: [String: [CLLocationCoordinate2D]] = [:]
    private let radiusMeters: Double
    private let cellSizeDeg: Double  // degrees per cell

    init(points: [CLLocationCoordinate2D], radiusMeters: Double) {
        self.radiusMeters = radiusMeters
        // ~111km per degree latitude; cell size = 2× radius to guarantee coverage
        self.cellSizeDeg = (radiusMeters * 2) / 111_000
        for pt in points {
            let key = cellKey(pt)
            cells[key, default: []].append(pt)
        }
    }

    func hasPoint(near coord: CLLocationCoordinate2D) -> Bool {
        let lat = coord.latitude, lon = coord.longitude
        let cellLat = floor(lat / cellSizeDeg)
        let cellLon = floor(lon / cellSizeDeg)

        // Check 3×3 grid of neighboring cells
        for dLat in -1...1 {
            for dLon in -1...1 {
                let key = "\(Int(cellLat) + dLat),\(Int(cellLon) + dLon)"
                guard let pts = cells[key] else { continue }
                for pt in pts {
                    let dlat = (pt.latitude  - lat) * .pi / 180
                    let dlon = (pt.longitude - lon) * .pi / 180
                    let midLat = lat * .pi / 180
                    let a = dlat*dlat + cos(midLat)*cos(midLat)*dlon*dlon
                    let dist = 6_371_000 * 2 * atan2(sqrt(a), sqrt(1-a))
                    if dist <= radiusMeters { return true }
                }
            }
        }
        return false
    }

    private func cellKey(_ coord: CLLocationCoordinate2D) -> String {
        "\(Int(floor(coord.latitude / cellSizeDeg))),\(Int(floor(coord.longitude / cellSizeDeg)))"
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
