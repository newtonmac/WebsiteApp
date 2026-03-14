//
//  ContentView.swift
//  WebsiteApp
//
//  Created by GUILLERMO VILLANUEVA on 3/11/25.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            OilPriceDashboardView()
                .tabItem {
                    Label("Oil Tracker", systemImage: "drop.fill")
                }

            EVRoutePlannerView()
                .tabItem {
                    Label("EV Planner", systemImage: "bolt.car.fill")
                }
        }
    }
}

#Preview {
    ContentView()
}
