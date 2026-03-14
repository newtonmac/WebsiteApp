import SwiftUI
import MapKit

struct EVLocationSearchField: View {
    @Binding var text: String
    let placeholder: String
    @Binding var coordinate: CLLocationCoordinate2D?

    @State private var searchCompleter = LocationSearchCompleter()
    @State private var isShowingSuggestions = false
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TextField(placeholder, text: $text)
                .textFieldStyle(.roundedBorder)
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

            if isShowingSuggestions && !searchCompleter.results.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(searchCompleter.results.prefix(5), id: \.self) { suggestion in
                        Button {
                            selectSuggestion(suggestion)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(suggestion.title)
                                    .font(.subheadline)
                                    .foregroundStyle(.primary)
                                if !suggestion.subtitle.isEmpty {
                                    Text(suggestion.subtitle)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 12)
                        }
                        Divider()
                    }
                }
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .shadow(radius: 4)
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
