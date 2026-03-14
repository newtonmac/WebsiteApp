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
    @State private var mapCameraPosition: MapCameraPosition = .region(
        MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 32.72, longitude: -117.16),
                          span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5))
    )

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                // Map
                EVMapContent(
                    cameraPosition: $mapCameraPosition,
                    routes: routeService.routes,
                    selectedRoute: selectedRoute,
                    chargers: chargerService.chargers,
                    origin: originCoord,
                    destination: destinationCoord
                )
                .ignoresSafeArea(edges: .top)

                // Bottom panel
                VStack(spacing: 0) {
                    // Drag handle
                    RoundedRectangle(cornerRadius: 2.5)
                        .fill(Color.gray.opacity(0.5))
                        .frame(width: 36, height: 5)
                        .padding(.top, 8)

                    ScrollView {
                        VStack(spacing: 16) {
                            inputSection
                            vehicleSection
                            planButton
                            if !routeService.routes.isEmpty {
                                routeResultsSection
                            }
                            if let error = routeService.errorMessage {
                                Text(error)
                                    .font(.caption)
                                    .foregroundStyle(.red)
                                    .padding(.horizontal)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 12)
                        .padding(.bottom, 32)
                    }
                }
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .frame(maxHeight: UIScreen.main.bounds.height * 0.55)
            }
            .navigationTitle("EV Route Planner")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
            .sheet(isPresented: $showingVehiclePicker) {
                EVVehiclePickerView(selectedVehicle: $selectedVehicle)
            }
            .sheet(isPresented: $showingRouteDetail) {
                if let route = selectedRoute {
                    EVRouteDetailView(route: route, vehicle: selectedVehicle, chargers: chargerService.chargers)
                }
            }
        }
    }

    // MARK: - Input Section

    private var inputSection: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Circle()
                    .fill(.green)
                    .frame(width: 10, height: 10)
                EVLocationSearchField(
                    text: $originText,
                    placeholder: "Origin",
                    coordinate: $originCoord
                )
            }

            HStack(spacing: 8) {
                Circle()
                    .fill(.red)
                    .frame(width: 10, height: 10)
                EVLocationSearchField(
                    text: $destinationText,
                    placeholder: "Destination",
                    coordinate: $destinationCoord
                )
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
                        .foregroundStyle(.primary)
                    HStack(spacing: 8) {
                        Text(selectedVehicle.batteryDescription)
                        Text("•")
                        Text(selectedVehicle.rangeDescription)
                        Text("•")
                        Text("\(String(format: "%.2f", selectedVehicle.effKwhMi)) kWh/mi")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(12)
            .background(.thinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
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
            .background(canPlan ? Color.green : Color.gray.opacity(0.3))
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
                    isSelected: selectedRoute?.id == route.id
                )
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedRoute = route
                    }
                    fitMapToRoute(route)
                }
                .onLongPressGesture {
                    selectedRoute = route
                    showingRouteDetail = true
                }
            }

            if let route = selectedRoute {
                navigationButtons(for: route)
            }
        }
    }

    // MARK: - Navigation Buttons

    private func navigationButtons(for route: RouteResult) -> some View {
        VStack(spacing: 8) {
            // Google Maps
            if let url = googleMapsURL(for: route) {
                Link(destination: url) {
                    HStack {
                        Image(systemName: "map.fill")
                        Text("Open in Google Maps")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.blue)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }

            // Apple Maps
            if let url = appleMapsURL(for: route) {
                Link(destination: url) {
                    HStack {
                        Image(systemName: "apple.logo")
                        Text("Open in Apple Maps")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(white: 0.25))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
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
}
