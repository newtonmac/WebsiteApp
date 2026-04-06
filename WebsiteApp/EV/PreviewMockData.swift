#if DEBUG
import SwiftUI
import MapKit

/// Mock data for Xcode Previews and App Store screenshots
enum PreviewMock {

    // MARK: - Vehicle

    static let vehicle = EVDatabase.vehicles.first { $0.id == "modely_lr" } ?? EVDatabase.vehicles[0]

    // MARK: - Coordinates (San Diego → Los Angeles)

    static let originCoord = CLLocationCoordinate2D(latitude: 32.7157, longitude: -117.1611)
    static let destinationCoord = CLLocationCoordinate2D(latitude: 34.0522, longitude: -118.2437)

    // MARK: - Chargers

    static let chargers: [EVCharger] = [
        EVCharger(
            id: "preview_tesla_1",
            name: "Tesla Supercharger - San Clemente",
            network: .tesla,
            coordinate: CLLocationCoordinate2D(latitude: 33.4270, longitude: -117.6120),
            address: "101 Avenida Del Mar, San Clemente, CA",
            connectors: ["NACS/Tesla"],
            speedKw: 250,
            hours: "24/7",
            pricing: "$0.35/kWh",
            stallCount: 16,
            level2Count: 0,
            dcFastCount: 16
        ),
        EVCharger(
            id: "preview_ea_1",
            name: "Electrify America - Mission Viejo",
            network: .electrifyAmerica,
            coordinate: CLLocationCoordinate2D(latitude: 33.5560, longitude: -117.6630),
            address: "555 The Shops at Mission Viejo, Mission Viejo, CA",
            connectors: ["CCS", "CHAdeMO"],
            speedKw: 350,
            hours: "24/7",
            pricing: "$0.48/kWh",
            stallCount: 10,
            level2Count: 0,
            dcFastCount: 10
        ),
        EVCharger(
            id: "preview_evgo_1",
            name: "EVgo - Irvine Spectrum",
            network: .evgo,
            coordinate: CLLocationCoordinate2D(latitude: 33.6490, longitude: -117.7400),
            address: "670 Spectrum Center Dr, Irvine, CA",
            connectors: ["CCS", "CHAdeMO"],
            speedKw: 200,
            hours: "24/7",
            pricing: nil,
            stallCount: 6,
            level2Count: 2,
            dcFastCount: 4
        ),
        EVCharger(
            id: "preview_cp_1",
            name: "ChargePoint - Anaheim",
            network: .chargePoint,
            coordinate: CLLocationCoordinate2D(latitude: 33.8366, longitude: -117.9143),
            address: "321 W Katella Ave, Anaheim, CA",
            connectors: ["CCS"],
            speedKw: 62,
            hours: "6:00 AM - 11:00 PM",
            pricing: nil,
            stallCount: 4,
            level2Count: 2,
            dcFastCount: 2
        ),
        EVCharger(
            id: "preview_tesla_2",
            name: "Tesla Supercharger - Downey",
            network: .tesla,
            coordinate: CLLocationCoordinate2D(latitude: 33.9425, longitude: -118.1320),
            address: "12050 Lakewood Blvd, Downey, CA",
            connectors: ["NACS/Tesla"],
            speedKw: 250,
            hours: "24/7",
            pricing: "$0.36/kWh",
            stallCount: 20,
            level2Count: 0,
            dcFastCount: 20
        ),
    ]

    // MARK: - Elevation Profile (simulated I-5 corridor)

    static let elevationProfile: [ElevationPoint] = {
        let count = 80
        var points: [ElevationPoint] = []
        let totalMiles = 120.5

        for i in 0..<count {
            let dist = totalMiles * Double(i) / Double(count - 1)
            let fraction = Double(i) / Double(count - 1)

            // Simulated elevation: start at ~50ft, climb through Camp Pendleton/Oceanside hills,
            // dip at San Clemente, climb through OC, settle into LA basin
            let base = 15.0 // meters
            let hill1 = 120.0 * sin(fraction * .pi * 1.5) * max(0, 1 - fraction * 2)
            let hill2 = 80.0 * sin(fraction * .pi * 3.0) * max(0, fraction - 0.3) * 1.5
            let descent = -60.0 * max(0, fraction - 0.7) * 3.0
            let elev = base + hill1 + hill2 + descent

            var grade = 0.0
            if i > 0 {
                let prevElev = points[i - 1].elevation
                let segDist = (totalMiles / Double(count - 1)) * EVConstants.metersPerMile
                grade = ((elev - prevElev) / segDist) * 100
            }

            // Mock coordinate interpolated along a line
            let lat = 32.72 + fraction * 0.5
            let lon = -117.16 + fraction * 0.3
            let coord = CLLocationCoordinate2D(latitude: lat, longitude: lon)

            points.append(ElevationPoint(distance: dist, elevation: max(5, elev), grade: grade, coordinate: coord))
        }
        return points
    }()

    // MARK: - Charging Stops

    static let chargingStops: [ChargingStop] = [
        ChargingStop(
            distanceMiles: 62.0,
            coordinate: CLLocationCoordinate2D(latitude: 33.4270, longitude: -117.6120),
            arrivalBatteryPct: 18.0,
            departureBatteryPct: 80.0,
            energyToAddKwh: 46.5,
            stopNumber: 1,
            estimatedChargeMinutes: 28,
            sectionDistanceMiles: 62.0,
            sectionEnergyKwh: 18.6,
            sectionElevationGain: 220,
            sectionElevationLoss: 180
        )
    ]

    // MARK: - Route Results (preview init, no MKRoute needed)

    /// Long trip: San Diego → Los Angeles, needs 1 charging stop
    static let longTripRoute = RouteResult(
        routeName: "I-5 N",
        distanceMiles: 120.5,
        durationMinutes: 118,
        elevationGain: 340,
        elevationLoss: 310,
        energyKwh: 32.4,
        batteryPctUsed: 43.2,
        efficiency: 3.7,
        averageGrade: 1.8,
        peakGrade: 5.2,
        elevationProfile: elevationProfile,
        score: 26.5,
        chargingStops: chargingStops,
        finalBatteryPct: 36.8,
        finalSection: FinalSection(distanceMiles: 58.5, energyKwh: 13.8, elevationGain: 120, elevationLoss: 130)
    )

    /// Short trip: no charging needed
    static let shortTripRoute = RouteResult(
        routeName: "CA-163 N / I-15 N",
        distanceMiles: 35.2,
        durationMinutes: 38,
        elevationGain: 180,
        elevationLoss: 95,
        energyKwh: 10.1,
        batteryPctUsed: 13.5,
        efficiency: 3.5,
        averageGrade: 1.2,
        peakGrade: 3.8,
        elevationProfile: Array(elevationProfile.prefix(30)),
        score: 8.2,
        chargingStops: [],
        finalBatteryPct: 86.5
    )

    /// Alt route
    static let altRoute = RouteResult(
        routeName: "I-405 N",
        distanceMiles: 128.3,
        durationMinutes: 132,
        elevationGain: 410,
        elevationLoss: 380,
        energyKwh: 36.1,
        batteryPctUsed: 48.1,
        efficiency: 3.6,
        averageGrade: 2.1,
        peakGrade: 6.8,
        elevationProfile: elevationProfile,
        score: 29.1,
        chargingStops: chargingStops,
        finalBatteryPct: 31.9
    )
}

// MARK: - Previews

#Preview("Charger Detail — Tesla") {
    ChargerDetailSheet(charger: PreviewMock.chargers[0])
}

#Preview("Charger Detail — Electrify America") {
    ChargerDetailSheet(charger: PreviewMock.chargers[1])
}

#Preview("Route Card — Best (Charging)") {
    VStack(spacing: 12) {
        EVRouteCard(
            route: PreviewMock.longTripRoute,
            vehicle: PreviewMock.vehicle,
            isBest: true,
            isSelected: true
        )
        EVRouteCard(
            route: PreviewMock.altRoute,
            vehicle: PreviewMock.vehicle,
            isBest: false,
            isSelected: false
        )
    }
    .padding()
    .background(EVTheme.bgPrimary)
    .preferredColorScheme(.dark)
}

#Preview("Route Card — Short Trip") {
    EVRouteCard(
        route: PreviewMock.shortTripRoute,
        vehicle: PreviewMock.vehicle,
        isBest: true,
        isSelected: true
    )
    .padding()
    .background(EVTheme.bgPrimary)
    .preferredColorScheme(.dark)
}

#Preview("Route Detail — Charging Needed") {
    EVRouteDetailView(
        route: PreviewMock.longTripRoute,
        vehicle: PreviewMock.vehicle,
        chargers: PreviewMock.chargers
    )
}

#Preview("Route Detail — No Charging") {
    EVRouteDetailView(
        route: PreviewMock.shortTripRoute,
        vehicle: PreviewMock.vehicle,
        chargers: PreviewMock.chargers
    )
}

#Preview("Vehicle Picker") {
    EVVehiclePickerView(selectedVehicle: .constant(PreviewMock.vehicle))
}
#endif
