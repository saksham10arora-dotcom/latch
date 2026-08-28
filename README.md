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

## Customizing

Everything is editable in **Customize**, and the same state is plain JSON at
`~/Library/Application Support/Latch/config.json` if you would rather use an
editor.

- **Block lists** are named sets of websites and apps. Write `social` once, use
  it in three presets.
- **Presets** are a duration, a set of block lists, and an escape policy.
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
swift run LatchTests   # 19 tests, exits non-zero on failure
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
- **A determined person gets around it.** You can edit `/etc/hosts` yourself in
  another terminal. Latch raises the cost of a distraction; it is not a prison.
- **A VPN or DNS-over-HTTPS can bypass the hosts file** for websites. App
  blocking is unaffected.

Built with love by Saksham Arora.
