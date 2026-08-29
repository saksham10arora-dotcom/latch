import AppKit
import Foundation

/// Watches which app is frontmost and reports when you have wandered off.
///
/// This is how Lecture mode works. Blocking `youtube.com` cannot help when the
/// lecture *is* youtube.com, so the lock is on the app instead: name the app the
/// lecture is in, and switching to anything else raises the wall.
///
/// Notably this does not need Accessibility permission. Swallowing Cmd-Tab
/// outright would, via a CGEventTap, and would also mean Latch could silently
/// eat every keystroke on the machine. Letting the switch happen and answering
/// it instantly is a much smaller ask for nearly the same effect.
final class FocusGuard {
    private var observer: NSObjectProtocol?
    private var allowed: Set<String> = []
    private var onStray: ((NSRunningApplication?) -> Void)?

    /// Apps that must never trigger the wall, whatever the preset says.
    /// SecurityAgent is the macOS password prompt: Latch itself raises it to
    /// write /etc/hosts, so walling it would have the app fight its own dialog.
    private static let alwaysAllowed: Set<String> = [
        Bundle.main.bundleIdentifier ?? "dev.saksham.latch",
        "com.apple.SecurityAgent",
        "com.apple.loginwindow",
    ]

    func start(allowedApps: [String], onStray: @escaping (NSRunningApplication?) -> Void) {
        allowed = Set(allowedApps).union(Self.alwaysAllowed)
        self.onStray = onStray

        observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            self?.evaluate(app)
        }
        evaluate(NSWorkspace.shared.frontmostApplication)
    }

    func stop() {
        if let observer { NSWorkspace.shared.notificationCenter.removeObserver(observer) }
        observer = nil
        onStray = nil
        allowed = []
    }

    private func evaluate(_ app: NSRunningApplication?) {
        guard !allowed.isEmpty else { return }
        guard let id = app?.bundleIdentifier else { return }
        if !allowed.contains(id) { onStray?(app) }
    }

    /// Brings the session's app back to the front. Best effort: if it quit while
    /// the wall was up there is nothing to return to, and the caller just leaves
    /// the wall down rather than pretending it worked.
    @discardableResult
    static func returnTo(_ bundleIDs: [String]) -> Bool {
        for id in bundleIDs {
            if let app = NSRunningApplication.runningApplications(withBundleIdentifier: id).first {
                return app.activate(options: [.activateAllWindows])
            }
        }
        return false
    }
}
