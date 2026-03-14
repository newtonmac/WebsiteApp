import SwiftUI

struct EVVehiclePickerView: View {
    @Binding var selectedVehicle: EVVehicle
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(EVDatabase.groupedByBrand, id: \.brand) { group in
                    Section(group.brand) {
                        ForEach(group.vehicles) { vehicle in
                            Button {
                                selectedVehicle = vehicle
                                dismiss()
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(vehicle.model)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(.primary)

                                        HStack(spacing: 12) {
                                            specBadge("\(Int(vehicle.batteryKwh)) kWh")
                                            specBadge("\(vehicle.epaMiles) mi")
                                            specBadge("\(String(format: "%.2f", vehicle.effKwhMi)) kWh/mi")
                                        }
                                    }

                                    Spacer()

                                    if vehicle.id == selectedVehicle.id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.green)
                                    }
                                }
                                .contentShape(Rectangle())
                            }
                        }
                    }
                }
            }
            .navigationTitle("Select Vehicle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func specBadge(_ text: String) -> some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.gray.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .foregroundStyle(.secondary)
    }
}
