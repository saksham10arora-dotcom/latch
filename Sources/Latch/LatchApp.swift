import SwiftUI

@main
struct LatchApp: App {
    @StateObject private var controller = SessionController()

    var body: some Scene {
        WindowGroup("Latch") {
            Group {
                if controller.running {
                    RunningView(controller: controller)
                } else {
                    IdleView(controller: controller)
                }
            }
            .frame(minWidth: 560, minHeight: 500)
            .preferredColorScheme(.dark)
        }
        .windowResizability(.contentSize)

        // A focus app should not need a window to do its job. The countdown lives
        // next to the clock, and the window can be closed for the whole session.
        MenuBarExtra(controller.menuBarLabel, systemImage: controller.running ? "lock.fill" : "lock.open") {
            if controller.running, let preset = controller.activePreset {
                Text("\(preset.name) · \(controller.remainingLabel) left")
                Divider()
                Text("Ending early needs the window, on purpose.")
            } else {
                Text(controller.streak > 0
                     ? "\(controller.streak) day streak · \(controller.minutesToday)m today"
                     : "No session running")
                Divider()
                ForEach(controller.config.presets) { preset in
                    Button("Start \(preset.name) · \(preset.minutes)m") {
                        controller.start(preset)
                    }
                }
            }
            Divider()
            Button("Quit Latch") { NSApplication.shared.terminate(nil) }
        }
    }
}
