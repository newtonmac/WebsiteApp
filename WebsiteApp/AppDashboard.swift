//
//  AppDashboard.swift
//  WebsiteApp
//

import SwiftUI

struct AppDashboard: Identifiable {
    let id: String
    let name: String
    let description: String
    let icon: String
    let accentColor: Color
    let webPath: String
    let isNative: Bool

    static let baseURL = "https://newtonmac-websiteapp.vercel.app"

    var webURL: URL? {
        URL(string: "\(Self.baseURL)/\(webPath)")
    }

    static let allDashboards: [AppDashboard] = [
        AppDashboard(
            id: "oil-tracker",
            name: "Oil Tracker",
            description: "Crude oil prices \u{2022} WTI, Brent, Maya",
            icon: "fuelpump.fill",
            accentColor: Color(hex: "#3b82f6"),
            webPath: "oil-tracker.html",
            isNative: true
        ),
        AppDashboard(
            id: "gold-tracker",
            name: "Gold Tracker",
            description: "Live gold price \u{2022} Charts & history",
            icon: "circle.fill",
            accentColor: Color(hex: "#f59e0b"),
            webPath: "gold-tracker.html",
            isNative: false
        ),
        AppDashboard(
            id: "silver-tracker",
            name: "Silver Tracker",
            description: "Live silver price \u{2022} Charts & history",
            icon: "circle.fill",
            accentColor: Color(hex: "#94a3b8"),
            webPath: "silver-tracker.html",
            isNative: false
        ),
        AppDashboard(
            id: "bitcoin-tracker",
            name: "Bitcoin Tracker",
            description: "BTC price \u{2022} Crypto charts",
            icon: "bitcoinsign.circle.fill",
            accentColor: Color(hex: "#f97316"),
            webPath: "bitcoin-tracker.html",
            isNative: false
        ),
        AppDashboard(
            id: "currency-tracker",
            name: "MXN/USD Tracker",
            description: "Peso-dollar exchange rate",
            icon: "dollarsign.arrow.circlepath",
            accentColor: Color(hex: "#10b981"),
            webPath: "currency-tracker.html",
            isNative: false
        ),
        AppDashboard(
            id: "live-tracker",
            name: "Live Tracker",
            description: "Real-time market data",
            icon: "chart.line.uptrend.xyaxis",
            accentColor: Color(hex: "#ef4444"),
            webPath: "live-tracker.html",
            isNative: false
        ),
        AppDashboard(
            id: "flight-tracker",
            name: "Flight Tracker",
            description: "Live flights on the map",
            icon: "airplane",
            accentColor: Color(hex: "#6366f1"),
            webPath: "flight-tracker.html",
            isNative: false
        ),
        AppDashboard(
            id: "sky-tracker",
            name: "Sky Tracker",
            description: "Sky & weather conditions",
            icon: "cloud.sun.fill",
            accentColor: Color(hex: "#8b5cf6"),
            webPath: "sky-tracker.html",
            isNative: false
        ),
        AppDashboard(
            id: "traffic-dashboard",
            name: "Traffic Dashboard",
            description: "Live traffic maps & cams",
            icon: "car.fill",
            accentColor: Color(hex: "#ec4899"),
            webPath: "traffic-dashboard.html",
            isNative: false
        ),
        AppDashboard(
            id: "webcam-dashboard",
            name: "SD Webcams",
            description: "San Diego live webcams",
            icon: "video.fill",
            accentColor: Color(hex: "#14b8a6"),
            webPath: "webcam-dashboard.html",
            isNative: false
        ),
        AppDashboard(
            id: "powerwall-dashboard",
            name: "Powerwall Dashboard",
            description: "Tesla Powerwall monitor",
            icon: "bolt.fill",
            accentColor: Color(hex: "#22c55e"),
            webPath: "powerwall-dashboard.html",
            isNative: false
        ),
        AppDashboard(
            id: "quoteview-3d",
            name: "QuoteView 3D",
            description: "3D quote visualizations",
            icon: "cube.fill",
            accentColor: Color(hex: "#a78bfa"),
            webPath: "quoteview-3d.html",
            isNative: false
        ),
        AppDashboard(
            id: "tech-stocks",
            name: "Tech Stocks",
            description: "Top 10 AI stocks \u{2022} Live charts",
            icon: "desktopcomputer",
            accentColor: Color(hex: "#3b82f6"),
            webPath: "tech-stocks-tracker.html",
            isNative: false
        ),
        AppDashboard(
            id: "earthquake-tracker",
            name: "Earthquake Tracker",
            description: "USGS live seismic data",
            icon: "waveform.path.ecg",
            accentColor: Color(hex: "#ef4444"),
            webPath: "earthquake-tracker.html",
            isNative: false
        ),
        AppDashboard(
            id: "ev-route-planner",
            name: "EV Route Planner",
            description: "Least elevation gain \u{2022} Save battery",
            icon: "bolt.car.fill",
            accentColor: Color(hex: "#34d399"),
            webPath: "ev-route-planner.html",
            isNative: false
        ),
        AppDashboard(
            id: "workbench-configurator",
            name: "Workbench Configurator",
            description: "Industrial workbenches \u{2022} Kennedy, Dewey, Harding",
            icon: "wrench.and.screwdriver.fill",
            accentColor: Color(hex: "#1976d2"),
            webPath: "industrial-furniture.html",
            isNative: false
        ),
    ]
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = Double(rgbValue & 0x0000FF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}
