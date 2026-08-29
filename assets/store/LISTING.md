# Chrome Web Store listing

Everything the submission form asks for, written out. Copy from here rather than
improvising into the form, because the permission justifications in particular
are what a review turns on.

## Basics

**Name**
```
Latch Lecture Lock
```

**Short description** (132 char limit)
```
Pins a YouTube lecture in full screen. Escape does nothing. Getting out takes a deliberate eight second hold.
```

**Category** Productivity → Workflow & Planning

**Language** English

## Detailed description

```
Latch is for the moment forty minutes into a lecture when it gets hard and your
hand reaches for Cmd-T before you have decided anything.

Arm it with a keyboard shortcut while a lecture is playing, and:

  - Escape does nothing
  - Reload, new tab, close tab and Cmd-1..9 do nothing
  - Clicking another tab puts you back
  - Navigating away from the lecture puts you back
  - The video pauses if you do get out, so it is not playing to an empty room

Getting out is always possible and always deliberate: hold a button for eight
seconds, optionally typing a phrase as well. Letting go resets the timer. The
screen you hold it on tells you how far into the lecture you already are, and
argues, briefly, that you stay.

It is not a prison. Holding Escape for two seconds always forces full screen off,
and removing the extension always works. Latch raises the cost of a distraction
rather than pretending to remove the option.

Open source, MIT licensed:
https://github.com/saksham10arora-dotcom/latch
```

## Permission justifications

These are the fields a review actually reads. Be specific; vague answers are the
usual cause of a rejection.

**`storage`**
```
Stores the user's own settings (hold duration, optional unlock phrase, whether
to warn on tab close) and the lock's current state, so that the lock survives a
page reload. Nothing is transmitted anywhere.
```

**`tabs`**
```
The lock's purpose is to keep the user on their chosen lecture tab. The
extension needs to know when a different tab becomes active so it can return the
user to the lecture, and needs the URL of the locked tab so that closing it can
be undone by reopening the same lecture. No browsing history is read, stored or
transmitted; only the single tab the user explicitly locked is inspected.
```

**Host permission `*://*.youtube.com/*`**
```
The lock runs only on YouTube, where the lecture is. The content script needs to
observe full-screen changes on the page and display the lock screen over it.
The extension requests no access to any other site.
```

**Remote code** No. All code is in the package; nothing is fetched or evaluated
at runtime.

**Data usage disclosures** Tick nothing. The extension collects no user data,
makes no network requests, and has no analytics. Certify all three:
does not sell data, does not use it for unrelated purposes, does not use it for
creditworthiness.

## Assets

| Item | Requirement | File |
|---|---|---|
| Icon | 128x128 PNG | `extension/icons/icon-128.png` |
| Screenshot | 1280x800 or 640x400, at least one | `assets/store/screenshot-wall.png` |

`screenshot-source.html` regenerates the screenshot. Open it and capture at
1280x800, or:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --screenshot=out.png --window-size=1280,800 \
  file://$PWD/assets/store/screenshot-source.html
```

## Before you submit

- A privacy policy URL is required once any permission is declared. The README
  section covers it; link to the repo, or add a `PRIVACY.md` and link that.
- Bump `version` in `extension/manifest.json` for every upload. The store
  rejects a re-upload of a version it already has.
- Build the package with `bash scripts/package-extension.sh` and upload
  `build/latch-lecture-lock.zip`. Never zip the `extension/` folder directly:
  it contains `node_modules` and tests.

## What to expect

A one-time 5 USD registration fee, and a review that usually takes a few days.
`tabs` is a sensitive permission, so expect the justification above to be the
part they read most carefully. An extension that prevents leaving a page is
legitimate and the category is full of them, but describing the escape routes
plainly, as the description does, is what makes it read as a focus tool rather
than something that traps people.
