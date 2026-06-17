import SwiftUI

enum AdriftMotion {
    static let gentle = Animation.smooth(duration: 0.38)
    static let slow = Animation.easeInOut(duration: 0.8)
    static let drift = Animation.easeInOut(duration: 14).repeatForever(autoreverses: true)
    static let breathe = Animation.easeInOut(duration: 5.2).repeatForever(autoreverses: true)
}
