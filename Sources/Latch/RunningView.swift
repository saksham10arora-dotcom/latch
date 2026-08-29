import SwiftUI
import LatchCore

/// The session screen. Almost empty on purpose: the whole point of the app is
/// that you are not looking at it.
struct RunningView: View {
    @ObservedObject var controller: SessionController

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            ZStack {
                Circle()
                    .stroke(Theme.line, lineWidth: 6)
                Circle()
                    .trim(from: 0, to: controller.progress)
                    .stroke(Theme.accent, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: controller.progress)

                VStack(spacing: 6) {
                    Text(controller.remainingLabel)
                        .font(.system(size: 44, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                    Text(controller.activePreset?.name ?? "")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted)
                }
            }
            .frame(width: 230, height: 230)

            if !controller.quitApps.isEmpty {
                VStack(spacing: 6) {
                    Text("Closed during this session")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                    Text(controller.quitApps.prefix(4).joined(separator: ", "))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.muted.opacity(0.75))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: 360)
            }

            Spacer()

            Button("End session early") { controller.showEscape = true }
                .buttonStyle(.plain)
                .font(.system(size: 12))
                .foregroundStyle(Theme.muted)
                .padding(.bottom, 22)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg)
        .sheet(isPresented: $controller.showEscape) {
            EscapeSheet(
                policy: controller.activePreset?.escape ?? .none,
                onRelease: {
                    controller.showEscape = false
                    controller.finish(completed: false)
                },
                onCancel: {
                    controller.showEscape = false
                    // Cancelling from the wall should put you back where you
                    // were, not leave you staring at Latch.
                    controller.returnToSession()
                }
            )
        }
    }
}

/// The friction. Everything here exists to put time and effort between the
/// impulse to quit and actually quitting, without ever making it impossible.
struct EscapeSheet: View {
    let policy: EscapePolicy
    let onRelease: () -> Void
    let onCancel: () -> Void

    @State private var secondsLeft: Int = 0
    @State private var typed = ""
    @State private var timer: Timer?

    private var waitDone: Bool { secondsLeft <= 0 }
    private var phraseDone: Bool {
        guard let required = policy.requiredPhrase else { return true }
        return typed.trimmingCharacters(in: .whitespacesAndNewlines) == required
    }
    private var canRelease: Bool { waitDone && phraseDone }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("End this session early?")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.ink)

            if !waitDone {
                Text("You can end it in \(secondsLeft)s. Give it a moment.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
            } else if let required = policy.requiredPhrase {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Type this exactly:")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                    Text(required)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(Theme.warn)
                        .textSelection(.disabled)
                    TextField("", text: $typed)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 13, design: .monospaced))
                }
            } else {
                Text("Everything you blocked will become reachable again.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
            }

            HStack {
                Button("Keep going", action: onCancel)
                    .keyboardShortcut(.defaultAction)
                Spacer()
                Button("End session", action: onRelease)
                    .disabled(!canRelease)
            }
        }
        .padding(22)
        .frame(width: 420)
        .background(Theme.surface)
        .onAppear {
            secondsLeft = policy.waitSeconds
            guard secondsLeft > 0 else { return }
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
                secondsLeft -= 1
                if secondsLeft <= 0 { t.invalidate() }
            }
        }
        .onDisappear { timer?.invalidate() }
    }
}
