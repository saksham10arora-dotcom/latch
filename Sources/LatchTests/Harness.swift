import Foundation

/// Minimal test harness. Collects failures instead of trapping on the first one,
/// so a run tells you everything that broke rather than only the earliest thing.
enum T {
    nonisolated(unsafe) static var failures: [String] = []
    nonisolated(unsafe) static var passed = 0
    nonisolated(unsafe) static var current = ""

    static func test(_ name: String, _ body: () -> Void) {
        current = name
        let before = failures.count
        body()
        if failures.count == before {
            passed += 1
            print("  ok   \(name)")
        }
    }

    static func check(_ condition: Bool, _ message: String) {
        if !condition {
            failures.append("\(current): \(message)")
            print("  FAIL \(current): \(message)")
        }
    }

    static func equal<V: Equatable>(_ a: V, _ b: V, _ message: String) {
        if a != b {
            failures.append("\(current): \(message)\n         got:      \(a)\n         expected: \(b)")
            print("  FAIL \(current): \(message)")
            print("         got:      \(a)")
            print("         expected: \(b)")
        }
    }

    static func finish() -> Never {
        print("")
        if failures.isEmpty {
            print("\(passed) passed")
            exit(0)
        }
        print("\(passed) passed, \(failures.count) FAILED")
        for f in failures { print("  - \(f)") }
        exit(1)
    }
}
