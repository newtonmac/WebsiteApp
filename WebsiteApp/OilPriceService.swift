//
//  OilPriceService.swift
//  WebsiteApp
//

import Foundation

@MainActor
class OilPriceService: ObservableObject {
    @Published var wtiPrices: [OilPrice] = []
    @Published var brentPrices: [OilPrice] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func fetchPrices() async {
        isLoading = true
        errorMessage = nil

        // Using the EIA (U.S. Energy Information Administration) API
        // Get a free API key at: https://www.eia.gov/opendata/register.php
        // Replace "DEMO_KEY" with your actual key for production use
        let apiKey = "DEMO_KEY"

        async let wtiResult = fetchEIASeries(
            seriesId: "PET.RWTC.D",
            apiKey: apiKey
        )
        async let brentResult = fetchEIASeries(
            seriesId: "PET.RBRTE.D",
            apiKey: apiKey
        )

        let (wti, brent) = await (wtiResult, brentResult)

        if wti.isEmpty && brent.isEmpty {
            // Fallback to sample data if API fails
            errorMessage = "Using sample data. Add an EIA API key for live prices."
            wtiPrices = Self.generateSampleData(basePrice: 72.0)
            brentPrices = Self.generateSampleData(basePrice: 76.0)
        } else {
            if !wti.isEmpty { wtiPrices = wti }
            else {
                wtiPrices = Self.generateSampleData(basePrice: 72.0)
            }
            if !brent.isEmpty { brentPrices = brent }
            else {
                brentPrices = Self.generateSampleData(basePrice: 76.0)
            }
        }

        isLoading = false
    }

    private func fetchEIASeries(seriesId: String, apiKey: String) async -> [OilPrice] {
        let urlString = "https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=\(apiKey)&frequency=daily&data[0]=value&facets[series][\(seriesId)]&sort[0][column]=period&sort[0][direction]=desc&length=365"

        guard let url = URL(string: urlString) else { return [] }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(EIAResponse.self, from: data)
            return response.response.data.compactMap { item in
                guard let price = Double(item.value ?? "") else { return nil }
                return OilPrice(date: item.period, price: price)
            }.reversed()
        } catch {
            print("API fetch failed for \(seriesId): \(error)")
            return []
        }
    }

    static func generateSampleData(basePrice: Double) -> [OilPrice] {
        let calendar = Calendar.current
        let today = Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        var prices: [OilPrice] = []
        var currentPrice = basePrice

        for i in (0..<365).reversed() {
            guard let date = calendar.date(byAdding: .day, value: -i, to: today) else { continue }
            let weekday = calendar.component(.weekday, from: date)
            if weekday == 1 || weekday == 7 { continue } // Skip weekends

            // Simulate realistic price movement
            let change = Double.random(in: -2.5...2.5)
            currentPrice += change
            currentPrice = max(55, min(95, currentPrice)) // Keep in realistic range

            prices.append(OilPrice(
                date: formatter.string(from: date),
                price: (currentPrice * 100).rounded() / 100
            ))
        }
        return prices
    }
}

// EIA API response models
struct EIAResponse: Codable {
    let response: EIAResponseData
}

struct EIAResponseData: Codable {
    let data: [EIADataPoint]
}

struct EIADataPoint: Codable {
    let period: String
    let value: String?
}
