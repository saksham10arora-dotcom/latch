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

    private var ticker: Timer?
    private var endsAt: Date?
    private let appBlocker = AppBlocker()

    init() {
        staleBlockFound = HostsBlocker.hasStaleBlock()
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
        activePreset = preset
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
    func finish(completed: Bool) {
        ticker?.invalidate()
        ticker = nil
        appBlocker.stop()
        do {
            try HostsBlocker.clear()
        } catch {
            errorMessage =
                "Session ended but websites are still blocked: \(error.localizedDescription) "
                + "Run scripts/latch-unlock.sh to clear it."
        }
        running = false
        activePreset = nil
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
