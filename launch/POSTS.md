# Launch posts

Drafts. Edit them into your own voice before anything goes out; they are written
close to how you talk but they are not you.

Rule for all of them: lead with the mechanism, not the product. "I built a focus
app" is ignored. "Escape does not exit full screen and here is the API that makes
that possible" is not.

---

## X thread

**1/**
```
I kept quitting lectures 40 minutes in.

So I made Escape stop working.

Chrome extension. Press Esc in a YouTube lecture and nothing happens.
```
*(attach the GIF)*

**2/**
```
Turns out this is a real browser API, not a hack.

navigator.keyboard.lock(["Escape"])

It is what cloud gaming and remote desktop pages use. While it is held in full
screen, Escape reaches the page as a normal keydown instead of exiting.
```

**3/**
```
Then I tried to break it. Eight times I got out:

reload, Cmd-W, Cmd-T, clicking a tab, the address bar,
the extension's own popup, a new window, and hold-Escape.

Fixed seven. The eighth is meant to stay.
```

**4/**
```
The eight bugs turned out to be three patterns:

1. guards that switched off exactly when the lock screen was up
2. acting on a page that had not finished loading
3. one guard disarming while another was mid-recovery

Wrote them down instead of just fixing them.
```

**5/**
```
The thing I did not expect to matter: the copy.

The screen you have to hold a button on for 8 seconds tells you how far into the
lecture you already are. Watching a ring fill to 58% is a better argument than
any sentence.
```

**6/**
```
It is not a prison and it should not be. Holding Escape for 2s always works,
and removing the extension always works.

It raises the cost of a distraction. That is all a lock is.

MIT, escape surface documented:
github.com/saksham10arora-dotcom/latch
```

---

## Hacker News

**Title**
```
Show HN: Latch, a Chrome extension where Escape does not exit full screen
```

**First comment**
```
I kept abandoning lectures about forty minutes in, so I wanted something that
made leaving cost more than a keypress.

The mechanism is navigator.keyboard.lock(["Escape"]), the Keyboard Lock API.
Most people do not know it exists. While it is held and the page is in full
screen, Escape is delivered to the page as an ordinary keydown and does not exit.
It is what cloud gaming and remote desktop pages use.

Holding Escape for about two seconds still force-exits and no API can remove
that, which is correct. A page able to trap someone in full screen with no way
out would be a genuinely dangerous thing to be able to build. So the design lets
that one route stand and answers it with a screen you have to hold a button on.

The more interesting part was breaking it. I found eight ways out after thinking
it was done: reload, Cmd-W then Cmd-Shift-T, tab clicks, the address bar, its own
toolbar popup, a new window. Patching them one at a time kept missing the class
each belonged to. They were three patterns, and the third only became visible on
the sixth bug:

  1. guards gated on inFullscreen(), which is false exactly when the lock screen
     is up, so the screen shown to someone actively trying to leave was the least
     protected part of the extension
  2. load order: after a reload the lock screen goes up before YouTube has built
     its player, so a single pause() call landed on nothing
  3. races: closing the locked tab reopens it, and two other guards read the
     momentarily missing tab as "session over" and disarmed

ESCAPES.md documents every route, what closes it, and what is deliberately left
open. That file is the part I would actually want reviewed.

MIT. No network requests, no analytics.
```

---

## r/GetDisciplined

**Title**
```
I got tired of Escape working, so I made it stop
```

**Body**
```
I kept quitting lectures about forty minutes in. Not because I was done, because
it got hard and my hand moved before I decided anything.

So I built a Chrome extension that pins the video in full screen. Press Escape
and nothing happens. Reload, new tab, close tab, clicking another tab: nothing,
or you get put straight back.

Getting out is possible on purpose, it just costs something. Hold Escape for two
seconds, then hold a button for eight while a screen tells you how far into the
lecture you already are. Letting go resets the timer.

The part that surprised me is that the screen showing 58% done is a better
argument than any sentence I wrote on it. Watching the ring fill to where you
already are is hard to argue with.

It is free and open source. Not claiming it fixes discipline, it just makes
quitting deliberate instead of a reflex.
```
*(attach the GIF)*

---

## r/chrome_extensions

**Title**
```
You can stop Escape exiting full screen with navigator.keyboard.lock()
```

**Body**
```
I did not know this API existed until I needed it.

navigator.keyboard.lock(["Escape"]) is the Keyboard Lock API. In a secure
context, while the page is in full screen, it delivers Escape to the page as an
ordinary keydown instead of exiting full screen. Cloud gaming and remote desktop
pages use it.

Two things worth knowing if you try it:

- It only registers while the document is in full screen. Calling it outside
  rejects with InvalidStateError, so it has to be taken inside the
  fullscreenchange handler and re-taken on every entry.
- Holding Escape for ~2s still force-exits and cannot be blocked. That is a
  deliberate browser guarantee.

Built a focus extension around it. The messier problem turned out to be
everything else: tab switching needs the tabs API and a snap-back, since a page
cannot see the tab strip, and chrome.tabs.update rejects with "Tabs cannot be
edited right now (user may be dragging a tab)" at exactly the moment you want to
call it.

Source is MIT if useful: github.com/saksham10arora-dotcom/latch
```

---

## Awesome-list PR body

```
Adds Latch, an MIT-licensed Chrome extension that keeps a YouTube lecture in
full screen. It uses the Keyboard Lock API so Escape does not exit, with a
deliberate hold-to-unlock rather than a click.

No network requests, no analytics, 46 tests. The repo documents its own escape
surface, including the routes that are deliberately left open.

Placed alphabetically in <section>, matching the surrounding format.
```
