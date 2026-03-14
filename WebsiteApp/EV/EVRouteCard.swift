import SwiftUI

struct EVRouteCard: View {
    let route: RouteResult
    let vehicle: EVVehicle
    let isBest: Bool
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            HStack {
                if isBest {
                    Text("BEST")
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.2))
                        .foregroundStyle(.green)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                Text(route.route.name)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Spacer()
            }

            // Stats grid
            HStack(spacing: 0) {
                StatItem(
                    value: String(format: "%.1f", route.distanceMiles),
                    unit: "mi",
                    label: "DISTANCE"
                )
                Spacer()
                StatItem(
                    value: formatDuration(route.durationMinutes),
                    unit: "",
                    label: "TIME"
                )
                Spacer()
                StatItem(
                    value: String(format: "%.1f", route.elevationGain * 3.28084),
                    unit: "ft",
                    label: "ELEV GAIN"
                )
            }

            Divider()

            // Energy stats
            HStack(spacing: 0) {
                StatItem(
                    value: String(format: "%.1f", route.energyKwh),
                    unit: "kWh",
                    label: "ENERGY",
                    valueColor: .primary
                )
                Spacer()
                StatItem(
                    value: String(format: "%.0f%%", route.batteryPctUsed),
                    unit: "",
                    label: "BATTERY USED",
                    valueColor: batteryColor
                )
                Spacer()
                StatItem(
                    value: String(format: "%.1f", route.efficiency),
                    unit: "mi/kWh",
                    label: "EFFICIENCY",
                    valueColor: .primary
                )
            }

            // Battery bar
            BatteryBarView(
                vehicleName: vehicle.displayName,
                batteryPctUsed: route.batteryPctUsed
            )
        }
        .padding(14)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(isSelected ? Color.green : Color.clear, lineWidth: 2)
        )
    }

    private var batteryColor: Color {
        if route.batteryPctUsed > 80 { return .red }
        if route.batteryPctUsed > 60 { return .yellow }
        return .green
    }

    private func formatDuration(_ minutes: Double) -> String {
        let hrs = Int(minutes) / 60
        let mins = Int(minutes) % 60
        return hrs > 0 ? "\(hrs)h \(mins)m" : "\(mins)m"
    }
}

struct StatItem: View {
    let value: String
    let unit: String
    let label: String
    var valueColor: Color = .primary

    var body: some View {
        VStack(spacing: 2) {
            HStack(spacing: 2) {
                Text(value)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(valueColor)
                if !unit.isEmpty {
                    Text(unit)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
            }
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.secondary)
        }
    }
}

struct BatteryBarView: View {
    let vehicleName: String
    let batteryPctUsed: Double

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text(vehicleName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(Int(max(0, 100 - batteryPctUsed)))%")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(remainingColor)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.gray.opacity(0.2))

                    RoundedRectangle(cornerRadius: 6)
                        .fill(remainingColor.gradient)
                        .frame(width: geo.size.width * max(0, 100 - batteryPctUsed) / 100)
                }
            }
            .frame(height: 14)
        }
    }

    private var remainingColor: Color {
        let remaining = 100 - batteryPctUsed
        if remaining < 20 { return .red }
        if remaining < 40 { return .yellow }
        return .green
    }
}
