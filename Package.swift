// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Latch",
    platforms: [.macOS(.v14)],
    targets: [
        // Pure logic, no AppKit. Everything that could corrupt /etc/hosts or
        // let you out of a session early lives here so it can be unit tested.
        .target(name: "LatchCore"),
        .executableTarget(name: "Latch", dependencies: ["LatchCore"]),
        // Xcode is not installed on this machine, only the Command Line Tools,
        // so XCTest and swift-testing are both unavailable. These are real tests
        // with a hand-rolled harness: `swift run latch-test` exits non-zero on
        // failure, which is all CI actually needs from a test runner.
        .executableTarget(name: "LatchTests", dependencies: ["LatchCore"]),
        .executableTarget(name: "latchctl", dependencies: ["LatchCore"]),
    ]
)
