import AppKit
import Combine
import Foundation
import LatchCore

@MainActor
final class SessionController: ObservableObject {
    @Published var config: LatchConfig = ConfigStore.load()
    @Published private(set) var running = false
    @Published private(set) var activePreset: Preset?
    @Published private(set) var remaining: TimeInterval = 0
    @Published private(set) var quitApps: [String] = []
    @Published var errorMessage: String?
    /// Set at launch when a previous run left a block behind.
    @Published var staleBlockFound = false
    @Published private(set) var history: [SessionRecord] = HistoryStore.load()

    /// Raised by the focus lock; the window layer watches this to show the wall.
    @Published private(set) var locked = false
    @Published private(set) var nudge: Nudge?
    /// Driven from both the main window and the lock wall, so the escape sheet
    /// is presented from one place regardless of where it was asked for.
    @Published var showEscape = false

    private var ticker: Timer?
    private var endsAt: Date?
    private var startedAt: Date?
    private let appBlocker = AppBlocker()
    private let focusGuard = FocusGuard()

    init() {
        staleBlockFound = HostsBlocker.hasStaleBlock()
    }

    var streak: Int { History.streak(in: history) }
    var minutesToday: Int { History.minutesToday(in: history) }

    /// What the menu bar shows. Short on purpose: it sits next to the clock.
    var menuBarLabel: String {
        guard running else { return "Latch" }
        let total = max(0, Int(remaining))
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    var progress: Double {
        guard let preset = activePreset, preset.minutes > 0 else { return 0 }
        let total = Double(preset.minutes * 60)
        return max(0, min(1, (total - remaining) / total))
    }

    var remainingLabel: String {
        let total = max(0, Int(remaining))
        return String(format: "%02d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60)
    }

    // MARK: - Session lifecycle

    func start(_ preset: Preset) {
        errorMessage = nil
        let targets = config.targets(for: preset)

        do {
            try HostsBlocker.apply(domains: targets.domains)
        } catch {
            // Cancelling the password prompt must not leave a half-started
            // session: no websites blocked but apps being force quit is a
            // confusing state to be in.
            errorMessage = error.localizedDescription
            return
        }

        appBlocker.start(bundleIDs: targets.bundleIDs)
        if preset.locksFocus {
            focusGuard.start(allowedApps: preset.allowedApps) { [weak self] _ in
                self?.raiseLock()
            }
        }
        activePreset = preset
        startedAt = Date()
        endsAt = Date().addingTimeInterval(Double(preset.minutes * 60))
        remaining = Double(preset.minutes * 60)
        running = true
        staleBlockFound = false

        ticker = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    private func tick() {
        guard let endsAt else { return }
        remaining = max(0, endsAt.timeIntervalSinceNow)
        quitApps = appBlocker.quitLog
        if remaining <= 0 {
            finish(completed: true)
        }
    }

    /// Ends the session and undoes everything. `completed` only changes the
    /// message; the teardown is identical either way, because an escape that
    /// left websites blocked would be worse than no escape at all.
    // MARK: - Focus lock

    /// Called when you switch to an app this session does not allow.
    private func raiseLock() {
        guard running, !locked else { return }
        nudge = Persuasion.nudge(
            for: Persuasion.Context(
                minutesElapsed: elapsedMinutes,
                minutesRemaining: Int(remaining) / 60,
                streak: streak,
                presetName: activePreset?.name ?? "This session"
            )
        )
        locked = true
    }

    var elapsedMinutes: Int {
        guard let began = startedAt else { return 0 }
        return Int(Date().timeIntervalSince(began)) / 60
    }

    /// Puts you back in the app the session is locked to. If that app is gone,
    /// the wall stays down rather than pretending the return worked.
    func returnToSession() {
        guard let preset = activePreset else { locked = false; return }
        locked = false
        FocusGuard.returnTo(preset.allowedApps)
    }

    /// The wall's exit. Lowers the wall so the escape sheet is visible and
    /// interactive; the sheet still enforces the preset's wait and phrase, so
    /// this is a route to the escape policy, not around it.
    func requestEscapeFromLock() {
        locked = false
        showEscape = true
        // The wall was covering the main window; bring it back or the sheet
        // would open behind full-screen video with no way to reach it.
        NSApp.activate(ignoringOtherApps: true)
        NSApp.windows.first { $0.canBecomeKey && !($0.level == .screenSaver) }?
            .makeKeyAndOrderFront(nil)
    }

    func finish(completed: Bool) {
        ticker?.invalidate()
        ticker = nil
        appBlocker.stop()
        focusGuard.stop()
        locked = false
        nudge = nil

        // Logged before teardown, so a failure to unblock still leaves a record
        // of the time actually spent.
        if let preset = activePreset, let began = startedAt {
            history = HistoryStore.append(
                SessionRecord(
                    presetName: preset.name,
                    startedAt: began,
                    plannedMinutes: preset.minutes,
                    actualSeconds: Int(Date().timeIntervalSince(began)),
                    completed: completed
                )
            )
        }
        do {
            try HostsBlocker.clear()
        } catch {
            errorMessage =
                "Session ended but websites are still blocked: \(error.localizedDescription) "
                + "Run scripts/latch-unlock.sh to clear it."
        }
        running = false
        activePreset = nil
        startedAt = nil
        endsAt = nil
        remaining = 0
    }

    func clearStaleBlock() {
        do {
            try HostsBlocker.clear()
            staleBlockFound = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func save() {
        ConfigStore.save(config)
    }
}
