import SwiftUI

struct AuthBackgroundView: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 6)) { timeline in
            let phase = timeline.date.timeIntervalSinceReferenceDate

            ZStack {
                LinearGradient(
                    colors: backgroundColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                AuthDriftAura(phase: phase)
                    .opacity(colorScheme == .dark ? 0.62 : 0.34)
                    .ignoresSafeArea()

                AuthMapConstellation(phase: phase)
                    .opacity(colorScheme == .dark ? 0.46 : 0.34)
                    .ignoresSafeArea()
            }
        }
    }

    private var backgroundColors: [Color] {
        if colorScheme == .dark {
            return [
                Color(red: 0.045, green: 0.065, blue: 0.105),
                Color(red: 0.055, green: 0.125, blue: 0.170),
                Color(red: 0.105, green: 0.090, blue: 0.190)
            ]
        }

        return [
            Color(red: 0.92, green: 0.98, blue: 1.00),
            Color(red: 0.96, green: 0.98, blue: 1.00),
            Color(red: 0.94, green: 0.94, blue: 0.99)
        ]
    }
}

private struct AuthDriftAura: View {
    @Environment(\.colorScheme) private var colorScheme
    let phase: TimeInterval

    var body: some View {
        Canvas { context, size in
            let drift = CGFloat(sin(phase / 18)) * 18
            let breathe = CGFloat(0.92 + 0.08 * sin(phase / 8))
            let auraColor = colorScheme == .dark ? AdriftColors.cyan : AdriftColors.ocean
            let secondColor = colorScheme == .dark ? AdriftColors.indigo : AdriftColors.mint

            drawAura(
                in: &context,
                color: auraColor.opacity(colorScheme == .dark ? 0.24 : 0.16),
                rect: CGRect(
                    x: size.width * 0.05 + drift,
                    y: size.height * 0.10,
                    width: size.width * 0.54 * breathe,
                    height: size.width * 0.54 * breathe
                )
            )

            drawAura(
                in: &context,
                color: secondColor.opacity(colorScheme == .dark ? 0.18 : 0.12),
                rect: CGRect(
                    x: size.width * 0.48 - drift * 0.6,
                    y: size.height * 0.55,
                    width: size.width * 0.58,
                    height: size.width * 0.58
                )
            )
        }
        .blur(radius: 10)
        .allowsHitTesting(false)
    }

    private func drawAura(in context: inout GraphicsContext, color: Color, rect: CGRect) {
        context.fill(
            Path(ellipseIn: rect),
            with: .radialGradient(
                Gradient(colors: [color, color.opacity(0)]),
                center: CGPoint(x: rect.midX, y: rect.midY),
                startRadius: 8,
                endRadius: max(rect.width, rect.height) * 0.48
            )
        )
    }
}

private struct AuthMapConstellation: View {
    @Environment(\.colorScheme) private var colorScheme
    let phase: TimeInterval

    var body: some View {
        Canvas { context, size in
            let lineColor = colorScheme == .dark
                ? AdriftColors.cyan.opacity(0.18)
                : AdriftColors.ocean.opacity(0.15)
            let pointColor = colorScheme == .dark
                ? AdriftColors.mint.opacity(0.72)
                : AdriftColors.ocean.opacity(0.46)
            let starColor = colorScheme == .dark
                ? Color.white.opacity(0.28)
                : AdriftColors.indigo.opacity(0.16)

            var route = Path()
            route.move(to: CGPoint(x: size.width * 0.10, y: size.height * 0.30))
            route.addCurve(
                to: CGPoint(x: size.width * 0.86, y: size.height * 0.22),
                control1: CGPoint(x: size.width * 0.26, y: size.height * 0.18),
                control2: CGPoint(x: size.width * 0.58, y: size.height * 0.42)
            )
            route.move(to: CGPoint(x: size.width * 0.18, y: size.height * 0.68))
            route.addCurve(
                to: CGPoint(x: size.width * 0.88, y: size.height * 0.78),
                control1: CGPoint(x: size.width * 0.36, y: size.height * 0.55),
                control2: CGPoint(x: size.width * 0.58, y: size.height * 0.88)
            )
            context.stroke(route, with: .color(lineColor), style: StrokeStyle(lineWidth: 1, lineCap: .round, dash: [4, 12]))

            let points = [
                CGPoint(x: size.width * 0.22, y: size.height * 0.26),
                CGPoint(x: size.width * 0.62, y: size.height * 0.36),
                CGPoint(x: size.width * 0.30, y: size.height * 0.70),
                CGPoint(x: size.width * 0.82, y: size.height * 0.76)
            ]

            for (index, point) in points.enumerated() {
                let offset = CGFloat(sin(phase / 12 + Double(index))) * 4
                let pulse = CGFloat(1 + 0.12 * sin(phase / 6 + Double(index)))
                let center = CGPoint(x: point.x + offset, y: point.y - offset * 0.5)
                let halo = CGRect(x: center.x - 7 * pulse, y: center.y - 7 * pulse, width: 14 * pulse, height: 14 * pulse)
                let dot = CGRect(x: center.x - 2.4, y: center.y - 2.4, width: 4.8, height: 4.8)

                context.fill(Path(ellipseIn: halo), with: .color(pointColor.opacity(0.10)))
                context.fill(Path(ellipseIn: dot), with: .color(pointColor))
            }

            for index in 0..<8 {
                let x = size.width * CGFloat((Double((index * 37) % 100)) / 100)
                let y = size.height * CGFloat((Double((index * 23 + 17) % 100)) / 100)
                let shimmer = CGFloat(0.55 + 0.25 * sin(phase / 8 + Double(index)))
                let rect = CGRect(x: x, y: y, width: 1.6 * shimmer, height: 1.6 * shimmer)
                context.fill(Path(ellipseIn: rect), with: .color(starColor))
            }
        }
        .allowsHitTesting(false)
    }
}
