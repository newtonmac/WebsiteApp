import SwiftUI
import MapKit

enum EVMapStyle: String, CaseIterable {
    case standard = "Standard"
    case satellite = "Satellite"
    case hybrid = "Hybrid"

    var icon: String {
        switch self {
        case .standard: return "map"
        case .satellite: return "globe.americas"
        case .hybrid: return "square.stack.3d.up"
        }
    }

    var next: EVMapStyle {
        switch self {
        case .standard: return .satellite
        case .satellite: return .hybrid
        case .hybrid: return .standard
        }
    }
}

struct EVMapContent: View {
    @Binding var cameraPosition: MapCameraPosition
    let routes: [RouteResult]
    let selectedRoute: RouteResult?
    let chargers: [EVCharger]
    let origin: CLLocationCoordinate2D?
    let destination: CLLocationCoordinate2D?
    @Binding var selectedCharger: EVCharger?
    @Binding var mapStyle: EVMapStyle
    let panelHeight: CGFloat

    @State private var showLookAround = false
    @State private var lookAroundScene: MKLookAroundScene?
    @State private var isLoadingLookAround = false

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
        .mapStyle(currentMapStyle)
        .mapControls {
            MapCompass()
            MapScaleView()
        }
        .overlay(alignment: .leading) {
            // Left-side controls stack — out of the way of the bottom panel
            VStack(spacing: 10) {
                // Look Around button
                Button {
                    Task { await loadLookAround() }
                } label: {
                    ZStack {
                        if isLoadingLookAround {
                            ProgressView()
                                .tint(.primary)
                        } else {
                            Image(systemName: "binoculars.fill")
                                .font(.system(size: 18, weight: .medium))
                                .foregroundStyle(.primary)
                        }
                    }
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .shadow(color: .black.opacity(0.15), radius: 4, y: 2)
                }

                // 3D, Map Style, Location
                VStack(spacing: 0) {
                    // 3D / Pitch toggle
                    Button {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            cameraPosition = .camera(
                                MapCamera(
                                    centerCoordinate: currentCenterCoordinate ?? CLLocationCoordinate2D(latitude: 32.72, longitude: -117.16),
                                    distance: 5000,
                                    heading: 0,
                                    pitch: 60
                                )
                            )
                        }
                    } label: {
                        Text("3D")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.primary)
                            .frame(width: 44, height: 44)
                    }

                    Divider().frame(width: 34)

                    // Map style toggle
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            mapStyle = mapStyle.next
                        }
                    } label: {
                        Image(systemName: mapStyle.icon)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(.primary)
                            .frame(width: 44, height: 44)
                    }

                    Divider().frame(width: 34)

                    // Location button
                    Button {
                        cameraPosition = .userLocation(fallback: .automatic)
                    } label: {
                        Image(systemName: "location.fill")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(.blue)
                            .frame(width: 44, height: 44)
                    }
                }
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .shadow(color: .black.opacity(0.15), radius: 4, y: 2)
            }
            .padding(.leading, 12)
        }
        .sheet(isPresented: $showLookAround) {
            if let scene = lookAroundScene {
                LookAroundPreview(scene: .constant(scene))
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    private var currentMapStyle: MapStyle {
        switch mapStyle {
        case .standard:
            return .standard(elevation: .realistic, pointsOfInterest: .excludingAll)
        case .satellite:
            return .imagery(elevation: .realistic)
        case .hybrid:
            return .hybrid(elevation: .realistic, pointsOfInterest: .excludingAll)
        }
    }

    private func loadLookAround() async {
        // Get the center coordinate from the current camera position
        guard let center = currentCenterCoordinate else { return }
        isLoadingLookAround = true
        defer { isLoadingLookAround = false }

        let request = MKLookAroundSceneRequest(coordinate: center)
        do {
            lookAroundScene = try await request.scene
            if lookAroundScene != nil {
                showLookAround = true
            }
        } catch {
            // Look Around not available at this location
        }
    }

    private var currentCenterCoordinate: CLLocationCoordinate2D? {
        // Use destination, origin, or fallback
        if let destination { return destination }
        if let origin { return origin }
        return CLLocationCoordinate2D(latitude: 32.72, longitude: -117.16)
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
                // Charger count badge
                if charger.totalChargers > 0 {
                    Text("\(charger.totalChargers)")
                        .font(.system(size: 7, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(minWidth: 12, minHeight: 12)
                        .background(Circle().fill(EVTheme.accentBlue))
                        .offset(x: 6, y: -6)
                }
            }
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

            // Charger counts and speed
            HStack(spacing: 0) {
                if let dcFast = charger.dcFastCount, dcFast > 0 {
                    VStack(spacing: 4) {
                        Text("DC FAST")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(dcFast)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(EVTheme.accentGreen)
                    }
                    .frame(maxWidth: .infinity)
                }

                if let l2 = charger.level2Count, l2 > 0 {
                    VStack(spacing: 4) {
                        Text("LEVEL 2")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(l2)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(EVTheme.accentBlue)
                    }
                    .frame(maxWidth: .infinity)
                }

                if let speed = charger.speedKw {
                    VStack(spacing: 4) {
                        Text("MAX SPEED")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(Int(speed)) kW")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(speed >= 150 ? EVTheme.accentGreen : EVTheme.accentYellow)
                    }
                    .frame(maxWidth: .infinity)
                }

                if let stalls = charger.stallCount, stalls > 0 {
                    VStack(spacing: 4) {
                        Text("TOTAL")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                        Text("\(stalls)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(EVTheme.textPrimary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.vertical, 8)
            .background(EVTheme.bgInput)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            // Connectors
            if !charger.connectors.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "ev.plug.dc.ccs2")
                        .font(.system(size: 13))
                        .foregroundStyle(EVTheme.textSecondary)
                    Text(charger.connectors.joined(separator: ", "))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(EVTheme.textPrimary)
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
