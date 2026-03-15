import UIKit
import CoreGraphics
import CoreLocation

/// Generates a professional PDF report for an EV route with graphs and section breakdowns.
struct EVRoutePDFGenerator {

    // MARK: - Colors (matching EVTheme, as CGColor)

    private static let bgPrimary = UIColor(red: 15/255, green: 17/255, blue: 23/255, alpha: 1)
    private static let bgCard = UIColor(red: 26/255, green: 29/255, blue: 40/255, alpha: 1)
    private static let bgInput = UIColor(red: 37/255, green: 40/255, blue: 54/255, alpha: 1)
    private static let border = UIColor(red: 45/255, green: 48/255, blue: 64/255, alpha: 1)
    private static let textPrimary = UIColor(red: 225/255, green: 228/255, blue: 232/255, alpha: 1)
    private static let textSecondary = UIColor(red: 139/255, green: 143/255, blue: 163/255, alpha: 1)
    private static let accentGreen = UIColor(red: 52/255, green: 211/255, blue: 153/255, alpha: 1)
    private static let accentBlue = UIColor(red: 96/255, green: 165/255, blue: 250/255, alpha: 1)
    private static let accentRed = UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1)
    private static let accentYellow = UIColor(red: 251/255, green: 191/255, blue: 36/255, alpha: 1)
    private static let accentOrange = UIColor(red: 249/255, green: 115/255, blue: 22/255, alpha: 1)

    // MARK: - Fonts

    private static func font(_ size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        UIFont.systemFont(ofSize: size, weight: weight)
    }

    // MARK: - Public

    static func generatePDF(
        route: RouteResult,
        vehicle: EVVehicle,
        origin: String,
        destination: String,
        chargers: [EVCharger]
    ) -> Data {
        let pageWidth: CGFloat = 612   // US Letter
        let pageHeight: CGFloat = 792
        let margin: CGFloat = 40
        let contentWidth = pageWidth - margin * 2

        let pdfData = NSMutableData()
        var mediaBox = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)

        guard let consumer = CGDataConsumer(data: pdfData),
              let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil)
        else { return Data() }

        var currentY: CGFloat = 0

        // Helper to start a new page
        func newPage() {
            if currentY != 0 {
                context.endPage()
            }
            context.beginPage(mediaBox: &mediaBox)

            // Dark background
            context.setFillColor(bgPrimary.cgColor)
            context.fill(CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))

            currentY = pageHeight - margin
        }

        // Check if we need a new page (returns true if page was created)
        func ensureSpace(_ needed: CGFloat) {
            if currentY - needed < margin {
                newPage()
            }
        }

        // MARK: - Page 1: Header + Route Overview

        newPage()

        // Logo / App title
        currentY = drawHeader(context: context, x: margin, y: currentY, width: contentWidth)
        currentY -= 8

        // Route title
        currentY = drawText(
            context: context,
            text: "\(origin) → \(destination)",
            x: margin, y: currentY, width: contentWidth,
            font: font(18, weight: .bold), color: textPrimary
        )
        currentY -= 4

        // Route name and date
        let dateStr = formatDate(Date())
        currentY = drawText(
            context: context,
            text: "via \(route.routeName) • Generated \(dateStr)",
            x: margin, y: currentY, width: contentWidth,
            font: font(11), color: textSecondary
        )
        currentY -= 20

        // Separator
        currentY = drawSeparator(context: context, x: margin, y: currentY, width: contentWidth)
        currentY -= 16

        // Vehicle info card
        currentY = drawSectionTitle(context: context, text: "Vehicle", x: margin, y: currentY)
        currentY -= 8
        currentY = drawCard(context: context, x: margin, y: currentY, width: contentWidth) { cardX, cardY, cardW in
            var y = cardY
            y = drawKeyValue(context: context, key: "Vehicle", value: vehicle.displayName,
                             x: cardX, y: y, width: cardW, valueColor: accentGreen)
            y = drawKeyValue(context: context, key: "Battery", value: "\(Int(vehicle.batteryKwh)) kWh",
                             x: cardX, y: y, width: cardW)
            y = drawKeyValue(context: context, key: "EPA Range", value: "\(vehicle.epaMiles) miles",
                             x: cardX, y: y, width: cardW)
            y = drawKeyValue(context: context, key: "Efficiency", value: String(format: "%.2f kWh/mi", vehicle.effKwhMi),
                             x: cardX, y: y, width: cardW)
            return y
        }
        currentY -= 16

        // Route summary card
        currentY = drawSectionTitle(context: context, text: "Route Summary", x: margin, y: currentY)
        currentY -= 8
        currentY = drawCard(context: context, x: margin, y: currentY, width: contentWidth) { cardX, cardY, cardW in
            var y = cardY
            y = drawKeyValue(context: context, key: "Distance", value: String(format: "%.1f miles", route.distanceMiles),
                             x: cardX, y: y, width: cardW)
            y = drawKeyValue(context: context, key: "Est. Time", value: formatDuration(route.durationMinutes),
                             x: cardX, y: y, width: cardW)
            y = drawKeyValue(context: context, key: "Total Energy", value: String(format: "%.1f kWh", route.energyKwh),
                             x: cardX, y: y, width: cardW, valueColor: accentBlue)
            y = drawKeyValue(context: context, key: "Battery Used", value: String(format: "%.0f%%", route.batteryPctUsed),
                             x: cardX, y: y, width: cardW,
                             valueColor: route.batteryPctUsed > 80 ? accentRed : route.batteryPctUsed > 50 ? accentYellow : accentGreen)
            y = drawKeyValue(context: context, key: "Efficiency", value: String(format: "%.1f mi/kWh", route.efficiency),
                             x: cardX, y: y, width: cardW, valueColor: accentGreen)
            y = drawKeyValue(context: context, key: "kWh/mile", value: String(format: "%.3f kWh/mi", route.energyKwh / max(0.1, route.distanceMiles)),
                             x: cardX, y: y, width: cardW)
            y = drawKeyValue(context: context, key: "Arrival Battery",
                             value: String(format: "%.0f%%", route.finalBatteryPct),
                             x: cardX, y: y, width: cardW,
                             valueColor: route.finalBatteryPct > 40 ? accentGreen : route.finalBatteryPct > 20 ? accentYellow : accentRed)
            return y
        }
        currentY -= 16

        // Elevation card
        currentY = drawSectionTitle(context: context, text: "Elevation", x: margin, y: currentY)
        currentY -= 8
        currentY = drawCard(context: context, x: margin, y: currentY, width: contentWidth) { cardX, cardY, cardW in
            var y = cardY
            y = drawKeyValue(context: context, key: "Elevation Gain",
                             value: String(format: "+%.0f m (+%d ft)", route.elevationGain, Int(route.elevationGain * 3.28084)),
                             x: cardX, y: y, width: cardW, valueColor: accentOrange)
            y = drawKeyValue(context: context, key: "Elevation Loss",
                             value: String(format: "-%.0f m (-%d ft)", route.elevationLoss, Int(route.elevationLoss * 3.28084)),
                             x: cardX, y: y, width: cardW, valueColor: accentGreen)
            y = drawKeyValue(context: context, key: "Avg Grade", value: String(format: "%.1f%%", route.averageGrade),
                             x: cardX, y: y, width: cardW)
            y = drawKeyValue(context: context, key: "Peak Grade", value: String(format: "%.1f%%", route.peakGrade),
                             x: cardX, y: y, width: cardW,
                             valueColor: route.peakGrade > 8 ? accentRed : route.peakGrade > 5 ? accentYellow : accentGreen)
            return y
        }
        currentY -= 16

        // Regen estimate
        let regenKwh = route.elevationLoss > 0
            ? (vehicle.weightKg * 9.81 * route.elevationLoss) / 3_600_000 * vehicle.regenEff
            : 0
        if regenKwh > 0.5 {
            ensureSpace(30)
            currentY = drawText(
                context: context,
                text: "⚡ Est. \(String(format: "%.1f kWh", regenKwh)) recovered via regenerative braking",
                x: margin + 12, y: currentY, width: contentWidth - 12,
                font: font(10), color: accentGreen
            )
            currentY -= 12
        }

        // MARK: - Elevation Profile Graph

        ensureSpace(180)
        currentY = drawSectionTitle(context: context, text: "Elevation Profile", x: margin, y: currentY)
        currentY -= 8
        if !route.elevationProfile.isEmpty {
            currentY = drawElevationGraph(
                context: context,
                profile: route.elevationProfile,
                vehicle: vehicle,
                chargingStops: route.chargingStops,
                avgSpeedMps: (route.distanceMiles * 1609.34) / max(1, route.durationMinutes * 60),
                x: margin, y: currentY, width: contentWidth, height: 140
            )
        }
        currentY -= 20

        // MARK: - Battery Consumption Graph

        ensureSpace(170)
        currentY = drawSectionTitle(context: context, text: "Battery Consumption", x: margin, y: currentY)
        currentY -= 8
        if !route.elevationProfile.isEmpty {
            currentY = drawBatteryGraph(
                context: context,
                profile: route.elevationProfile,
                vehicle: vehicle,
                chargingStops: route.chargingStops,
                avgSpeedMps: (route.distanceMiles * 1609.34) / max(1, route.durationMinutes * 60),
                x: margin, y: currentY, width: contentWidth, height: 130
            )
        }
        currentY -= 20

        // MARK: - Charging Plan (if needed)

        if route.needsCharging {
            ensureSpace(60)
            currentY = drawSectionTitle(context: context, text: "Charging Plan", x: margin, y: currentY)
            currentY -= 8

            // Total cost estimate
            let totalCost = route.chargingStops.reduce(0.0) { total, stop in
                let nearest = nearestCharger(to: stop, from: chargers)
                let price = nearest?.pricePerKwh ?? ChargerNetwork.electrifyAmerica.defaultPricePerKwh
                return total + stop.energyToAddKwh * price
            }
            currentY = drawText(
                context: context,
                text: "Est. Total Charging Cost: \(String(format: "$%.2f", totalCost))",
                x: margin, y: currentY, width: contentWidth,
                font: font(12, weight: .semibold), color: accentGreen
            )
            currentY -= 12

            for stop in route.chargingStops {
                ensureSpace(120)
                let nearest = nearestCharger(to: stop, from: chargers)
                let price = nearest?.pricePerKwh ?? ChargerNetwork.electrifyAmerica.defaultPricePerKwh
                let cost = stop.energyToAddKwh * price

                currentY = drawCard(context: context, x: margin, y: currentY, width: contentWidth) { cardX, cardY, cardW in
                    var y = cardY
                    y = drawText(context: context,
                                 text: "⚡ Charging Stop \(stop.stopNumber) — Mile \(String(format: "%.0f", stop.distanceMiles))",
                                 x: cardX, y: y, width: cardW,
                                 font: font(13, weight: .bold), color: accentYellow)
                    y -= 4

                    // Section stats
                    y = drawText(context: context,
                                 text: "Section \(stop.stopNumber): \(String(format: "%.1f mi", stop.sectionDistanceMiles)) • \(String(format: "%.1f kWh", stop.sectionEnergyKwh)) • \(String(format: "%.1f mi/kWh", stop.sectionEfficiency))",
                                 x: cardX, y: y, width: cardW,
                                 font: font(10, weight: .medium), color: textPrimary)
                    y -= 2

                    let netElev = stop.sectionElevationGain - stop.sectionElevationLoss
                    let netFt = Int(netElev * 3.28084)
                    y = drawText(context: context,
                                 text: "Elevation: \(netFt > 0 ? "+" : "")\(netFt) ft (+\(Int(stop.sectionElevationGain * 3.28084))/-\(Int(stop.sectionElevationLoss * 3.28084)) ft)",
                                 x: cardX, y: y, width: cardW,
                                 font: font(9), color: textSecondary)
                    y -= 6

                    y = drawKeyValue(context: context, key: "Arrive", value: "\(Int(stop.arrivalBatteryPct))%",
                                     x: cardX, y: y, width: cardW,
                                     valueColor: stop.arrivalBatteryPct < 20 ? accentRed : accentYellow)
                    y = drawKeyValue(context: context, key: "Charge To", value: "\(Int(stop.departureBatteryPct))%",
                                     x: cardX, y: y, width: cardW, valueColor: accentGreen)
                    y = drawKeyValue(context: context, key: "Energy Added", value: String(format: "+%.1f kWh", stop.energyToAddKwh),
                                     x: cardX, y: y, width: cardW, valueColor: accentBlue)
                    y = drawKeyValue(context: context, key: "Est. Cost",
                                     value: String(format: "$%.2f @ $%.2f/kWh", cost, price),
                                     x: cardX, y: y, width: cardW, valueColor: accentGreen)
                    if let nearest = nearest {
                        y = drawKeyValue(context: context, key: "Nearest Charger", value: "\(nearest.network.shortName) — \(nearest.name)",
                                         x: cardX, y: y, width: cardW, valueColor: textPrimary)
                    }
                    return y
                }
                currentY -= 10
            }

            // Final section
            if let finalSec = route.finalSection {
                ensureSpace(50)
                currentY = drawCard(context: context, x: margin, y: currentY, width: contentWidth) { cardX, cardY, cardW in
                    var y = cardY
                    y = drawText(context: context,
                                 text: "📍 Final Section → Destination",
                                 x: cardX, y: y, width: cardW,
                                 font: font(13, weight: .bold), color: textPrimary)
                    y -= 4
                    y = drawText(context: context,
                                 text: "\(String(format: "%.1f mi", finalSec.distanceMiles)) • \(String(format: "%.1f kWh", finalSec.energyKwh)) • \(String(format: "%.1f mi/kWh", finalSec.efficiency))",
                                 x: cardX, y: y, width: cardW,
                                 font: font(10, weight: .medium), color: textPrimary)
                    y -= 2
                    let netElev = finalSec.elevationGain - finalSec.elevationLoss
                    let netFt = Int(netElev * 3.28084)
                    y = drawText(context: context,
                                 text: "Elevation: \(netFt > 0 ? "+" : "")\(netFt) ft (+\(Int(finalSec.elevationGain * 3.28084))/-\(Int(finalSec.elevationLoss * 3.28084)) ft)",
                                 x: cardX, y: y, width: cardW,
                                 font: font(9), color: textSecondary)
                    y -= 4
                    y = drawKeyValue(context: context, key: "Arrival Battery",
                                     value: String(format: "%.0f%%", route.finalBatteryPct),
                                     x: cardX, y: y, width: cardW,
                                     valueColor: route.finalBatteryPct > 40 ? accentGreen : route.finalBatteryPct > 20 ? accentYellow : accentRed)
                    return y
                }
                currentY -= 16
            }
        }

        // MARK: - Energy Breakdown Bar Chart

        ensureSpace(180)
        currentY = drawSectionTitle(context: context, text: "Energy Breakdown", x: margin, y: currentY)
        currentY -= 8

        let baseDriving = route.distanceMiles * vehicle.effKwhMi
        let climbingKwh = route.elevationGain > 0
            ? (vehicle.weightKg * 9.81 * route.elevationGain) / (3_600_000 * 0.85)
            : 0

        let breakdownItems: [(String, Double, UIColor)] = [
            ("Base Driving", baseDriving, accentBlue),
            ("Climbing", climbingKwh, accentOrange),
            ("Regen Recovery", -regenKwh, accentGreen),
            ("Total", route.energyKwh, textPrimary),
        ]

        currentY = drawBarChart(
            context: context,
            items: breakdownItems,
            x: margin, y: currentY, width: contentWidth, barHeight: 22
        )
        currentY -= 20

        // MARK: - Footer

        ensureSpace(40)
        currentY = drawSeparator(context: context, x: margin, y: currentY, width: contentWidth)
        currentY -= 10
        _ = drawText(
            context: context,
            text: "EV Route Planner • Report generated \(dateStr) • Data from NREL AFDC & Open Elevation",
            x: margin, y: currentY, width: contentWidth,
            font: font(8), color: textSecondary
        )

        context.endPage()
        context.closePDF()

        return pdfData as Data
    }

    // MARK: - Drawing Helpers

    /// Draw the app header with logo icon
    private static func drawHeader(context: CGContext, x: CGFloat, y: CGFloat, width: CGFloat) -> CGFloat {
        var currentY = y

        // Draw a small EV icon (bolt in circle)
        let iconSize: CGFloat = 28
        let iconRect = CGRect(x: x, y: currentY - iconSize, width: iconSize, height: iconSize)
        context.setFillColor(accentGreen.cgColor)
        context.fillEllipse(in: iconRect)

        // Bolt symbol drawn manually
        context.setFillColor(bgPrimary.cgColor)
        let boltPath = CGMutablePath()
        let cx = iconRect.midX
        let cy = iconRect.midY
        boltPath.move(to: CGPoint(x: cx - 2, y: cy + 8))
        boltPath.addLine(to: CGPoint(x: cx + 1, y: cy))
        boltPath.addLine(to: CGPoint(x: cx - 1, y: cy))
        boltPath.addLine(to: CGPoint(x: cx + 2, y: cy - 8))
        boltPath.addLine(to: CGPoint(x: cx - 1, y: cy))
        boltPath.addLine(to: CGPoint(x: cx + 1, y: cy))
        boltPath.closeSubpath()
        context.addPath(boltPath)
        context.fillPath()

        // Title text
        let titleX = x + iconSize + 10
        let titleAttr: [NSAttributedString.Key: Any] = [
            .font: font(22, weight: .bold),
            .foregroundColor: textPrimary
        ]
        let title = NSAttributedString(string: "EV Route Planner", attributes: titleAttr)
        let titleLine = CTLineCreateWithAttributedString(title)
        context.textPosition = CGPoint(x: titleX, y: currentY - 20)
        CTLineDraw(titleLine, context)

        // Subtitle
        let subAttr: [NSAttributedString.Key: Any] = [
            .font: font(10),
            .foregroundColor: textSecondary
        ]
        let subtitle = NSAttributedString(string: "Route Summary Report", attributes: subAttr)
        let subLine = CTLineCreateWithAttributedString(subtitle)
        context.textPosition = CGPoint(x: titleX, y: currentY - 34)
        CTLineDraw(subLine, context)

        currentY -= 44
        return currentY
    }

    private static func drawSectionTitle(context: CGContext, text: String, x: CGFloat, y: CGFloat) -> CGFloat {
        // Green accent bar
        context.setFillColor(accentGreen.cgColor)
        context.fill(CGRect(x: x, y: y - 14, width: 3, height: 14))

        let attr: [NSAttributedString.Key: Any] = [
            .font: font(14, weight: .bold),
            .foregroundColor: textPrimary
        ]
        let attrStr = NSAttributedString(string: text, attributes: attr)
        let line = CTLineCreateWithAttributedString(attrStr)
        context.textPosition = CGPoint(x: x + 10, y: y - 12)
        CTLineDraw(line, context)

        return y - 20
    }

    private static func drawText(context: CGContext, text: String, x: CGFloat, y: CGFloat, width: CGFloat,
                                  font: UIFont, color: UIColor) -> CGFloat {
        let attr: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color
        ]
        let attrStr = NSAttributedString(string: text, attributes: attr)

        let frameSetter = CTFramesetterCreateWithAttributedString(attrStr)
        let suggestedSize = CTFramesetterSuggestFrameSizeWithConstraints(
            frameSetter, CFRange(location: 0, length: 0),
            nil, CGSize(width: width, height: CGFloat.greatestFiniteMagnitude), nil
        )

        let frameRect = CGRect(x: x, y: y - suggestedSize.height, width: width, height: suggestedSize.height)
        let path = CGPath(rect: frameRect, transform: nil)
        let frame = CTFramesetterCreateFrame(frameSetter, CFRange(location: 0, length: 0), path, nil)
        CTFrameDraw(frame, context)

        return y - suggestedSize.height
    }

    private static func drawKeyValue(context: CGContext, key: String, value: String,
                                      x: CGFloat, y: CGFloat, width: CGFloat,
                                      valueColor: UIColor = textPrimary) -> CGFloat {
        let rowHeight: CGFloat = 16

        // Key (left)
        let keyAttr: [NSAttributedString.Key: Any] = [
            .font: font(10),
            .foregroundColor: textSecondary
        ]
        let keyStr = NSAttributedString(string: key, attributes: keyAttr)
        let keyLine = CTLineCreateWithAttributedString(keyStr)
        context.textPosition = CGPoint(x: x, y: y - 11)
        CTLineDraw(keyLine, context)

        // Value (right-aligned)
        let valAttr: [NSAttributedString.Key: Any] = [
            .font: font(10, weight: .semibold),
            .foregroundColor: valueColor
        ]
        let valStr = NSAttributedString(string: value, attributes: valAttr)
        let valLine = CTLineCreateWithAttributedString(valStr)
        let valWidth = CTLineGetTypographicBounds(valLine, nil, nil, nil)
        context.textPosition = CGPoint(x: x + width - valWidth, y: y - 11)
        CTLineDraw(valLine, context)

        return y - rowHeight
    }

    private static func drawSeparator(context: CGContext, x: CGFloat, y: CGFloat, width: CGFloat) -> CGFloat {
        context.setFillColor(border.cgColor)
        context.fill(CGRect(x: x, y: y - 1, width: width, height: 1))
        return y - 1
    }

    /// Draw a rounded card background and call the content closure to fill it.
    private static func drawCard(context: CGContext, x: CGFloat, y: CGFloat, width: CGFloat,
                                  content: (CGFloat, CGFloat, CGFloat) -> CGFloat) -> CGFloat {
        // Measure content height by running it in a temporary state
        let padding: CGFloat = 12
        let contentStartY = y - padding

        // Draw content first to get actual height
        context.saveGState()
        let contentEndY = content(x + padding, contentStartY, width - padding * 2)
        context.restoreGState()

        let cardHeight = y - contentEndY + padding
        let cardRect = CGRect(x: x, y: y - cardHeight, width: width, height: cardHeight)
        let cardPath = UIBezierPath(roundedRect: cardRect, cornerRadius: 10).cgPath

        // Card background
        context.setFillColor(bgCard.cgColor)
        context.addPath(cardPath)
        context.fillPath()

        // Card border
        context.setStrokeColor(border.cgColor)
        context.setLineWidth(0.5)
        context.addPath(cardPath)
        context.strokePath()

        // Re-draw content on top of card
        return content(x + padding, contentStartY, width - padding * 2)
    }

    // MARK: - Graphs

    /// Draw elevation profile with grade-colored segments
    private static func drawElevationGraph(
        context: CGContext,
        profile: [ElevationPoint],
        vehicle: EVVehicle,
        chargingStops: [ChargingStop],
        avgSpeedMps: Double,
        x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat
    ) -> CGFloat {
        guard profile.count >= 2 else { return y }

        let graphRect = CGRect(x: x, y: y - height, width: width, height: height)

        // Background
        context.setFillColor(bgCard.cgColor)
        let bgPath = UIBezierPath(roundedRect: graphRect, cornerRadius: 8).cgPath
        context.addPath(bgPath)
        context.fillPath()

        let inset: CGFloat = 35
        let chartX = graphRect.minX + inset
        let chartW = graphRect.width - inset - 10
        let chartY = graphRect.minY + 20
        let chartH = graphRect.height - 35

        let elevations = profile.map { $0.elevation * 3.28084 }  // to feet
        let minElev = (elevations.min() ?? 0) - 20
        let maxElev = (elevations.max() ?? 100) + 20
        let elevRange = max(1, maxElev - minElev)
        let maxDist = profile.last?.distance ?? 1

        // Grid lines
        context.setStrokeColor(border.withAlphaComponent(0.4).cgColor)
        context.setLineWidth(0.5)
        for i in 0...4 {
            let gy = chartY + chartH * CGFloat(i) / 4
            context.move(to: CGPoint(x: chartX, y: gy))
            context.addLine(to: CGPoint(x: chartX + chartW, y: gy))
            context.strokePath()

            // Y-axis labels
            let elevVal = maxElev - (Double(i) / 4.0) * elevRange
            let labelAttr: [NSAttributedString.Key: Any] = [
                .font: font(7), .foregroundColor: textSecondary
            ]
            let label = NSAttributedString(string: "\(Int(elevVal))", attributes: labelAttr)
            let labelLine = CTLineCreateWithAttributedString(label)
            let labelW = CTLineGetTypographicBounds(labelLine, nil, nil, nil)
            context.textPosition = CGPoint(x: chartX - labelW - 4, y: gy - 3)
            CTLineDraw(labelLine, context)
        }

        // Fill under elevation
        context.saveGState()
        let fillPath = CGMutablePath()
        fillPath.move(to: CGPoint(x: chartX, y: chartY))
        for point in profile {
            let px = chartX + (point.distance / maxDist) * chartW
            let py = chartY + chartH - ((point.elevation * 3.28084 - minElev) / elevRange) * chartH
            fillPath.addLine(to: CGPoint(x: px, y: py))
        }
        fillPath.addLine(to: CGPoint(x: chartX + chartW, y: chartY))
        fillPath.closeSubpath()
        context.addPath(fillPath)
        context.clip()

        let gradColors = [accentGreen.withAlphaComponent(0.25).cgColor, accentGreen.withAlphaComponent(0.02).cgColor] as CFArray
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: gradColors, locations: [0, 1]) {
            context.drawLinearGradient(gradient,
                                       start: CGPoint(x: chartX, y: chartY + chartH),
                                       end: CGPoint(x: chartX, y: chartY),
                                       options: [])
        }
        context.restoreGState()

        // Grade-colored line segments
        for i in 1..<profile.count {
            let x1 = chartX + (profile[i-1].distance / maxDist) * chartW
            let y1 = chartY + chartH - ((profile[i-1].elevation * 3.28084 - minElev) / elevRange) * chartH
            let x2 = chartX + (profile[i].distance / maxDist) * chartW
            let y2 = chartY + chartH - ((profile[i].elevation * 3.28084 - minElev) / elevRange) * chartH

            let grade = profile[i].grade
            let color: UIColor
            if grade < -1 { color = accentGreen }
            else if grade < 1 { color = UIColor(red: 163/255, green: 230/255, blue: 53/255, alpha: 1) }
            else if grade < 4 { color = accentYellow }
            else { color = accentRed }

            context.setStrokeColor(color.cgColor)
            context.setLineWidth(2)
            context.move(to: CGPoint(x: x1, y: y1))
            context.addLine(to: CGPoint(x: x2, y: y2))
            context.strokePath()
        }

        // Charging stop markers
        for stop in chargingStops {
            let sx = chartX + (stop.distanceMiles / maxDist) * chartW
            context.setStrokeColor(accentYellow.withAlphaComponent(0.6).cgColor)
            context.setLineWidth(1)
            context.setLineDash(phase: 0, lengths: [3, 2])
            context.move(to: CGPoint(x: sx, y: chartY))
            context.addLine(to: CGPoint(x: sx, y: chartY + chartH))
            context.strokePath()
            context.setLineDash(phase: 0, lengths: [])
        }

        // X-axis labels
        let xLabelAttr: [NSAttributedString.Key: Any] = [.font: font(7), .foregroundColor: textSecondary]
        let startLabel = NSAttributedString(string: "0 mi", attributes: xLabelAttr)
        let endLabel = NSAttributedString(string: "\(String(format: "%.0f", maxDist)) mi", attributes: xLabelAttr)
        context.textPosition = CGPoint(x: chartX, y: graphRect.minY + 4)
        CTLineDraw(CTLineCreateWithAttributedString(startLabel), context)
        let endLine = CTLineCreateWithAttributedString(endLabel)
        let endW = CTLineGetTypographicBounds(endLine, nil, nil, nil)
        context.textPosition = CGPoint(x: chartX + chartW - endW, y: graphRect.minY + 4)
        CTLineDraw(endLine, context)

        // Legend
        let legendY = graphRect.minY + 4
        let legendItems: [(String, UIColor)] = [("Downhill", accentGreen), ("Flat", UIColor(red: 163/255, green: 230/255, blue: 53/255, alpha: 1)), ("Uphill", accentYellow), ("Steep", accentRed)]
        var legendX = chartX + chartW / 3
        for (name, color) in legendItems {
            context.setFillColor(color.cgColor)
            context.fill(CGRect(x: legendX, y: legendY, width: 10, height: 3))
            let lAttr: [NSAttributedString.Key: Any] = [.font: font(6), .foregroundColor: textSecondary]
            let lStr = NSAttributedString(string: name, attributes: lAttr)
            context.textPosition = CGPoint(x: legendX + 12, y: legendY - 2)
            CTLineDraw(CTLineCreateWithAttributedString(lStr), context)
            legendX += 40
        }

        return y - height
    }

    /// Draw battery consumption line graph
    private static func drawBatteryGraph(
        context: CGContext,
        profile: [ElevationPoint],
        vehicle: EVVehicle,
        chargingStops: [ChargingStop],
        avgSpeedMps: Double,
        x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat
    ) -> CGFloat {
        guard profile.count >= 2 else { return y }

        let battPcts = computeBatteryProfile(profile: profile, vehicle: vehicle,
                                              chargingStops: chargingStops, avgSpeedMps: avgSpeedMps)
        guard battPcts.count == profile.count else { return y }

        let graphRect = CGRect(x: x, y: y - height, width: width, height: height)

        // Background
        context.setFillColor(bgCard.cgColor)
        let bgPath = UIBezierPath(roundedRect: graphRect, cornerRadius: 8).cgPath
        context.addPath(bgPath)
        context.fillPath()

        let inset: CGFloat = 35
        let chartX = graphRect.minX + inset
        let chartW = graphRect.width - inset - 10
        let chartY = graphRect.minY + 18
        let chartH = graphRect.height - 30
        let maxDist = profile.last?.distance ?? 1

        // Grid + labels
        context.setStrokeColor(border.withAlphaComponent(0.4).cgColor)
        context.setLineWidth(0.5)
        for i in 0...4 {
            let gy = chartY + chartH * CGFloat(i) / 4
            context.move(to: CGPoint(x: chartX, y: gy))
            context.addLine(to: CGPoint(x: chartX + chartW, y: gy))
            context.strokePath()

            let pctVal = 100 - (Double(i) / 4.0) * 100
            let lAttr: [NSAttributedString.Key: Any] = [.font: font(7), .foregroundColor: accentBlue]
            let lStr = NSAttributedString(string: "\(Int(pctVal))%", attributes: lAttr)
            let lLine = CTLineCreateWithAttributedString(lStr)
            let lW = CTLineGetTypographicBounds(lLine, nil, nil, nil)
            context.textPosition = CGPoint(x: chartX - lW - 4, y: gy - 3)
            CTLineDraw(lLine, context)
        }

        // Battery line
        for i in 1..<battPcts.count {
            let x1 = chartX + (profile[i-1].distance / maxDist) * chartW
            let y1 = chartY + chartH - (battPcts[i-1] / 100.0) * chartH
            let x2 = chartX + (profile[i].distance / maxDist) * chartW
            let y2 = chartY + chartH - (battPcts[i] / 100.0) * chartH

            let color: UIColor
            if battPcts[i] < 15 { color = accentRed }
            else if battPcts[i] < 30 { color = accentYellow }
            else { color = accentBlue }

            context.setStrokeColor(color.cgColor)
            context.setLineWidth(2)
            context.move(to: CGPoint(x: x1, y: y1))
            context.addLine(to: CGPoint(x: x2, y: y2))
            context.strokePath()
        }

        // Fill under battery line
        context.saveGState()
        let fillPath = CGMutablePath()
        fillPath.move(to: CGPoint(x: chartX, y: chartY))
        for i in 0..<battPcts.count {
            let px = chartX + (profile[i].distance / maxDist) * chartW
            let py = chartY + chartH - (battPcts[i] / 100.0) * chartH
            fillPath.addLine(to: CGPoint(x: px, y: py))
        }
        fillPath.addLine(to: CGPoint(x: chartX + chartW, y: chartY))
        fillPath.closeSubpath()
        context.addPath(fillPath)
        context.clip()
        let gradColors = [accentBlue.withAlphaComponent(0.12).cgColor, accentBlue.withAlphaComponent(0.01).cgColor] as CFArray
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: gradColors, locations: [0, 1]) {
            context.drawLinearGradient(gradient,
                                       start: CGPoint(x: chartX, y: chartY + chartH),
                                       end: CGPoint(x: chartX, y: chartY),
                                       options: [])
        }
        context.restoreGState()

        // Charging stop markers
        for stop in chargingStops {
            let sx = chartX + (stop.distanceMiles / maxDist) * chartW
            context.setStrokeColor(accentYellow.withAlphaComponent(0.6).cgColor)
            context.setLineWidth(1)
            context.setLineDash(phase: 0, lengths: [3, 2])
            context.move(to: CGPoint(x: sx, y: chartY))
            context.addLine(to: CGPoint(x: sx, y: chartY + chartH))
            context.strokePath()
            context.setLineDash(phase: 0, lengths: [])
        }

        // 15% threshold line
        let thresholdY = chartY + chartH - (15.0 / 100.0) * chartH
        context.setStrokeColor(accentRed.withAlphaComponent(0.4).cgColor)
        context.setLineWidth(0.5)
        context.setLineDash(phase: 0, lengths: [4, 3])
        context.move(to: CGPoint(x: chartX, y: thresholdY))
        context.addLine(to: CGPoint(x: chartX + chartW, y: thresholdY))
        context.strokePath()
        context.setLineDash(phase: 0, lengths: [])

        let threshLabel: [NSAttributedString.Key: Any] = [.font: font(6), .foregroundColor: accentRed.withAlphaComponent(0.6)]
        let threshStr = NSAttributedString(string: "15% min", attributes: threshLabel)
        context.textPosition = CGPoint(x: chartX + chartW - 30, y: thresholdY + 2)
        CTLineDraw(CTLineCreateWithAttributedString(threshStr), context)

        return y - height
    }

    /// Draw horizontal bar chart for energy breakdown
    private static func drawBarChart(
        context: CGContext,
        items: [(String, Double, UIColor)],
        x: CGFloat, y: CGFloat, width: CGFloat, barHeight: CGFloat
    ) -> CGFloat {
        var currentY = y
        let maxVal = items.map { abs($0.1) }.max() ?? 1
        let labelWidth: CGFloat = 100
        let barWidth = width - labelWidth - 60

        for (name, value, color) in items {
            // Label
            let labelAttr: [NSAttributedString.Key: Any] = [
                .font: font(10), .foregroundColor: textSecondary
            ]
            let labelStr = NSAttributedString(string: name, attributes: labelAttr)
            context.textPosition = CGPoint(x: x, y: currentY - barHeight + 5)
            CTLineDraw(CTLineCreateWithAttributedString(labelStr), context)

            // Bar
            let barW = max(2, (abs(value) / maxVal) * barWidth)
            let barRect = CGRect(x: x + labelWidth, y: currentY - barHeight + 3, width: barW, height: barHeight - 6)
            let barPath = UIBezierPath(roundedRect: barRect, cornerRadius: 4).cgPath
            context.setFillColor(color.withAlphaComponent(value < 0 ? 0.4 : 0.7).cgColor)
            context.addPath(barPath)
            context.fillPath()

            // Value label
            let valStr: String
            if value < 0 {
                valStr = String(format: "%.1f kWh", value)
            } else {
                valStr = String(format: "%.1f kWh", value)
            }
            let valAttr: [NSAttributedString.Key: Any] = [
                .font: font(9, weight: .semibold), .foregroundColor: color
            ]
            let valLabel = NSAttributedString(string: valStr, attributes: valAttr)
            context.textPosition = CGPoint(x: x + labelWidth + barW + 6, y: currentY - barHeight + 5)
            CTLineDraw(CTLineCreateWithAttributedString(valLabel), context)

            currentY -= barHeight + 4
        }

        return currentY
    }

    // MARK: - Battery Profile Calculation (matches ElevationChartView)

    private static func computeBatteryProfile(
        profile: [ElevationPoint], vehicle: EVVehicle,
        chargingStops: [ChargingStop], avgSpeedMps: Double
    ) -> [Double] {
        let airDensity = 1.225
        let drivetrainEff = 0.88
        let g = 9.81

        var batteryPcts: [Double] = [100.0]
        var currentPct = 100.0
        let stopDistances = chargingStops.map { $0.distanceMiles }
        let chargeTargetPct = 80.0

        for i in 1..<profile.count {
            let segDistMiles = profile[i].distance - profile[i - 1].distance
            let segDistMeters = segDistMiles * 1609.34
            let gradePct = profile[i].grade
            let theta = atan(gradePct / 100.0)

            let gradeSpeedFactor: Double
            if gradePct > 6 { gradeSpeedFactor = 0.75 }
            else if gradePct > 3 { gradeSpeedFactor = 0.88 }
            else if gradePct < -6 { gradeSpeedFactor = 0.90 }
            else { gradeSpeedFactor = 1.0 }
            let segSpeed = avgSpeedMps * gradeSpeedFactor

            let fRoll = vehicle.rollingResistance * vehicle.weightKg * g * cos(theta)
            let fAero = 0.5 * airDensity * vehicle.dragCoeff * vehicle.frontalArea * segSpeed * segSpeed
            let fGrade = vehicle.weightKg * g * sin(theta)
            let fTotal = fRoll + fAero + fGrade

            let segEnergyJoules = fTotal * segDistMeters
            let segEnergyKwh: Double
            if segEnergyJoules > 0 {
                segEnergyKwh = segEnergyJoules / (3_600_000 * drivetrainEff)
            } else {
                segEnergyKwh = segEnergyJoules / 3_600_000 * vehicle.regenEff
            }

            let segPct = (max(0, segEnergyKwh) / vehicle.batteryKwh) * 100

            for stopDist in stopDistances {
                if stopDist > profile[i - 1].distance && stopDist <= profile[i].distance {
                    currentPct = chargeTargetPct
                }
            }

            currentPct -= segPct
            currentPct = max(0, min(100, currentPct))
            batteryPcts.append(currentPct)
        }

        return batteryPcts
    }

    // MARK: - Utilities

    private static func formatDuration(_ minutes: Double) -> String {
        let hrs = Int(minutes) / 60
        let mins = Int(minutes) % 60
        return hrs > 0 ? "\(hrs)h \(mins)m" : "\(mins)m"
    }

    private static func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: date)
    }

    private static func nearestCharger(to stop: ChargingStop, from chargers: [EVCharger]) -> EVCharger? {
        let stopLoc = CLLocation(latitude: stop.coordinate.latitude, longitude: stop.coordinate.longitude)
        var best: EVCharger?
        var bestDist = Double.greatestFiniteMagnitude
        for charger in chargers {
            let dist = stopLoc.distance(from: CLLocation(latitude: charger.coordinate.latitude, longitude: charger.coordinate.longitude))
            if dist < bestDist {
                bestDist = dist
                best = charger
            }
        }
        return best
    }
}
