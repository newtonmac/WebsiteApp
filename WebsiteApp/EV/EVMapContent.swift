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
            // Route polylines
            ForEach(routes) { route in
                let isSelected = route.id == selectedRoute?.id
                MapPolyline(route.route.polyline)
                    .stroke(
                        isSelected ? Color.blue : Color.gray.opacity(0.5),
                        lineWidth: isSelected ? 5 : 3
                    )
            }

            // Origin marker
            if let origin {
                Annotation("Start", coordinate: origin) {
                    ZStack {
                        Circle()
                            .fill(.green)
                            .frame(width: 28, height: 28)
                        Circle()
                            .fill(.white)
                            .frame(width: 12, height: 12)
                    }
                    .shadow(radius: 3)
                }
            }

            // Destination marker
            if let destination {
                Annotation("End", coordinate: destination) {
                    ZStack {
                        Circle()
                            .fill(.red)
                            .frame(width: 28, height: 28)
                        Circle()
                            .fill(.white)
                            .frame(width: 12, height: 12)
                    }
                    .shadow(radius: 3)
                }
            }

            // Charger markers
            ForEach(chargers) { charger in
                Annotation(charger.name, coordinate: charger.coordinate) {
                    ChargerMarkerView(charger: charger)
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic))
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
            Text(charger.network.abbreviation)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.white)
        }
        .shadow(radius: 2)
    }

    private var networkColor: Color {
        switch charger.network {
        case .tesla: return Color(red: 0.89, green: 0.10, blue: 0.22)
        case .electrifyAmerica: return Color(red: 0, green: 0.45, blue: 0.81)
        case .evgo: return Color(red: 0, green: 0.67, blue: 0.94)
        case .chargePoint: return Color(red: 0.28, green: 0.72, blue: 0.30)
        case .blink: return Color.orange
        case .evConnect: return Color(red: 0.36, green: 0.75, blue: 0.08)
        }
    }
}
