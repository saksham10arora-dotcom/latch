import SwiftUI
import LatchCore

/// Editing a preset: how long, what it blocks, and how hard it is to bail out.
/// This is the half of "customizable" the first cut was missing, since block
/// lists were editable but the sessions that use them were hard-coded.
struct PresetEditor: View {
    @Binding var preset: Preset
    let allLists: [BlockList]

    // EscapePolicy is an enum with associated values, which does not bind to a
    // Picker directly. These mirror it, and `sync` folds them back into the enum
    // whenever one changes.
    @State private var kind: Kind = .waitThenPhrase
    @State private var seconds: Int = 60
    @State private var phrase: String = ""

    private enum Kind: String, CaseIterable, Identifiable {
        case none, wait, phrase, waitThenPhrase
        var id: String { rawValue }
        var label: String {
            switch self {
            case .none: return "One click"
            case .wait: return "Wait"
            case .phrase: return "Type a phrase"
            case .waitThenPhrase: return "Wait, then type"
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                field("Name") {
                    TextField("", text: $preset.name)
                        .textFieldStyle(.roundedBorder)
                }

                field("Length") {
                    HStack(spacing: 10) {
                        Stepper(value: $preset.minutes, in: 5...480, step: 5) {
                            Text("\(preset.minutes) minutes")
                                .font(.system(size: 13))
                                .monospacedDigit()
                        }
                        Spacer()
                        ForEach([25, 50, 90], id: \.self) { quick in
                            Button("\(quick)m") { preset.minutes = quick }
                                .font(.system(size: 11))
                        }
                    }
                }

                field("Blocks") {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(allLists) { list in
                            Toggle(isOn: binding(for: list.name)) {
                                Text("\(list.name)  ")
                                    .font(.system(size: 12))
                                + Text("\(list.domains.count) sites, \(list.bundleIDs.count) apps")
                                    .font(.system(size: 11))
                                    .foregroundColor(Theme.muted)
                            }
                            .toggleStyle(.checkbox)
                        }
                        if allLists.isEmpty {
                            Text("No block lists yet.")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.muted)
                        }
                    }
                }

                field("Ending early") {
                    VStack(alignment: .leading, spacing: 10) {
                        Picker("", selection: $kind) {
                            ForEach(Kind.allCases) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()

                        if kind == .wait || kind == .waitThenPhrase {
                            Stepper(value: $seconds, in: 5...600, step: 5) {
                                Text("\(seconds)s before the button works")
                                    .font(.system(size: 12))
                                    .monospacedDigit()
                            }
                        }
                        if kind == .phrase || kind == .waitThenPhrase {
                            TextField("phrase to retype", text: $phrase)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 12, design: .monospaced))
                        }

                        Text(explanation)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(18)
        }
        .onAppear(perform: loadFromPreset)
        .onChange(of: kind) { _, _ in sync() }
        .onChange(of: seconds) { _, _ in sync() }
        .onChange(of: phrase) { _, _ in sync() }
    }

    private var explanation: String {
        switch kind {
        case .none:
            return "A nudge, not a lock. Fine for a preset you rarely want to escape."
        case .wait:
            return "A countdown is usually enough. The urge to quit rarely survives a minute of sitting still."
        case .phrase:
            return "Typing is deliberate in a way clicking is not. Longer and duller beats short and clever."
        case .waitThenPhrase:
            return "The strictest option here, and still always escapable. Use it for the sessions that matter."
        }
    }

    @ViewBuilder
    private func field<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.ink)
            content()
        }
    }

    private func binding(for listName: String) -> Binding<Bool> {
        Binding(
            get: { preset.blockListNames.contains(listName) },
            set: { on in
                var names = Set(preset.blockListNames)
                if on { names.insert(listName) } else { names.remove(listName) }
                preset.blockListNames = names.sorted()
            }
        )
    }

    private func loadFromPreset() {
        switch preset.escape {
        case .none:
            kind = .none
        case .wait(let s):
            kind = .wait; seconds = s
        case .phrase(let p):
            kind = .phrase; phrase = p
        case .waitThenPhrase(let s, let p):
            kind = .waitThenPhrase; seconds = s; phrase = p
        }
    }

    private func sync() {
        // An empty phrase would make a "type this" policy trivially passable, so
        // it falls back to something real rather than silently disabling itself.
        let text = phrase.trimmingCharacters(in: .whitespacesAndNewlines)
        let safe = text.isEmpty ? "I am choosing to end this session early" : text
        switch kind {
        case .none: preset.escape = .none
        case .wait: preset.escape = .wait(seconds: seconds)
        case .phrase: preset.escape = .phrase(safe)
        case .waitThenPhrase: preset.escape = .waitThenPhrase(seconds: seconds, phrase: safe)
        }
    }
}
