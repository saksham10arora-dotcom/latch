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

## Rules every guard follows

1. **Default to not enforcing.** Missing or unreadable state must never wall
   somebody who never armed anything.
2. **Losing the target disarms rather than strands.** If the pinned tab cannot be
   recovered, the lock ends. Snapping toward a tab that no longer exists is worse
   than no lock.
3. **Never destroy user data to enforce.** A blank new tab is closed; a tab with
   a real URL is only deactivated.
4. **Enforce in the worker, not the UI.** The popup is a page anyone can open
   devtools on, so greying a control out is a courtesy, not the enforcement.
