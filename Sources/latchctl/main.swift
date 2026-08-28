import Foundation
import LatchCore

// Dev utility. Applies or removes a block on an ordinary file so the hosts
// logic can be exercised against a real-world /etc/hosts copy without root and
// without touching the live system file.
//
//   cp /etc/hosts /tmp/h
//   swift run latchctl /tmp/h block youtube.com reddit.com
//   swift run latchctl /tmp/h unblock
//   diff /etc/hosts /tmp/h     # must be empty

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage: latchctl <file> <block|unblock> [domain ...]")
    exit(2)
}

let path = args[1]
let mode = args[2]

// Refuse the live file outright. This tool exists to make the dangerous path
// testable, so pointing it at the real thing would defeat its own purpose.
guard path != HostsBlockerPaths.system else {
    print("refusing to operate on \(HostsBlockerPaths.system); copy it somewhere first")
    exit(2)
}

guard let contents = try? String(contentsOfFile: path, encoding: .utf8) else {
    print("cannot read \(path)")
    exit(1)
}

let output: String
switch mode {
case "block":
    let domains = args.count > 3 ? Array(args[3...]) : ["youtube.com", "reddit.com", "x.com"]
    output = HostsFile.applyingBlock(to: contents, domains: domains)
case "unblock":
    output = HostsFile.removingBlock(from: contents)
default:
    print("unknown mode '\(mode)'; expected block or unblock")
    exit(2)
}

do {
    try output.write(toFile: path, atomically: true, encoding: .utf8)
    print("\(mode) applied to \(path)")
} catch {
    print("write failed: \(error.localizedDescription)")
    exit(1)
}
