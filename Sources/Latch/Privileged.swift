import Foundation

/// Running a command as root. /etc/hosts is only writable by root, so blocking
/// websites needs one authenticated step per state change.
///
/// This uses `do shell script ... with administrator privileges`, which puts up
/// the standard macOS auth dialog. The alternative, a SMJobBless helper that
/// installs once and never prompts again, needs a paid Developer ID and a
/// signed bundle. That is the right answer for a shipped product and the wrong
/// answer for something you want running on your own laptop this afternoon.
enum Privileged {

    enum Failure: LocalizedError {
        case cancelled
        case failed(String)

        var errorDescription: String? {
            switch self {
            case .cancelled:
                return "Authentication cancelled. Websites are not blocked."
            case .failed(let message):
                return message
            }
        }
    }

    /// Runs `script` as root via one auth prompt. Returns stdout.
    static func run(_ script: String, reason: String) throws -> String {
        // Escape for embedding inside an AppleScript string literal.
        let escaped = script
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")

        let source = """
        do shell script "\(escaped)" with prompt "\(reason)" with administrator privileges
        """

        var error: NSDictionary?
        guard let apple = NSAppleScript(source: source) else {
            throw Failure.failed("Could not build the privileged command.")
        }
        let result = apple.executeAndReturnError(&error)

        if let error {
            // -128 is the documented "user cancelled" code.
            if (error[NSAppleScript.errorNumber] as? Int) == -128 {
                throw Failure.cancelled
            }
            let message = error[NSAppleScript.errorMessage] as? String ?? "Unknown authentication error."
            throw Failure.failed(message)
        }
        return result.stringValue ?? ""
    }
}
