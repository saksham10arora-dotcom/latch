# How Escape is actually blocked

The first version of this was wrong. It assumed Escape could not be stopped, so
it let the exit happen and threw an overlay up afterwards. That is the fallback,
not the mechanism.

## Keyboard Lock

`navigator.keyboard.lock(["Escape"])` exists for exactly this. It is what
remote-desktop and cloud-gaming pages use so Escape reaches the app instead of
the browser. While it is held **and** the page is in full screen:

- pressing Escape delivers a `keydown` to the page
- it does **not** exit full screen

Verified present in Chrome 148 on youtube.com: `navigator.keyboard.lock` is a
function, the context is secure, and `document.fullscreenEnabled` is true.

Requirements: a secure context (YouTube is HTTPS) and full screen. The lock is
released automatically when full screen ends, so it has to be re-taken every
time full screen is entered.

## The one exit that cannot be removed, and should not be

Holding Escape for about two seconds force-exits full screen no matter what the
page does. Chrome shows its own "Press and hold Esc to exit" prompt.

That is a deliberate browser guarantee, and removing it is not something any API
allows. It is also the right line: a page that could trap a user in full screen
with no way out would be a genuinely dangerous thing to be able to build.

So the honest description of this extension is: **a press of Escape does
nothing. Getting out takes a two second hold, and then the wall is waiting.**

## What each exit route hits

| Route | What stops it |
|---|---|
| Press Escape | Keyboard Lock swallows it. Nothing happens. |
| `f` key | keydown intercepted in the capture phase |
| YouTube's own full screen button | click intercepted in the capture phase |
| Hold Escape ~2s | Cannot be blocked. The wall catches the exit. |
| Close the tab | `beforeunload` prompt, in strict mode |

The wall is now the backstop for the single route that cannot be closed, rather
than the whole design.
