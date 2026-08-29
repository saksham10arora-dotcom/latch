# Escape surface

Every way out of an engaged lock, what closes it, and what deliberately does not.
Written because fixing reported bugs one at a time kept missing the class the bug
belonged to.

## The rule

Full screen and the wall are **two states of the same lock**, not lock and
aftermath. Anything blocked in one must be blocked in the other. Most holes so
far came from gating on `inFullscreen()`, which is false exactly when the wall is
up, so the wall screen was the least protected part of the whole thing.

## In-page keys

| Route | State | Closed by |
|---|---|---|
| Escape | full screen | Keyboard Lock swallows it |
| `f`, player full screen button | both | capture-phase handlers |
| Cmd-T / W / N / R / L / 1-9 / Ctrl-Tab | full screen | Keyboard Lock + keydown |
| Same keys while the wall is up | wall | **Cannot be blocked in-page.** Keyboard Lock needs full screen. The worker's snap-back is the answer. |

## Tabs and windows

| Route | Closed by |
|---|---|
| Clicking another tab | `tabs.onActivated` snap-back |
| Tab loses focus at all | `visibilitychange` in the page, a second independent path so the worker is not a single point of failure |
| New tab | `tabs.onCreated`, blank ones closed |
| New window | `windows.onCreated` and `windows.onFocusChanged` |
| Navigating off YouTube | `tabs.onUpdated` returns the pinned URL |
| **Closing the locked tab** | reopened at the pinned URL and re-pinned. Previously this disarmed everything, making Cmd-W then Cmd-Shift-T a two-key bypass. |

## Deliberately open

These are the floor. A lock with no way out is a dangerous thing to build, and
each of these costs enough to not be a reflex.

| Route | Why it stays open |
|---|---|
| Hold Escape ~2s | Browser guarantee. No API can remove it, and it should not be removable. |
| Removing or disabling the extension | Several deliberate clicks through `chrome://extensions`. |
| Quitting Chrome, Cmd-Q | Nothing in a page or extension can stop an application quitting. |
| Cmd-Tab to another app | macOS handles it before Chrome sees the key. Out of scope by choice. |
| Closing the whole window | Distinguished from closing a tab via `isWindowClosing`, and not fought. Fighting a window close means fighting a quit. |
| Incognito, or another Chrome profile | The extension is not loaded there. Worth knowing rather than pretending. |
| Another browser entirely | Nothing here can see it. |
| **Other extensions** | An extension cannot act on another extension. Their toolbar buttons and Chrome's side panel are browser chrome: a page cannot see them, receive their clicks, or cover them, exactly like the tab strip. `chrome.management.setEnabled` technically exists, but reaching for "Manage your apps, extensions and themes" at install so a focus timer can switch off your other software is hostile, and would be the most invasive permission in the extension by a wide margin. Not doing it. |

## Load order, which is its own class of bug

After a reload the wall goes up *before* YouTube has built its player. Anything
the wall does to the page in a single call therefore lands on a page that does
not exist yet.

That is what made the lecture keep playing behind the wall: `pause()` ran, found
no `<video>`, and YouTube then autoplayed into an empty room. Muting a page is a
state to be held, not a call to be made once, so it retries while the element
appears and a capture-phase `play` listener stops anything that starts later,
ads and swapped-in elements included.

Anything else that touches the page on load should assume the same: the page is
not finished, and whatever you did may need doing again.

## Failures that look like the guard was never there

Two real ones, both silent, both found only by reading chrome://extensions.

**`Tabs cannot be edited right now (user may be dragging a tab)`.**
`chrome.tabs.update` rejects during the transient state right after a tab is
clicked, which is exactly when the snap-back runs. A single call rejected, the
rejection went unhandled, and the tab switch stood. The guard was firing
correctly the whole time and losing at the last step. It retries with a backoff
now, and gives up rather than spinning.

**`Extension context invalidated`.** Reloading the extension orphans every
content script already running in an open tab: the page keeps executing the old
code, but every `chrome.*` call from it throws. Unguarded, that made each of the
script's own handlers a source of uncaught errors. Orphans cannot be revived, so
they check `chrome.runtime?.id` and go quiet instead.

The lesson for both: a guard that fires but fails is indistinguishable from a
guard that never ran, and neither shows up anywhere except the extension's own
error page. Check it before theorising.

## In-page layering

What another extension puts *into the page* is winnable, and is handled.
`z-index` alone does not settle it: two elements both at the maximum are ordered
by their position in the DOM, so whatever is appended last is on top. The wall
keeps itself as the last child of `<html>` while it is up, and re-adds itself if
something removes it.

That is the whole extent of it. Anything an extension renders outside the page
is out of reach, and pretending otherwise would be worse than saying so.

## Races, which is the third class

Closing the locked tab reopens it. For a moment during that, the pinned tab id
points at a tab that has already gone, and two other listeners see it: the
snap-back, and the window-focus handler. Both treated a missing tab as "the
session is over" and disarmed, so Cmd-W reopened the tab with the lock switched
off and the reopen achieved nothing.

The rule that came out of it: **exactly one place may end a session.** Guards put
you back or do nothing. `onRemoved` alone decides a session is over, because it
is the only one that can tell a close from a reopen in flight.

The replacement tab is also flagged while it is being created, so the listener
watching for new tabs does not read our own reopen as somebody escaping, and the
new id is pinned before the flag clears so nothing observes an armed lock
pointing at nothing.

## Rules every guard follows

1. **Default to not enforcing.** Missing or unreadable state must never wall
   somebody who never armed anything.
2. **Exactly one place may end a session.** `onRemoved` decides, and only after
   trying to reopen. Every other guard puts you back or does nothing, because a
   guard that can disarm becomes a way out the moment its timing is off.
3. **Never destroy user data to enforce.** A blank new tab is closed; a tab with
   a real URL is only deactivated.
4. **Enforce in the worker, not the UI.** The popup is a page anyone can open
   devtools on, so greying a control out is a courtesy, not the enforcement.
