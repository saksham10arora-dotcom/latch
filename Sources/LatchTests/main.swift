import Foundation
import LatchCore

print("HostsFile")

// The one that matters. If Latch ever eats a line it did not write, it has
// broken the user's networking and there is no undo.
T.test("leaves everything outside its markers untouched") {
    let original = """
    ##
    # Host Database
    ##
    127.0.0.1\tlocalhost
    255.255.255.255\tbroadcasthost
    ::1             localhost
    10.0.0.5 my-work-vpn.internal
    """
    let blocked = HostsFile.applyingBlock(to: original, domains: ["youtube.com"])
    let restored = HostsFile.removingBlock(from: blocked)
    for line in original.components(separatedBy: "\n") {
        T.check(blocked.contains(line), "block dropped a pre-existing line: \(line)")
        T.check(restored.contains(line), "restore dropped a pre-existing line: \(line)")
    }
}

T.test("round trip returns to the original content") {
    let original = "127.0.0.1\tlocalhost\n"
    let blocked = HostsFile.applyingBlock(to: original, domains: ["reddit.com", "x.com"])
    T.equal(HostsFile.removingBlock(from: blocked), original, "round trip changed the file")
}

T.test("applying twice does not stack duplicate blocks") {
    var c = "127.0.0.1 localhost\n"
    c = HostsFile.applyingBlock(to: c, domains: ["youtube.com"])
    c = HostsFile.applyingBlock(to: c, domains: ["youtube.com"])
    let markers = c.components(separatedBy: HostsFile.beginMarker).count - 1
    T.equal(markers, 1, "a second session stacked another block instead of replacing it")
}

T.test("reapplying with different domains replaces rather than merges") {
    var c = "127.0.0.1 localhost\n"
    c = HostsFile.applyingBlock(to: c, domains: ["youtube.com"])
    c = HostsFile.applyingBlock(to: c, domains: ["reddit.com"])
    T.check(c.contains("0.0.0.0 reddit.com"), "new domain missing")
    T.check(!c.contains("youtube.com"), "stale domain survived into the new session")
}

T.test("removing a block is safe when none is present") {
    let plain = "127.0.0.1 localhost\n"
    T.equal(HostsFile.removingBlock(from: plain), plain, "mangled a file it should not have touched")
}

T.test("removing a block twice is safe") {
    let blocked = HostsFile.applyingBlock(to: "127.0.0.1 localhost\n", domains: ["x.com"])
    let once = HostsFile.removingBlock(from: blocked)
    T.equal(HostsFile.removingBlock(from: once), once, "second removal changed the file")
}

T.test("blocks both the bare domain and the www variant") {
    let c = HostsFile.applyingBlock(to: "", domains: ["youtube.com"])
    T.check(c.contains("0.0.0.0 youtube.com"), "bare domain missing")
    T.check(c.contains("0.0.0.0 www.youtube.com"), "www variant missing, block feels broken")
}

T.test("writes an IPv6 route so dual stack does not leak") {
    let c = HostsFile.applyingBlock(to: "", domains: ["x.com"])
    T.check(c.contains(":: x.com"), "IPv6 unblocked means the site still loads")
}

T.test("expand normalises pasted URLs") {
    T.equal(Set(HostsFile.expand("https://www.Reddit.com/")), ["www.reddit.com", "reddit.com"], "URL not normalised")
    T.equal(Set(HostsFile.expand("http://x.com")), ["x.com", "www.x.com"], "scheme not stripped")
}

T.test("expand ignores blank input") {
    T.check(HostsFile.expand("   ").isEmpty, "blank domain produced a host entry")
}

T.test("an empty domain list writes no block at all") {
    let c = HostsFile.applyingBlock(to: "127.0.0.1 localhost\n", domains: [])
    T.check(!HostsFile.hasBlock(in: c), "wrote an empty marker block")
}

T.test("repeated sessions do not grow the file") {
    var c = "127.0.0.1 localhost\n"
    for _ in 0..<25 {
        c = HostsFile.applyingBlock(to: c, domains: ["x.com"])
        c = HostsFile.removingBlock(from: c)
    }
    T.equal(c, "127.0.0.1 localhost\n", "file drifted over 25 sessions")
}

T.test("hasBlock detects an active session") {
    T.check(!HostsFile.hasBlock(in: "127.0.0.1 localhost"), "false positive")
    T.check(HostsFile.hasBlock(in: HostsFile.applyingBlock(to: "", domains: ["x.com"])), "false negative")
}

print("\nConfig")

T.test("preset resolves to the union of its block lists") {
    let config = LatchConfig(
        blockLists: [
            BlockList(name: "a", domains: ["one.com"], bundleIDs: ["com.one"]),
            BlockList(name: "b", domains: ["two.com"], bundleIDs: ["com.two"]),
        ],
        presets: [Preset(name: "p", minutes: 30, blockListNames: ["a", "b"], escape: .none)]
    )
    let t = config.targets(for: config.presets[0])
    T.equal(t.domains, ["one.com", "two.com"], "domains not unioned")
    T.equal(t.bundleIDs, ["com.one", "com.two"], "bundle ids not unioned")
}

T.test("a missing block list costs one list, not the whole session") {
    let config = LatchConfig(
        blockLists: [BlockList(name: "real", domains: ["one.com"])],
        presets: [Preset(name: "p", minutes: 30, blockListNames: ["real", "typo"], escape: .none)]
    )
    T.equal(config.targets(for: config.presets[0]).domains, ["one.com"], "typo broke the whole preset")
}

T.test("overlapping lists do not produce duplicate entries") {
    let config = LatchConfig(
        blockLists: [BlockList(name: "a", domains: ["same.com"]), BlockList(name: "b", domains: ["same.com"])],
        presets: [Preset(name: "p", minutes: 30, blockListNames: ["a", "b"], escape: .none)]
    )
    T.equal(config.targets(for: config.presets[0]).domains, ["same.com"], "duplicate domain")
}

T.test("escape policy exposes its wait and phrase") {
    T.equal(EscapePolicy.wait(seconds: 30).waitSeconds, 30, "wait seconds wrong")
    T.check(EscapePolicy.wait(seconds: 30).requiredPhrase == nil, "wait policy should have no phrase")
    T.equal(EscapePolicy.waitThenPhrase(seconds: 60, phrase: "let me out").waitSeconds, 60, "combined wait wrong")
    T.equal(EscapePolicy.waitThenPhrase(seconds: 60, phrase: "let me out").requiredPhrase, "let me out", "combined phrase wrong")
    T.equal(EscapePolicy.none.waitSeconds, 0, "none should not wait")
}

T.test("default config survives a JSON round trip") {
    let data = try! JSONEncoder().encode(LatchConfig.default)
    let decoded = try! JSONDecoder().decode(LatchConfig.self, from: data)
    T.equal(decoded.presets.count, LatchConfig.default.presets.count, "presets lost")
    T.equal(decoded.blockLists.map(\.name), LatchConfig.default.blockLists.map(\.name), "block lists lost")
}

T.test("the default Lecture preset leaves video reachable") {
    let lecture = LatchConfig.default.presets.first { $0.name == "Lecture" }!
    let domains = LatchConfig.default.targets(for: lecture).domains
    T.check(!domains.contains("youtube.com"), "you cannot watch the lecture if the lecture is blocked")
    T.check(domains.contains("reddit.com"), "lecture preset should still block social")
}

print("\nHistory")

let cal = Calendar(identifier: .gregorian)
let today = cal.startOfDay(for: Date())
func day(_ offset: Int) -> Date { cal.date(byAdding: .day, value: offset, to: today)! }
func rec(_ offset: Int, completed: Bool = true, minutes: Int = 30) -> SessionRecord {
    SessionRecord(presetName: "p", startedAt: day(offset).addingTimeInterval(3600),
                  plannedMinutes: minutes, actualSeconds: minutes * 60, completed: completed)
}

T.test("no sessions is a zero streak") {
    T.equal(History.streak(in: [], today: today, calendar: cal), 0, "empty history should be 0")
}

T.test("counts consecutive completed days") {
    let r = [rec(0), rec(-1), rec(-2)]
    T.equal(History.streak(in: r, today: today, calendar: cal), 3, "three straight days")
}

T.test("a gap ends the streak") {
    let r = [rec(0), rec(-1), rec(-3)]
    T.equal(History.streak(in: r, today: today, calendar: cal), 2, "day -2 missing should stop it")
}

T.test("today being empty does not break a live streak") {
    // 9am on a day you have not studied yet should not read as a broken streak.
    let r = [rec(-1), rec(-2)]
    T.equal(History.streak(in: r, today: today, calendar: cal), 2, "grace day missing")
}

T.test("an abandoned session does not keep a streak alive") {
    let r = [rec(0, completed: false), rec(-1)]
    // yesterday completed, today only abandoned -> grace applies, streak is 1
    T.equal(History.streak(in: r, today: today, calendar: cal), 1, "early exit should not count")
}

T.test("two sessions in one day still count as one day") {
    let r = [rec(0), rec(0), rec(-1)]
    T.equal(History.streak(in: r, today: today, calendar: cal), 2, "same day double counted")
}

T.test("minutes today sums only today") {
    let r = [rec(0, minutes: 25), rec(0, minutes: 35), rec(-1, minutes: 90)]
    T.equal(History.minutesToday(in: r, today: today, calendar: cal), 60, "wrong daily total")
}

T.test("minutes today counts abandoned sessions, because the time was still spent") {
    let r = [rec(0, completed: false, minutes: 10)]
    T.equal(History.minutesToday(in: r, today: today, calendar: cal), 10, "abandoned time not counted")
}

T.test("completion rate is nil with no history rather than a fake zero") {
    T.check(History.completionRate(in: []) == nil, "should be nil, not 0")
    T.equal(History.completionRate(in: [rec(0), rec(-1, completed: false)]), 0.5, "wrong rate")
}

T.test("history survives a save and load round trip") {
    // The bug this catches: setting a date strategy on the encoder but not the
    // decoder writes a file that silently reads back as empty.
    let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent("latch-history-\(UUID().uuidString).json")
    defer { try? FileManager.default.removeItem(at: tmp) }
    let written = HistoryStore.append(rec(0), to: tmp)
    T.equal(written.count, 1, "append did not return the record")
    let reloaded = HistoryStore.load(from: tmp)
    T.equal(reloaded.count, 1, "history did not survive the round trip")
    T.equal(reloaded.first?.presetName, "p", "record came back wrong")
}

T.test("appending accumulates rather than overwriting") {
    let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent("latch-history-\(UUID().uuidString).json")
    defer { try? FileManager.default.removeItem(at: tmp) }
    HistoryStore.append(rec(-1), to: tmp)
    let after = HistoryStore.append(rec(0), to: tmp)
    T.equal(after.count, 2, "second append clobbered the first")
}

print("\nPersuasion")

func ctx(elapsed: Int = 10, remaining: Int = 30, streak: Int = 0, preset: String = "Lecture") -> Persuasion.Context {
    Persuasion.Context(minutesElapsed: elapsed, minutesRemaining: remaining, streak: streak, presetName: preset)
}

T.test("never returns empty copy, whatever the context") {
    // The lock screen has no fallback: whatever this returns is what the user
    // reads at the exact moment they are trying to quit.
    for e in [0, 1, 5, 20, 59] {
        for r in [0, 1, 2, 3, 30] {
            for s in [0, 1, 2, 3, 40] {
                let n = Persuasion.nudge(for: ctx(elapsed: e, remaining: r, streak: s))
                T.check(!n.headline.isEmpty, "empty headline at e=\(e) r=\(r) s=\(s)")
                T.check(!n.body.isEmpty, "empty body at e=\(e) r=\(r) s=\(s)")
            }
        }
    }
}

T.test("the almost-done case beats everything else") {
    let n = Persuasion.nudge(for: ctx(elapsed: 58, remaining: 1, streak: 30))
    T.check(n.headline.contains("Two minutes"), "should lead with how little is left")
}

T.test("a real streak gets named with the actual number") {
    let n = Persuasion.nudge(for: ctx(elapsed: 10, remaining: 30, streak: 17))
    T.check(n.headline.contains("17"), "streak copy should use the real number")
}

T.test("a streak under three is not worth invoking") {
    let n = Persuasion.nudge(for: ctx(elapsed: 5, remaining: 40, streak: 2))
    T.check(!n.headline.contains("2 days"), "a two day streak is not leverage")
}

T.test("time already spent gets named once it is substantial") {
    let n = Persuasion.nudge(for: ctx(elapsed: 34, remaining: 20, streak: 0))
    T.check(n.headline.contains("34"), "should name the elapsed minutes")
}

T.test("copy is stable within a minute so the screen does not flicker") {
    let a = Persuasion.nudge(for: ctx(elapsed: 7, remaining: 30))
    let b = Persuasion.nudge(for: ctx(elapsed: 7, remaining: 30))
    T.equal(a, b, "same context gave different copy")
}

T.test("copy varies across attempts so it does not go stale") {
    var seen = Set<String>()
    for e in 0..<12 { seen.insert(Persuasion.nudge(for: ctx(elapsed: e, remaining: 30)).headline) }
    T.check(seen.count >= 3, "only \(seen.count) distinct lines across 12 minutes")
}

print("\nFocus lock")

T.test("a preset with no allowed apps does not lock focus") {
    let p = Preset(name: "p", minutes: 30, blockListNames: [], escape: .none)
    T.check(!p.locksFocus, "empty allowedApps should mean no lock")
}

T.test("the default Lecture preset locks to a browser") {
    let lecture = LatchConfig.default.presets.first { $0.name == "Lecture" }!
    T.check(lecture.locksFocus, "Lecture is the preset that most needs the lock")
    T.check(lecture.allowedApps.contains("com.google.Chrome"), "Chrome should be allowed")
}

T.test("no other default preset locks focus") {
    for p in LatchConfig.default.presets where p.name != "Lecture" {
        T.check(!p.locksFocus, "\(p.name) should not lock focus by default")
    }
}

T.test("a config written before allowedApps existed still decodes") {
    // The real regression risk: shipping this would otherwise reset a user's
    // saved presets to defaults on first launch after the update.
    let legacy = """
    {"blockLists":[],"presets":[{"blockListNames":["social"],"escape":{"none":{}},
    "minutes":45,"name":"Old"}]}
    """.data(using: .utf8)!
    if let decoded = try? JSONDecoder().decode(LatchConfig.self, from: legacy) {
        T.equal(decoded.presets.first?.name, "Old", "legacy preset lost")
        T.equal(decoded.presets.first?.allowedApps ?? ["x"], [], "allowedApps should default to empty")
    } else {
        T.check(false, "a pre-allowedApps config failed to decode")
    }
}

T.finish()
