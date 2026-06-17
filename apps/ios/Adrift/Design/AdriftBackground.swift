import SwiftUI

struct AdriftBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            let phase = timeline.date.timeIntervalSinceReferenceDate

            ZStack {
                LinearGradient(
                    colors: backgroundColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                MemoryMapDecorationView(phase: phase)
                    .opacity(colorScheme == .dark ? 0.52 : 0.42)
                    .ignoresSafeArea()
            }
        }
    }

    private var backgroundColors: [Color] {
        if colorScheme == .dark {
            return [
                Color(red: 0.04, green: 0.07, blue: 0.12),
                Color(red: 0.05, green: 0.13, blue: 0.18),
                Color(red: 0.09, green: 0.08, blue: 0.18)
            ]
        }

        return [
            Color(red: 0.95, green: 0.99, blue: 1.00),
            Color(red: 0.91, green: 0.97, blue: 0.98),
            Color(red: 0.96, green: 0.95, blue: 1.00)
        ]
    }
}

struct MemoryMapDecorationView: View {
    @Environment(\.colorScheme) private var colorScheme
    let phase: TimeInterval

    var body: some View {
        Canvas { context, size in
            let lineColor = colorScheme == .dark
                ? AdriftColors.cyan.opacity(0.14)
                : AdriftColors.ocean.opacity(0.13)
            let glowColor = colorScheme == .dark
                ? AdriftColors.mint.opacity(0.52)
                : AdriftColors.cyan.opacity(0.40)

            var path = Path()
            path.move(to: CGPoint(x: size.width * 0.08, y: size.height * 0.28))
            path.addCurve(
                to: CGPoint(x: size.width * 0.92, y: size.height * 0.20),
                control1: CGPoint(x: size.width * 0.28, y: size.height * 0.08),
                control2: CGPoint(x: size.width * 0.60, y: size.height * 0.42)
            )
            path.move(to: CGPoint(x: size.width * 0.05, y: size.height * 0.72))
            path.addCurve(
                to: CGPoint(x: size.width * 0.86, y: size.height * 0.82),
                control1: CGPoint(x: size.width * 0.24, y: size.height * 0.58),
                control2: CGPoint(x: size.width * 0.55, y: size.height * 0.96)
            )
            path.move(to: CGPoint(x: size.width * 0.22, y: size.height * 0.48))
            path.addCurve(
                to: CGPoint(x: size.width * 0.78, y: size.height * 0.52),
                control1: CGPoint(x: size.width * 0.34, y: size.height * 0.38),
                control2: CGPoint(x: size.width * 0.62, y: size.height * 0.62)
            )

            context.stroke(path, with: .color(lineColor), style: StrokeStyle(lineWidth: 1.2, lineCap: .round, dash: [6, 14]))

            let breathing = 0.7 + 0.3 * sin(phase / 5.2 * .pi * 2)
            let points = [
                CGPoint(x: size.width * 0.20, y: size.height * 0.24),
                CGPoint(x: size.width * 0.66, y: size.height * 0.38),
                CGPoint(x: size.width * 0.38, y: size.height * 0.76),
                CGPoint(x: size.width * 0.82, y: size.height * 0.66)
            ]

            for (index, point) in points.enumerated() {
                let offset = CGFloat(sin(phase / 12 + Double(index))) * 8
                let center = CGPoint(x: point.x + offset, y: point.y - offset * 0.4)
                let radius = CGFloat(7 + breathing * 5)
                let rect = CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)
                context.fill(Path(ellipseIn: rect), with: .color(glowColor.opacity(0.16)))
                context.fill(Path(ellipseIn: rect.insetBy(dx: radius * 0.45, dy: radius * 0.45)), with: .color(glowColor.opacity(0.55)))
            }
        }
        .allowsHitTesting(false)
    }
}
