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
    @State private var showChargers = false
    @State private var panelExpanded = true
    @State private var selectedCharger: EVCharger?
    @State private var mapStyle: EVMapStyle = .standard
    @State private var showingSummarySheet = false
    @State private var summaryPDFData: Data?
    @State private var selectedNetworks: Set<ChargerNetwork> = Set(ChargerNetwork.allCases)
    @State private var keyboardOffset: CGFloat = 0
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @GestureState private var dragOffset: CGFloat = 0
    @State private var mapCameraPosition: MapCameraPosition = .region(
        MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 32.72, longitude: -117.16),
                          span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5))
    )

    private let expandedFraction: CGFloat = 0.50
    private let collapsedFraction: CGFloat = 0.10

    private var mapChargers: [EVCharger] {
        guard showChargers else { return [] }
        let networkFiltered = chargerService.chargers.filter { selectedNetworks.contains($0.network) }

        // If a route with charging stops is selected, only show chargers within 15 miles of stops
        if let route = selectedRoute, route.needsCharging {
            let radiusMeters: Double = 50 * 1609.34
            let stopLocations = route.chargingStops.map {
                CLLocation(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude)
            }
            return networkFiltered.filter { charger in
                let chargerLoc = CLLocation(latitude: charger.coordinate.latitude, longitude: charger.coordinate.longitude)
                return stopLocations.contains { $0.distance(from: chargerLoc) <= radiusMeters }
            }
        }

        return networkFiltered
    }

    private var panelHeight: CGFloat {
        let screenH = UIScreen.main.bounds.height
        let screenW = UIScreen.main.bounds.width
        let isLandscape = screenW > screenH
        let expandFraction: CGFloat = isLandscape ? 0.65 : expandedFraction
        let collapseFraction: CGFloat = isLandscape ? 0.15 : collapsedFraction
        let target = panelExpanded ? screenH * expandFraction : screenH * collapseFraction
        let dragged = target - dragOffset
        return max(screenH * collapseFraction, min(screenH * 0.85, dragged))
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Map
            EVMapContent(
                cameraPosition: $mapCameraPosition,
                routes: routeService.routes,
                selectedRoute: selectedRoute,
                chargers: mapChargers,
                origin: originCoord,
                destination: destinationCoord,
                selectedCharger: $selectedCharger,
                mapStyle: $mapStyle,
                panelHeight: panelHeight
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
                        if verticalSizeClass == .compact {
                            // Landscape: two-column layout with results below
                            VStack(spacing: 14) {
                                HStack(alignment: .top, spacing: 14) {
                                    // Left column: inputs + vehicle + plan button
                                    VStack(spacing: 10) {
                                        inputSection
                                        vehicleSection
                                        planButton
                                    }
                                    .frame(maxWidth: .infinity)

                                    // Right column: toggles + networks
                                    VStack(spacing: 10) {
                                        togglesSection
                                    }
                                    .frame(maxWidth: .infinity)
                                }

                                // Route results span full width below both columns
                                if !routeService.routes.isEmpty {
                                    routeResultsSection
                                }

                                if let error = routeService.errorMessage {
                                    Text(error)
                                        .font(.caption)
                                        .foregroundStyle(EVTheme.accentRed)
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.bottom, 100)
                        } else {
                            // Portrait: single-column layout
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
            }
            .frame(height: panelHeight)
            .background(EVTheme.bgCard)
            .clipShape(.rect(topLeadingRadius: 20, topTrailingRadius: 20))
            .overlay(alignment: .top) {
                UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20)
                    .stroke(EVTheme.border, lineWidth: 1)
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: panelExpanded)
            .offset(y: -keyboardOffset)
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
        .sheet(isPresented: $showingSummarySheet) {
            if let pdfData = summaryPDFData {
                PDFShareSheet(pdfData: pdfData, fileName: "EV_Route_Summary.pdf")
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardDidShowNotification)) { notification in
            if let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect {
                let screenH = UIScreen.main.bounds.height
                // Cap offset so panel top doesn't go above the screen
                let maxOffset = max(0, screenH - panelHeight)
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    keyboardOffset = min(frame.height, maxOffset)
                    panelExpanded = true
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardDidHideNotification)) { _ in
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                keyboardOffset = 0
            }
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
                if isOn, let route = selectedRoute, let mkRoute = route.route, chargerService.chargers.isEmpty {
                    Task {
                        await chargerService.findChargersAlongRoute(mkRoute)
                    }
                }
            }

            // Network filter chips
            if showChargers {
                networkFilterSection
            }
        }
    }

    // MARK: - Network Filter

    private var networkFilterSection: some View {
        GeometryReader { geo in
            let isLandscape = geo.size.width > geo.size.height
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Networks")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(EVTheme.textSecondary)
                    Spacer()
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            if selectedNetworks.count == ChargerNetwork.allCases.count {
                                selectedNetworks.removeAll()
                            } else {
                                selectedNetworks = Set(ChargerNetwork.allCases)
                            }
                        }
                    } label: {
                        Text(selectedNetworks.count == ChargerNetwork.allCases.count ? "None" : "All")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(EVTheme.accentBlue)
                    }
                }

                FlowLayout(spacing: 6) {
                    ForEach(ChargerNetwork.allCases, id: \.self) { network in
                        let isSelected = selectedNetworks.contains(network)
                        Button {
                            withAnimation(.easeInOut(duration: 0.15)) {
                                if isSelected {
                                    selectedNetworks.remove(network)
                                } else {
                                    selectedNetworks.insert(network)
                                }
                            }
                        } label: {
                            HStack(spacing: isLandscape ? 6 : 2) {
                                NetworkIconView(network: network, size: 16)
                                if isLandscape {
                                    Text(network.shortName)
                                        .font(.system(size: 11, weight: .bold))
                                }
                            }
                            .padding(.horizontal, isLandscape ? 10 : 6)
                            .padding(.vertical, 6)
                            .background(isSelected ? Color(hex: network.color).opacity(0.2) : EVTheme.bgInput)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(isSelected ? Color(hex: network.color) : EVTheme.border, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .foregroundStyle(isSelected ? Color(hex: network.color) : EVTheme.textSecondary)
                        }
                    }
                }
            }
            .padding(10)
            .background(EVTheme.bgInput)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(EVTheme.border, lineWidth: 1)
            )
        }
        .frame(height: 80)
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
                        if showChargers, let mkRoute = route.route {
                            Task {
                                await chargerService.findChargersAlongRoute(mkRoute)
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

            Button {
                Task.detached {
                    let pdfData = EVRoutePDFGenerator.generatePDF(
                        route: route,
                        vehicle: selectedVehicle,
                        origin: originText,
                        destination: destinationText,
                        chargers: chargerService.chargers
                    )
                    await MainActor.run {
                        summaryPDFData = pdfData
                        showingSummarySheet = true
                    }
                }
            } label: {
                HStack {
                    Image(systemName: "doc.text.fill")
                    Text("Summary")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    LinearGradient(colors: [Color(hex: "#8b5cf6"), Color(hex: "#6d28d9")],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: Color(hex: "#8b5cf6").opacity(0.3), radius: 8, y: 4)
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
                value: String(format: "%.1f mi/kWh (%.3f kWh/mi)", route.efficiency, route.energyKwh / max(0.1, route.distanceMiles)),
                color: EVTheme.textPrimary
            )

            energyRow(
                label: "Est. electricity cost",
                value: String(format: "$%.2f (@ $0.16/kWh)", route.energyKwh * 0.16),
                color: EVTheme.accentGreen
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
                ElevationChartView(
                    profile: route.elevationProfile,
                    vehicle: selectedVehicle,
                    chargingStops: route.chargingStops,
                    avgSpeedMps: (route.distanceMiles * 1609.34) / max(1, route.durationMinutes * 60)
                )
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
            if let mkRoute = best.route {
                await chargerService.findChargersAlongRoute(mkRoute)
            }
        }
    }

    private func fitMapToRoute(_ route: RouteResult) {
        guard let mkRoute = route.route else { return }
        let rect = mkRoute.polyline.boundingMapRect
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

// MARK: - Network Icon View (Mini brand logos drawn with SwiftUI)

struct NetworkIconView: View {
    let network: ChargerNetwork
    let size: CGFloat

    var body: some View {
        let brandColor = Color(hex: network.color)
        Canvas { context, canvasSize in
            let s = canvasSize.width
            switch network {
            case .tesla:
                // Stylized Tesla "T" – wide top bar + center stem
                var top = Path()
                top.move(to: CGPoint(x: s * 0.1, y: s * 0.12))
                top.addLine(to: CGPoint(x: s * 0.5, y: s * 0.28))
                top.addLine(to: CGPoint(x: s * 0.9, y: s * 0.12))
                top.addLine(to: CGPoint(x: s * 0.5, y: s * 0.22))
                top.closeSubpath()
                context.fill(top, with: .color(brandColor))
                var stem = Path()
                stem.move(to: CGPoint(x: s * 0.42, y: s * 0.25))
                stem.addLine(to: CGPoint(x: s * 0.5, y: s * 0.92))
                stem.addLine(to: CGPoint(x: s * 0.58, y: s * 0.25))
                stem.closeSubpath()
                context.fill(stem, with: .color(brandColor))

            case .electrifyAmerica:
                // Bold lightning bolt
                var bolt = Path()
                bolt.move(to: CGPoint(x: s * 0.6, y: s * 0.05))
                bolt.addLine(to: CGPoint(x: s * 0.2, y: s * 0.52))
                bolt.addLine(to: CGPoint(x: s * 0.48, y: s * 0.48))
                bolt.addLine(to: CGPoint(x: s * 0.38, y: s * 0.95))
                bolt.addLine(to: CGPoint(x: s * 0.82, y: s * 0.42))
                bolt.addLine(to: CGPoint(x: s * 0.52, y: s * 0.46))
                bolt.closeSubpath()
                context.fill(bolt, with: .color(brandColor))

            case .evgo:
                // "ev" text-style with a plug dot
                let font = Font.system(size: s * 0.52, weight: .black)
                context.draw(
                    Text("ev").font(font).foregroundStyle(brandColor),
                    at: CGPoint(x: s * 0.48, y: s * 0.42)
                )
                let dot = Path(ellipseIn: CGRect(x: s * 0.7, y: s * 0.65, width: s * 0.2, height: s * 0.2))
                context.fill(dot, with: .color(brandColor))

            case .chargePoint:
                // Circle with inner plug pin
                let outer = Path(ellipseIn: CGRect(x: s * 0.08, y: s * 0.08, width: s * 0.84, height: s * 0.84))
                context.stroke(outer, with: .color(brandColor), lineWidth: s * 0.1)
                let pin = Path(ellipseIn: CGRect(x: s * 0.32, y: s * 0.32, width: s * 0.36, height: s * 0.36))
                context.fill(pin, with: .color(brandColor))

            case .blink:
                // Blink "eye" shape – two arcs
                var eye = Path()
                eye.move(to: CGPoint(x: s * 0.08, y: s * 0.5))
                eye.addQuadCurve(to: CGPoint(x: s * 0.92, y: s * 0.5),
                                 control: CGPoint(x: s * 0.5, y: s * 0.05))
                eye.addQuadCurve(to: CGPoint(x: s * 0.08, y: s * 0.5),
                                 control: CGPoint(x: s * 0.5, y: s * 0.95))
                eye.closeSubpath()
                context.fill(eye, with: .color(brandColor))
                let pupil = Path(ellipseIn: CGRect(x: s * 0.35, y: s * 0.35, width: s * 0.3, height: s * 0.3))
                context.fill(pupil, with: .color(.black.opacity(0.85)))

            case .evConnect:
                // Plug with two prongs
                var plug = Path()
                plug.addRoundedRect(in: CGRect(x: s * 0.25, y: s * 0.45, width: s * 0.5, height: s * 0.45), cornerSize: CGSize(width: s * 0.08, height: s * 0.08))
                context.fill(plug, with: .color(brandColor))
                let prong1 = Path(CGRect(x: s * 0.32, y: s * 0.15, width: s * 0.1, height: s * 0.35))
                let prong2 = Path(CGRect(x: s * 0.58, y: s * 0.15, width: s * 0.1, height: s * 0.35))
                context.fill(prong1, with: .color(brandColor))
                context.fill(prong2, with: .color(brandColor))

            case .shell:
                // Simplified shell/pecten shape – fan of lines from bottom
                let center = CGPoint(x: s * 0.5, y: s * 0.88)
                for i in 0..<7 {
                    let angle = Double.pi * (0.15 + Double(i) * 0.1)
                    let endX = s * 0.5 + cos(angle) * s * 0.42
                    let endY = s * 0.88 - sin(angle) * s * 0.72
                    var ray = Path()
                    ray.move(to: center)
                    ray.addLine(to: CGPoint(x: endX, y: endY))
                    context.stroke(ray, with: .color(brandColor), lineWidth: s * 0.07)
                }
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Flow Layout for Network Chips

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            currentX += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }

        return CGSize(width: maxWidth, height: currentY + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var currentX: CGFloat = bounds.minX
        var currentY: CGFloat = bounds.minY
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > bounds.maxX && currentX > bounds.minX {
                currentX = bounds.minX
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: currentX, y: currentY), proposal: .unspecified)
            currentX += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

// MARK: - PDF Share Sheet

struct PDFShareSheet: UIViewControllerRepresentable {
    let pdfData: Data
    let fileName: String

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent(fileName)
        try? pdfData.write(to: fileURL)
        let controller = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
