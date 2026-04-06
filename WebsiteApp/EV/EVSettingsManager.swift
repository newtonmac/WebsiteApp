import SwiftUI

/// Centralized settings manager using @AppStorage for persistence across launches.
/// All EV route planning preferences live here and are consumed by views and services.
final class EVSettingsManager: ObservableObject {

    static let shared = EVSettingsManager()

    // MARK: - Vehicle & Battery

    /// Starting battery charge percentage (0–100)
    @AppStorage("ev_startChargePct") var startChargePct: Double = 100

    /// Minimum arrival charge percentage — never plan to arrive below this
    @AppStorage("ev_minArrivalPct") var minArrivalPct: Double = 15

    /// Target charge percentage at each charging stop
    @AppStorage("ev_chargeTargetPct") var chargeTargetPct: Double = 80

    /// Preferred minimum charger speed in kW (0 = no preference)
    @AppStorage("ev_preferredChargerSpeedKw") var preferredChargerSpeedKw: Double = 50

    /// Show Level 2 charger counts alongside DC Fast on map badges
    @AppStorage("ev_showLevel2Counts") var showLevel2Counts: Bool = true

    // MARK: - Route Preferences

    /// Avoid highways when requesting directions
    @AppStorage("ev_avoidHighways") var avoidHighways: Bool = false

    /// Avoid toll roads when requesting directions
    @AppStorage("ev_avoidTolls") var avoidTolls: Bool = false

    /// Maximum detour distance (miles) to reach a charger
    @AppStorage("ev_maxDetourMiles") var maxDetourMiles: Double = 15

    /// Minimum charging stop duration in minutes (includes parking, plugging in, etc.)
    @AppStorage("ev_preferredStopMinutes") var preferredStopMinutes: Double = 30

    // MARK: - Display

    /// true = miles, false = kilometers
    @AppStorage("ev_useMiles") var useMiles: Bool = true

    /// Electricity cost per kWh for cost estimates
    @AppStorage("ev_electricityCostPerKwh") var electricityCostPerKwh: Double = 0.16

    // MARK: - Charging Networks (stored as comma-separated raw values)

    @AppStorage("ev_defaultNetworks_v2") var defaultNetworksRaw: String = ""

    /// Decoded set of default networks. Empty string = none selected (user must opt in).
    var defaultNetworks: Set<ChargerNetwork> {
        get {
            guard !defaultNetworksRaw.isEmpty else { return [] }  // none by default
            let ids = defaultNetworksRaw.split(separator: ",").map(String.init)
            return Set(ids.compactMap { id in ChargerNetwork.allCases.first { $0.rawValue == id } })
        }
        set {
            // Always store explicit IDs — empty string reliably means "none"
            defaultNetworksRaw = newValue.map(\.rawValue).sorted().joined(separator: ",")
        }
    }

    // MARK: - Last Selected Vehicle

    @AppStorage("ev_lastVehicleId") var lastVehicleId: String = ""

    var lastVehicle: EVVehicle? {
        EVDatabase.vehicles.first { $0.id == lastVehicleId }
    }

    // MARK: - Helpers

    /// Distance string with unit
    func distanceString(_ miles: Double) -> String {
        if useMiles {
            return String(format: "%.1f mi", miles)
        } else {
            return String(format: "%.1f km", miles * EVConstants.kmPerMile)
        }
    }

    /// Distance value converted
    func distanceValue(_ miles: Double) -> Double {
        useMiles ? miles : miles * EVConstants.kmPerMile
    }

    /// Unit label
    var distanceUnit: String { useMiles ? "mi" : "km" }

    /// Speed unit label
    var speedUnit: String { useMiles ? "mph" : "km/h" }

    /// Efficiency string
    func efficiencyString(kwhPerMile: Double) -> String {
        if useMiles {
            return String(format: "%.2f kWh/mi", kwhPerMile)
        } else {
            return String(format: "%.2f kWh/km", kwhPerMile / EVConstants.kmPerMile)
        }
    }

    /// Efficiency label (mi/kWh or km/kWh)
    func efficiencyInverse(miPerKwh: Double) -> String {
        if useMiles {
            return String(format: "%.1f mi/kWh", miPerKwh)
        } else {
            return String(format: "%.1f km/kWh", miPerKwh * EVConstants.kmPerMile)
        }
    }

    /// Reset all settings to defaults
    func resetToDefaults() {
        startChargePct = 100
        minArrivalPct = 15
        chargeTargetPct = 80
        preferredChargerSpeedKw = 50
        showLevel2Counts = true
        avoidHighways = false
        avoidTolls = false
        maxDetourMiles = 15
        preferredStopMinutes = 30
        useMiles = true
        electricityCostPerKwh = 0.16
        defaultNetworksRaw = ""
        lastVehicleId = ""
    }
}
