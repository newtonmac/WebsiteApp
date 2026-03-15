import SwiftUI

struct EVVehiclePickerView: View {
    @Binding var selectedVehicle: EVVehicle
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    ForEach(EVDatabase.groupedByBrand, id: \.brand) { group in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(group.brand.uppercased())
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(EVTheme.textSecondary)
                                .tracking(1)
                                .padding(.horizontal, 16)

                            VStack(spacing: 0) {
                                ForEach(group.vehicles) { vehicle in
                                    Button {
                                        selectedVehicle = vehicle
                                        dismiss()
                                    } label: {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(vehicle.model)
                                                    .font(.subheadline.weight(.semibold))
                                                    .foregroundStyle(EVTheme.textPrimary)

                                                HStack(spacing: 8) {
                                                    specBadge(vehicle.batteryDescription)
                                                    specBadge(vehicle.rangeDescription)
                                                    specBadge(vehicle.efficiencyDescription)
                                                }
                                            }

                                            Spacer()

                                            if vehicle.id == selectedVehicle.id {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundStyle(EVTheme.accentGreen)
                                            }
                                        }
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 12)
                                        .contentShape(Rectangle())
                                    }

                                    if vehicle.id != group.vehicles.last?.id {
                                        Rectangle()
                                            .fill(EVTheme.border)
                                            .frame(height: 1)
                                            .padding(.leading, 16)
                                    }
                                }
                            }
                            .background(EVTheme.bgInput)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(EVTheme.border, lineWidth: 1)
                            )
                            .padding(.horizontal, 16)
                        }
                    }
                }
                .padding(.vertical, 16)
            }
            .background(EVTheme.bgPrimary)
            .navigationTitle("Select Vehicle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(EVTheme.bgCard, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(EVTheme.accentGreen)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func specBadge(_ text: String) -> some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(EVTheme.border)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .foregroundStyle(EVTheme.textSecondary)
    }
}

#if DEBUG
#Preview("Vehicle Picker") {
    EVVehiclePickerView(selectedVehicle: .constant(PreviewMock.vehicle))
}
#endif
