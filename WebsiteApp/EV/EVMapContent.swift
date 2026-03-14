import SwiftUI
import MapKit

struct EVMapContent: View {
    @Binding var cameraPosition: MapCameraPosition
    let routes: [RouteResult]
    let selectedRoute: RouteResult?
    let chargers: [EVCharger]
    let origin: CLLocationCoordinate2D?
    let destination: CLLocationCoordinate2D?
    @Binding var selectedCharger: EVCharger?

    var body: some View {
        Map(position: $cameraPosition) {
            // Route polylines — alternatives first, selected on top
            ForEach(routes) { route in
                let isSelected = route.id == selectedRoute?.id
                if !isSelected {
                    MapPolyline(route.route.polyline)
                        .stroke(Color.gray.opacity(0.4), lineWidth: 3)
                }
            }

            // Selected route on top
            if let selected = selectedRoute {
                MapPolyline(selected.route.polyline)
                    .stroke(EVTheme.accentBlue, lineWidth: 5)
            }

            // Origin marker
            if let origin {
                Annotation("Start", coordinate: origin) {
                    ZStack {
                        Circle()
                            .fill(EVTheme.accentGreen)
                            .frame(width: 28, height: 28)
                        Circle()
                            .fill(.white)
                            .frame(width: 10, height: 10)
                    }
                    .shadow(color: EVTheme.accentGreen.opacity(0.4), radius: 4)
                }
            }

            // Destination marker
            if let destination {
                Annotation("End", coordinate: destination) {
                    ZStack {
                        Circle()
                            .fill(EVTheme.accentRed)
                            .frame(width: 28, height: 28)
                        Circle()
                            .fill(.white)
                            .frame(width: 10, height: 10)
                    }
                    .shadow(color: EVTheme.accentRed.opacity(0.4), radius: 4)
                }
            }

            // Charging stop markers (for selected route)
            if let selected = selectedRoute {
                ForEach(selected.chargingStops) { stop in
                    Annotation("Charge Stop \(stop.stopNumber)", coordinate: stop.coordinate) {
                        ZStack {
                            Circle()
                                .fill(EVTheme.accentYellow)
                                .frame(width: 30, height: 30)
                            Image(systemName: "bolt.fill")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .shadow(color: EVTheme.accentYellow.opacity(0.5), radius: 4)
                    }
                }
            }

            // Charger markers
            ForEach(chargers) { charger in
                Annotation("", coordinate: charger.coordinate, anchor: .center) {
                    ChargerMarkerView(charger: charger)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectedCharger = charger
                        }
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
        .mapControls {
            MapCompass()
            MapScaleView()
            MapUserLocationButton()
        }
    }
}

struct ChargerMarkerView: View {
    let charger: EVCharger

    var body: some View {
        VStack(spacing: 1) {
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(networkColor)
                    .frame(width: 28, height: 22)
                    .shadow(color: networkColor.opacity(0.4), radius: 3)
                Text(charger.network.abbreviation)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(charger.network == .shell ? .black : .white)
            }
            .overlay(alignment: .topTrailing) {
                // Rating badge if available
                if let rating = charger.rating, rating > 0 {
                    HStack(spacing: 1) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 5))
                        Text(String(format: "%.1f", rating))
                            .font(.system(size: 6, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 3)
                    .padding(.vertical, 1)
                    .background(Capsule().fill(Color.black.opacity(0.7)))
                    .offset(x: 10, y: -8)
                }
            }
            // Open/closed indicator
            if let isOpen = charger.isOpen {
                Circle()
                    .fill(isOpen ? EVTheme.accentGreen : EVTheme.accentRed)
                    .frame(width: 5, height: 5)
            }
        }
    }

    private var networkColor: Color {
        Color(hex: charger.network.color)
    }
}

// MARK: - Charger Detail Sheet (Two-Layer)

struct ChargerDetailSheet: View {
    let charger: EVCharger
    let chargerService: EVChargerService

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Header
                HStack(spacing: 10) {
                    Circle()
                        .fill(Color(hex: charger.network.color))
                        .frame(width: 14, height: 14)
                    Text(charger.name)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(EVTheme.textPrimary)
                        .lineLimit(2)
                }
                .padding(.top, 8)

                // Network
                HStack(spacing: 6) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: charger.network.color))
                    Text(charger.network.rawValue)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color(hex: charger.network.color))
                }

                // Address
                HStack(spacing: 6) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(EVTheme.textSecondary)
                    Text(charger.address)
                        .font(.system(size: 14))
                        .foregroundStyle(EVTheme.textSecondary)
                }

                // Google Places info row (rating, reviews, open status)
                placesInfoRow

                Divider()
                    .background(EVTheme.border)

                // NREL technical details (async loaded)
                nrelDetailsSection

                // Navigate button
                Button {
                    let placemark = MKPlacemark(coordinate: charger.coordinate)
                    let mapItem = MKMapItem(placemark: placemark)
                    mapItem.name = charger.name
                    mapItem.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
                } label: {
                    HStack {
                        Image(systemName: "arrow.triangle.turn.up.right.diamond.fill")
                        Text("Navigate to Charger")
                            .fontWeight(.semibold)
                    }
                    .font(.system(size: 15))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        LinearGradient(colors: [Color(hex: charger.network.color), Color(hex: charger.network.color).opacity(0.7)],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .foregroundStyle(charger.network == .shell ? .black : .white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
        .background(EVTheme.bgCard)
        .preferredColorScheme(.dark)
        .task {
            await chargerService.loadNRELDetails(for: charger)
        }
    }

    // MARK: - Google Places Info

    private var placesInfoRow: some View {
        HStack(spacing: 16) {
            // Rating
            if let rating = charger.rating {
                HStack(spacing: 4) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(EVTheme.accentYellow)
                    Text(String(format: "%.1f", rating))
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(EVTheme.textPrimary)
                    if let count = charger.reviewCount {
                        Text("(\(count))")
                            .font(.system(size: 12))
                            .foregroundStyle(EVTheme.textSecondary)
                    }
                }
            }

            // Open/closed status
            if let isOpen = charger.isOpen {
                HStack(spacing: 4) {
                    Circle()
                        .fill(isOpen ? EVTheme.accentGreen : EVTheme.accentRed)
                        .frame(width: 8, height: 8)
                    Text(isOpen ? "Open Now" : "Closed")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(isOpen ? EVTheme.accentGreen : EVTheme.accentRed)
                }
            }
        }
    }

    // MARK: - NREL Details Section

    @ViewBuilder
    private var nrelDetailsSection: some View {
        if let details = charger.nrelDetails {
            // Stall counts
            HStack(spacing: 0) {
                if details.dcFastCount > 0 {
                    VStack(spacing: 4) {
                        Text("DC FAST")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(details.dcFastCount)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(EVTheme.accentGreen)
                    }
                    .frame(maxWidth: .infinity)
                }

                if details.level2Count > 0 {
                    VStack(spacing: 4) {
                        Text("LEVEL 2")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(details.level2Count)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(EVTheme.accentBlue)
                    }
                    .frame(maxWidth: .infinity)
                }

                if details.level1Count > 0 {
                    VStack(spacing: 4) {
                        Text("LEVEL 1")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(details.level1Count)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(EVTheme.textPrimary)
                    }
                    .frame(maxWidth: .infinity)
                }

                let total = details.dcFastCount + details.level2Count + details.level1Count
                if total > 0 {
                    VStack(spacing: 4) {
                        Text("TOTAL")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(total)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(EVTheme.textPrimary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.vertical, 8)
            .background(EVTheme.bgInput)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            // Connectors with kW
            if !details.connectors.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Image(systemName: "ev.plug.dc.ccs2")
                            .font(.system(size: 13))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("CONNECTORS")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                    }
                    ForEach(details.connectors, id: \.type) { connector in
                        Text(connector.displayString)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(EVTheme.textPrimary)
                            .padding(.leading, 20)
                    }
                }
            }

            // Hours
            if let hours = details.hours {
                HStack(spacing: 6) {
                    Image(systemName: "clock.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(EVTheme.textSecondary)
                    Text(hours)
                        .font(.system(size: 13))
                        .foregroundStyle(EVTheme.textSecondary)
                        .lineLimit(3)
                }
            }

            // Pricing
            if let pricing = details.pricing, !pricing.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(EVTheme.accentYellow)
                    Text(pricing)
                        .font(.system(size: 13))
                        .foregroundStyle(EVTheme.textSecondary)
                        .lineLimit(4)
                }
            }
        } else if chargerService.nrelLoadingIds.contains(charger.id) {
            // Loading state
            HStack(spacing: 10) {
                ProgressView()
                    .tint(EVTheme.textSecondary)
                Text("Loading charger details...")
                    .font(.system(size: 13))
                    .foregroundStyle(EVTheme.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(EVTheme.bgInput)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        } else if chargerService.nrelErrorIds.contains(charger.id) {
            // Error / no NREL data
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .font(.system(size: 13))
                    .foregroundStyle(EVTheme.textSecondary)
                Text("Technical details not available")
                    .font(.system(size: 13))
                    .foregroundStyle(EVTheme.textSecondary)
            }
            .padding(.vertical, 8)
        }
    }
}
