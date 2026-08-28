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

T.finish()
