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
    @State private var keyboardHeight: CGFloat = 0
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
            .offset(y: -keyboardHeight)
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: keyboardHeight)
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
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { notification in
            if let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect {
                keyboardHeight = frame.height
                if !panelExpanded {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        panelExpanded = true
                    }
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardHeight = 0
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
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
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
                        if showChargers {
                            Task {
                                await chargerService.findChargersAlongRoute(route.route)
                            }
                        }
                    }
                )
            }

            if let route = selectedRoute {
                navigationButtons(for: route)
                energyBreakdownCard(for: route)
                elevationProfileCard(for: route)
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

    // MARK: - Energy Breakdown Card

    private func energyBreakdownCard(for route: RouteResult) -> some View {
        let vehicle = selectedVehicle
        let baseDriving = route.distanceMiles * vehicle.effKwhMi
        let elevGainFt = Int(route.elevationGain * 3.28084)
        let elevGainM = Int(route.elevationGain)
        let climbingKwh = route.elevationGain > 0
            ? (vehicle.weightKg * 9.81 * route.elevationGain) / (3_600_000 * 0.85)
            : 0
        let regenKwh = route.elevationLoss > 0
            ? (vehicle.weightKg * 9.81 * route.elevationLoss) / 3_600_000 * vehicle.regenEff
            : 0
        let netElevM = route.elevationGain - route.elevationLoss
        let netElevFt = Int(netElevM * 3.28084)
        let remaining = route.remainingBatteryPct

        return VStack(alignment: .leading, spacing: 12) {
            // Vehicle title
            Text(vehicle.displayName.uppercased())
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(EVTheme.accentGreen)

            // Battery bar
            HStack {
                Text("\(Int(vehicle.batteryKwh)) kWh battery")
                    .font(.system(size: 13))
                    .foregroundStyle(EVTheme.textSecondary)
                Spacer()
                Text("\(Int(remaining))% remaining")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(remaining > 40 ? EVTheme.accentGreen : remaining > 20 ? EVTheme.accentYellow : EVTheme.accentRed)
            }

            // Battery usage bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(EVTheme.border)
                    RoundedRectangle(cornerRadius: 8)
                        .fill(EVTheme.accentBlue)
                        .frame(width: geo.size.width * min(1, route.batteryPctUsed / 100))
                    Text("\(String(format: "%.1f", route.energyKwh)) kWh used of \(Int(vehicle.batteryKwh)) kWh")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 22)

            // Energy details
            energyRow(label: "Base driving", value: String(format: "%.1f kWh", baseDriving), color: EVTheme.textPrimary)

            energyRow(
                label: "Climbing (+\(elevGainM)m / +\(elevGainFt)ft ~\(String(format: "%.1f", route.averageGrade))% avg grade)",
                value: String(format: "+%.1f kWh", climbingKwh),
                color: EVTheme.accentYellow
            )

            energyRow(
                label: "Regen braking (-\(Int(route.elevationLoss))m)",
                value: String(format: "-%.1f kWh", regenKwh),
                color: EVTheme.accentGreen
            )

            Rectangle()
                .fill(EVTheme.border)
                .frame(height: 1)

            energyRow(
                label: "Total energy",
                value: "\(String(format: "%.1f", route.energyKwh)) kWh (\(Int(route.batteryPctUsed))% of battery)",
                color: EVTheme.textPrimary,
                bold: true
            )

            energyRow(
                label: "Trip efficiency",
                value: String(format: "%.1f mi/kWh", route.efficiency),
                color: EVTheme.textPrimary
            )

            energyRow(
                label: "Net elevation",
                value: "\(netElevM >= 0 ? "+" : "")\(Int(netElevM))m (\(netElevFt >= 0 ? "+" : "")\(netElevFt)ft)",
                color: EVTheme.textSecondary
            )

            // Summary text
            summaryText(for: route, climbingKwh: climbingKwh, regenKwh: regenKwh)
        }
        .padding(14)
        .background(EVTheme.bgInput)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(EVTheme.border, lineWidth: 1)
        )
    }

    private func energyRow(label: String, value: String, color: Color, bold: Bool = false) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13, weight: bold ? .semibold : .regular))
                .foregroundStyle(EVTheme.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: bold ? .bold : .semibold))
                .foregroundStyle(color)
        }
    }

    private func summaryText(for route: RouteResult, climbingKwh: Double, regenKwh: Double) -> some View {
        let vehicle = selectedVehicle
        var lines: [String] = []

        if route.elevationGain < route.elevationLoss {
            lines.append("This route minimizes climbing to save battery.")
        } else if route.elevationGain > 200 {
            lines.append("This route has significant climbing that increases energy use.")
        }

        if regenKwh > 0.5 {
            lines.append("Regen braking recovers \(String(format: "%.1f", regenKwh)) kWh on downhill sections.")
        }

        if route.remainingBatteryPct > 40 {
            lines.append("Your \(vehicle.displayName) should handle this trip comfortably.")
        } else if route.remainingBatteryPct > 15 {
            lines.append("Your \(vehicle.displayName) can complete this trip but consider charging options.")
        } else if route.needsCharging {
            lines.append("This trip requires \(route.chargingStops.count) charging stop\(route.chargingStops.count == 1 ? "" : "s").")
        }

        return Text(lines.joined(separator: " "))
            .font(.system(size: 12))
            .foregroundStyle(EVTheme.textSecondary)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(EVTheme.accentGreen.opacity(0.08))
            .overlay(
                Rectangle()
                    .fill(EVTheme.accentGreen)
                    .frame(width: 3),
                alignment: .leading
            )
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    // MARK: - Elevation Profile Card

    private func elevationProfileCard(for route: RouteResult) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("ELEVATION PROFILE")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(EVTheme.textPrimary)

            // Gain / Loss labels
            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(EVTheme.accentGreen)
                    Text("+\(Int(route.elevationGain))m gain")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(EVTheme.accentGreen)
                }
                HStack(spacing: 4) {
                    Image(systemName: "arrow.down")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(EVTheme.accentRed)
                    Text("-\(Int(route.elevationLoss))m loss")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(EVTheme.accentRed)
                }
            }

            if !route.elevationProfile.isEmpty {
                ElevationChartView(profile: route.elevationProfile)
                    .frame(height: 160)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                Text("No elevation data available")
                    .font(.caption)
                    .foregroundStyle(EVTheme.textSecondary)
                    .frame(height: 80)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(14)
        .background(EVTheme.bgInput)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(EVTheme.border, lineWidth: 1)
        )
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
