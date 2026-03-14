import SwiftUI
import MapKit

struct EVMapContent: View {
    @Binding var cameraPosition: MapCameraPosition
    let routes: [RouteResult]
    let selectedRoute: RouteResult?
    let chargers: [EVCharger]
    let origin: CLLocationCoordinate2D?
    let destination: CLLocationCoordinate2D?

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
                Annotation(charger.name, coordinate: charger.coordinate) {
                    ChargerMarkerView(charger: charger)
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
