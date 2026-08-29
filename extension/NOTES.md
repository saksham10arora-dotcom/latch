# Why the overlay exists

Escape cannot be stopped. Exiting full screen on Escape is user-agent behaviour,
not a page event: the keydown fires, but `preventDefault()` does not cancel the
exit. No extension can hold a video in full screen against the key.

Re-entering is also gated. `requestFullscreen()` only works inside a user
gesture, so a content script cannot silently put you back.

What is left is the design this uses, and it turns out to be the better one
anyway: let the exit happen, and answer it in the same frame.

  exit full screen  ->  fullscreenchange fires  ->  an opaque overlay covers
  the entire page before the video is visible again

The overlay carries the only two ways forward. "Back to the lecture" is a real
click, which is a user gesture, which is exactly what `requestFullscreen()`
needs. "Unlock" runs the ritual.

So the video is not literally trapped in full screen. What is true is that
leaving it buys you nothing: you do not get the page back, you get a wall, and
the cheapest way out of the wall is back into the lecture.
