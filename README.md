<div align="center">

<img src="icons/icon-128.png" width="88" alt="Latch">

```
██╗      █████╗ ████████╗ ██████╗██╗  ██╗
██║     ██╔══██╗╚══██╔══╝██╔════╝██║  ██║
██║     ███████║   ██║   ██║     ███████║
██║     ██╔══██║   ██║   ██║     ██╔══██║
███████╗██║  ██║   ██║   ╚██████╗██║  ██║
╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝
```

**Pins a video lecture in full screen. Escape does nothing.**

> Most blockers ask you to be disciplined at the exact moment you are not.
> Latch is built for the version of you who wants to quit.

[![License: MIT](https://img.shields.io/badge/License-MIT-5b9dff.svg)](LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-5b9dff.svg)](manifest.json)
[![Tests](https://img.shields.io/badge/tests-46%20passing-4caf82.svg)](#development)
[![Escape surface](https://img.shields.io/badge/escape%20surface-audited-f8b45a.svg)](ESCAPES.md)

<img src="assets/demo-wall.gif" width="600" alt="The lock screen assembling: the gauge draws to how far into the lecture you already are">

</div>

---

## The moment it exists for

You are forty minutes into a lecture. It gets hard. Your hand reaches for
`Cmd-T` before you have decided anything.

Latch is what happens next. Press Escape and nothing happens.

---

## Where it works

47 platforms:

**Video and the big MOOCs** · YouTube, Udemy, Coursera, edX, Udacity, FutureLearn, Codecademy, Pluralsight, Skillshare, DataCamp, Educative, Alison, MasterClass, Domestika, LinkedIn Learning, O'Reilly

**Developer platforms** · Frontend Masters, egghead.io, Laracasts, Scrimba, Treehouse, Vue School, LeetCode, Code with Mosh

**India** · NPTEL, SWAYAM, Unacademy, Physics Wallah, Vedantu, BYJU'S, Doubtnut, Testbook, Scaler, Coding Ninjas, upGrad, Great Learning, Simplilearn

**Universities and open courseware** · MIT OpenCourseWare, Stanford Online, Khan Academy, Brilliant

**Course hosting** · Teachable, Thinkific, Kajabi, Podia, Maven, Vimeo

LinkedIn and O'Reilly are scoped to `/learning/` and `/library/`, so the
extension never asks for the rest of either site.

**And anywhere else.** The lock itself is site-agnostic: Keyboard Lock,
`fullscreenchange` and the wall are browser features, not YouTube features, so
only four things ever needed a site to be named, and three of them have a
generic answer. An unlisted platform still locks, matching on accessibility
labels (`aria-label="Full screen"`) rather than class names, because a label is a
contract a player is unlikely to break while `.ytp-fullscreen-button` is an
implementation detail that moves.

A site entry in `src/persuade.js` is therefore an optimisation, not a
requirement. Adding one is a few lines, and nothing breaks without it.

## What it stops

| You press | What happens |
|---|---|
| `Escape` | nothing |
| `Cmd-R`, `Cmd-L` | nothing |
| `Cmd-T`, `Cmd-W`, `Cmd-N`, `Cmd-1..9` | nothing |
| `f`, the player's full screen button | nothing |
| a different tab | you are put back |
| an address that is not YouTube | you are put back |
| closing the tab | it reopens, still locked |
| **holding `Escape` for two seconds** | **the lock screen** |

The video pauses too, so a lecture is never playing to an empty room behind the
lock screen.

### How Escape is blocked

[`navigator.keyboard.lock(["Escape"])`](https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/lock),
the Keyboard Lock API that remote-desktop and cloud-gaming pages use. While it is
held in full screen, Escape arrives as an ordinary keydown and does **not** exit
full screen.

Holding Escape for two seconds still forces full screen off, and no API can
remove that. It is a browser guarantee and it should be: a page able to trap
someone in full screen with no way out would be a dangerous thing to build.

---

## Getting out

A **hold**, not a click, because a click is a reflex and eight seconds is not.
Optionally a phrase to retype as well. Letting go resets the timer, so it cannot
be chipped away at in bursts, and a correct phrase cannot skip the hold.

The toolbar popup cannot end an engaged lock. Neither can the keyboard shortcut.
Every route out has to cost the same thing, or the cheapest one becomes the only
one anybody uses.

While you hold it, the screen argues. It uses what the page actually knows:
minutes watched, minutes left, and how many times you have already bounced off it.

> ### You are 34 minutes in.
> The expensive part is already paid. Starting is what costs you, and you did
> that 34 minutes ago.

> ### 17 days. This is the one that breaks it.
> Streaks do not end on the hard days. They end on an ordinary Tuesday when
> someone decides one skip does not count.

Deliberately unflattering rather than motivational. Motivational copy stops
working on the second reading, and copy that shames you makes the extension
something you delete.

---

## Every way out, written down

[**ESCAPES.md**](ESCAPES.md) is the full audit: each route, what closes it, and
which are deliberately left open.

It exists because eight real bypasses were found by using this, and patching them
one at a time kept missing the class each belonged to. Three patterns account for
all of them:

1. **Guards gated on `inFullscreen()`**, which is false exactly when the lock
   screen is up, leaving the screen shown to someone actively trying to leave as
   the least protected part of the extension.
2. **Load order.** After a reload the lock screen goes up before YouTube has
   built its player, so anything done to the page once may need doing again.
3. **Races.** Closing the locked tab reopens it, and two guards read the
   momentarily missing tab as "the session is over" and disarmed it. Exactly one
   place may end a session.

Deliberately still open: holding Escape, removing the extension, quitting Chrome,
`Cmd-Tab`, incognito, other extensions, another browser. A lock with no way out
is a dangerous thing to build.

---

## Install

Not on the Chrome Web Store yet.

```bash
git clone https://github.com/saksham10arora-dotcom/latch.git
```

`chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick the
cloned folder.

Then play a lecture, go full screen, and press **Option-Shift-L**.

If the shortcut does nothing, another extension has claimed it. The popup reads
the binding back from Chrome and will tell you; set your own at
`chrome://extensions/shortcuts`.

**Turn on "Allow in Incognito"** while you are there, or a private window is a
clean way out.

---

## Development

```bash
npm install
npm test               # 46 tests
bash scripts/package.sh   # -> build/latch.zip for the Web Store
```

All logic that can be tested without a browser lives in `src/persuade.js`. The
tests import it the same way Chrome loads it, as a classic script attaching to
`globalThis`, so a change that breaks the extension breaks the suite.

The service worker deliberately does **not** call `importScripts`. A worker
registers its listeners by running top to bottom, so anything that throws first
means `chrome.tabs.onActivated` is never registered and the guard silently does
not exist. The few values it needs are inlined, and tests assert the copy has not
drifted from the module.

**Most likely to rot:** the YouTube selectors in `src/lock.js`. Those are
YouTube's own class names and they move.

---

## Privacy

No network requests, no analytics, nothing leaves your machine. `storage` holds
your own settings and the lock state. `tabs` is what lets the lock return you to
the lecture tab and reopen it if it is closed.

---

## Known limits

- **Chrome and Chromium only.** The logic ports; the manifest needs a Firefox
  variant.
- **A determined person gets around all of it.** Latch raises the cost of a
  distraction. It is not a prison, and it should not be.

---

<div align="center">

[MIT](LICENSE). Built with ❤️ by Saksham Arora.

</div>
