import AppKit
import Foundation

/// Quits blocked apps while a session is running.
///
/// Two mechanisms on purpose. The launch notification is instant, so reopening
/// Discord closes it before the window is usable. The sweep is the backstop:
/// notifications can be missed if the app was already running when the session
/// started, or if something launches during a wake from sleep.
final class AppBlocker {
    private var blocked: Set<String> = []
    private var sweepTimer: Timer?
    private var observer: NSObjectProtocol?

    /// Apps Latch will refuse to quit even if you list them. Terminating these
    /// either does nothing useful or actively fights the user.
    private static let protected: Set<String> = [
        "com.apple.finder",
        "com.apple.systempreferences",
        "com.apple.Terminal",
        Bundle.main.bundleIdentifier ?? "dev.saksham.latch",
    ]

    /// Bundle IDs it actually quit, newest first. Surfaced in the UI so a
    /// session tells you what it did rather than silently killing your work.
    private(set) var quitLog: [String] = []

    func start(bundleIDs: [String]) {
        blocked = Set(bundleIDs).subtracting(Self.protected)
        guard !blocked.isEmpty else { return }

        observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didLaunchApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard
                let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            else { return }
            self?.quitIfBlocked(app)
        }

        sweepTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            self?.sweep()
        }
        sweep()
    }

    func stop() {
        if let observer {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
        }
        observer = nil
        sweepTimer?.invalidate()
        sweepTimer = nil
        blocked = []
    }

    private func sweep() {
        for app in NSWorkspace.shared.runningApplications {
            quitIfBlocked(app)
        }
    }

    private func quitIfBlocked(_ app: NSRunningApplication) {
        guard
            let id = app.bundleIdentifier,
            blocked.contains(id),
            !Self.protected.contains(id)
        else { return }

        // terminate() sends a polite quit event first, which gives the app a
        // chance to save. forceTerminate is a last resort for apps that ignore
        // it, and is deliberately delayed rather than immediate.
        if !app.terminate() {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                if !app.isTerminated { app.forceTerminate() }
            }
        }
        if quitLog.first != id {
            quitLog.insert(id, at: 0)
            quitLog = Array(quitLog.prefix(20))
        }
    }

    /// Apps currently running that a user might plausibly want to block, so the
    /// settings screen can offer real choices instead of asking for bundle IDs.
    static func runningCandidates() -> [(name: String, bundleID: String)] {
        NSWorkspace.shared.runningApplications
            .filter { $0.activationPolicy == .regular }
            .compactMap { app in
                guard
                    let id = app.bundleIdentifier,
                    let name = app.localizedName,
                    !protected.contains(id)
                else { return nil }
                return (name, id)
            }
            .sorted { $0.name.lowercased() < $1.name.lowercased() }
    }
}
