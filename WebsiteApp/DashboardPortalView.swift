//
//  DashboardPortalView.swift
//  WebsiteApp
//

import SwiftUI

struct DashboardPortalView: View {
    let columns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(AppDashboard.allDashboards) { dashboard in
                        NavigationLink(value: dashboard.id) {
                            DashboardTileView(dashboard: dashboard)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
            .background(Color(hex: "#0f1117"))
            .navigationTitle("JMLSD Apps")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(Color(hex: "#1a1d28"), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .navigationDestination(for: String.self) { dashboardId in
                if let dashboard = AppDashboard.allDashboards.first(where: { $0.id == dashboardId }) {
                    if dashboard.isNative {
                        nativeView(for: dashboard)
                    } else {
                        WebDashboardView(dashboard: dashboard)
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private func nativeView(for dashboard: AppDashboard) -> some View {
        switch dashboard.id {
        case "oil-tracker":
            OilPriceDashboardView()
        default:
            WebDashboardView(dashboard: dashboard)
        }
    }
}

struct DashboardTileView: View {
    let dashboard: AppDashboard

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(dashboard.accentColor.opacity(0.15))
                    .frame(width: 56, height: 56)

                Image(systemName: dashboard.icon)
                    .font(.system(size: 24))
                    .foregroundStyle(dashboard.accentColor)
            }

            Text(dashboard.name)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)

            Text(dashboard.description)
                .font(.system(size: 11))
                .foregroundStyle(Color(hex: "#8b8fa3"))
                .multilineTextAlignment(.center)
                .lineLimit(2)

            if dashboard.isNative {
                Text("NATIVE")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(dashboard.accentColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(dashboard.accentColor.opacity(0.15))
                    )
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color(hex: "#1a1d28"))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color(hex: "#2d3040"), lineWidth: 1)
                )
        )
    }
}

#Preview {
    DashboardPortalView()
}
