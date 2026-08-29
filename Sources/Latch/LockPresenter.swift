import AppKit
import Combine
import SwiftUI

/// Bridges the session's `locked` flag to the actual wall window.
///
/// Kept out of SessionController on purpose: the controller decides *whether*
/// you are locked out, this decides what that looks like on screen. It also
/// means the controller stays free of window management and remains the piece
/// that could be driven from a test or a CLI later.
@MainActor
final class LockPresenter {
    private let controller: SessionController
    private let window = LockWindowController()
    private var cancellable: AnyCancellable?

    init(controller: SessionController) {
        self.controller = controller
        cancellable = controller.$locked
            .removeDuplicates()
            .sink { [weak self] locked in
                guard let self else { return }
                if locked { self.present() } else { self.window.hide() }
            }
    }

    private func present() {
        guard let nudge = controller.nudge else { return }
        let preset = controller.activePreset
        let canReturn = !(preset?.allowedApps.isEmpty ?? true)
        window.show {
            LockScreen(
                nudge: nudge,
                remainingLabel: self.controller.remainingLabel,
                presetName: preset?.name ?? "Session",
                canReturn: canReturn,
                onReturn: { self.controller.returnToSession() },
                onEscape: { self.controller.requestEscapeFromLock() }
            )
        }
    }
}
