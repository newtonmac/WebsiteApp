import SwiftUI
import MapKit

struct EVMapContent: View {
    @Binding var cameraPosition: MapCameraPosition
    let routes: [RouteResult]
    let selectedRoute: RouteResult?
    let chargers: [EVCharger]
    let origin: CLLocationCoordinate2D?
    let destination: CLLocationCoordinate2D?
    @State private var selectedCharger: EVCharger?

    var body: some View {
        ZStack(alignment: .bottom) {
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
                    Annotation(charger.name, coordinate: charger.coordinate) {
                        ChargerMarkerView(charger: charger)
                            .onTapGesture {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    selectedCharger = selectedCharger?.id == charger.id ? nil : charger
                                }
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

            // Charger detail popup
            if let charger = selectedCharger {
                ChargerDetailPopup(charger: charger) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedCharger = nil
                    }
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .padding(.horizontal, 16)
                .padding(.bottom, UIScreen.main.bounds.height * 0.38)
            }
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

struct ChargerDetailPopup: View {
    let charger: EVCharger
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            HStack {
                // Network color dot
                Circle()
                    .fill(Color(hex: charger.network.color))
                    .frame(width: 12, height: 12)

                Text(charger.name)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(EVTheme.textPrimary)
                    .lineLimit(2)

                Spacer()

                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(EVTheme.textSecondary)
                }
            }

            // Network
            HStack(spacing: 6) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(Color(hex: charger.network.color))
                Text(charger.network.rawValue)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color(hex: charger.network.color))
            }

            // Address
            HStack(spacing: 6) {
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(EVTheme.textSecondary)
                Text(charger.address)
                    .font(.system(size: 12))
                    .foregroundStyle(EVTheme.textSecondary)
            }

            Divider()
                .background(EVTheme.border)

            // Details grid
            HStack(spacing: 16) {
                // Connectors
                if !charger.connectors.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("CONNECTORS")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text(charger.connectors.joined(separator: ", "))
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(EVTheme.textPrimary)
                    }
                }

                Spacer()

                // Stalls
                if let stalls = charger.stallCount, stalls > 0 {
                    VStack(alignment: .trailing, spacing: 3) {
                        Text("STALLS")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(stalls)")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(EVTheme.textPrimary)
                    }
                }

                // Speed
                if let speed = charger.speedKw {
                    VStack(alignment: .trailing, spacing: 3) {
                        Text("SPEED")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(Int(speed)) kW")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(EVTheme.accentGreen)
                    }
                }
            }

            // Hours
            if let hours = charger.hours {
                HStack(spacing: 6) {
                    Image(systemName: "clock.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(EVTheme.textSecondary)
                    Text(hours)
                        .font(.system(size: 12))
                        .foregroundStyle(EVTheme.textSecondary)
                        .lineLimit(2)
                }
            }

            // Pricing
            if let pricing = charger.pricing, !pricing.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(EVTheme.accentYellow)
                    Text(pricing)
                        .font(.system(size: 12))
                        .foregroundStyle(EVTheme.textSecondary)
                        .lineLimit(3)
                }
            }

            // Open in Maps button
            Button {
                let placemark = MKPlacemark(coordinate: charger.coordinate)
                let mapItem = MKMapItem(placemark: placemark)
                mapItem.name = charger.name
                mapItem.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
            } label: {
                HStack {
                    Image(systemName: "arrow.triangle.turn.up.right.diamond.fill")
                    Text("Navigate")
                        .fontWeight(.semibold)
                }
                .font(.system(size: 13))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color(hex: charger.network.color).opacity(0.2))
                .foregroundStyle(Color(hex: charger.network.color))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
        .padding(14)
        .background(EVTheme.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(EVTheme.border, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }
}
