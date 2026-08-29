import AppKit
import SwiftUI
import LatchCore

/// The wall. A borderless window on every screen, above everything, shown the
/// moment you switch away from the app your session is locked to.
///
/// It is not a trap. The escape policy is reachable from here exactly as it is
/// from the main window, and if Latch dies the wall dies with it. What it buys
/// is that leaving costs you a deliberate act instead of a reflex.
final class LockWindowController {
    private var windows: [NSWindow] = []
    private var savedPresentationOptions: NSApplication.PresentationOptions?

    var isShowing: Bool { !windows.isEmpty }

    func show<Content: View>(@ViewBuilder content: () -> Content) {
        guard windows.isEmpty else { return }

        let view = content()
        for screen in NSScreen.screens {
            let window = NSWindow(
                contentRect: screen.frame,
                styleMask: [.borderless],
                backing: .buffered,
                defer: false
            )
            window.contentView = NSHostingView(rootView: view)
            window.setFrame(screen.frame, display: true)
            // Above full-screen video, which is the whole point.
            window.level = .screenSaver
            window.isOpaque = true
            window.backgroundColor = NSColor(red: 0.055, green: 0.06, blue: 0.075, alpha: 1)
            window.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
            window.ignoresMouseEvents = false
            window.hidesOnDeactivate = false
            window.makeKeyAndOrderFront(nil)
            windows.append(window)
        }

        savedPresentationOptions = NSApp.presentationOptions
        // Hiding the dock and menu bar removes the two one-click exits that sit
        // at the edges of the screen while the wall is up.
        NSApp.presentationOptions = [.hideDock, .hideMenuBar]
        NSApp.activate(ignoringOtherApps: true)
    }

    func hide() {
        guard !windows.isEmpty else { return }
        for window in windows { window.orderOut(nil) }
        windows.removeAll()
        if let saved = savedPresentationOptions { NSApp.presentationOptions = saved }
        savedPresentationOptions = nil
    }
}

/// What the wall actually says.
struct LockScreen: View {
    let nudge: Nudge
    let remainingLabel: String
    let presetName: String
    let canReturn: Bool
    let onReturn: () -> Void
    let onEscape: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(alignment: .leading, spacing: 22) {
                Text("\(presetName) · \(remainingLabel) left")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .monospacedDigit()

                Text(nudge.headline)
                    .font(.system(size: 40, weight: .bold))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Text(nudge.body)
                    .font(.system(size: 17))
                    .foregroundStyle(Theme.muted)
                    .lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 12) {
                    if canReturn {
                        Button(action: onReturn) {
                            Text("Back to it")
                                .font(.system(size: 14, weight: .semibold))
                                .padding(.horizontal, 22)
                                .padding(.vertical, 11)
                        }
                        .buttonStyle(.borderedProminent)
                        .keyboardShortcut(.defaultAction)
                    }

                    // Deliberately the quieter of the two, and it still routes
                    // through the session's escape policy rather than ending
                    // anything directly.
                    Button(action: onEscape) {
                        Text("End the session")
                            .font(.system(size: 13))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 11)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.muted)
                }
                .padding(.top, 6)
            }
            .frame(maxWidth: 620, alignment: .leading)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg)
    }
}
