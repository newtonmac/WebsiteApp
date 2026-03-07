//
//  OilPriceDashboardView.swift
//  WebsiteApp
//

import SwiftUI

struct OilPriceDashboardView: View {
    @StateObject private var service = OilPriceService()
    @State private var selectedOilType: OilType = .wti
    @State private var selectedTimeRange: TimeRange = .oneMonth

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Oil type picker
                    Picker("Oil Type", selection: $selectedOilType) {
                        ForEach(OilType.allCases) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    // Time range picker
                    Picker("Time Range", selection: $selectedTimeRange) {
                        ForEach(TimeRange.allCases) { range in
                            Text(range.rawValue).tag(range)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    if service.isLoading {
                        ProgressView("Loading prices...")
                            .frame(height: 300)
                    } else {
                        // Chart
                        OilPriceChartView(
                            prices: filteredPrices,
                            title: selectedOilType.rawValue,
                            color: selectedOilType == .wti ? .blue : .orange
                        )
                        .padding(.horizontal)
                        .animation(.easeInOut, value: selectedOilType)
                        .animation(.easeInOut, value: selectedTimeRange)

                        // Stats card
                        StatsCardView(prices: filteredPrices)
                            .padding(.horizontal)

                        // Recent prices list
                        RecentPricesView(prices: filteredPrices)
                            .padding(.horizontal)
                    }

                    if let error = service.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Crude Oil Tracker")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await service.fetchPrices() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
        .task {
            await service.fetchPrices()
        }
    }

    private var filteredPrices: [OilPrice] {
        let allPrices = selectedOilType == .wti ? service.wtiPrices : service.brentPrices
        let cutoffDate = Calendar.current.date(
            byAdding: .day,
            value: -selectedTimeRange.days,
            to: Date()
        ) ?? Date()

        return allPrices.filter { $0.dateValue >= cutoffDate }
    }
}

struct StatsCardView: View {
    let prices: [OilPrice]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Statistics")
                .font(.headline)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                StatItem(label: "High", value: String(format: "$%.2f", high), color: .green)
                StatItem(label: "Low", value: String(format: "$%.2f", low), color: .red)
                StatItem(label: "Average", value: String(format: "$%.2f", average), color: .blue)
                StatItem(label: "Volatility", value: String(format: "%.2f%%", volatility), color: .purple)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
        )
    }

    private var high: Double { prices.map(\.price).max() ?? 0 }
    private var low: Double { prices.map(\.price).min() ?? 0 }
    private var average: Double {
        guard !prices.isEmpty else { return 0 }
        return prices.map(\.price).reduce(0, +) / Double(prices.count)
    }
    private var volatility: Double {
        guard prices.count > 1 else { return 0 }
        let avg = average
        let variance = prices.map { pow($0.price - avg, 2) }.reduce(0, +) / Double(prices.count - 1)
        return (sqrt(variance) / avg) * 100
    }
}

struct StatItem: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.title3.bold())
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct RecentPricesView: View {
    let prices: [OilPrice]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Prices")
                .font(.headline)

            ForEach(prices.suffix(10).reversed()) { price in
                HStack {
                    Text(price.date)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(String(format: "$%.2f", price.price))
                        .font(.subheadline.bold())
                }
                Divider()
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
        )
    }
}

#Preview {
    OilPriceDashboardView()
}
