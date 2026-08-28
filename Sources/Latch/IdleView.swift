import SwiftUI
import LatchCore

struct IdleView: View {
    @ObservedObject var controller: SessionController
    @State private var showSettings = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Latch")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    Text("Pick a session. Nothing starts until you do.")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                }
                Spacer()
                Button("Customize") { showSettings = true }
                    .font(.system(size: 12))
            }
            .padding(.horizontal, 22)
            .padding(.top, 20)
            .padding(.bottom, 16)

            if controller.staleBlockFound {
                Card {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Websites are still blocked from a previous session")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.warn)
                        Text("Latch closed while a session was running, so its block is still in /etc/hosts.")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.muted)
                        Button("Unblock now") { controller.clearStaleBlock() }
                            .font(.system(size: 12))
                    }
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 12)
            }

            if let error = controller.errorMessage {
                Card {
                    Text(error)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.warn)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 12)
            }

            ScrollView {
                VStack(spacing: 10) {
                    ForEach(controller.config.presets) { preset in
                        PresetRow(
                            preset: preset,
                            targets: controller.config.targets(for: preset),
                            start: { controller.start(preset) }
                        )
                    }
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 22)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.bg)
        .sheet(isPresented: $showSettings) {
            SettingsView(controller: controller, done: { showSettings = false })
        }
    }
}

private struct PresetRow: View {
    let preset: Preset
    let targets: (domains: [String], bundleIDs: [String])
    let start: () -> Void

    private var escapeLabel: String {
        switch preset.escape {
        case .none: return "can quit anytime"
        case .wait(let s): return "\(s)s wait to quit"
        case .phrase: return "type a phrase to quit"
        case .waitThenPhrase(let s, _): return "\(s)s wait, then a phrase"
        }
    }

    var body: some View {
        Card {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 8) {
                        Text(preset.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                        Text("\(preset.minutes) min")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.accent)
                    }
                    Text("\(targets.domains.count) sites, \(targets.bundleIDs.count) apps · \(escapeLabel)")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.muted)
                }
                Spacer()
                Button("Start", action: start)
                    .font(.system(size: 12, weight: .semibold))
            }
        }
    }
}
