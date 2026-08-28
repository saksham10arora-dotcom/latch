import Foundation
import LatchCore

/// Applies and removes the /etc/hosts block, and knows how to dig itself out
/// if a previous run died while a block was active.
enum HostsBlocker {
    static let hostsPath = HostsBlockerPaths.system

    static func currentContents() -> String {
        (try? String(contentsOfFile: hostsPath, encoding: .utf8)) ?? ""
    }

    /// True when a block is sitting in /etc/hosts right now. Checked at launch:
    /// if Latch was force quit or crashed mid-session, the block outlives the
    /// process and the user is left unable to reach half the internet with no
    /// visible cause. That is the worst bug this app could ship, so the app
    /// looks for it every single launch.
    static func hasStaleBlock() -> Bool {
        HostsFile.hasBlock(in: currentContents())
    }

    static func apply(domains: [String]) throws {
        guard !domains.isEmpty else { return }
        let updated = HostsFile.applyingBlock(to: currentContents(), domains: domains)
        try write(updated, reason: "Latch needs to block distracting websites for this session.")
    }

    static func clear() throws {
        let contents = currentContents()
        guard HostsFile.hasBlock(in: contents) else { return }
        let updated = HostsFile.removingBlock(from: contents)
        try write(updated, reason: "Latch needs to unblock the websites it blocked.")
    }

    /// Writes via a temp file plus `cat`, never a redirect into /etc/hosts.
    /// A redirect truncates the file the instant the shell opens it, so an
    /// interrupted write leaves an empty hosts file and a broken machine.
    private static func write(_ contents: String, reason: String) throws {
        let backup = ConfigStore.hostsBackupURL
        try? FileManager.default.createDirectory(
            at: ConfigStore.directory, withIntermediateDirectories: true)
        // Keep the first pristine copy we ever see, and never overwrite it with
        // a copy that already contains a block.
        if !FileManager.default.fileExists(atPath: backup.path) {
            let original = currentContents()
            if !HostsFile.hasBlock(in: original) {
                try? original.write(to: backup, atomically: true, encoding: .utf8)
            }
        }

        let temp = FileManager.default.temporaryDirectory
            .appendingPathComponent("latch-hosts-\(UUID().uuidString)")
        try contents.write(to: temp, atomically: true, encoding: .utf8)
        defer { try? FileManager.default.removeItem(at: temp) }

        // cp preserves /etc/hosts's own mode and owner; flushing DNS afterwards
        // is what makes the change take effect without a reboot.
        let script = """
        cp '\(temp.path)' \(hostsPath) && \
        dscacheutil -flushcache 2>/dev/null; \
        killall -HUP mDNSResponder 2>/dev/null; true
        """
        _ = try Privileged.run(script, reason: reason)
    }
}
