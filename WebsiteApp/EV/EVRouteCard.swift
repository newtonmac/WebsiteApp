import SwiftUI

struct EVRouteCard: View {
    let route: RouteResult
    let vehicle: EVVehicle
    let isBest: Bool
    let isSelected: Bool
    var onInfoTap: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header with info button
            HStack {
                if isBest {
                    Text("EV BEST")
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(EVTheme.badgeBest)
                        .foregroundStyle(EVTheme.accentGreen)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                } else {
                    Text("ALT")
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(EVTheme.border)
                        .foregroundStyle(EVTheme.textSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }

                Text(String(format: "%.1f mi", route.distanceMiles))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(EVTheme.textPrimary)

                Spacer()

                // Info button (i)
                Button {
                    onInfoTap?()
                } label: {
                    ZStack {
                        Circle()
                            .stroke(EVTheme.textSecondary.opacity(0.5), lineWidth: 1)
                            .frame(width: 22, height: 22)
                        Text("i")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(EVTheme.textSecondary)
                    }
                }
            }

            // Stats row
            HStack(spacing: 0) {
                EVStatItem(
                    value: formatDuration(route.durationMinutes),
                    unit: "",
                    label: "TIME"
                )
                Spacer()
                EVStatItem(
                    value: String(format: "%.1f", route.energyKwh),
                    unit: "kWh",
                    label: "ENERGY"
                )
                Spacer()
                EVStatItem(
                    value: String(format: "%.0f%%", route.remainingBatteryPct),
                    unit: "",
                    label: "BATT LEFT",
                    valueColor: batteryColor
                )
            }

            // Battery bar
            BatteryBarView(
                vehicleName: vehicle.displayName,
                batteryPctUsed: route.batteryPctUsed
            )
        }
        .padding(14)
        .background(EVTheme.bgInput)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(isSelected ? EVTheme.accentGreen : EVTheme.border, lineWidth: isSelected ? 2 : 1)
        )
        .shadow(color: isSelected ? EVTheme.accentGreen.opacity(0.15) : .clear, radius: 8)
    }

    private var batteryColor: Color {
        let remaining = route.remainingBatteryPct
        if remaining < 20 { return EVTheme.accentRed }
        if remaining < 40 { return EVTheme.accentYellow }
        return EVTheme.accentGreen
    }

    private func formatDuration(_ minutes: Double) -> String {
        let hrs = Int(minutes) / 60
        let mins = Int(minutes) % 60
        return hrs > 0 ? "\(hrs)h \(mins)m" : "\(mins)m"
    }
}

struct EVStatItem: View {
    let value: String
    let unit: String
    let label: String
    var valueColor: Color = EVTheme.textPrimary

    var body: some View {
        VStack(spacing: 2) {
            HStack(spacing: 2) {
                Text(value)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(valueColor)
                if !unit.isEmpty {
                    Text(unit)
                        .font(.system(size: 10))
                        .foregroundStyle(EVTheme.textSecondary)
                }
            }
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(EVTheme.textSecondary)
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
                    .foregroundStyle(EVTheme.textSecondary)
                Spacer()
                Text("\(Int(max(0, 100 - batteryPctUsed)))%")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(remainingColor)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 9)
                        .fill(EVTheme.border)

                    ZStack {
                        RoundedRectangle(cornerRadius: 9)
                            .fill(remainingColor)
                            .frame(width: geo.size.width * max(0, 100 - batteryPctUsed) / 100)

                        Text("\(Int(max(0, 100 - batteryPctUsed)))% remaining")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.5), radius: 1, y: 1)
                    }
                }
            }
            .frame(height: 18)
        }
        .padding(.top, 4)
        .padding(10)
        .background(EVTheme.bgCard.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(EVTheme.border.opacity(0.4), lineWidth: 1)
        )
    }

    private var remainingColor: Color {
        let remaining = 100 - batteryPctUsed
        if remaining < 20 { return EVTheme.accentRed }
        if remaining < 40 { return EVTheme.accentYellow }
        return EVTheme.accentGreen
    }
}
