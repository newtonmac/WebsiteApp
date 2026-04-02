import Foundation

struct EVVehicle: Identifiable, Hashable {
    let id: String
    let brand: String
    let model: String
    let batteryKwh: Double
    let epaKwhPer100Mi: Double  // Official EPA combined kWh/100mi (source: fueleconomy.gov)
    let effKwhMi: Double        // Real-world flat baseline = epaKwhPer100Mi × 1.05 / 100
    let weightKg: Double
    let regenEff: Double        // regen braking efficiency (realistic, not theoretical max)
    let epaMiles: Int

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
    // Source: fueleconomy.gov vehicles.csv — EPA combE values × 1.05 real-world factor
    static let vehicles: [EVVehicle] = [
        // Tesla
        EVVehicle(id: "model3_sr", brand: "Tesla", model: "Model 3",
                  batteryKwh: 57.5, epaKwhPer100Mi: 25.5, effKwhMi: 0.268, weightKg: 1752, regenEff: 0.50, epaMiles: 272),
        EVVehicle(id: "model3_lr", brand: "Tesla", model: "Model 3 Long Range",
                  batteryKwh: 75, epaKwhPer100Mi: 25.8, effKwhMi: 0.271, weightKg: 1830, regenEff: 0.50, epaMiles: 358),
        EVVehicle(id: "modely_lr", brand: "Tesla", model: "Model Y Long Range",
                  batteryKwh: 75, epaKwhPer100Mi: 27.6, effKwhMi: 0.290, weightKg: 1979, regenEff: 0.50, epaMiles: 330),
        EVVehicle(id: "modely_perf", brand: "Tesla", model: "Model Y Performance",
                  batteryKwh: 75, epaKwhPer100Mi: 30.5, effKwhMi: 0.320, weightKg: 2003, regenEff: 0.50, epaMiles: 303),
        EVVehicle(id: "models_lr", brand: "Tesla", model: "Model S Long Range",
                  batteryKwh: 100, epaKwhPer100Mi: 28.2, effKwhMi: 0.296, weightKg: 2108, regenEff: 0.48, epaMiles: 405),
        EVVehicle(id: "modelx_lr", brand: "Tesla", model: "Model X Long Range",
                  batteryKwh: 100, epaKwhPer100Mi: 33.1, effKwhMi: 0.348, weightKg: 2352, regenEff: 0.46, epaMiles: 348),
        EVVehicle(id: "cybertruck_awd", brand: "Tesla", model: "Cybertruck AWD",
                  batteryKwh: 123, epaKwhPer100Mi: 42.9, effKwhMi: 0.450, weightKg: 3104, regenEff: 0.40, epaMiles: 325),
        EVVehicle(id: "cybertruck_beast", brand: "Tesla", model: "Cybertruck Cyberbeast",
                  batteryKwh: 123, epaKwhPer100Mi: 44.5, effKwhMi: 0.467, weightKg: 3200, regenEff: 0.40, epaMiles: 301),

        // Rivian
        EVVehicle(id: "r1t_lg", brand: "Rivian", model: "R1T Large Pack",
                  batteryKwh: 135, epaKwhPer100Mi: 46.1, effKwhMi: 0.484, weightKg: 3200, regenEff: 0.38, epaMiles: 328),
        EVVehicle(id: "r1s_lg", brand: "Rivian", model: "R1S Large Pack",
                  batteryKwh: 135, epaKwhPer100Mi: 47.4, effKwhMi: 0.498, weightKg: 3150, regenEff: 0.38, epaMiles: 321),

        // Ford
        EVVehicle(id: "mach_e_er", brand: "Ford", model: "Mustang Mach-E ER",
                  batteryKwh: 91, epaKwhPer100Mi: 34.3, effKwhMi: 0.360, weightKg: 2100, regenEff: 0.46, epaMiles: 312),
        EVVehicle(id: "f150_er", brand: "Ford", model: "F-150 Lightning ER",
                  batteryKwh: 131, epaKwhPer100Mi: 47.9, effKwhMi: 0.503, weightKg: 2950, regenEff: 0.38, epaMiles: 320),

        // Hyundai / Kia
        EVVehicle(id: "ioniq5_lr", brand: "Hyundai", model: "Ioniq 5 Long Range",
                  batteryKwh: 77.4, epaKwhPer100Mi: 34.0, effKwhMi: 0.357, weightKg: 2000, regenEff: 0.48, epaMiles: 303),
        EVVehicle(id: "ioniq6_lr", brand: "Hyundai", model: "Ioniq 6 Long Range",
                  batteryKwh: 77.4, epaKwhPer100Mi: 24.0, effKwhMi: 0.252, weightKg: 1955, regenEff: 0.50, epaMiles: 361),
        EVVehicle(id: "ev6_lr", brand: "Kia", model: "EV6 Long Range",
                  batteryKwh: 77.4, epaKwhPer100Mi: 29.0, effKwhMi: 0.305, weightKg: 2055, regenEff: 0.48, epaMiles: 310),

        // Volkswagen
        EVVehicle(id: "id4_pro", brand: "Volkswagen", model: "ID.4 Pro S",
                  batteryKwh: 82, epaKwhPer100Mi: 29.8, effKwhMi: 0.313, weightKg: 2124, regenEff: 0.46, epaMiles: 291),

        // BMW / Mercedes
        EVVehicle(id: "ix_50", brand: "BMW", model: "iX xDrive50",
                  batteryKwh: 105.2, epaKwhPer100Mi: 39.0, effKwhMi: 0.410, weightKg: 2510, regenEff: 0.45, epaMiles: 324),
        EVVehicle(id: "eqs_450", brand: "Mercedes", model: "EQS 450+",
                  batteryKwh: 108.4, epaKwhPer100Mi: 34.0, effKwhMi: 0.357, weightKg: 2480, regenEff: 0.46, epaMiles: 390),

        // Chevrolet
        EVVehicle(id: "bolt_euv", brand: "Chevrolet", model: "Bolt EUV",
                  batteryKwh: 65, epaKwhPer100Mi: 29.4, effKwhMi: 0.309, weightKg: 1709, regenEff: 0.48, epaMiles: 247),
        EVVehicle(id: "equinox_ev", brand: "Chevrolet", model: "Equinox EV",
                  batteryKwh: 85, epaKwhPer100Mi: 35.1, effKwhMi: 0.369, weightKg: 2150, regenEff: 0.46, epaMiles: 285),

        // Nissan
        EVVehicle(id: "leaf_plus", brand: "Nissan", model: "Leaf S Plus",
                  batteryKwh: 60, epaKwhPer100Mi: 30.8, effKwhMi: 0.323, weightKg: 1748, regenEff: 0.44, epaMiles: 212),
        EVVehicle(id: "ariya", brand: "Nissan", model: "Ariya",
                  batteryKwh: 87, epaKwhPer100Mi: 35.3, effKwhMi: 0.371, weightKg: 2100, regenEff: 0.46, epaMiles: 272),

        // Polestar / Lucid
        EVVehicle(id: "polestar2_lr", brand: "Polestar", model: "Polestar 2 Long Range",
                  batteryKwh: 78, epaKwhPer100Mi: 31.7, effKwhMi: 0.333, weightKg: 2065, regenEff: 0.48, epaMiles: 276),
        EVVehicle(id: "lucid_air_gt", brand: "Lucid", model: "Air Grand Touring",
                  batteryKwh: 112, epaKwhPer100Mi: 25.7, effKwhMi: 0.270, weightKg: 2360, regenEff: 0.48, epaMiles: 516),
    ]

    static var groupedByBrand: [(brand: String, vehicles: [EVVehicle])] {
        let grouped = Dictionary(grouping: vehicles, by: \.brand)
        return grouped.sorted { $0.key < $1.key }.map { (brand: $0.key, vehicles: $0.value) }
    }
}
