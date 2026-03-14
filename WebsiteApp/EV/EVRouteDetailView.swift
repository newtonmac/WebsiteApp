import SwiftUI

struct EVRouteDetailView: View {
    let route: RouteResult
    let vehicle: EVVehicle
    let chargers: [EVCharger]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Elevation Profile
                    elevationProfileSection

                    // Energy Breakdown
                    energyBreakdownSection

                    // Route Stats
                    routeStatsSection

                    // Chargers Along Route
                    if !chargers.isEmpty {
                        chargersSection
                    }
                }
                .padding(20)
            }
            .navigationTitle("Route Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    // MARK: - Elevation Profile

    private var elevationProfileSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ELEVATION PROFILE")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            if !route.elevationProfile.isEmpty {
                ElevationChartView(profile: route.elevationProfile)
                    .frame(height: 150)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            HStack {
                Label("\(Int(route.elevationGain * 3.28084)) ft gain", systemImage: "arrow.up.right")
                    .font(.caption)
                    .foregroundStyle(.green)
                Spacer()
                Label("\(Int(route.elevationLoss * 3.28084)) ft loss", systemImage: "arrow.down.right")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .padding(14)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Energy Breakdown

    private var energyBreakdownSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("ENERGY BREAKDOWN")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            DetailRow(label: "Total Energy", value: String(format: "%.1f kWh", route.energyKwh))
            DetailRow(label: "Battery Used", value: String(format: "%.0f%%", route.batteryPctUsed),
                      valueColor: route.batteryPctUsed > 80 ? .red : route.batteryPctUsed > 60 ? .yellow : .green)
            DetailRow(label: "Remaining Battery", value: String(format: "%.0f%%", route.remainingBatteryPct))
            DetailRow(label: "Efficiency", value: String(format: "%.1f mi/kWh", route.efficiency))

            BatteryBarView(vehicleName: vehicle.displayName, batteryPctUsed: route.batteryPctUsed)
        }
        .padding(14)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Route Stats

    private var routeStatsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("ROUTE STATS")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            DetailRow(label: "Distance", value: String(format: "%.1f miles", route.distanceMiles))
            DetailRow(label: "Est. Time", value: formatDuration(route.durationMinutes))
            DetailRow(label: "Route Name", value: route.route.name)
            DetailRow(label: "Avg Grade", value: String(format: "%.1f%%", route.averageGrade))
            DetailRow(label: "Peak Grade", value: String(format: "%.1f%%", route.peakGrade),
                      valueColor: route.peakGrade > 8 ? .red : route.peakGrade > 5 ? .yellow : .green)
        }
        .padding(14)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Chargers

    private var chargersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("CHARGERS ALONG ROUTE (\(chargers.count))")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            ForEach(chargers) { charger in
                HStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(networkColor(charger.network))
                            .frame(width: 32, height: 24)
                        Text(charger.network.abbreviation)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(charger.name)
                            .font(.subheadline.weight(.medium))
                            .lineLimit(1)
                        Text(charger.address)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        if !charger.connectors.isEmpty {
                            Text(charger.connectors.joined(separator: " • "))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Helpers

    private func formatDuration(_ minutes: Double) -> String {
        let hrs = Int(minutes) / 60
        let mins = Int(minutes) % 60
        return hrs > 0 ? "\(hrs)h \(mins)m" : "\(mins)m"
    }

    private func networkColor(_ network: ChargerNetwork) -> Color {
        switch network {
        case .tesla: return Color(red: 0.89, green: 0.10, blue: 0.22)
        case .electrifyAmerica: return Color(red: 0, green: 0.45, blue: 0.81)
        case .evgo: return Color(red: 0, green: 0.67, blue: 0.94)
        case .chargePoint: return Color(red: 0.28, green: 0.72, blue: 0.30)
        case .blink: return Color.orange
        case .evConnect: return Color(red: 0.36, green: 0.75, blue: 0.08)
        }
    }
}

struct DetailRow: View {
    let label: String
    let value: String
    var valueColor: Color = .primary

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(valueColor)
        }
    }
}

struct ElevationChartView: View {
    let profile: [ElevationPoint]

    var body: some View {
        GeometryReader { geo in
            let minElev = (profile.map(\.elevation).min() ?? 0) - 10
            let maxElev = (profile.map(\.elevation).max() ?? 100) + 10
            let elevRange = maxElev - minElev
            let maxDist = profile.last?.distance ?? 1

            Canvas { context, size in
                guard profile.count >= 2 else { return }

                // Fill
                var fillPath = Path()
                fillPath.move(to: CGPoint(x: 0, y: size.height))

                for point in profile {
                    let x = (point.distance / maxDist) * size.width
                    let y = size.height - ((point.elevation - minElev) / elevRange) * size.height
                    fillPath.addLine(to: CGPoint(x: x, y: y))
                }

                fillPath.addLine(to: CGPoint(x: size.width, y: size.height))
                fillPath.closeSubpath()

                context.fill(fillPath, with: .linearGradient(
                    Gradient(colors: [.green.opacity(0.4), .green.opacity(0.05)]),
                    startPoint: CGPoint(x: 0, y: 0),
                    endPoint: CGPoint(x: 0, y: size.height)
                ))

                // Line
                var linePath = Path()
                for (i, point) in profile.enumerated() {
                    let x = (point.distance / maxDist) * size.width
                    let y = size.height - ((point.elevation - minElev) / elevRange) * size.height
                    if i == 0 {
                        linePath.move(to: CGPoint(x: x, y: y))
                    } else {
                        linePath.addLine(to: CGPoint(x: x, y: y))
                    }
                }

                context.stroke(linePath, with: .color(.green), lineWidth: 2)
            }
        }
    }
}
