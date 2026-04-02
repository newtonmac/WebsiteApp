//
//  OilPriceChartView.swift
//  WebsiteApp
//

import SwiftUI
import Charts

struct OilPriceChartView: View {
    let prices: [OilPrice]
    let title: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let latest = prices.last {
                HStack(alignment: .firstTextBaseline) {
                    Text(String(format: "$%.2f", latest.price))
                        .font(.system(size: 34, weight: .bold, design: .rounded))

                    if prices.count >= 2 {
                        let previous = prices[prices.count - 2]
                        let change = latest.price - previous.price
                        let pctChange = (change / previous.price) * 100

                        HStack(spacing: 2) {
                            Image(systemName: change >= 0 ? "arrow.up.right" : "arrow.down.right")
                            Text(String(format: "%+.2f (%.2f%%)", change, pctChange))
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(change >= 0 ? .green : .red)
                    }
                }
            }

            Chart(prices) { price in
                LineMark(
                    x: .value("Date", price.dateValue),
                    y: .value("Price", price.price)
                )
                .foregroundStyle(color.gradient)
                .interpolationMethod(.catmullRom)

                AreaMark(
                    x: .value("Date", price.dateValue),
                    y: .value("Price", price.price)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [color.opacity(0.3), color.opacity(0.05)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .interpolationMethod(.catmullRom)
            }
            .chartYScale(domain: priceRange)
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                        .foregroundStyle(Color.gray.opacity(0.3))
                    AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        .foregroundStyle(.secondary)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                        .foregroundStyle(Color.gray.opacity(0.3))
                    AxisValueLabel {
                        if let price = value.as(Double.self) {
                            Text("$\(Int(price))")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .frame(height: 250)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
        )
    }

    private var priceRange: ClosedRange<Double> {
        guard let first = prices.first else { return 0...100 }
        var minPrice = first.price
        var maxPrice = first.price
        for p in prices {
            if p.price < minPrice { minPrice = p.price }
            if p.price > maxPrice { maxPrice = p.price }
        }
        let padding = (maxPrice - minPrice) * 0.1
        return (minPrice - padding)...(maxPrice + padding)
    }
}
