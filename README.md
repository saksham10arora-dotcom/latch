# Latch

A focus locker for macOS. Start a session, and the things that pull you away
stop being reachable until it ends.

Not a timer with a guilt trip. Blocked websites do not resolve, and blocked apps
close when you open them. Quitting Latch does not unblock anything, because
quitting the app is exactly what you would do at minute nine.

```bash
bash scripts/build-app.sh
open build/Latch.app
```

---

## What a session actually does

| | How |
|---|---|
| **Websites** | Rewrites `/etc/hosts`, so it holds in every browser at once, not just the one with an extension installed |
| **Apps** | Watches `NSWorkspace` and quits blocked apps on launch, plus a sweep every 3s for anything already open |
| **Ending early** | Possible on purpose, but behind a wait, a phrase to retype, or both |

Blocking websites needs one admin password prompt per session, because
`/etc/hosts` is root-owned. There is no background daemon and nothing installed
outside the app bundle.

## Lecture mode, part two: the in-page lock

The macOS focus lock below stops you leaving the **browser**. It cannot stop you
leaving **full screen**, because that happens inside the page, where a native app
cannot see.

`extension/` is a Chrome extension that handles that half. Arm it with
**Option-Shift-L** while a lecture is playing, and Escape stops working.

Arming is deliberately harmless on its own: you can only reach the popup while
windowed, so an armed-but-windowed lock just waits for full screen rather than
treating you as though you had escaped from something.

If the shortcut does nothing, another extension has claimed it. Chrome drops a
contested `suggested_key` silently rather than reporting it. Set your own at
`chrome://extensions/shortcuts`.

Getting out is a **hold**, not a click, defaulting to eight seconds, optionally
with a phrase to type as well. **The toolbar popup cannot end it once it has
engaged**, and neither can the keyboard shortcut: the wall's hold is the only
route through. Every exit has to cost the same thing, or the cheapest one is the
only one anyone ever uses. Removing the extension still works, which is the
deliberate floor under it.

Reloading used to be a one-key bypass, since a reload drops full screen and
builds a fresh content script with no memory of the lock. Whether the lock has
engaged therefore lives in storage rather than in a variable, so the page comes
back to the wall rather than to YouTube. Letting go resets the timer, so it cannot be
chipped away at in half-second bursts. The video pauses behind the wall, because
otherwise the lecture plays on while you are not watching it.

### Every way out, written down

`extension/ESCAPES.md` is the full audit: each route, what closes it, and which
ones are deliberately left open. The governing rule is that **full screen and the
wall are two states of one lock**, not lock and aftermath. Most bypasses found so
far came from gating a guard on `inFullscreen()`, which is false exactly when the
wall is up, leaving the wall screen the least protected part of the whole thing.

### What is actually enforceable

### Escape does nothing

`navigator.keyboard.lock(["Escape"])` is the mechanism. It is the same
Keyboard Lock API remote-desktop and cloud-gaming pages use, and while it is held
in full screen, Escape is delivered to the page as an ordinary keydown and does
**not** exit full screen. Press it and nothing happens except a toast.

The `f` shortcut and YouTube's own full screen button are page-level, so both are
stopped outright by capture-phase handlers.

| Route out | What stops it |
|---|---|
| Press Escape | Keyboard Lock swallows it |
| `f` key | keydown intercepted |
| Player's full screen button | click intercepted |
| Cmd-T, Cmd-W, Cmd-N, Cmd-1..9, Ctrl-Tab | Keyboard Lock, then keydown intercepted |
| **Clicking another tab** | Not preventable. The worker switches you back. |
| Switching browser window | Same, the worker refocuses the lecture |
| Cmd-R reload | Keyboard Lock, and the wall is waiting if it happens anyway |
| Typing another address | The worker sends the tab back to the lecture |
| **Hold Escape ~2s** | **Cannot be blocked.** The wall catches the exit. |
| Close the tab | `beforeunload` prompt in strict mode |

### Tab switching

Two halves, because they fail differently.

**Keyboard** is stopped outright. Keyboard Lock covers `KeyT`, `KeyW`, `KeyN`,
`Tab` and `Digit1`-`Digit9`, so Chrome never acts on the shortcut, and the
keydown handler swallows it only when a modifier is down, leaving ordinary typing
alone.

**The mouse is not stoppable.** The tab strip is browser chrome and no page can
see a click on it. So arming pins the current tab, and the service worker puts
you back the moment you land anywhere else. You get the switch and lose it again
inside a frame.

A genuinely blank new tab gets closed, since by definition it holds nothing to
lose. Anything opened with a real URL is left alone and merely deactivated:
closing a tab because someone fat-fingered a shortcut would be its own bug.

Closing the lecture tab always disarms. Otherwise every later switch would snap
toward a tab that no longer exists.

That last row is a deliberate browser guarantee and no API can remove it. It is
also the right line: a page able to trap someone in full screen with no way out
would be a dangerous thing to be able to build. Chrome shows its own "Press and
hold Esc to exit" prompt.

So, precisely: **a press of Escape does nothing. Getting out takes a two second
hold, and then the wall is waiting.** Full reasoning in `extension/NOTES.md`.

## Lecture mode: the focus lock

Blocking `youtube.com` cannot help when the lecture **is** on YouTube. So the
`Lecture` preset locks on the **app** instead: name the browser you are watching
in, switch to anything else, and a full-screen wall appears on every display,
above full-screen video, with the dock and menu bar hidden.

The wall is not a trap. It carries two buttons: **Back to it**, which returns you
to the lecture, and **End the session**, which routes through the same escape
policy as the main window, wait and phrase included. If Latch dies, the wall dies
with it.

It also **argues with you**. The wall picks the most pointed thing it can say
given the moment: how many minutes you have already spent, how long the streak
is, or how little is left. The copy is deliberately unflattering rather than
motivational, because motivational copy stops working on the second reading:

> **You do not want to leave.**
> You want to not be bored for ten seconds. Those are different things, and only
> one of them is worth the session you are about to end.

Any session can lock, not just `Lecture`. Tick the allowed apps under **Focus
lock** in the session editor; leave them all unticked for no lock.

### What it does and does not stop

It answers an app switch rather than preventing one. Cmd-Tab still works, and
about a quarter of a second later the wall is in front of you.

Preventing the switch outright would need an Accessibility event tap, which means
granting Latch the ability to read every keystroke on the machine. That is a very
large permission for a small gain, and it is not worth it. For the same reason
Latch does not detect leaving full screen *within* the allowed app, only leaving
the app.

## The escape hatch

An escape you can reach in one click is not friction, and a session you cannot
end is a trap. Latch aims between the two: ending early always works, but it
costs you a minute and some typing, which is usually longer than the impulse
lasts.

Per preset, pick one of:

- `wait(seconds:)` — a countdown before the quit button works
- `phrase(_:)` — retype a sentence exactly
- `waitThenPhrase(seconds:phrase:)` — both
- `none` — honest about being a nudge

## In the menu bar

The countdown sits next to the clock, so you can close the window for the whole
session. The menu starts any session without opening the app.

Ending early deliberately is **not** in the menu. Making the exit one click from
the menu bar would undo the friction the escape policy exists to create.

## Streaks

Finished sessions are logged to `history.json`, and the idle screen shows a day
streak plus minutes focused today.

A session you ended early **does not** keep a streak alive. A number is only
worth looking at if it is hard to get, and "I started something" is not hard.
Today being empty does not break the streak either, since the day is not over;
the count just starts from yesterday.

Time from abandoned sessions still counts toward minutes today. You did the
minutes, even if you did not finish.

## Customizing

Everything is editable in **Customize**, and the same state is plain JSON at
`~/Library/Application Support/Latch/config.json` if you would rather use an
editor.

- **Sessions** are a name, a duration, a set of block lists, and an escape
  policy. Add and delete them freely; Latch will not let you delete the last one.
- **Block lists** are named sets of websites and apps. Write `social` once, use
  it in three sessions.
- Apps are picked from what is **currently running**, so you never look up a
  bundle identifier by hand.

The default `Lecture` preset deliberately leaves video sites reachable. The
lecture is usually on YouTube, and a blocker that blocks the thing you are
studying gets uninstalled on day one.

## If something goes wrong

`/etc/hosts` is a system file, so the failure mode that matters is Latch dying
mid-session and leaving the block behind. Three things guard that:

1. **Latch only touches lines between its own markers.** Everything else in the
   file is copied through untouched, verified against a real `/etc/hosts`.
2. **On every launch it checks for a leftover block** and offers to clear it.
3. **A standalone recovery script** that needs nothing but bash:

```bash
sudo ./scripts/latch-unlock.sh
```

That script uses `sed` and `awk` only. It works if the app is broken, deleted,
or was never installed.

## Development

```bash
swift build            # build
swift run LatchTests   # 41 tests, exits non-zero on failure
bash scripts/build-app.sh
```

Only the macOS Command Line Tools are required; Xcode is not. That also means
XCTest is unavailable, so `LatchTests` is a small hand-rolled harness rather
than an XCTest bundle. It is a real suite and a real CI gate, just not the
framework you would expect.

To exercise the risky path without root:

```bash
cp /etc/hosts /tmp/h
swift run latchctl /tmp/h block youtube.com
swift run latchctl /tmp/h unblock
diff /etc/hosts /tmp/h     # must print nothing
```

`latchctl` refuses to operate on the live `/etc/hosts`.

## Known limits

- **macOS only.** The blocking is `/etc/hosts` plus `NSWorkspace`; neither ports.
- **Not notarized.** Ad-hoc signed, so it runs on this machine. Shipping to
  anyone else needs a Developer ID.
- **`strings` cannot verify a Swift build.** Literals of 15 bytes or fewer are
  inlined into code by the small-string optimization and never reach the strings
  table. Check a long literal, or the tests.
- **A determined person gets around it.** You can edit `/etc/hosts` yourself in
  another terminal. Latch raises the cost of a distraction; it is not a prison.
- **A VPN or DNS-over-HTTPS can bypass the hosts file** for websites. App
  blocking is unaffected.

Built with love by Saksham Arora.
