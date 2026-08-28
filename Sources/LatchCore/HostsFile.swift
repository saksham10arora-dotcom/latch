import Foundation

/// Website blocking works by pointing domains at a dead address in /etc/hosts,
/// which catches every browser at once instead of one extension per browser.
///
/// This is the most dangerous thing Latch does: /etc/hosts is a system file and
/// a bad write can take your networking down. Three rules hold that risk down,
/// and all three are enforced here rather than at the call site:
///
///  1. Latch only ever touches lines between its own markers. Anything you or
///     another tool put in that file is copied through untouched.
///  2. Writing a block is "remove the old block, then append a fresh one", so
///     the operation is idempotent and can never stack duplicates.
///  3. The markers are literal and unique, so `latch-unlock.sh` can strip them
///     with sed alone if the app is gone, broken, or mid-crash.
public enum HostsFile {
    public static let beginMarker = "# >>> latch >>>"
    public static let endMarker = "# <<< latch <<<"

    /// Every host a domain should resolve away from. Someone types "youtube.com"
    /// but reaches "www.youtube.com", and leaving the www variant live makes the
    /// whole block feel broken.
    public static func expand(_ domain: String) -> [String] {
        let clean = domain
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .replacingOccurrences(of: "/", with: "")
        guard !clean.isEmpty else { return [] }
        if clean.hasPrefix("www.") {
            return [clean, String(clean.dropFirst(4))]
        }
        return [clean, "www.\(clean)"]
    }

    public static func hasBlock(in contents: String) -> Bool {
        contents.contains(beginMarker)
    }

    /// Removes Latch's block and nothing else. Safe to call on a file that has
    /// no block, and safe to call twice.
    public static func removingBlock(from contents: String) -> String {
        guard contents.contains(beginMarker) else { return contents }
        var out: [String] = []
        var inside = false
        for line in contents.components(separatedBy: "\n") {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed == beginMarker { inside = true; continue }
            if trimmed == endMarker { inside = false; continue }
            if !inside { out.append(line) }
        }
        // Collapse the trailing blank lines a removal tends to leave behind,
        // then restore exactly one, so repeated sessions do not grow the file.
        while let last = out.last, last.trimmingCharacters(in: .whitespaces).isEmpty {
            out.removeLast()
        }
        return out.joined(separator: "\n") + "\n"
    }

    /// The file contents with a fresh block for `domains`. Existing block, if any,
    /// is replaced rather than appended to.
    public static func applyingBlock(to contents: String, domains: [String]) -> String {
        let base = removingBlock(from: contents)
        let hosts = Array(Set(domains.flatMap(expand))).sorted()
        guard !hosts.isEmpty else { return base }

        var block = [
            beginMarker,
            "# Managed by Latch. Everything between these two markers is removed",
            "# when the session ends. Edit outside them, not inside.",
        ]
        for host in hosts {
            block.append("0.0.0.0 \(host)")
            block.append(":: \(host)")
        }
        block.append(endMarker)

        return base + "\n" + block.joined(separator: "\n") + "\n"
    }
}

/// Shared so the dev utility can refuse to touch the live file, and so the path
/// is written down in exactly one place.
public enum HostsBlockerPaths {
    public static let system = "/etc/hosts"
}
