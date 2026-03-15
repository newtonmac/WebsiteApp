import SwiftUI
import CoreLocation

struct NearbyCharger: Identifiable {
    let id: String
    let charger: EVCharger
    let distanceMiles: Double
}

struct StopChargers: Identifiable {
    let id: UUID
    let stop: ChargingStop
    let chargers: [NearbyCharger]
}

struct EVRouteDetailView: View {
    let route: RouteResult
    let vehicle: EVVehicle
    let chargers: [EVCharger]
    @Environment(\.dismiss) private var dismiss

    private let groupedChargers: [StopChargers]

    init(route: RouteResult, vehicle: EVVehicle, chargers: [EVCharger]) {
        self.route = route
        self.vehicle = vehicle
        self.chargers = chargers

        let radiusMeters: Double = 15 * 1609.34
        let maxPerStop = 5
        var groups: [StopChargers] = []

        for stop in route.chargingStops {
            let stopLocation = CLLocation(latitude: stop.coordinate.latitude, longitude: stop.coordinate.longitude)
            var nearby: [NearbyCharger] = []

            for charger in chargers {
                let chargerLocation = CLLocation(latitude: charger.coordinate.latitude, longitude: charger.coordinate.longitude)
                let dist = stopLocation.distance(from: chargerLocation)
                if dist <= radiusMeters {
                    nearby.append(NearbyCharger(id: charger.id, charger: charger, distanceMiles: dist / 1609.34))
                }
            }

            nearby.sort { $0.distanceMiles < $1.distanceMiles }
            if nearby.count > maxPerStop {
                nearby = Array(nearby.prefix(maxPerStop))
            }
            groups.append(StopChargers(id: stop.id, stop: stop, chargers: nearby))
        }

        self.groupedChargers = groups
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Title
                    HStack {
                        Text(route.route.name.isEmpty ? "Route" : route.route.name)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(EVTheme.accentGreen)
                        Text("— \(String(format: "%.1f mi", route.distanceMiles))")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(EVTheme.textPrimary)
                    }

                    // Route analysis checkmarks
                    routeAnalysisSection

                    Rectangle()
                        .fill(EVTheme.border)
                        .frame(height: 1)

                    // Elevation Profile
                    elevationProfileSection

                    Rectangle()
                        .fill(EVTheme.border)
                        .frame(height: 1)

                    // Map Colors legend
                    mapColorsLegend

                    Rectangle()
                        .fill(EVTheme.border)
                        .frame(height: 1)

                    // Charging plan (if needed)
                    if route.needsCharging {
                        Rectangle()
                            .fill(EVTheme.border)
                            .frame(height: 1)
                        chargingPlanSection
                    }

                    // Energy breakdown
                    energyBreakdownSection

                    // Chargers
                    if !chargers.isEmpty {
                        Rectangle()
                            .fill(EVTheme.border)
                            .frame(height: 1)
                        chargersSection
                    }
                }
                .padding(20)
            }
            .background(EVTheme.bgPrimary)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(EVTheme.bgCard, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(EVTheme.textSecondary)
                            .frame(width: 28, height: 28)
                            .background(EVTheme.bgInput)
                            .clipShape(Circle())
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Route Analysis (checkmark bullets)

    private var routeAnalysisSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Energy efficiency
            if route.batteryPctUsed < 50 {
                checkItem("Uses the **least battery** — the most energy-efficient path", color: EVTheme.accentGreen)
            } else if route.batteryPctUsed < 80 {
                checkItem("Moderate battery usage — \(String(format: "%.0f%%", route.batteryPctUsed)) consumed", color: EVTheme.accentYellow)
            } else {
                checkItem("High battery usage — \(String(format: "%.0f%%", route.batteryPctUsed)) consumed", color: EVTheme.accentRed)
            }

            // Climbing
            let elevFt = Int(route.elevationGain * 3.28084)
            let elevM = Int(route.elevationGain)
            if elevFt < 500 {
                checkItem("**Low climbing** — only +\(elevM)m (+\(elevFt)ft) elevation gain", color: EVTheme.accentGreen)
            } else if elevFt < 2000 {
                checkItem("Moderate climbing — +\(elevM)m (+\(elevFt)ft) elevation gain", color: EVTheme.accentYellow)
            } else {
                checkItem("Significant climbing — +\(elevM)m (+\(elevFt)ft) elevation gain", color: EVTheme.accentOrange)
            }

            // Regen
            let regenKwh = route.elevationLoss > 0
                ? (vehicle.weightKg * 9.81 * route.elevationLoss) / 3_600_000 * vehicle.regenEff
                : 0
            if regenKwh > 0.5 {
                checkItem("Recovers **\(String(format: "%.1f kWh", regenKwh))** through regenerative braking on downhill sections", color: EVTheme.accentGreen)
            }

            // Battery remaining
            let remaining = route.remainingBatteryPct
            if remaining > 50 {
                checkItem("Arrives with **\(Int(remaining))% battery** remaining — plenty of margin", color: EVTheme.accentGreen)
            } else if remaining > 20 {
                checkItem("Arrives with **\(Int(remaining))% battery** remaining", color: EVTheme.accentYellow)
            } else {
                checkItem("Arrives with only **\(Int(remaining))% battery** — consider charging stops", color: EVTheme.accentRed)
            }

            // Peak grade
            if route.peakGrade > 8 {
                warningItem("Contains steep grades up to \(String(format: "%.1f%%", route.peakGrade)) — increased energy use")
            } else if !route.needsCharging {
                checkItem("No significant drawbacks for this route", color: EVTheme.accentYellow)
            }

            // Charging needed
            if route.needsCharging {
                warningItem("Requires **\(route.chargingStops.count) charging stop\(route.chargingStops.count == 1 ? "" : "s")** — battery exceeds single-charge range")
                checkItem("Arrives with **\(Int(route.finalBatteryPct))% battery** after charging", color: EVTheme.accentGreen)
            }
        }
    }

    // MARK: - Charging Plan

    private var chargingPlanSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "bolt.circle.fill")
                    .foregroundStyle(EVTheme.accentYellow)
                Text("Charging Plan")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(EVTheme.textPrimary)
            }

            // Start
            chargingTimelineRow(
                icon: "circle.fill",
                iconColor: EVTheme.accentGreen,
                title: "Depart Origin",
                subtitle: "Battery: 100%",
                isLast: false
            )

            ForEach(route.chargingStops) { stop in
                chargingTimelineRow(
                    icon: "bolt.circle.fill",
                    iconColor: EVTheme.accentYellow,
                    title: "Charging Stop \(stop.stopNumber)",
                    subtitle: "At mile \(String(format: "%.0f", stop.distanceMiles)) — Arrive \(Int(stop.arrivalBatteryPct))% → Charge to \(Int(stop.departureBatteryPct))% (+\(String(format: "%.1f", stop.energyToAddKwh)) kWh)",
                    isLast: false
                )
            }

            // Destination
            chargingTimelineRow(
                icon: "mappin.circle.fill",
                iconColor: EVTheme.accentRed,
                title: "Arrive Destination",
                subtitle: "Battery: \(Int(route.finalBatteryPct))% remaining",
                isLast: true
            )
        }
    }

    private func chargingTimelineRow(icon: String, iconColor: Color, title: String, subtitle: String, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(iconColor)
                if !isLast {
                    Rectangle()
                        .fill(EVTheme.border)
                        .frame(width: 2, height: 30)
                }
            }
            .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(EVTheme.textPrimary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(EVTheme.textSecondary)
            }
        }
    }

    private func checkItem(_ text: LocalizedStringKey, color: Color) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(color)
                .frame(width: 16)
                .padding(.top, 2)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(EVTheme.textPrimary)
        }
    }

    private func warningItem(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 12))
                .foregroundStyle(EVTheme.accentYellow)
                .frame(width: 16)
                .padding(.top, 2)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(EVTheme.textPrimary)
        }
    }

    // MARK: - Elevation Profile

    private var elevationProfileSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Elevation Profile")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(EVTheme.textPrimary)

            if !route.elevationProfile.isEmpty {
                ElevationChartView(profile: route.elevationProfile)
                    .frame(height: 160)
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                HStack {
                    Label("\(Int(route.elevationGain * 3.28084)) ft gain", systemImage: "arrow.up.right")
                        .font(.caption)
                        .foregroundStyle(EVTheme.accentGreen)
                    Spacer()
                    Label("\(Int(route.elevationLoss * 3.28084)) ft loss", systemImage: "arrow.down.right")
                        .font(.caption)
                        .foregroundStyle(EVTheme.accentRed)
                    Spacer()
                    Label("\(String(format: "%.1f%%", route.peakGrade)) peak", systemImage: "mountain.2.fill")
                        .font(.caption)
                        .foregroundStyle(EVTheme.accentYellow)
                }
            } else {
                Text("No elevation data available")
                    .font(.caption)
                    .foregroundStyle(EVTheme.textSecondary)
            }
        }
    }

    // MARK: - Map Colors Legend

    private var mapColorsLegend: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Map Colors")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(EVTheme.textPrimary)

            legendRow(color: EVTheme.accentGreen, text: "Green segments = downhill (battery recovers via regen braking)")
            legendRow(color: Color(hex: "#a3e635"), text: "Yellow-green = flat (low energy use)")
            legendRow(color: EVTheme.accentYellow, text: "Yellow/orange = moderate uphill")
            legendRow(color: EVTheme.accentRed, text: "Red segments = steep uphill (high energy drain)")
        }
    }

    private func legendRow(color: Color, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            RoundedRectangle(cornerRadius: 2)
                .fill(color)
                .frame(width: 24, height: 4)
                .padding(.top, 7)
            Text(text)
                .font(.caption)
                .foregroundStyle(EVTheme.textSecondary)
        }
    }

    // MARK: - Energy Breakdown

    private var energyBreakdownSection: some View {
        let energyAdded = route.chargingStops.reduce(0.0) { $0 + $1.energyToAddKwh }
        let arrivalPct = route.finalBatteryPct
        let arrivalColor = arrivalPct < 20 ? EVTheme.accentRed : arrivalPct < 40 ? EVTheme.accentYellow : EVTheme.accentGreen

        return VStack(alignment: .leading, spacing: 12) {
            Text("Energy Details")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(EVTheme.textPrimary)

            DetailRow(label: "Total Energy", value: String(format: "%.1f kWh", route.energyKwh))

            if route.needsCharging {
                DetailRow(label: "Energy Added", value: String(format: "+%.1f kWh", energyAdded),
                          valueColor: EVTheme.accentGreen)
                DetailRow(label: "Charging Stops", value: "\(route.chargingStops.count)")
            }

            DetailRow(label: "Arrival Battery", value: String(format: "%.0f%%", arrivalPct),
                      valueColor: arrivalColor)
            DetailRow(label: "Efficiency", value: String(format: "%.1f mi/kWh", route.efficiency))
            DetailRow(label: "Distance", value: String(format: "%.1f miles", route.distanceMiles))
            DetailRow(label: "Est. Time", value: formatDuration(route.durationMinutes))
            DetailRow(label: "Avg Grade", value: String(format: "%.1f%%", route.averageGrade))
            DetailRow(label: "Peak Grade", value: String(format: "%.1f%%", route.peakGrade),
                      valueColor: route.peakGrade > 8 ? EVTheme.accentRed : route.peakGrade > 5 ? EVTheme.accentYellow : EVTheme.accentGreen)

            BatteryBarView(vehicleName: vehicle.displayName, batteryPctUsed: 100 - route.finalBatteryPct)
        }
    }

    // MARK: - Chargers

    private var chargersSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            if route.needsCharging {
                ForEach(groupedChargers) { group in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 6) {
                            Image(systemName: "bolt.circle.fill")
                                .foregroundStyle(EVTheme.accentYellow)
                                .font(.subheadline)
                            Text("Chargers Near Stop \(group.stop.stopNumber)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EVTheme.textPrimary)
                            Spacer()
                            Text("Mile \(String(format: "%.0f", group.stop.distanceMiles))")
                                .font(.caption)
                                .foregroundStyle(EVTheme.textSecondary)
                        }

                        if group.chargers.isEmpty {
                            Text("No chargers found within 15 miles")
                                .font(.caption)
                                .foregroundStyle(EVTheme.textSecondary)
                                .padding(.vertical, 4)
                        } else {
                            ForEach(group.chargers) { nearby in
                                chargerRow(charger: nearby.charger, distanceMiles: nearby.distanceMiles)

                                if nearby.id != group.chargers.last?.id {
                                    Rectangle()
                                        .fill(EVTheme.border)
                                        .frame(height: 1)
                                }
                            }
                        }
                    }

                    if group.id != groupedChargers.last?.id {
                        Rectangle()
                            .fill(EVTheme.border.opacity(0.5))
                            .frame(height: 1)
                            .padding(.vertical, 4)
                    }
                }
            } else {
                Text("Chargers Along Route (\(chargers.count))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(EVTheme.textPrimary)

                ForEach(chargers) { charger in
                    chargerRow(charger: charger, distanceMiles: nil)

                    if charger.id != chargers.last?.id {
                        Rectangle()
                            .fill(EVTheme.border)
                            .frame(height: 1)
                    }
                }
            }
        }
    }

    private func chargerRow(charger: EVCharger, distanceMiles: Double?) -> some View {
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
                    .foregroundStyle(EVTheme.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(charger.address)
                        .font(.caption)
                        .foregroundStyle(EVTheme.textSecondary)
                        .lineLimit(1)
                    if let miles = distanceMiles {
                        Text("• \(String(format: "%.1f mi", miles))")
                            .font(.caption)
                            .foregroundStyle(EVTheme.accentGreen)
                    }
                }
                if !charger.connectors.isEmpty {
                    Text(charger.connectors.joined(separator: " • "))
                        .font(.caption2)
                        .foregroundStyle(EVTheme.textSecondary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Helpers

    private func formatDuration(_ minutes: Double) -> String {
        let hrs = Int(minutes) / 60
        let mins = Int(minutes) % 60
        return hrs > 0 ? "\(hrs)h \(mins)m" : "\(mins)m"
    }

    private func networkColor(_ network: ChargerNetwork) -> Color {
        Color(hex: network.color)
    }
}

struct DetailRow: View {
    let label: String
    let value: String
    var valueColor: Color = EVTheme.textPrimary

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(EVTheme.textSecondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(valueColor)
        }
    }
}

struct ElevationChartView: View {
    let profile: [ElevationPoint]

    private var minElevFt: Double {
        ((profile.map(\.elevation).min() ?? 0) * 3.28084) - 20
    }
    private var maxElevFt: Double {
        ((profile.map(\.elevation).max() ?? 100) * 3.28084) + 20
    }
    private var elevRange: Double {
        max(1, maxElevFt - minElevFt)
    }
    private var maxDist: Double {
        profile.last?.distance ?? 1
    }

    var body: some View {
        GeometryReader { geo in
            let chartLeft: CGFloat = 45
            let chartWidth = geo.size.width - chartLeft - 8
            let chartHeight = geo.size.height - 20

            ZStack(alignment: .topLeading) {
                // Background
                RoundedRectangle(cornerRadius: 10)
                    .fill(EVTheme.bgCard)

                // Y-axis labels
                VStack {
                    Text("\(Int(maxElevFt)) ft")
                        .font(.system(size: 8))
                        .foregroundStyle(EVTheme.textSecondary)
                    Spacer()
                    Text("\(Int((maxElevFt + minElevFt) / 2)) ft")
                        .font(.system(size: 8))
                        .foregroundStyle(EVTheme.textSecondary)
                    Spacer()
                    Text("\(Int(minElevFt)) ft")
                        .font(.system(size: 8))
                        .foregroundStyle(EVTheme.textSecondary)
                }
                .frame(width: chartLeft - 4, height: chartHeight)
                .padding(.top, 4)

                // Chart area
                Canvas { context, size in
                    guard profile.count >= 2 else { return }

                    let cWidth = chartWidth
                    let cHeight = chartHeight

                    // Grid lines
                    for i in 0...4 {
                        let y = cHeight * CGFloat(i) / 4.0
                        var gridPath = Path()
                        gridPath.move(to: CGPoint(x: 0, y: y))
                        gridPath.addLine(to: CGPoint(x: cWidth, y: y))
                        context.stroke(gridPath, with: .color(EVTheme.border.opacity(0.4)), lineWidth: 0.5)
                    }

                    // Fill gradient under the line
                    var fillPath = Path()
                    fillPath.move(to: CGPoint(x: 0, y: cHeight))

                    for point in profile {
                        let x = (point.distance / maxDist) * cWidth
                        let elevFt = point.elevation * 3.28084
                        let y = cHeight - ((elevFt - minElevFt) / elevRange) * cHeight
                        fillPath.addLine(to: CGPoint(x: x, y: y))
                    }

                    fillPath.addLine(to: CGPoint(x: cWidth, y: cHeight))
                    fillPath.closeSubpath()

                    context.fill(fillPath, with: .linearGradient(
                        Gradient(colors: [EVTheme.accentGreen.opacity(0.25), EVTheme.accentGreen.opacity(0.02)]),
                        startPoint: CGPoint(x: 0, y: 0),
                        endPoint: CGPoint(x: 0, y: cHeight)
                    ))

                    // Colored line segments by grade
                    for i in 1..<profile.count {
                        let x1 = (profile[i-1].distance / maxDist) * cWidth
                        let elevFt1 = profile[i-1].elevation * 3.28084
                        let y1 = cHeight - ((elevFt1 - minElevFt) / elevRange) * cHeight
                        let x2 = (profile[i].distance / maxDist) * cWidth
                        let elevFt2 = profile[i].elevation * 3.28084
                        let y2 = cHeight - ((elevFt2 - minElevFt) / elevRange) * cHeight

                        var segPath = Path()
                        segPath.move(to: CGPoint(x: x1, y: y1))
                        segPath.addLine(to: CGPoint(x: x2, y: y2))

                        let grade = profile[i].grade
                        let color: Color
                        if grade < -1 {
                            color = EVTheme.accentGreen
                        } else if grade < 1 {
                            color = Color(hex: "#a3e635")
                        } else if grade < 4 {
                            color = EVTheme.accentYellow
                        } else {
                            color = EVTheme.accentRed
                        }

                        context.stroke(segPath, with: .color(color), lineWidth: 2.5)
                    }
                }
                .frame(width: chartWidth, height: chartHeight)
                .offset(x: chartLeft, y: 4)

                // X-axis labels
                HStack {
                    Text("0 mi")
                        .font(.system(size: 8))
                        .foregroundStyle(EVTheme.textSecondary)
                    Spacer()
                    Text("\(String(format: "%.0f", maxDist)) mi")
                        .font(.system(size: 8))
                        .foregroundStyle(EVTheme.textSecondary)
                }
                .offset(x: chartLeft, y: chartHeight + 6)
                .frame(width: chartWidth)
            }
        }
    }
}
