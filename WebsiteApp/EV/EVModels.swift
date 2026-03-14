import Foundation

struct EVVehicle: Identifiable, Hashable {
    let id: String
    let brand: String
    let model: String
    let batteryKwh: Double
    let effKwhMi: Double    // EPA kWh per mile (highway mix)
    let weightKg: Double
    let regenEff: Double    // regen braking efficiency (0.0–1.0)
    let epaMiles: Int

    var displayName: String { "\(brand) \(model)" }
    var rangeDescription: String { "\(epaMiles) mi EPA" }
    var batteryDescription: String { "\(Int(batteryKwh)) kWh" }
}

enum EVDatabase {
    static let vehicles: [EVVehicle] = [
        // Tesla
        EVVehicle(id: "model3_sr", brand: "Tesla", model: "Model 3",
                  batteryKwh: 57.5, effKwhMi: 0.25, weightKg: 1752, regenEff: 0.62, epaMiles: 272),
        EVVehicle(id: "model3_lr", brand: "Tesla", model: "Model 3 Long Range",
                  batteryKwh: 75, effKwhMi: 0.25, weightKg: 1830, regenEff: 0.63, epaMiles: 358),
        EVVehicle(id: "modely_lr", brand: "Tesla", model: "Model Y Long Range",
                  batteryKwh: 75, effKwhMi: 0.27, weightKg: 1979, regenEff: 0.62, epaMiles: 330),
        EVVehicle(id: "modely_perf", brand: "Tesla", model: "Model Y Performance",
                  batteryKwh: 75, effKwhMi: 0.28, weightKg: 2003, regenEff: 0.61, epaMiles: 303),
        EVVehicle(id: "models_lr", brand: "Tesla", model: "Model S Long Range",
                  batteryKwh: 100, effKwhMi: 0.30, weightKg: 2108, regenEff: 0.60, epaMiles: 405),
        EVVehicle(id: "modelx_lr", brand: "Tesla", model: "Model X Long Range",
                  batteryKwh: 100, effKwhMi: 0.34, weightKg: 2352, regenEff: 0.58, epaMiles: 348),
        EVVehicle(id: "cybertruck_awd", brand: "Tesla", model: "Cybertruck AWD",
                  batteryKwh: 123, effKwhMi: 0.41, weightKg: 3104, regenEff: 0.55, epaMiles: 318),
        EVVehicle(id: "cybertruck_beast", brand: "Tesla", model: "Cybertruck Cyberbeast",
                  batteryKwh: 123, effKwhMi: 0.44, weightKg: 3200, regenEff: 0.53, epaMiles: 301),

        // Rivian
        EVVehicle(id: "r1t_lg", brand: "Rivian", model: "R1T Large Pack",
                  batteryKwh: 135, effKwhMi: 0.48, weightKg: 3200, regenEff: 0.52, epaMiles: 328),
        EVVehicle(id: "r1s_lg", brand: "Rivian", model: "R1S Large Pack",
                  batteryKwh: 135, effKwhMi: 0.47, weightKg: 3150, regenEff: 0.53, epaMiles: 321),

        // Ford
        EVVehicle(id: "mach_e_er", brand: "Ford", model: "Mustang Mach-E ER",
                  batteryKwh: 91, effKwhMi: 0.33, weightKg: 2100, regenEff: 0.58, epaMiles: 312),
        EVVehicle(id: "f150_er", brand: "Ford", model: "F-150 Lightning ER",
                  batteryKwh: 131, effKwhMi: 0.47, weightKg: 2950, regenEff: 0.50, epaMiles: 320),

        // Hyundai / Kia
        EVVehicle(id: "ioniq5_lr", brand: "Hyundai", model: "Ioniq 5 Long Range",
                  batteryKwh: 77.4, effKwhMi: 0.29, weightKg: 2000, regenEff: 0.60, epaMiles: 303),
        EVVehicle(id: "ioniq6_lr", brand: "Hyundai", model: "Ioniq 6 Long Range",
                  batteryKwh: 77.4, effKwhMi: 0.26, weightKg: 1955, regenEff: 0.62, epaMiles: 361),
        EVVehicle(id: "ev6_lr", brand: "Kia", model: "EV6 Long Range",
                  batteryKwh: 77.4, effKwhMi: 0.29, weightKg: 2055, regenEff: 0.60, epaMiles: 310),

        // Volkswagen
        EVVehicle(id: "id4_pro", brand: "Volkswagen", model: "ID.4 Pro S",
                  batteryKwh: 82, effKwhMi: 0.30, weightKg: 2124, regenEff: 0.58, epaMiles: 275),

        // BMW / Mercedes
        EVVehicle(id: "ix_50", brand: "BMW", model: "iX xDrive50",
                  batteryKwh: 105.2, effKwhMi: 0.33, weightKg: 2510, regenEff: 0.57, epaMiles: 324),
        EVVehicle(id: "eqs_450", brand: "Mercedes", model: "EQS 450+",
                  batteryKwh: 108.4, effKwhMi: 0.30, weightKg: 2480, regenEff: 0.58, epaMiles: 350),

        // Chevrolet
        EVVehicle(id: "bolt_euv", brand: "Chevrolet", model: "Bolt EUV",
                  batteryKwh: 65, effKwhMi: 0.29, weightKg: 1709, regenEff: 0.58, epaMiles: 247),
        EVVehicle(id: "equinox_ev", brand: "Chevrolet", model: "Equinox EV",
                  batteryKwh: 85, effKwhMi: 0.30, weightKg: 2150, regenEff: 0.58, epaMiles: 319),

        // Nissan
        EVVehicle(id: "leaf_plus", brand: "Nissan", model: "Leaf S Plus",
                  batteryKwh: 60, effKwhMi: 0.30, weightKg: 1748, regenEff: 0.55, epaMiles: 212),
        EVVehicle(id: "ariya", brand: "Nissan", model: "Ariya",
                  batteryKwh: 87, effKwhMi: 0.32, weightKg: 2100, regenEff: 0.57, epaMiles: 304),

        // Polestar / Lucid
        EVVehicle(id: "polestar2_lr", brand: "Polestar", model: "Polestar 2 Long Range",
                  batteryKwh: 78, effKwhMi: 0.29, weightKg: 2065, regenEff: 0.60, epaMiles: 295),
        EVVehicle(id: "lucid_air_gt", brand: "Lucid", model: "Air Grand Touring",
                  batteryKwh: 112, effKwhMi: 0.27, weightKg: 2360, regenEff: 0.60, epaMiles: 516),
    ]

    static var groupedByBrand: [(brand: String, vehicles: [EVVehicle])] {
        let grouped = Dictionary(grouping: vehicles, by: \.brand)
        return grouped.sorted { $0.key < $1.key }.map { (brand: $0.key, vehicles: $0.value) }
    }
}
