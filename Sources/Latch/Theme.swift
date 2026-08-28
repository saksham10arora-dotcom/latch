import SwiftUI

/// One accent, everything else neutral. A focus app that is itself busy is a
/// contradiction, so the palette is deliberately close to monochrome and the
/// accent appears only on the thing you are meant to look at.
enum Theme {
    static let bg = Color(red: 0.055, green: 0.06, blue: 0.075)
    static let surface = Color(red: 0.094, green: 0.102, blue: 0.125)
    static let line = Color.white.opacity(0.09)
    static let ink = Color(red: 0.93, green: 0.94, blue: 0.96)
    static let muted = Color(red: 0.60, green: 0.63, blue: 0.69)
    static let accent = Color(red: 0.40, green: 0.62, blue: 1.0)
    static let warn = Color(red: 0.98, green: 0.71, blue: 0.35)
}

struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line))
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
