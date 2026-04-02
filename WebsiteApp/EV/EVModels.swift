import Foundation

struct EVVehicle: Identifiable, Hashable {
    let id: String
    let brand: String
    let model: String
    let batteryKwh: Double
    let effKwhMi: Double    // EPA kWh per mile (highway mix, used as fallback)
    let weightKg: Double
    let regenEff: Double    // regen braking efficiency (0.0–1.0)
    let epaMiles: Int
    let dragCoeff: Double   // aerodynamic drag coefficient (Cd)
    let frontalArea: Double // frontal area in m²
    let rollingResistance: Double // tire rolling resistance coefficient (Crr)

    var displayName: String { "\(brand) \(model)" }
    var batteryDescription: String { "\(Int(batteryKwh)) kWh" }

    /// Range description respecting the user's distance unit preference
    var rangeDescription: String {
        let settings = EVSettingsManager.shared
        if settings.useMiles {
            return "\(epaMiles) mi EPA"
        } else {
            return "\(Int(Double(epaMiles) * EVConstants.kmPerMile)) km EPA"
        }
    }

    /// Efficiency description respecting the user's distance unit preference
    var efficiencyDescription: String {
        let settings = EVSettingsManager.shared
        return settings.efficiencyString(kwhPerMile: effKwhMi)
    }
}

enum EVDatabase {
    // Cd = drag coefficient, A = frontal area (m²), Crr = rolling resistance
    static let vehicles: [EVVehicle] = [
        // Tesla
        EVVehicle(id: "model3_sr", brand: "Tesla", model: "Model 3",
                  batteryKwh: 57.5, effKwhMi: 0.27, weightKg: 1752, regenEff: 0.50, epaMiles: 272,
                  dragCoeff: 0.23, frontalArea: 2.22, rollingResistance: 0.007),
        EVVehicle(id: "model3_lr", brand: "Tesla", model: "Model 3 Long Range",
                  batteryKwh: 75, effKwhMi: 0.27, weightKg: 1830, regenEff: 0.50, epaMiles: 358,
                  dragCoeff: 0.23, frontalArea: 2.22, rollingResistance: 0.007),
        EVVehicle(id: "modely_lr", brand: "Tesla", model: "Model Y Long Range",
                  batteryKwh: 75, effKwhMi: 0.30, weightKg: 1979, regenEff: 0.50, epaMiles: 330,
                  dragCoeff: 0.23, frontalArea: 2.58, rollingResistance: 0.008),
        EVVehicle(id: "modely_perf", brand: "Tesla", model: "Model Y Performance",
                  batteryKwh: 75, effKwhMi: 0.31, weightKg: 2003, regenEff: 0.50, epaMiles: 303,
                  dragCoeff: 0.23, frontalArea: 2.58, rollingResistance: 0.008),
        EVVehicle(id: "models_lr", brand: "Tesla", model: "Model S Long Range",
                  batteryKwh: 100, effKwhMi: 0.32, weightKg: 2108, regenEff: 0.48, epaMiles: 405,
                  dragCoeff: 0.208, frontalArea: 2.34, rollingResistance: 0.007),
        EVVehicle(id: "modelx_lr", brand: "Tesla", model: "Model X Long Range",
                  batteryKwh: 100, effKwhMi: 0.37, weightKg: 2352, regenEff: 0.46, epaMiles: 348,
                  dragCoeff: 0.24, frontalArea: 2.73, rollingResistance: 0.008),
        EVVehicle(id: "cybertruck_awd", brand: "Tesla", model: "Cybertruck AWD",
                  batteryKwh: 123, effKwhMi: 0.45, weightKg: 3104, regenEff: 0.40, epaMiles: 318,
                  dragCoeff: 0.34, frontalArea: 3.30, rollingResistance: 0.010),
        EVVehicle(id: "cybertruck_beast", brand: "Tesla", model: "Cybertruck Cyberbeast",
                  batteryKwh: 123, effKwhMi: 0.48, weightKg: 3200, regenEff: 0.40, epaMiles: 301,
                  dragCoeff: 0.34, frontalArea: 3.30, rollingResistance: 0.010),

        // Rivian
        EVVehicle(id: "r1t_lg", brand: "Rivian", model: "R1T Large Pack",
                  batteryKwh: 135, effKwhMi: 0.50, weightKg: 3200, regenEff: 0.38, epaMiles: 328,
                  dragCoeff: 0.33, frontalArea: 3.20, rollingResistance: 0.010),
        EVVehicle(id: "r1s_lg", brand: "Rivian", model: "R1S Large Pack",
                  batteryKwh: 135, effKwhMi: 0.50, weightKg: 3150, regenEff: 0.38, epaMiles: 321,
                  dragCoeff: 0.33, frontalArea: 3.10, rollingResistance: 0.010),

        // Ford
        EVVehicle(id: "mach_e_er", brand: "Ford", model: "Mustang Mach-E ER",
                  batteryKwh: 91, effKwhMi: 0.36, weightKg: 2100, regenEff: 0.46, epaMiles: 312,
                  dragCoeff: 0.27, frontalArea: 2.63, rollingResistance: 0.008),
        EVVehicle(id: "f150_er", brand: "Ford", model: "F-150 Lightning ER",
                  batteryKwh: 131, effKwhMi: 0.50, weightKg: 2950, regenEff: 0.38, epaMiles: 320,
                  dragCoeff: 0.38, frontalArea: 3.40, rollingResistance: 0.011),

        // Hyundai / Kia
        EVVehicle(id: "ioniq5_lr", brand: "Hyundai", model: "Ioniq 5 Long Range",
                  batteryKwh: 77.4, effKwhMi: 0.31, weightKg: 2000, regenEff: 0.48, epaMiles: 303,
                  dragCoeff: 0.288, frontalArea: 2.63, rollingResistance: 0.008),
        EVVehicle(id: "ioniq6_lr", brand: "Hyundai", model: "Ioniq 6 Long Range",
                  batteryKwh: 77.4, effKwhMi: 0.27, weightKg: 1955, regenEff: 0.50, epaMiles: 361,
                  dragCoeff: 0.21, frontalArea: 2.25, rollingResistance: 0.007),
        EVVehicle(id: "ev6_lr", brand: "Kia", model: "EV6 Long Range",
                  batteryKwh: 77.4, effKwhMi: 0.31, weightKg: 2055, regenEff: 0.48, epaMiles: 310,
                  dragCoeff: 0.288, frontalArea: 2.58, rollingResistance: 0.008),

        // Volkswagen
        EVVehicle(id: "id4_pro", brand: "Volkswagen", model: "ID.4 Pro S",
                  batteryKwh: 82, effKwhMi: 0.33, weightKg: 2124, regenEff: 0.46, epaMiles: 275,
                  dragCoeff: 0.28, frontalArea: 2.65, rollingResistance: 0.008),

        // BMW / Mercedes
        EVVehicle(id: "ix_50", brand: "BMW", model: "iX xDrive50",
                  batteryKwh: 105.2, effKwhMi: 0.36, weightKg: 2510, regenEff: 0.45, epaMiles: 324,
                  dragCoeff: 0.25, frontalArea: 2.83, rollingResistance: 0.008),
        EVVehicle(id: "eqs_450", brand: "Mercedes", model: "EQS 450+",
                  batteryKwh: 108.4, effKwhMi: 0.33, weightKg: 2480, regenEff: 0.46, epaMiles: 350,
                  dragCoeff: 0.20, frontalArea: 2.51, rollingResistance: 0.007),

        // Chevrolet
        EVVehicle(id: "bolt_euv", brand: "Chevrolet", model: "Bolt EUV",
                  batteryKwh: 65, effKwhMi: 0.31, weightKg: 1709, regenEff: 0.48, epaMiles: 247,
                  dragCoeff: 0.31, frontalArea: 2.38, rollingResistance: 0.008),
        EVVehicle(id: "equinox_ev", brand: "Chevrolet", model: "Equinox EV",
                  batteryKwh: 85, effKwhMi: 0.32, weightKg: 2150, regenEff: 0.46, epaMiles: 319,
                  dragCoeff: 0.28, frontalArea: 2.65, rollingResistance: 0.008),

        // Nissan
        EVVehicle(id: "leaf_plus", brand: "Nissan", model: "Leaf S Plus",
                  batteryKwh: 60, effKwhMi: 0.33, weightKg: 1748, regenEff: 0.44, epaMiles: 212,
                  dragCoeff: 0.28, frontalArea: 2.27, rollingResistance: 0.008),
        EVVehicle(id: "ariya", brand: "Nissan", model: "Ariya",
                  batteryKwh: 87, effKwhMi: 0.34, weightKg: 2100, regenEff: 0.46, epaMiles: 304,
                  dragCoeff: 0.297, frontalArea: 2.64, rollingResistance: 0.008),

        // Polestar / Lucid
        EVVehicle(id: "polestar2_lr", brand: "Polestar", model: "Polestar 2 Long Range",
                  batteryKwh: 78, effKwhMi: 0.31, weightKg: 2065, regenEff: 0.48, epaMiles: 295,
                  dragCoeff: 0.278, frontalArea: 2.35, rollingResistance: 0.008),
        EVVehicle(id: "lucid_air_gt", brand: "Lucid", model: "Air Grand Touring",
                  batteryKwh: 112, effKwhMi: 0.27, weightKg: 2360, regenEff: 0.48, epaMiles: 516,
                  dragCoeff: 0.197, frontalArea: 2.32, rollingResistance: 0.007),
    ]

    static var groupedByBrand: [(brand: String, vehicles: [EVVehicle])] {
        let grouped = Dictionary(grouping: vehicles, by: \.brand)
        return grouped.sorted { $0.key < $1.key }.map { (brand: $0.key, vehicles: $0.value) }
    }
}
