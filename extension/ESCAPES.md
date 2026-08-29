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
