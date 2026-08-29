<div align="center">

<img src="assets/icon.png" width="96" alt="Latch">

```
██╗      █████╗ ████████╗ ██████╗██╗  ██╗
██║     ██╔══██╗╚══██╔══╝██╔════╝██║  ██║
██║     ███████║   ██║   ██║     ███████║
██║     ██╔══██║   ██║   ██║     ██╔══██║
███████╗██║  ██║   ██║   ╚██████╗██║  ██║
╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝
```

**A focus locker that does not let go when you change your mind.**

> Most blockers ask you to be disciplined at the exact moment you are not.
> This one is built for the version of you who wants to quit.

[![License: MIT](https://img.shields.io/badge/License-MIT-5b9dff.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/macOS-14%2B-5b9dff.svg)](#install)
[![Tests](https://img.shields.io/badge/tests-83%20passing-4caf82.svg)](#development)
[![Escape surface](https://img.shields.io/badge/escape%20surface-audited-f8b45a.svg)](extension/ESCAPES.md)

</div>

---

## The moment it exists for

You are forty minutes into a lecture. It gets hard. Your hand reaches for
Cmd-Tab before you have decided anything.

Latch is what happens next.

```
                    you press Escape
                           │
                           ▼
                    nothing happens
```

Not a nag. Not a timer you can dismiss. Escape is swallowed, tab shortcuts are
dead, and clicking another tab puts you back. Getting out takes a deliberate
eight second hold, and the screen argues with you while you do it.

---

## Two halves

Because no single program can see the whole problem.

| | Latch.app | Lecture Lock |
|---|---|---|
| **What** | native macOS app | Chrome extension |
| **Blocks** | websites via `/etc/hosts`, and apps via `NSWorkspace` | Escape, reload, tab and window shortcuts, tab clicks |
| **Why separate** | an app cannot see inside a web page | a page cannot see the rest of your Mac |

Blocking `youtube.com` cannot help when the lecture **is** on YouTube. That is
the whole reason the second half exists.

---

## Install

**The app**

```bash
git clone https://github.com/saksham10arora-dotcom/latch.git
cd latch && bash scripts/build-app.sh && open build/Latch.app
```

**The extension**

`chrome://extensions` → enable Developer mode → **Load unpacked** → pick the
`extension/` folder. Then play a lecture, go full screen, and press
**Option-Shift-L**.

---

## Escape does nothing

`navigator.keyboard.lock(["Escape"])`, the Keyboard Lock API that remote-desktop
and cloud-gaming pages use. While it is held in full screen, Escape is delivered
to the page as an ordinary keydown and **does not exit full screen**.

| You press | What happens |
|---|---|
| `Escape` | nothing |
| `Cmd-R`, `Cmd-L` | nothing |
| `Cmd-T`, `Cmd-W`, `Cmd-N`, `Cmd-1..9` | nothing |
| `f`, the player's full screen button | nothing |
| a different tab | you are put back |
| an address that is not YouTube | you are put back |
| closing the tab | it reopens, still locked |
| **holding `Escape` for two seconds** | **the wall** |

That last row is a browser guarantee no API can remove, and it should not be
removable. It is the floor, not an oversight.

---

## It argues with you

The wall picks the most pointed thing it can say, using what the page actually
knows: minutes watched, minutes left, and how many times you have already
bounced off it.

> ### You do not want to leave.
> You want to not be bored for ten seconds. Those are different things, and only
> one of them is worth the lecture you are in the middle of.

> ### 17 days. This is the one that breaks it.
> Streaks do not end on the hard days. They end on an ordinary Tuesday when
> someone decides one skip does not count.

> ### You are 34 minutes in.
> The expensive part is already paid. Starting is what costs you, and you did
> that 34 minutes ago.

Deliberately unflattering rather than motivational. Motivational copy stops
working on the second reading, and copy that shames you makes the app something
you delete.

---

## Getting out

A **hold**, not a click, because a click is a reflex and eight seconds is not.
Optionally a phrase to retype as well. Letting go resets the timer, so it cannot
be chipped away at in bursts, and a correct phrase cannot skip the hold.

The toolbar popup **cannot** end an engaged lock. Neither can the keyboard
shortcut. Every route out has to cost the same thing, or the cheapest one becomes
the only one anybody uses.

---

## Every way out, written down

[**`extension/ESCAPES.md`**](extension/ESCAPES.md) is the full audit: each route,
what closes it, and which are deliberately left open.

It exists because six real bypasses were found by using it, and patching them one
at a time kept missing the class each belonged to. The pattern, once visible, was
always the same:

> Full screen and the wall are **two states of one lock**, not lock and
> aftermath. Guards gated on `inFullscreen()` switched themselves off exactly
> when the wall was up, leaving the screen shown to someone actively trying to
> leave as the least protected part of the whole thing.

Deliberately still open: holding Escape, removing the extension, quitting Chrome,
Cmd-Tab, incognito, another browser. A lock with no way out is a dangerous thing
to build.

---

## Customizing

Sessions are a name, a length, a set of block lists, and an escape policy. Block
lists are named sets of sites and apps, written once and reused. Apps are picked
from what is currently running, so you never look up a bundle identifier.

All of it is editable in the app, and is plain JSON at
`~/Library/Application Support/Latch/config.json` if you would rather use an
editor.

Finished sessions are logged. A session you ended early **does not** keep a
streak alive: a number is only worth looking at if it is hard to get.

---

## If something goes wrong

`/etc/hosts` is a system file, so the failure that matters is Latch dying with a
block still in place.

```bash
sudo ./scripts/latch-unlock.sh
```

`sed` and `awk` only. It works if the app is broken, deleted, or was never
installed. Latch also checks for a leftover block on every launch, and only ever
touches lines between its own markers, verified against a real `/etc/hosts` and
across 25 apply-and-remove cycles.

---

## Development

```bash
swift build && swift run LatchTests      # 41 tests
cd extension && npm install && npm test  # 42 tests
bash scripts/build-app.sh
```

Only the macOS Command Line Tools are needed, not Xcode. That also means XCTest
is unavailable, so `LatchTests` is a small hand-rolled harness that exits
non-zero on failure. A real suite and a real gate, just not the framework you
would expect.

To exercise the risky path without root:

```bash
cp /etc/hosts /tmp/h
swift run latchctl /tmp/h block youtube.com
swift run latchctl /tmp/h unblock
diff /etc/hosts /tmp/h                   # must print nothing
```

---

## Known limits

- **macOS and Chrome.** The blocking is `/etc/hosts`, `NSWorkspace` and MV3.
  None of it ports as written.
- **Not notarized.** Ad-hoc signed, so it runs locally. Shipping it to anyone
  else needs a Developer ID.
- **Cmd-Tab is not covered.** macOS handles it before Chrome sees the key.
- **Incognito needs a toggle.** Allow the extension in incognito, or a private
  window is a clean way out.
- **Other extensions are outside the boundary.** An extension cannot act on
  another extension, and toolbar buttons and the side panel are browser chrome
  that no page can reach. What another extension injects *into* the page is
  handled; what it renders outside one is not.
- **A determined person gets around all of it.** Latch raises the cost of a
  distraction. It is not a prison, and it should not be.

---

<div align="center">

[MIT](LICENSE). Built with ❤️ by Saksham Arora.

</div>
