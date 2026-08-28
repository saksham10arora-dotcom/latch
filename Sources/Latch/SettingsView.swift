import SwiftUI
import LatchCore

/// Customization lives here. Everything is editable in the UI, and the same
/// state is a plain JSON file at ~/Library/Application Support/Latch/config.json
/// for anyone who would rather edit it in a text editor.
struct SettingsView: View {
    @ObservedObject var controller: SessionController
    let done: () -> Void

    @State private var selectedList: String?
    @State private var newDomain = ""

    private var running: [(name: String, bundleID: String)] { AppBlocker.runningCandidates() }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Customize")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Spacer()
                Button("Done") {
                    controller.save()
                    done()
                }
                .keyboardShortcut(.defaultAction)
            }
            .padding(18)

            Divider().overlay(Theme.line)

            HStack(spacing: 0) {
                // Block lists
                List(selection: $selectedList) {
                    Section("Block lists") {
                        ForEach(controller.config.blockLists) { list in
                            Text(list.name).tag(list.name as String?)
                        }
                    }
                }
                .frame(width: 150)

                Divider().overlay(Theme.line)

                if let name = selectedList,
                   let index = controller.config.blockLists.firstIndex(where: { $0.name == name }) {
                    listEditor(index: index)
                } else {
                    VStack {
                        Text("Pick a block list to edit it.")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.muted)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        }
        .frame(width: 720, height: 460)
        .background(Theme.bg)
        .onAppear { selectedList = selectedList ?? controller.config.blockLists.first?.name }
    }

    @ViewBuilder
    private func listEditor(index: Int) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Websites")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.ink)

                    ForEach(Array(controller.config.blockLists[index].domains.enumerated()), id: \.offset) { i, domain in
                        HStack {
                            Text(domain)
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundStyle(Theme.muted)
                            Spacer()
                            Button {
                                controller.config.blockLists[index].domains.remove(at: i)
                            } label: { Image(systemName: "minus.circle") }
                            .buttonStyle(.plain)
                            .foregroundStyle(Theme.muted)
                        }
                    }

                    HStack {
                        TextField("add a domain, e.g. news.ycombinator.com", text: $newDomain)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 12))
                        Button("Add") {
                            let clean = newDomain.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !clean.isEmpty else { return }
                            controller.config.blockLists[index].domains.append(clean)
                            newDomain = ""
                        }
                        .font(.system(size: 12))
                    }
                }

                Divider().overlay(Theme.line)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Apps")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text("Ticked apps get quit when a session using this list starts.")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.muted)

                    // Only apps that are actually running are offered, so you
                    // never have to go looking up a bundle identifier by hand.
                    ForEach(running, id: \.bundleID) { app in
                        Toggle(isOn: Binding(
                            get: { controller.config.blockLists[index].bundleIDs.contains(app.bundleID) },
                            set: { on in
                                var ids = Set(controller.config.blockLists[index].bundleIDs)
                                if on { ids.insert(app.bundleID) } else { ids.remove(app.bundleID) }
                                controller.config.blockLists[index].bundleIDs = ids.sorted()
                            }
                        )) {
                            Text("\(app.name)  ").font(.system(size: 12))
                            + Text(app.bundleID).font(.system(size: 10, design: .monospaced)).foregroundColor(Theme.muted)
                        }
                        .toggleStyle(.checkbox)
                    }

                    let extras = controller.config.blockLists[index].bundleIDs
                        .filter { id in !running.contains { $0.bundleID == id } }
                    if !extras.isEmpty {
                        Text("Also blocked when running: \(extras.joined(separator: ", "))")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Theme.muted)
                    }
                }
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
