import SwiftUI

// MARK: - Shared legal content view scaffold

private struct LegalView<Content: View>: View {
    let title: String
    let lastUpdated: String
    @ViewBuilder let content: () -> Content
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Last updated: \(lastUpdated)")
                    .font(.system(size: 12))
                    .foregroundStyle(EVTheme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                content()
            }
            .padding(20)
        }
        .background(EVTheme.bgPrimary)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(EVTheme.bgCard, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .preferredColorScheme(.dark)
    }
}

private struct LegalSection: View {
    let heading: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(heading)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(EVTheme.textPrimary)
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(EVTheme.textSecondary)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EVTheme.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(EVTheme.border, lineWidth: 1))
    }
}

// MARK: - Accuracy Disclaimer

struct DisclaimerView: View {
    var body: some View {
        LegalView(title: "Accuracy Disclaimer", lastUpdated: "January 2025") {

            LegalSection(
                heading: "Range & Energy Estimates",
                text: "EV Route Planner provides estimated energy consumption and driving range based on EPA-rated vehicle efficiency data and route elevation profiles. These are estimates only.\n\nActual range and energy use depend on many factors not modeled by this app, including: ambient temperature and weather conditions, use of heating, air conditioning, and other accessories, driving speed and driving style, road surface conditions, vehicle load and passenger count, battery age and health, and tire pressure.\n\nActual range may be significantly lower than estimated. Always maintain a sufficient battery buffer and never rely solely on this app's estimates when planning a trip."
            )

            LegalSection(
                heading: "Charging Station Data",
                text: "Charger information is sourced from the U.S. Department of Energy's Alternative Fuels Station Locator (NREL AFDC) and Open Charge Map. Station data may be outdated, incomplete, or inaccurate.\n\nBefore beginning your journey, always verify that:\n• Charging stations are operational and open\n• Connectors are compatible with your vehicle\n• The station has available stalls\n• Pricing matches what is shown\n\nEV Route Planner is not responsible for charging stations that are unavailable, out of service, incompatible, or different from what is shown in the app."
            )

            LegalSection(
                heading: "Routing & Navigation",
                text: "Routes are provided by Apple Maps. Road conditions, traffic, closures, and detours may affect actual driving time and distance. Always follow official road signs and current navigation guidance.\n\nDo not use this app while driving. Always plan routes before departure."
            )

            LegalSection(
                heading: "Not a Safety Device",
                text: "EV Route Planner is a planning tool only. It is not a safety device and should not be relied upon to prevent your vehicle from running out of charge. Running out of charge on a road can be dangerous.\n\nAlways plan with extra margin, know the location of charging stations along your route, and have a backup plan in case a charger is unavailable."
            )

            LegalSection(
                heading: "No Warranty",
                text: "EV Route Planner is provided \"as is\" without warranty of any kind. The app developers make no representations or warranties regarding the accuracy, reliability, or completeness of any information provided."
            )
        }
    }
}

// MARK: - Privacy Policy

struct PrivacyPolicyView: View {
    var body: some View {
        LegalView(title: "Privacy Policy", lastUpdated: "January 2025") {

            LegalSection(
                heading: "Overview",
                text: "EV Route Planner is designed with your privacy in mind. We do not create accounts, do not require registration, and do not store your personal information on any server."
            )

            LegalSection(
                heading: "Location Data",
                text: "EV Route Planner requests access to your device's location only when you tap the GPS button to set your trip's starting point. Your location is used solely to populate the origin field and is never stored, logged, or transmitted to our servers.\n\nLocation access is entirely optional. You can type any address manually without granting location permission."
            )

            LegalSection(
                heading: "Route & Trip Data",
                text: "All route planning data — including origin, destination, waypoints, vehicle settings, and preferences — is stored only on your device using Apple's standard UserDefaults system. This data is never transmitted to our servers.\n\nWhen planning a route, the app sends GPS coordinates (latitude and longitude only) to third-party services to fetch elevation data and locate nearby charging stations. No personal information is included in these requests."
            )

            LegalSection(
                heading: "Third-Party Services",
                text: "EV Route Planner uses the following third-party services. Each has its own privacy policy:\n\n• Apple Maps (MapKit) — route calculation and map display\n• NREL Alternative Fuels Station Locator — charging station data (U.S. Dept. of Energy)\n• Open Charge Map — supplemental charger speed data\n• Open-Elevation / Open-Meteo — elevation data\n\nThese services receive only the GPS coordinates necessary to perform their function. No name, account, or device identifier is sent."
            )

            LegalSection(
                heading: "Analytics & Advertising",
                text: "EV Route Planner does not use any analytics SDKs, does not serve advertising, and does not include any third-party tracking code."
            )

            LegalSection(
                heading: "Children's Privacy",
                text: "EV Route Planner does not knowingly collect any data from children under 13. The app has no data collection mechanisms."
            )

            LegalSection(
                heading: "Changes to This Policy",
                text: "If we update this privacy policy, the new version will be included in future app updates. Continued use of the app after an update constitutes acceptance of the revised policy."
            )

            LegalSection(
                heading: "Contact",
                text: "If you have questions about this privacy policy, contact us at:\nsupport@evrouteplanner.org"
            )
        }
    }
}

// MARK: - Terms of Use

struct TermsOfUseView: View {
    var body: some View {
        LegalView(title: "Terms of Use", lastUpdated: "January 2025") {

            LegalSection(
                heading: "Acceptance of Terms",
                text: "By downloading or using EV Route Planner, you agree to these Terms of Use. If you do not agree, do not use the app."
            )

            LegalSection(
                heading: "Use of the App",
                text: "EV Route Planner is intended for personal, non-commercial trip planning purposes. You agree to use the app lawfully and not to:\n\n• Attempt to reverse engineer, modify, or extract the app's code\n• Use the app in any way that could damage or impair its operation\n• Misrepresent or misuse any information provided by the app"
            )

            LegalSection(
                heading: "Accuracy of Information",
                text: "Route, energy, and charging station information provided by this app is for planning purposes only and may not be accurate. See the Accuracy Disclaimer for full details. You assume all risk from relying on information provided by this app."
            )

            LegalSection(
                heading: "Limitation of Liability",
                text: "To the fullest extent permitted by law, EV Route Planner and its developers shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from your use of the app, including but not limited to:\n\n• Vehicle running out of charge\n• Unavailable or non-functional charging stations\n• Inaccurate range or energy estimates\n• Routing errors or delays\n• Any personal injury, property damage, or financial loss"
            )

            LegalSection(
                heading: "Intellectual Property",
                text: "EV Route Planner and its content, features, and functionality are owned by its developers and are protected by copyright and other intellectual property laws."
            )

            LegalSection(
                heading: "Third-Party Services",
                text: "The app relies on third-party data providers (Apple Maps, NREL, Open Charge Map, Open-Meteo). We are not responsible for the availability, accuracy, or terms of these services."
            )

            LegalSection(
                heading: "Governing Law",
                text: "These terms are governed by the laws of the State of California, United States, without regard to its conflict of law provisions."
            )

            LegalSection(
                heading: "Changes to Terms",
                text: "We reserve the right to update these terms at any time. Updated terms will be included in future app updates. Continued use of the app constitutes acceptance of any revised terms."
            )
        }
    }
}

// MARK: - Data Sources & Attribution

struct DataSourcesView: View {
    var body: some View {
        LegalView(title: "Data Sources", lastUpdated: "January 2025") {

            LegalSection(
                heading: "Charging Station Data",
                text: "DC fast charging station locations, networks, connectors, and hours are sourced from the U.S. Department of Energy's Alternative Fuels Station Locator, provided by the National Renewable Energy Laboratory (NREL).\n\nAPI: developer.nrel.gov/api/alt-fuel-stations\nLicense: U.S. Government Open Data"
            )

            LegalSection(
                heading: "Charger Speed Data",
                text: "Real-time charger power ratings (kW) are supplemented by Open Charge Map, an open community-driven database of EV charging locations.\n\nAPI: openchargemap.io\nLicense: Creative Commons Attribution 4.0 (CC BY 4.0)"
            )

            LegalSection(
                heading: "Elevation Data",
                text: "Route elevation profiles are provided by Open-Elevation and Open-Meteo, both free and open elevation APIs.\n\nPrimary: open-elevation.com\nFallback: open-meteo.com/v1/elevation\nLicense: Open Data"
            )

            LegalSection(
                heading: "Mapping & Routing",
                text: "Maps, directions, and route polylines are provided by Apple Maps via the MapKit framework.\n\nApple Maps is subject to Apple's Maps Terms of Service.\nmaps.apple.com"
            )

            LegalSection(
                heading: "Vehicle Efficiency Data",
                text: "Vehicle efficiency ratings (kWh/100mi) are sourced from fueleconomy.gov, the official U.S. government source for fuel economy information, maintained by the U.S. Department of Energy and U.S. Environmental Protection Agency.\n\nSource: fueleconomy.gov/feg/download.do\nLicense: U.S. Government Open Data"
            )

            LegalSection(
                heading: "Open Source",
                text: "EV Route Planner is built on Apple's SwiftUI framework and makes use of standard iOS APIs. No third-party open source libraries are included in this app."
            )
        }
    }
}
