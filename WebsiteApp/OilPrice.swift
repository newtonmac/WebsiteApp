//
//  OilPrice.swift
//  WebsiteApp
//

import Foundation

struct OilPrice: Identifiable, Codable {
    var id: String { date }
    let date: String
    let price: Double

    var dateValue: Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: date) ?? Date()
    }
}

enum OilType: String, CaseIterable, Identifiable {
    case wti = "WTI Crude"
    case brent = "Brent Crude"

    var id: String { rawValue }
}

enum TimeRange: String, CaseIterable, Identifiable {
    case oneWeek = "1W"
    case oneMonth = "1M"
    case threeMonths = "3M"
    case sixMonths = "6M"
    case oneYear = "1Y"

    var id: String { rawValue }

    var days: Int {
        switch self {
        case .oneWeek: return 7
        case .oneMonth: return 30
        case .threeMonths: return 90
        case .sixMonths: return 180
        case .oneYear: return 365
        }
    }
}
