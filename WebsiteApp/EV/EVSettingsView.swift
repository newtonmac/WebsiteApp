import SwiftUI
import StoreKit

struct EVSettingsView: View {
    @ObservedObject var settings = EVSettingsManager.shared
    @Environment(\.dismiss) private var dismiss
    @Environment(\.requestReview) private var requestReview

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    vehicleBatterySection
                    routePreferencesSection
                    chargingNetworksSection
                    displaySection
                    // appInfoSection — hidden until site is ready
                    resetSection
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(EVTheme.bgPrimary)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(EVTheme.bgCard, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(EVTheme.accentGreen)
                        .fontWeight(.semibold)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Vehicle & Battery

    private var vehicleBatterySection: some View {
        SettingsCard(title: "VEHICLE & BATTERY", icon: "battery.75percent") {
            VStack(spacing: 14) {
                SettingsSliderRow(
                    label: "Starting Charge",
                    value: $settings.startChargePct,
                    range: 10...100,
                    step: 5,
                    unit: "%",
                    description: "Battery level when you start your trip"
                )

                Divider().overlay(EVTheme.border)

                SettingsSliderRow(
                    label: "Min. Arrival Charge",
                    value: $settings.minArrivalPct,
                    range: 5...50,
                    step: 5,
                    unit: "%",
                    description: "Never plan to arrive below this level"
                )

                Divider().overlay(EVTheme.border)

                SettingsSliderRow(
                    label: "Charge Target at Stops",
                    value: $settings.chargeTargetPct,
                    range: 50...100,
                    step: 5,
                    unit: "%",
                    description: "Charge to this level at each stop"
                )

                Divider().overlay(EVTheme.border)

                SettingsSliderRow(
                    label: "Min. Charger Speed",
                    value: $settings.preferredChargerSpeedKw,
                    range: 0...350,
                    step: 25,
                    unit: " kW",
                    description: "Prefer chargers at or above this speed (0 = any)"
                )
            }
        }
    }

    // MARK: - Route Preferences

    private var routePreferencesSection: some View {
        SettingsCard(title: "ROUTE PREFERENCES", icon: "road.lanes") {
            VStack(spacing: 14) {
                SettingsToggleRow(
                    label: "Avoid Highways",
                    icon: "road.lanes.curved.right",
                    isOn: $settings.avoidHighways,
                    description: "Prefer surface streets"
                )

                Divider().overlay(EVTheme.border)

                SettingsToggleRow(
                    label: "Avoid Tolls",
                    icon: "dollarsign.circle",
                    isOn: $settings.avoidTolls,
                    description: "Skip toll roads when possible"
                )

                Divider().overlay(EVTheme.border)

                SettingsSliderRow(
                    label: "Max Charger Detour",
                    value: $settings.maxDetourMiles,
                    range: 1...50,
                    step: 1,
                    unit: settings.useMiles ? " mi" : " km",
                    description: "Max distance off-route to reach a charger"
                )

                Divider().overlay(EVTheme.border)

                SettingsSliderRow(
                    label: "Min. Stop Duration",
                    value: $settings.preferredStopMinutes,
                    range: 10...120,
                    step: 5,
                    unit: " min",
                    description: "Minimum time at each stop (park, plug in, wait). Used to calculate total trip time."
                )
            }
        }
    }

    // MARK: - Charging Networks

    private var chargingNetworksSection: some View {
        SettingsCard(title: "DEFAULT NETWORKS", icon: "bolt.fill") {
            VStack(spacing: 10) {
                Text("Networks selected here will be enabled by default when you open the app.")
                    .font(.system(size: 12))
                    .foregroundStyle(EVTheme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack {
                    Button {
                        settings.defaultNetworks = Set(ChargerNetwork.allCases)
                    } label: {
                        Text("All")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(EVTheme.accentBlue)
                    }
                    Spacer()
                    Button {
                        settings.defaultNetworks = []
                    } label: {
                        Text("None")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(EVTheme.accentRed)
                    }
                }

                FlowLayout(spacing: 8) {
                    ForEach(ChargerNetwork.allCases, id: \.self) { network in
                        let isSelected = settings.defaultNetworks.contains(network)
                        Button {
                            withAnimation(.easeInOut(duration: 0.15)) {
                                var nets = settings.defaultNetworks
                                if isSelected { nets.remove(network) }
                                else { nets.insert(network) }
                                settings.defaultNetworks = nets
                            }
                        } label: {
                            HStack(spacing: 4) {
                                NetworkIconView(network: network, size: 14)
                                Text(network.shortName)
                                    .font(.system(size: 12, weight: .semibold))
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(isSelected ? network.colorValue.opacity(0.2) : EVTheme.bgPrimary)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(isSelected ? network.colorValue : EVTheme.border, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .foregroundStyle(isSelected ? network.colorValue : EVTheme.textSecondary)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Display

    private var displaySection: some View {
        SettingsCard(title: "DISPLAY", icon: "paintbrush") {
            VStack(spacing: 14) {
                // Distance units
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Distance Units")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(EVTheme.textPrimary)
                        Text("Affects all distance displays")
                            .font(.system(size: 11))
                            .foregroundStyle(EVTheme.textSecondary)
                    }
                    Spacer()
                    Picker("", selection: $settings.useMiles) {
                        Text("Miles").tag(true)
                        Text("Kilometers").tag(false)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 180)
                }

                Divider().overlay(EVTheme.border)

                // Electricity cost
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Electricity Cost")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(EVTheme.textPrimary)
                        Spacer()
                        Text(String(format: "$%.2f/kWh", settings.electricityCostPerKwh))
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(EVTheme.accentGreen)
                    }
                    Text("Used for trip cost estimates")
                        .font(.system(size: 11))
                        .foregroundStyle(EVTheme.textSecondary)
                    Slider(value: $settings.electricityCostPerKwh, in: 0.05...1.00, step: 0.01)
                        .tint(EVTheme.accentGreen)
                }
            }
        }
    }

    // MARK: - App Info

    private var appInfoSection: some View {
        SettingsCard(title: "APP INFO", icon: "info.circle") {
            VStack(spacing: 12) {
                infoRow(label: "App", value: "EV Route Planner")
                Divider().overlay(EVTheme.border)
                infoRow(label: "Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                Divider().overlay(EVTheme.border)
                infoRow(label: "Build", value: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1")
                Divider().overlay(EVTheme.border)

                Link(destination: URL(string: "https://evrouteplanner.org/")!) {
                    HStack {
                        Image(systemName: "globe")
                            .font(.system(size: 14))
                            .foregroundStyle(EVTheme.accentBlue)
                        Text("Website")
                            .font(.system(size: 14))
                            .foregroundStyle(EVTheme.textPrimary)
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 11))
                            .foregroundStyle(EVTheme.textSecondary)
                    }
                }

                Divider().overlay(EVTheme.border)

                Link(destination: URL(string: "https://evrouteplanner.org/privacy")!) {
                    HStack {
                        Image(systemName: "hand.raised.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(EVTheme.accentBlue)
                        Text("Privacy Policy")
                            .font(.system(size: 14))
                            .foregroundStyle(EVTheme.textPrimary)
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 11))
                            .foregroundStyle(EVTheme.textSecondary)
                    }
                }

                Divider().overlay(EVTheme.border)

                Button {
                    if let url = URL(string: "mailto:feedback@evrouteplanner.org?subject=EV%20Route%20Planner%20Feedback") {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    HStack {
                        Image(systemName: "envelope.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(EVTheme.accentGreen)
                        Text("Send Feedback")
                            .font(.system(size: 14))
                            .foregroundStyle(EVTheme.textPrimary)
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 11))
                            .foregroundStyle(EVTheme.textSecondary)
                    }
                }

                Divider().overlay(EVTheme.border)

                Button {
                    requestAppReview()
                } label: {
                    HStack {
                        Image(systemName: "star.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(EVTheme.accentYellow)
                        Text("Rate the App")
                            .font(.system(size: 14))
                            .foregroundStyle(EVTheme.textPrimary)
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 11))
                            .foregroundStyle(EVTheme.textSecondary)
                    }
                }
            }
        }
    }

    // MARK: - Reset

    private var resetSection: some View {
        Button {
            withAnimation {
                settings.resetToDefaults()
            }
        } label: {
            HStack {
                Image(systemName: "arrow.counterclockwise")
                Text("Reset All Settings")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(EVTheme.accentRed.opacity(0.15))
            .foregroundStyle(EVTheme.accentRed)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(EVTheme.accentRed.opacity(0.3), lineWidth: 1)
            )
        }
        .padding(.bottom, 30)
    }

    // MARK: - Helpers

    private func infoRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(EVTheme.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(EVTheme.textPrimary)
        }
    }

    private func requestAppReview() {
        requestReview()
    }
}

// MARK: - Reusable Settings Components

struct SettingsCard<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(EVTheme.accentGreen)
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(EVTheme.textSecondary)
            }

            content()
        }
        .padding(14)
        .background(EVTheme.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(EVTheme.border, lineWidth: 1)
        )
    }
}

struct SettingsSliderRow: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let unit: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(EVTheme.textPrimary)
                Spacer()
                Text("\(Int(value))\(unit)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(EVTheme.accentGreen)
                    .monospacedDigit()
            }
            Text(description)
                .font(.system(size: 11))
                .foregroundStyle(EVTheme.textSecondary)
            Slider(value: $value, in: range, step: step)
                .tint(EVTheme.accentGreen)
        }
    }
}

struct SettingsToggleRow: View {
    let label: String
    let icon: String
    @Binding var isOn: Bool
    let description: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(isOn ? EVTheme.accentGreen : EVTheme.textSecondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(EVTheme.textPrimary)
                Text(description)
                    .font(.system(size: 11))
                    .foregroundStyle(EVTheme.textSecondary)
            }

            Spacer()

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
            .onTapGesture { isOn.toggle() }
        }
    }
}
