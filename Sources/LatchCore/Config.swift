import Foundation

/// A named set of things to block. Keeping these separate from presets means you
/// can write "social" once and use it in three different session shapes.
public struct BlockList: Codable, Identifiable, Hashable {
    public var id: String { name }
    public var name: String
    public var domains: [String]
    /// Bundle identifiers, e.g. "com.hnc.Discord". Latch shows you the ones you
    /// have running so you never have to look these up by hand.
    public var bundleIDs: [String]

    public init(name: String, domains: [String] = [], bundleIDs: [String] = []) {
        self.name = name
        self.domains = domains
        self.bundleIDs = bundleIDs
    }
}

/// How hard it is to end a session early. The point is not to make escape
/// impossible, it is to put enough friction in front of the impulse that the
/// impulse passes. An escape you can reach in one click is not friction.
public enum EscapePolicy: Codable, Hashable {
    /// Sit with a countdown before the quit button works.
    case wait(seconds: Int)
    /// Retype a phrase exactly. Long and boring beats short and clever.
    case phrase(String)
    /// Both, wait first.
    case waitThenPhrase(seconds: Int, phrase: String)
    /// One click. Honest about being a nudge, not a lock.
    case none

    public var waitSeconds: Int {
        switch self {
        case .wait(let s), .waitThenPhrase(let s, _): return s
        case .phrase, .none: return 0
        }
    }

    public var requiredPhrase: String? {
        switch self {
        case .phrase(let p), .waitThenPhrase(_, let p): return p
        case .wait, .none: return nil
        }
    }
}

public struct Preset: Codable, Identifiable, Hashable {
    public var id: String { name }
    public var name: String
    public var minutes: Int
    public var blockListNames: [String]
    public var escape: EscapePolicy

    public init(name: String, minutes: Int, blockListNames: [String], escape: EscapePolicy) {
        self.name = name
        self.minutes = minutes
        self.blockListNames = blockListNames
        self.escape = escape
    }
}

public struct LatchConfig: Codable {
    public var blockLists: [BlockList]
    public var presets: [Preset]

    public init(blockLists: [BlockList], presets: [Preset]) {
        self.blockLists = blockLists
        self.presets = presets
    }

    /// Resolves preset -> the actual domains and bundle IDs to enforce.
    /// Unknown list names are skipped rather than throwing: a typo in a config
    /// file should cost you one blocklist, not your whole session.
    public func targets(for preset: Preset) -> (domains: [String], bundleIDs: [String]) {
        let lists = preset.blockListNames.compactMap { name in
            blockLists.first { $0.name == name }
        }
        return (
            Array(Set(lists.flatMap(\.domains))).sorted(),
            Array(Set(lists.flatMap(\.bundleIDs))).sorted()
        )
    }

    public static let `default` = LatchConfig(
        blockLists: [
            BlockList(
                name: "social",
                domains: [
                    "twitter.com", "x.com", "instagram.com", "facebook.com",
                    "reddit.com", "tiktok.com", "linkedin.com",
                ],
                bundleIDs: []
            ),
            BlockList(
                name: "video",
                domains: ["youtube.com", "netflix.com", "twitch.tv", "primevideo.com"],
                bundleIDs: ["com.netflix.Netflix"]
            ),
            BlockList(
                name: "chat",
                domains: ["web.whatsapp.com", "discord.com", "web.telegram.org"],
                bundleIDs: [
                    "com.hnc.Discord", "com.tinyspeck.slackmacgap",
                    "net.whatsapp.WhatsApp", "com.apple.MobileSMS",
                ]
            ),
            BlockList(
                name: "games",
                domains: ["store.steampowered.com", "chess.com", "lichess.org"],
                bundleIDs: ["com.valvesoftware.steam"]
            ),
        ],
        presets: [
            Preset(
                name: "Deep work",
                minutes: 90,
                blockListNames: ["social", "video", "chat", "games"],
                escape: .waitThenPhrase(
                    seconds: 60,
                    phrase: "I am choosing to end this session early"
                )
            ),
            Preset(
                name: "Lecture",
                minutes: 60,
                // Video stays reachable on purpose: the lecture is on YouTube.
                blockListNames: ["social", "chat", "games"],
                escape: .wait(seconds: 30)
            ),
            Preset(
                name: "Sprint",
                minutes: 25,
                blockListNames: ["social", "video", "chat", "games"],
                escape: .wait(seconds: 15)
            ),
        ]
    )
}

public enum ConfigStore {
    public static var directory: URL {
        FileManager.default
            .homeDirectory(forUser: NSUserName())?
            .appendingPathComponent("Library/Application Support/Latch")
            ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support/Latch")
    }

    public static var configURL: URL { directory.appendingPathComponent("config.json") }
    public static var hostsBackupURL: URL { directory.appendingPathComponent("hosts.backup") }

    public static func load() -> LatchConfig {
        guard let data = try? Data(contentsOf: configURL),
              let config = try? JSONDecoder().decode(LatchConfig.self, from: data)
        else { return .default }
        return config
    }

    @discardableResult
    public static func save(_ config: LatchConfig) -> Bool {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(config) else { return false }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return (try? data.write(to: configURL)) != nil
    }
}
