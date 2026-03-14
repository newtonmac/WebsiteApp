import SwiftUI
import MapKit

struct EVRoutePlannerView: View {
    @State private var routeService = EVRouteService()
    @State private var chargerService = EVChargerService()
    @State private var selectedVehicle: EVVehicle = EVDatabase.vehicles[0]
    @State private var originText = ""
    @State private var destinationText = ""
    @State private var originCoord: CLLocationCoordinate2D?
    @State private var destinationCoord: CLLocationCoordinate2D?
    @State private var selectedRoute: RouteResult?
    @State private var showingVehiclePicker = false
    @State private var showingRouteDetail = false
    @State private var detailRoute: RouteResult?
    @State private var isRoundTrip = false
    @State private var showChargers = true
    @State private var panelExpanded = true
    @State private var selectedCharger: EVCharger?
    @GestureState private var dragOffset: CGFloat = 0
    @State private var mapCameraPosition: MapCameraPosition = .region(
        MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 32.72, longitude: -117.16),
                          span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5))
    )

    private let expandedFraction: CGFloat = 0.40
    private let collapsedFraction: CGFloat = 0.10

    private var panelHeight: CGFloat {
        let screenH = UIScreen.main.bounds.height
        let target = panelExpanded ? screenH * expandedFraction : screenH * collapsedFraction
        let dragged = target - dragOffset
        return max(screenH * collapsedFraction, min(screenH * 0.75, dragged))
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            EVTheme.bgPrimary.ignoresSafeArea()

            // Map
            EVMapContent(
                cameraPosition: $mapCameraPosition,
                routes: routeService.routes,
                selectedRoute: selectedRoute,
                chargers: showChargers ? chargerService.chargers : [],
                origin: originCoord,
                destination: destinationCoord,
                selectedCharger: $selectedCharger
            )
            .ignoresSafeArea(edges: .top)

            // Bottom panel
            VStack(spacing: 0) {
                // Drag handle area
                VStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 2.5)
                        .fill(EVTheme.textSecondary.opacity(0.5))
                        .frame(width: 36, height: 5)
                        .padding(.top, 10)

                    HStack(alignment: .center) {
                        Text("EV Route Planner")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [EVTheme.accentGreen, EVTheme.accentBlue],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                        Spacer()
                        Image(systemName: panelExpanded ? "chevron.down" : "chevron.up")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(EVTheme.textSecondary)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
                }
                .contentShape(Rectangle())
                .simultaneousGesture(
                    DragGesture(minimumDistance: 10)
                        .updating($dragOffset) { value, state, _ in
                            state = value.translation.height
                        }
                        .onEnded { value in
                            let threshold: CGFloat = 30
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                if value.translation.height > threshold {
                                    panelExpanded = false
                                } else if value.translation.height < -threshold {
                                    panelExpanded = true
                                }
                            }
                        }
                )
                .simultaneousGesture(
                    TapGesture().onEnded {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            panelExpanded.toggle()
                        }
                    }
                )

                if panelExpanded || dragOffset < -30 {
                    ScrollView {
                        VStack(spacing: 14) {
                            inputSection
                            togglesSection
                            vehicleSection
                            planButton

                            if !routeService.routes.isEmpty {
                                routeResultsSection
                            }

                            if let error = routeService.errorMessage {
                                Text(error)
                                    .font(.caption)
                                    .foregroundStyle(EVTheme.accentRed)
                                    .padding(.horizontal)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 100)
                    }
                }
            }
            .frame(height: panelHeight)
            .background(EVTheme.bgCard)
            .clipShape(.rect(topLeadingRadius: 20, topTrailingRadius: 20))
            .overlay(alignment: .top) {
                UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20)
                    .stroke(EVTheme.border, lineWidth: 1)
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: panelExpanded)
        }
        .ignoresSafeArea(edges: .bottom)
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showingVehiclePicker) {
            EVVehiclePickerView(selectedVehicle: $selectedVehicle)
        }
        .sheet(isPresented: $showingRouteDetail) {
            if let route = detailRoute {
                EVRouteDetailView(route: route, vehicle: selectedVehicle, chargers: chargerService.chargers)
            }
        }
        .sheet(item: $selectedCharger) { charger in
            ChargerDetailSheet(charger: charger)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Input Section

    private var inputSection: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Circle()
                    .fill(EVTheme.accentGreen)
                    .frame(width: 10, height: 10)
                EVLocationSearchField(
                    text: $originText,
                    placeholder: "Origin",
                    coordinate: $originCoord,
                    showGPSButton: true
                )
            }

            HStack(spacing: 8) {
                Circle()
                    .fill(EVTheme.accentRed)
                    .frame(width: 10, height: 10)
                EVLocationSearchField(
                    text: $destinationText,
                    placeholder: "Destination",
                    coordinate: $destinationCoord
                )
            }
        }
    }

    // MARK: - Toggles Section

    private var togglesSection: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                // Round trip toggle
                EVToggleRow(
                    label: "Round Trip",
                    icon: "arrow.triangle.2.circlepath",
                    isOn: $isRoundTrip
                )

                // Show chargers toggle
                EVToggleRow(
                    label: "EV Chargers",
                    icon: "bolt.fill",
                    isOn: $showChargers
                )
            }
            .onChange(of: showChargers) { _, isOn in
                if isOn, let route = selectedRoute, chargerService.chargers.isEmpty {
                    Task {
                        await chargerService.findChargersAlongRoute(route.route)
                    }
                }
            }
        }
    }

    // MARK: - Vehicle Section

    private var vehicleSection: some View {
        Button {
            showingVehiclePicker = true
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(selectedVehicle.displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(EVTheme.textPrimary)
                    HStack(spacing: 8) {
                        Text(selectedVehicle.batteryDescription)
                        Text("•")
                        Text(selectedVehicle.rangeDescription)
                        Text("•")
                        Text("\(String(format: "%.2f", selectedVehicle.effKwhMi)) kWh/mi")
                    }
                    .font(.caption)
                    .foregroundStyle(EVTheme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(EVTheme.textSecondary)
            }
            .padding(12)
            .background(EVTheme.bgInput)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(EVTheme.border, lineWidth: 1)
            )
        }
    }

    // MARK: - Plan Button

    private var planButton: some View {
        Button {
            Task { await planRoute() }
        } label: {
            HStack {
                if routeService.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "bolt.fill")
                }
                Text(routeService.isLoading ? "Planning..." : "Plan Route")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                canPlan
                ? LinearGradient(colors: [EVTheme.btnGradientStart, EVTheme.btnGradientEnd],
                                 startPoint: .topLeading, endPoint: .bottomTrailing)
                : LinearGradient(colors: [EVTheme.border, EVTheme.border],
                                 startPoint: .leading, endPoint: .trailing)
            )
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(!canPlan || routeService.isLoading)
    }

    private var canPlan: Bool {
        originCoord != nil && destinationCoord != nil
    }

    // MARK: - Route Results

    private var routeResultsSection: some View {
        VStack(spacing: 10) {
            ForEach(Array(routeService.routes.enumerated()), id: \.element.id) { index, route in
                EVRouteCard(
                    route: route,
                    vehicle: selectedVehicle,
                    isBest: index == 0,
                    isSelected: selectedRoute?.id == route.id,
                    onInfoTap: {
                        detailRoute = route
                        showingRouteDetail = true
                    },
                    onCardTap: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedRoute = route
                        }
                        fitMapToRoute(route)
                    }
                )
            }

            if let route = selectedRoute {
                navigationButtons(for: route)
            }
        }
    }

    // MARK: - Navigation Buttons

    private func navigationButtons(for route: RouteResult) -> some View {
        VStack(spacing: 8) {
            if let url = googleMapsURL(for: route) {
                Link(destination: url) {
                    HStack {
                        Image(systemName: "map.fill")
                        Text("Open in Google Maps")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        LinearGradient(colors: [Color(hex: "#4285F4"), Color(hex: "#1a73e8")],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(color: Color(hex: "#4285F4").opacity(0.3), radius: 8, y: 4)
                }
            }

            if let url = appleMapsURL(for: route) {
                Link(destination: url) {
                    HStack {
                        Image(systemName: "apple.logo")
                        Text("Open in Apple Maps")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        LinearGradient(colors: [Color(hex: "#555555"), Color(hex: "#333333")],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }

            if let url = wazeURL(for: route) {
                Link(destination: url) {
                    HStack {
                        Image(systemName: "car.fill")
                        Text("Open in Waze")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        LinearGradient(colors: [Color(hex: "#33ccff"), Color(hex: "#05b0f0")],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(color: Color(hex: "#33ccff").opacity(0.3), radius: 8, y: 4)
                }
            }
        }
    }

    // MARK: - Actions

    private func planRoute() async {
        guard let origin = originCoord, let dest = destinationCoord else { return }

        await routeService.planRoute(from: origin, to: dest, vehicle: selectedVehicle)

        if let best = routeService.routes.first {
            selectedRoute = best
            fitMapToRoute(best)
            await chargerService.findChargersAlongRoute(best.route)
        }
    }

    private func fitMapToRoute(_ route: RouteResult) {
        let rect = route.route.polyline.boundingMapRect
        let padded = rect.insetBy(dx: -rect.size.width * 0.1, dy: -rect.size.height * 0.1)
        mapCameraPosition = .rect(padded)
    }

    // MARK: - Deep Links

    private func googleMapsURL(for route: RouteResult) -> URL? {
        guard let origin = originCoord, let dest = destinationCoord else { return nil }
        let urlStr = "https://www.google.com/maps/dir/?api=1&origin=\(origin.latitude),\(origin.longitude)&destination=\(dest.latitude),\(dest.longitude)&travelmode=driving"
        return URL(string: urlStr)
    }

    private func appleMapsURL(for route: RouteResult) -> URL? {
        guard let origin = originCoord, let dest = destinationCoord else { return nil }
        let urlStr = "https://maps.apple.com/?saddr=\(origin.latitude),\(origin.longitude)&daddr=\(dest.latitude),\(dest.longitude)&dirflg=d"
        return URL(string: urlStr)
    }

    private func wazeURL(for route: RouteResult) -> URL? {
        guard let dest = destinationCoord else { return nil }
        let urlStr = "https://www.waze.com/ul?ll=\(dest.latitude),\(dest.longitude)&navigate=yes"
        return URL(string: urlStr)
    }
}

// MARK: - Toggle Row (matches web app style)

struct EVToggleRow: View {
    let label: String
    let icon: String
    @Binding var isOn: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(isOn ? EVTheme.accentGreen : EVTheme.textSecondary)
                .frame(width: 20)

            Text(label)
                .font(.system(size: 13))
                .foregroundStyle(EVTheme.textSecondary)

            Spacer()

            // Custom toggle switch matching web app style
            ZStack(alignment: isOn ? .trailing : .leading) {
                RoundedRectangle(cornerRadius: 10)
                    .fill(isOn ? EVTheme.accentGreen.opacity(0.25) : EVTheme.border)
                    .frame(width: 36, height: 20)

                Circle()
                    .fill(isOn ? EVTheme.accentGreen : EVTheme.textSecondary)
                    .frame(width: 16, height: 16)
                    .padding(.horizontal, 2)
            }
            .animation(.easeInOut(duration: 0.2), value: isOn)
            .onTapGesture {
                isOn.toggle()
            }
        }
        .padding(.vertical, 4)
    }
}
