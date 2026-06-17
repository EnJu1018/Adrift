import SwiftUI

struct SplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var isBreathing = false

    var body: some View {
        ZStack {
            SplashBackground()

            Image("AdriftLaunchLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 180, height: 180)
                .clipShape(RoundedRectangle(cornerRadius: 40, style: .continuous))
                .shadow(color: glowColor.opacity(isBreathing ? 0.28 : 0.16), radius: 30)
                .scaleEffect(reduceMotion ? 1 : (isBreathing ? 1.028 : 1))
                .opacity(isBreathing ? 1 : 0.92)
                .accessibilityLabel("Adrift")
        }
        .ignoresSafeArea()
        .onAppear {
            guard !reduceMotion else {
                isBreathing = true
                return
            }

            withAnimation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true)) {
                isBreathing = true
            }
        }
    }

    private var glowColor: Color {
        colorScheme == .dark ? .cyan : AdriftColors.ocean
    }
}

private struct SplashBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                LinearGradient(
                    colors: backgroundColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                RadialGradient(
                    colors: [glowColor.opacity(colorScheme == .dark ? 0.13 : 0.16), .clear],
                    center: .center,
                    startRadius: 0,
                    endRadius: min(geometry.size.width, geometry.size.height) * 0.58
                )

                ForEach(Array(stars.enumerated()), id: \.offset) { index, star in
                    Circle()
                        .fill(starColor(at: index))
                        .frame(width: star.size, height: star.size)
                        .position(
                            x: geometry.size.width * star.x,
                            y: geometry.size.height * star.y
                        )
                }
            }
        }
        .allowsHitTesting(false)
    }

    private var backgroundColors: [Color] {
        if colorScheme == .dark {
            return [
                Color(red: 0.008, green: 0.018, blue: 0.055),
                Color(red: 0.018, green: 0.055, blue: 0.13),
                Color(red: 0.006, green: 0.012, blue: 0.035)
            ]
        }

        return [
            Color(red: 0.94, green: 0.98, blue: 0.99),
            Color(red: 0.88, green: 0.96, blue: 0.98),
            Color(red: 0.96, green: 0.97, blue: 1.00)
        ]
    }

    private var glowColor: Color {
        colorScheme == .dark ? .cyan : AdriftColors.ocean
    }

    private func starColor(at index: Int) -> Color {
        if colorScheme == .dark {
            return index.isMultiple(of: 3)
                ? Color.cyan.opacity(0.75)
                : Color.white.opacity(0.58)
        }

        return index.isMultiple(of: 3)
            ? AdriftColors.cyan.opacity(0.68)
            : AdriftColors.ocean.opacity(0.36)
    }

    private let stars: [(x: CGFloat, y: CGFloat, size: CGFloat)] = [
        (0.16, 0.19, 2.0),
        (0.78, 0.15, 1.5),
        (0.88, 0.33, 2.4),
        (0.12, 0.62, 1.4),
        (0.82, 0.72, 1.8),
        (0.29, 0.82, 2.2),
        (0.66, 0.89, 1.3),
        (0.44, 0.28, 1.4)
    ]
}

#Preview {
    SplashView()
}

#Preview("Light") {
    SplashView()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    SplashView()
        .preferredColorScheme(.dark)
}
