import SwiftUI

enum EVTheme {
    // Core backgrounds (from web app)
    static let bgPrimary = Color(hex: "#0f1117")       // body background
    static let bgCard = Color(hex: "#1a1d28")           // sidebar / card background
    static let bgInput = Color(hex: "#252836")          // input / elevated surface
    static let bgTopBar = Color(hex: "#1a1d28")         // top bar

    // Borders
    static let border = Color(hex: "#2d3040")

    // Text
    static let textPrimary = Color(hex: "#e1e4e8")
    static let textSecondary = Color(hex: "#8b8fa3")

    // Accents
    static let accentGreen = Color(hex: "#34d399")
    static let accentBlue = Color(hex: "#60a5fa")
    static let accentRed = Color(hex: "#ef4444")
    static let accentYellow = Color(hex: "#fbbf24")
    static let accentOrange = Color(hex: "#f97316")

    // Button
    static let btnGradientStart = Color(hex: "#34d399")
    static let btnGradientEnd = Color(hex: "#059669")

    // Badge backgrounds
    static let badgeBest = Color(hex: "#34d399").opacity(0.2)
    static let badgeFastest = Color(hex: "#60a5fa").opacity(0.2)
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)

        let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = Double((rgbValue & 0x0000FF)) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}
