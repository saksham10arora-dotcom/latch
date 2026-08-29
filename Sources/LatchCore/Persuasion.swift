import Foundation

/// What the lock screen says when you try to leave mid-session.
///
/// The tone is deliberate. Motivational-poster copy gets tuned out on the second
/// reading, and anything that shames you makes the app something you resent and
/// then delete. What actually works is being specific and a little unflattering:
/// name the real amount of time at stake, name what the urge actually is, and
/// point out that nothing on the other side of the window has changed.
public struct Nudge: Equatable {
    public let headline: String
    public let body: String
}

public enum Persuasion {

    /// Context the copy can lean on. All optional-ish: a nudge must still read
    /// well on someone's first ever session with no streak and no history.
    public struct Context {
        public let minutesElapsed: Int
        public let minutesRemaining: Int
        public let streak: Int
        public let presetName: String

        public init(minutesElapsed: Int, minutesRemaining: Int, streak: Int, presetName: String) {
            self.minutesElapsed = minutesElapsed
            self.minutesRemaining = minutesRemaining
            self.streak = streak
            self.presetName = presetName
        }
    }

    /// Picks the most pointed line the context supports.
    ///
    /// Ordered by specificity rather than shuffled: a nudge that can name your
    /// 17 day streak lands harder than a generic one, so the specific cases are
    /// checked first and the generic pool is the fallback. Within the fallback,
    /// the choice is stable for a given minute so the text does not flicker if
    /// the screen redraws, but changes across attempts so it does not go stale.
    public static func nudge(for context: Context) -> Nudge {
        if context.minutesRemaining <= 2 {
            return Nudge(
                headline: "Two minutes.",
                body: """
                You are about to quit with less time left than it takes to make tea. \
                Whatever this is, it will still be there in two minutes, and you will \
                have finished instead of almost finished.
                """
            )
        }

        if context.streak >= 3 {
            return Nudge(
                headline: "\(context.streak) days. This is the one that breaks it.",
                body: """
                Streaks do not end on the hard days. They end on an ordinary Tuesday \
                when someone decides one skip does not count. It counts. It is the \
                only thing that does.
                """
            )
        }

        if context.minutesElapsed >= 20 {
            return Nudge(
                headline: "You are \(context.minutesElapsed) minutes in.",
                body: """
                The expensive part is already paid. Starting is what costs you, and \
                you did that \(context.minutesElapsed) minutes ago. Leaving now means \
                paying it again later for the same \(context.minutesRemaining) minutes.
                """
            )
        }

        let pool = generic
        let index = abs(context.minutesElapsed &* 31 &+ context.presetName.count) % pool.count
        return pool[index]
    }

    static let generic: [Nudge] = [
        Nudge(
            headline: "You do not want to leave.",
            body: """
            You want to not be bored for ten seconds. Those are different things, and \
            only one of them is worth the session you are about to end.
            """
        ),
        Nudge(
            headline: "Nothing out there changed.",
            body: """
            No message arrived. No video got better. The feed is the same feed it was \
            four minutes ago, and it will be the same one when this ends.
            """
        ),
        Nudge(
            headline: "This feeling has a half-life.",
            body: """
            The pull you are feeling right now fades in about ninety seconds if you do \
            nothing at all. This screen is deliberately slower than that.
            """
        ),
        Nudge(
            headline: "Be honest about the reason.",
            body: """
            If the lecture got hard a minute ago, that is not a reason to leave. That \
            is the exact moment the session was for.
            """
        ),
        Nudge(
            headline: "You already decided this.",
            body: """
            A calmer version of you picked this length, on purpose, before the boring \
            part. He knew this moment was coming. Let him win one.
            """
        ),
        Nudge(
            headline: "The clock is not the enemy.",
            body: """
            You are not being punished, you are being held to something you asked for. \
            Close this, go back, and let it run out.
            """
        ),
    ]
}
