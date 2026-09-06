# Privacy policy for Latch

Last updated: 6 September 2026

## The short version

Latch collects nothing, sends nothing, and has no server. There is no account,
no analytics, no telemetry, and no network code of any kind in the extension.

## What is stored, and where

Latch keeps six values in `chrome.storage.local`, which is storage on your own
computer that only this extension can read:

| Key | What it is |
|---|---|
| `armed` | whether the lock is currently on |
| `engaged` | whether full screen has been entered under this arming |
| `holdSeconds` | how long the unlock button must be held |
| `phrase` | the optional phrase you chose to retype when unlocking |
| `strict` | whether to warn before closing the tab |
| `breaks` | how many times the lock screen has appeared |

That is the complete list. Uninstalling Latch removes all of it. None of it
leaves your machine, because there is nothing in the extension that could send
it anywhere.

## What is read from the page, and why

While the lock is armed on a supported tab, Latch reads two things from the page
in order to draw the lock screen:

- whether a `<video>` element exists, and its current time and duration, which is
  the "62% of this lecture done" figure
- the lecture or document title, so the lock screen can name what you are
  leaving

Both are used only to render the lock screen, in the tab, for you. Neither is
stored, logged, or transmitted. Page content itself is never read.

## Permissions, in plain terms

- **`storage`** holds the six settings above.
- **`tabs`** lets the extension notice that you switched away from the locked tab
  and switch you back. It reads the URL of the locked tab only, to confirm the
  tab is still the one you locked. No browsing history is read or kept.
- **Host permissions** for the listed learning platforms, `drive.google.com/file/`
  and `file:///` let the lock screen appear on those pages. The extension does
  nothing on them until you arm it.

Google Drive is scoped to `/file/`, which is the file viewer. Latch cannot see
your Drive file list. Access to local files is off unless you turn on "Allow
access to file URLs" yourself in Chrome.

## No remote code

Everything Latch runs ships inside the extension package. Nothing is downloaded
or evaluated at runtime.

## Changes

Any change to this policy will be a commit in the public repository, so the
history of it is visible:
https://github.com/saksham10arora-dotcom/latch

## Contact

Open an issue: https://github.com/saksham10arora-dotcom/latch/issues
