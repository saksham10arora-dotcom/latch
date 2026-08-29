import Foundation

/// One finished session. `completed` distinguishes running the clock out from
/// ending early, because a streak that counts abandoned sessions is a streak
/// that means nothing.
public struct SessionRecord: Codable, Identifiable, Hashable {
    public var id: UUID
    public var presetName: String
    public var startedAt: Date
    public var plannedMinutes: Int
    public var actualSeconds: Int
    public var completed: Bool

    public init(
        id: UUID = UUID(),
        presetName: String,
        startedAt: Date,
        plannedMinutes: Int,
        actualSeconds: Int,
        completed: Bool
    ) {
        self.id = id
        self.presetName = presetName
        self.startedAt = startedAt
        self.plannedMinutes = plannedMinutes
        self.actualSeconds = actualSeconds
        self.completed = completed
    }

    public var focusedMinutes: Int { actualSeconds / 60 }
}

/// Derived stats. Pure functions over a list of records so they can be tested
/// without touching disk or the clock.
public enum History {

    /// Consecutive days, counting back from `today`, on which at least one
    /// session was completed.
    ///
    /// A session ended early does not keep a streak alive. The number is only
    /// worth looking at if it is hard to get, and "I started something" is not
    /// hard. Today not yet having a session does not break the streak either,
    /// since the day is not over; the count simply starts from yesterday.
    public static func streak(
        in records: [SessionRecord],
        today: Date = Date(),
        calendar: Calendar = .current
    ) -> Int {
        let days = Set(
            records
                .filter(\.completed)
                .map { calendar.startOfDay(for: $0.startedAt) }
        )
        guard !days.isEmpty else { return 0 }

        var cursor = calendar.startOfDay(for: today)
        // Grace for today: if nothing is logged yet, start counting at yesterday
        // rather than reporting a broken streak at 9am.
        if !days.contains(cursor) {
            guard let yesterday = calendar.date(byAdding: .day, value: -1, to: cursor) else { return 0 }
            cursor = yesterday
        }

        var count = 0
        while days.contains(cursor) {
            count += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }
        return count
    }

    public static func minutesToday(
        in records: [SessionRecord],
        today: Date = Date(),
        calendar: Calendar = .current
    ) -> Int {
        let start = calendar.startOfDay(for: today)
        return records
            .filter { calendar.startOfDay(for: $0.startedAt) == start }
            .reduce(0) { $0 + $1.focusedMinutes }
    }

    public static func completionRate(in records: [SessionRecord]) -> Double? {
        guard !records.isEmpty else { return nil }
        return Double(records.filter(\.completed).count) / Double(records.count)
    }
}

public enum HistoryStore {
    public static var url: URL { ConfigStore.directory.appendingPathComponent("history.json") }
    /// Keeps the file from growing without bound. A year of heavy use fits well
    /// inside this, and nothing in the app reads further back than a streak.
    public static let limit = 2000

    /// One encoder and one decoder, defined together on purpose. Setting a date
    /// strategy on only one side writes a file that cannot be read back, and it
    /// fails silently: history just looks empty on next launch.
    public static func encoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        e.dateEncodingStrategy = .iso8601
        return e
    }

    public static func decoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    public static func load(from fileURL: URL? = nil) -> [SessionRecord] {
        let target = fileURL ?? url
        guard let data = try? Data(contentsOf: target),
              let records = try? decoder().decode([SessionRecord].self, from: data)
        else { return [] }
        return records
    }

    @discardableResult
    public static func append(_ record: SessionRecord, to fileURL: URL? = nil) -> [SessionRecord] {
        let target = fileURL ?? url
        var records = load(from: target)
        records.append(record)
        if records.count > limit { records.removeFirst(records.count - limit) }
        try? FileManager.default.createDirectory(
            at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let data = try? encoder().encode(records) { try? data.write(to: target) }
        return records
    }
}
