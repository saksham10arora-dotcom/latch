/* global LatchPersuade */
(() => {
  const P = LatchPersuade;
  let state = { ...P.DEFAULTS };
  let overlay = null;
  let held = 0;
  let holdTimer = null;
  /**
   * Whether the lock has anything to protect yet.
   *
   * Arming happens from the popup, which you can only click while NOT in full
   * screen. Treating "armed and windowed" as an escape attempt therefore threw
   * the quit wall up the instant you armed it, which is exactly backwards. The
   * wall belongs to *leaving* full screen, so it only fires once full screen has
   * actually been entered at least once under this arming.
   */
  let engaged = false;

  const video = () => document.querySelector("video.html5-main-video, video");
  const inFullscreen = () => !!document.fullscreenElement;

  // --- overlay -------------------------------------------------------------

  function build() {
    const root = document.createElement("div");
    root.id = "latch-wall";
    root.innerHTML = `
      <div class="latch-inner">
        <p class="latch-meta"></p>
        <h1 class="latch-head"></h1>
        <p class="latch-body"></p>
        <div class="latch-actions">
          <button class="latch-back" type="button">Back to the lecture</button>
          <button class="latch-out" type="button">
            <span class="latch-out-label">Hold to unlock</span>
            <span class="latch-fill"></span>
          </button>
        </div>
        <input class="latch-phrase" type="text" placeholder="type the phrase" hidden>
        <p class="latch-hint"></p>
      </div>`;
    document.documentElement.appendChild(root);

    // Back is a real click, which is a user gesture, which is the only context
    // where requestFullscreen() is allowed to work. This is why the wall has a
    // button instead of just putting you back automatically.
    root.querySelector(".latch-back").addEventListener("click", () => {
      const v = video();
      const target = v?.closest("#movie_player") || v;
      target?.requestFullscreen?.().catch(() => {});
      down();
    });

    const out = root.querySelector(".latch-out");
    const startHold = () => {
      if (holdTimer) return;
      holdTimer = setInterval(() => {
        held += 0.1;
        const pct = Math.min(100, (held / state.holdSeconds) * 100);
        root.querySelector(".latch-fill").style.width = pct + "%";
        if (held >= state.holdSeconds) refreshHint();
        if (P.unlockReady({ held, holdSeconds: state.holdSeconds, typed: phraseValue(), phrase: state.phrase })) {
          release();
        }
      }, 100);
    };
    const stopHold = () => {
      clearInterval(holdTimer);
      holdTimer = null;
      // Resetting on release is the point: letting go restarts the ritual, so
      // it cannot be chipped away at in half second bursts.
      held = 0;
      root.querySelector(".latch-fill").style.width = "0%";
      refreshHint();
    };
    out.addEventListener("mousedown", startHold);
    out.addEventListener("touchstart", startHold, { passive: true });
    ["mouseup", "mouseleave", "touchend", "blur"].forEach((e) =>
      out.addEventListener(e, stopHold)
    );

    root.querySelector(".latch-phrase").addEventListener("input", refreshHint);
    return root;
  }

  const phraseValue = () => overlay?.querySelector(".latch-phrase")?.value ?? "";

  function refreshHint() {
    if (!overlay) return;
    const hint = overlay.querySelector(".latch-hint");
    if (held < state.holdSeconds) {
      const left = Math.max(0, state.holdSeconds - held);
      hint.textContent = `Keep holding for ${left.toFixed(1)}s.`;
    } else if (state.phrase && phraseValue().trim() !== state.phrase.trim()) {
      hint.textContent = `Now type it exactly: ${state.phrase}`;
    } else {
      hint.textContent = "";
    }
  }

  function up() {
    if (overlay) return;
    overlay = build();
    const v = video();
    const n = P.nudge({
      watchedSeconds: v?.currentTime ?? 0,
      remainingSeconds: v && v.duration ? v.duration - v.currentTime : null,
      breaks: state.breaks,
    });
    overlay.querySelector(".latch-head").textContent = n.headline;
    overlay.querySelector(".latch-body").textContent = n.body;
    overlay.querySelector(".latch-meta").textContent = remainingLabel();
    const phrase = overlay.querySelector(".latch-phrase");
    phrase.hidden = !state.phrase;
    held = 0;
    refreshHint();
    // Pausing matters: without it the lecture keeps playing behind the wall and
    // you miss the part you were meant to be watching.
    video()?.pause();
    state.breaks += 1;
    chrome.storage.local.set({ breaks: state.breaks });
  }

  function down() {
    overlay?.remove();
    overlay = null;
    clearInterval(holdTimer);
    holdTimer = null;
    held = 0;
    video()?.play?.().catch(() => {});
  }

  function release() {
    clearInterval(holdTimer);
    holdTimer = null;
    state.armed = false;
    engaged = false;
    releaseKeyboardLock();
    // Through the worker, so the pinned tab is cleared in the same step the
    // lock is dropped. Setting storage directly would leave a stale pin behind.
    chrome.runtime.sendMessage({ type: "disarm" }).catch(() => {});
    down();
  }

  function remainingLabel() {
    const v = video();
    if (!v || !v.duration) return "Lecture lock";
    const left = Math.max(0, v.duration - v.currentTime);
    const m = Math.floor(left / 60);
    const s = Math.floor(left % 60);
    return `Lecture lock · ${m}:${String(s).padStart(2, "0")} of video left`;
  }

  // --- the actual enforcement ----------------------------------------------

  /**
   * Keyboard Lock is the mechanism. While it is held and the page is in full
   * screen, Escape is delivered to the page as an ordinary keydown and does NOT
   * exit full screen. It is the same API remote-desktop and cloud-gaming pages
   * use, and it is why a press of Escape here does nothing at all.
   *
   * It must be re-taken every time full screen is entered, because leaving full
   * screen releases it automatically.
   */
  // Keys the browser would otherwise act on itself. Locking them means the
  // shortcut does nothing at all, rather than being undone a moment later by
  // the service worker snapping the tab back.
  //
  // Named by physical code, not character, which is what the API takes: Cmd-1
  // is Digit1 plus a modifier. Deliberately a list rather than lock() with no
  // arguments, since locking every key would also swallow ordinary typing.
  const LOCKED_KEYS = [
    "Escape",
    "KeyT", "KeyW", "KeyN",              // new tab, close tab, new window
    "Tab",                                // Ctrl-Tab / Cmd-Alt-arrow cycling
    "Digit1", "Digit2", "Digit3", "Digit4",
    "Digit5", "Digit6", "Digit7", "Digit8", "Digit9",
  ];

  async function takeKeyboardLock() {
    if (!navigator.keyboard?.lock) return false;
    try {
      await navigator.keyboard.lock(LOCKED_KEYS);
      return true;
    } catch {
      // Denied or unsupported. Escape then falls through to the wall, and tab
      // switches to the service worker, so this degrades rather than fails open.
      try {
        await navigator.keyboard.lock(["Escape"]);
        return true;
      } catch {
        return false;
      }
    }
  }

  function releaseKeyboardLock() {
    try { navigator.keyboard?.unlock?.(); } catch { /* nothing to undo */ }
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (!state.armed || !inFullscreen()) return;

      // With the lock held this is where Escape arrives instead of exiting.
      // Swallowing it silently would read as a broken page, so it gets a brief,
      // honest toast rather than nothing.
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        toast();
        return;
      }

      // YouTube's own full screen shortcut.
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Tab and window shortcuts. Only swallowed when a modifier is down, so
      // typing a "t" into the search box still works normally.
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const isTabShortcut =
        e.code === "KeyT" ||
        e.code === "KeyW" ||
        e.code === "KeyN" ||
        e.code === "Tab" ||
        /^Digit[1-9]$/.test(e.code);
      if (isTabShortcut) {
        e.preventDefault();
        e.stopPropagation();
        toast("Locked in. That shortcut is off until you unlock.");
      }
    },
    true
  );

  // The player's exit-full-screen button is a page element, not browser chrome,
  // so a capture-phase click handler can stop it outright.
  document.addEventListener(
    "click",
    (e) => {
      if (!state.armed || !inFullscreen()) return;
      const button = e.target?.closest?.(".ytp-fullscreen-button, .ytp-size-button");
      if (!button) return;
      e.preventDefault();
      e.stopPropagation();
      toast();
    },
    true
  );

  document.addEventListener("fullscreenchange", () => {
    if (!state.armed) return;
    if (inFullscreen()) {
      engaged = true;
      down();
      takeKeyboardLock();
    } else {
      releaseKeyboardLock();
      // Only an exit counts. Never having been in full screen is not an escape.
      if (engaged) up();
    }
  });

  // Closing the tab is the other way out. Strict mode makes the browser ask.
  window.addEventListener("beforeunload", (e) => {
    if (!state.armed || !state.strict) return;
    e.preventDefault();
    e.returnValue = "";
  });

  // --- toast ---------------------------------------------------------------

  let toastEl = null;
  let toastTimer = null;

  /**
   * Feedback for a swallowed Escape. Says what happened and what the real exit
   * costs, because a key that does nothing with no explanation reads as a bug,
   * and hiding the hold-Escape route would be dishonest: the browser prompts
   * for it anyway.
   */
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "latch-toast";
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = message || "Locked in. Hold Esc to force out, and the wall is waiting.";
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl?.classList.remove("on"), 2200);
  }

  // --- wiring --------------------------------------------------------------

  chrome.storage.local.get(P.DEFAULTS, (stored) => {
    state = { ...P.DEFAULTS, ...stored };
    if (state.armed && inFullscreen()) {
      engaged = true;
      takeKeyboardLock();
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const [k, { newValue }] of Object.entries(changes)) state[k] = newValue;
    if (!state.armed) {
      engaged = false;
      releaseKeyboardLock();
      down();
    } else if (inFullscreen()) {
      // Armed mid-lecture, already full screen: take the lock now rather than
      // waiting for the next transition, which may never come.
      engaged = true;
      takeKeyboardLock();
      toast("Locked in. Escape and tab switching are off.");
    } else {
      // Armed from the popup, so necessarily windowed. Wait for full screen
      // instead of raising the wall at someone who has not gone anywhere.
      down();
      toast("Armed. Go full screen and it locks.");
    }
  });
})();
