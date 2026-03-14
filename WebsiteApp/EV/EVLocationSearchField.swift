import SwiftUI
import MapKit
import CoreLocation

struct EVLocationSearchField: View {
    @Binding var text: String
    let placeholder: String
    @Binding var coordinate: CLLocationCoordinate2D?
    var showGPSButton: Bool = false

    @State private var searchCompleter = LocationSearchCompleter()
    @State private var isShowingSuggestions = false
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                TextField(placeholder, text: $text)
                    .font(.system(size: 14))
                    .padding(10)
                    .background(EVTheme.bgInput)
                    .foregroundStyle(EVTheme.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(isFocused ? EVTheme.accentGreen : EVTheme.border, lineWidth: 1)
                    )
                    .focused($isFocused)
                    .onChange(of: text) { _, newValue in
                        searchCompleter.search(query: newValue)
                        isShowingSuggestions = !newValue.isEmpty && isFocused
                    }
                    .onChange(of: isFocused) { _, focused in
                        if !focused {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                                isShowingSuggestions = false
                            }
                        }
                    }

                if showGPSButton {
                    GPSButton(text: $text, coordinate: $coordinate)
                }
            }

            if isShowingSuggestions && !searchCompleter.results.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(searchCompleter.results.prefix(5), id: \.self) { suggestion in
                        Button {
                            selectSuggestion(suggestion)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(suggestion.title)
                                    .font(.subheadline)
                                    .foregroundStyle(EVTheme.textPrimary)
                                if !suggestion.subtitle.isEmpty {
                                    Text(suggestion.subtitle)
                                        .font(.caption)
                                        .foregroundStyle(EVTheme.textSecondary)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 12)
                        }
                        Rectangle()
                            .fill(EVTheme.border)
                            .frame(height: 1)
                    }
                }
                .background(EVTheme.bgInput)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(EVTheme.border, lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.3), radius: 4)
            }
        }
    }

    private func selectSuggestion(_ suggestion: MKLocalSearchCompletion) {
        text = suggestion.title
        isShowingSuggestions = false
        isFocused = false

        Task {
            let request = MKLocalSearch.Request(completion: suggestion)
            let search = MKLocalSearch(request: request)
            if let response = try? await search.start(),
               let item = response.mapItems.first {
                coordinate = item.placemark.coordinate
            }
        }
    }
}

struct GPSButton: View {
    @Binding var text: String
    @Binding var coordinate: CLLocationCoordinate2D?
    @State private var locationManager = GPSLocationManager()
    @State private var isLoading = false

    var body: some View {
        Button {
            requestLocation()
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(EVTheme.bgInput)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(isLoading ? EVTheme.accentGreen : EVTheme.border, lineWidth: 1)
                    )
                if isLoading {
                    ProgressView()
                        .tint(EVTheme.accentGreen)
                        .scaleEffect(0.7)
                } else {
                    Image(systemName: "location.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(EVTheme.accentBlue)
                }
            }
            .frame(width: 40, height: 40)
        }
    }

    private func requestLocation() {
        isLoading = true
        locationManager.requestLocation { result in
            isLoading = false
            switch result {
            case .success(let location):
                coordinate = location.coordinate
                // Reverse geocode
                let geocoder = CLGeocoder()
                geocoder.reverseGeocodeLocation(location) { placemarks, _ in
                    if let placemark = placemarks?.first {
                        let parts = [placemark.name, placemark.locality, placemark.administrativeArea]
                        text = parts.compactMap { $0 }.joined(separator: ", ")
                    } else {
                        text = "\(String(format: "%.4f", location.coordinate.latitude)), \(String(format: "%.4f", location.coordinate.longitude))"
                    }
                }
            case .failure:
                break
            }
        }
    }
}

class GPSLocationManager: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var completion: ((Result<CLLocation, Error>) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestLocation(completion: @escaping (Result<CLLocation, Error>) -> Void) {
        self.completion = completion
        manager.requestWhenInUseAuthorization()
        manager.requestLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let location = locations.first {
            completion?(.success(location))
            completion = nil
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        completion?(.failure(error))
        completion = nil
    }
}

@Observable
class LocationSearchCompleter: NSObject, MKLocalSearchCompleterDelegate {
    var results: [MKLocalSearchCompletion] = []
    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
    }

    func search(query: String) {
        completer.queryFragment = query
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        results = completer.results
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        results = []
    }
}
