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
            .frame(minWidth: 520, minHeight: 460)
            .preferredColorScheme(.dark)
        }
        .windowResizability(.contentSize)
    }
}
