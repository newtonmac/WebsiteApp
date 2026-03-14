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
                    Button {
                        selectedCharger = charger
                    } label: {
                        ChargerMarkerView(charger: charger)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
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
        ZStack {
            RoundedRectangle(cornerRadius: 6)
                .fill(networkColor)
                .frame(width: 28, height: 22)
                .shadow(color: networkColor.opacity(0.4), radius: 3)
            Text(charger.network.abbreviation)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(charger.network == .shell ? .black : .white)
        }
    }

    private var networkColor: Color {
        Color(hex: charger.network.color)
    }
}

// MARK: - Charger Detail Sheet

struct ChargerDetailSheet: View {
    let charger: EVCharger

    var body: some View {
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

            Divider()
                .background(EVTheme.border)

            // Details
            HStack(spacing: 20) {
                if !charger.connectors.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("CONNECTORS")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text(charger.connectors.joined(separator: ", "))
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(EVTheme.textPrimary)
                    }
                }

                Spacer()

                if let stalls = charger.stallCount, stalls > 0 {
                    VStack(alignment: .center, spacing: 4) {
                        Text("STALLS")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(stalls)")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(EVTheme.textPrimary)
                    }
                }

                if let speed = charger.speedKw {
                    VStack(alignment: .center, spacing: 4) {
                        Text("SPEED")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(Int(speed)) kW")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(EVTheme.accentGreen)
                    }
                }
            }

            // Hours
            if let hours = charger.hours {
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
            if let pricing = charger.pricing, !pricing.isEmpty {
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

            Spacer()
        }
        .padding(.horizontal, 20)
        .background(EVTheme.bgCard)
        .preferredColorScheme(.dark)
    }
}
