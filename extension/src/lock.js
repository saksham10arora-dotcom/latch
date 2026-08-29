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

  /**
   * Is this content script still attached to a live extension?
   *
   * Reloading the extension orphans every content script already running in an
   * open tab: the page keeps executing the old code, but every chrome.* call
   * throws "Extension context invalidated". Unguarded, that turns each of this
   * script's own handlers into a source of uncaught errors, and the wall stops
   * being able to record anything.
   *
   * Nothing can revive an orphan, so the honest behaviour is to notice and go
   * quiet rather than throw on every keystroke.
   */
  function alive() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  /** chrome.storage from a content script, safe against the orphan case. */
  function store(patch) {
    if (!alive()) return;
    try {
      chrome.storage.local.set(patch);
    } catch { /* orphaned between the check and the call */ }
  }

  /** chrome.runtime.sendMessage, same treatment. */
  function tell(message) {
    if (!alive()) return;
    try {
      chrome.runtime.sendMessage(message)?.catch?.(() => {});
    } catch { /* orphaned */ }
  }

  // --- overlay -------------------------------------------------------------

  function build() {
    const root = document.createElement("div");
    root.id = "latch-wall";
    root.innerHTML = `
      <div class="latch-rail"><span class="latch-rail-fill"></span></div>
      <div class="latch-inner">
        <p class="latch-meta"></p>
        <p class="latch-title"></p>
        <h1 class="latch-head"></h1>
        <p class="latch-body"></p>
        <div class="latch-actions">
          <button class="latch-back" type="button">Back to the lecture</button>
          <button class="latch-out" type="button">
            <span class="latch-fill"></span>
            <span class="latch-out-label">Hold to unlock</span>
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
        const left = Math.max(0, state.holdSeconds - held);
        root.querySelector(".latch-out-label").textContent =
          left > 0 ? `Hold to unlock  ${left.toFixed(1)}s` : "Release to unlock";
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
      root.querySelector(".latch-out-label").textContent = "Hold to unlock";
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
    overlay.querySelector(".latch-title").textContent = lectureTitle();
    // The rail is the single most persuasive fact on the screen made visible:
    // how much of this lecture you have already sat through. A sentence saying
    // "34 minutes in" is an argument; a bar that is two thirds full is a fact.
    const done = watchedFraction();
    overlay.querySelector(".latch-rail-fill").style.width = `${(done * 100).toFixed(2)}%`;
    // One frame later so the transition has a start state to animate from.
    requestAnimationFrame(() => overlay?.classList.add("is-in"));
    const phrase = overlay.querySelector(".latch-phrase");
    phrase.hidden = !state.phrase;
    held = 0;
    refreshHint();
    // Pausing matters: without it the lecture plays on behind the wall and you
    // miss the part you were supposed to be watching.
    silence();
    state.breaks += 1;
    store({ breaks: state.breaks });
  }

  /**
   * Keep media paused for as long as the wall is up.
   *
   * A single pause() call is not enough. After a reload the wall goes up before
   * YouTube has created the <video> element, so there is nothing to pause yet,
   * and the player then autoplays into an empty room behind the wall. Retrying
   * covers the element arriving late; the capture-phase "play" listener below
   * covers everything after that, including ads and any element YouTube swaps in.
   */
  function silence() {
    let tries = 0;
    const attempt = () => {
      document.querySelectorAll("video, audio").forEach((el) => {
        try { el.pause(); } catch { /* not ready */ }
      });
      // Roughly three seconds of retries, which is longer than YouTube takes to
      // build its player on a cold load.
      if (++tries < 30 && overlay) setTimeout(attempt, 100);
    };
    attempt();
  }

  // Anything that starts playing while the wall is up is stopped again. `play`
  // does not bubble, so this listens in the capture phase to catch it from any
  // element, however late it appears.
  document.addEventListener(
    "play",
    (e) => {
      if (!overlay) return;
      try { e.target?.pause?.(); } catch { /* gone */ }
    },
    true
  );

  function down() {
    overlay?.remove();
    overlay = null;
    clearInterval(holdTimer);
    holdTimer = null;
    held = 0;
    // Only the main video is resumed, never every media element on the page.
    video()?.play?.().catch(() => {});
  }

  function release() {
    clearInterval(holdTimer);
    holdTimer = null;
    state.armed = false;
    engaged = false;
    releaseKeyboardLock();
    // "release", not "disarm": the worker refuses a disarm once the lock has
    // engaged, and this is the one route that is allowed through.
    tell({ type: "release" });
    down();
  }

  /** How far through the lecture you already are, 0 to 1. */
  function watchedFraction() {
    const v = video();
    if (!v || !v.duration || !isFinite(v.duration)) return 0;
    return Math.max(0, Math.min(1, v.currentTime / v.duration));
  }

  /**
   * The lecture's own name. Naming the specific thing you are walking out of is
   * more pointed than "this session", and the page already knows it.
   */
  function lectureTitle() {
    const el = document.querySelector(
      "h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string"
    );
    const fromDom = el?.textContent?.trim();
    if (fromDom) return fromDom;
    return document.title.replace(/\s*-\s*YouTube\s*$/, "").trim();
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
    "KeyR",                               // reload, which would otherwise reset everything
    "KeyL",                               // focus the address bar
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
      // Gate on the lock being engaged, not on full screen. The wall is shown
      // precisely when full screen is gone, so the old condition disabled every
      // in-page guard at the exact moment the wall was on screen.
      if (!state.armed || !engaged) return;

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
        e.code === "KeyR" ||
        e.code === "KeyL" ||
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
      if (!state.armed || !engaged) return;
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
      // Published so the popup can grey its toggle out and the worker can
      // refuse a disarm from anywhere except the wall.
      store({ engaged: true });
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

  // Second, independent detector for the tab losing focus.
  //
  // tabs.onActivated in the worker is the primary one, but an MV3 service
  // worker is killed and restarted constantly, so making it the only path makes
  // it a single point of failure. This fires inside the page, which is alive for
  // as long as the tab is, and needs no worker to notice anything.
  document.addEventListener("visibilitychange", () => {
    if (!state.armed || !engaged) return;
    if (document.visibilityState !== "hidden") return;
    tell({ type: "snapback" });
  });

  window.addEventListener("blur", () => {
    if (!state.armed || !engaged) return;
    tell({ type: "snapback" });
  });

  // --- wiring --------------------------------------------------------------

  // Guarded like the rest: a script loaded into an already-orphaned context
  // would otherwise throw here and never wire anything up.
  if (!alive()) return;
  chrome.storage.local.get(P.DEFAULTS, (stored) => {
    state = { ...P.DEFAULTS, ...stored };
    // Rehydrate from storage. A reload builds a brand new content script, so a
    // local variable would forget the lock was ever engaged, which is exactly
    // what made Cmd-R a one-key bypass.
    engaged = !!state.engaged;

    if (state.armed && inFullscreen()) {
      engaged = true;
      store({ engaged: true });
      takeKeyboardLock();
    } else if (P.shouldRaiseWallOnLoad({ armed: state.armed, engaged, inFullscreen: false })) {
      // Came back from a reload or a navigation that dropped full screen. The
      // reload was the escape attempt, so the wall is what greets it.
      up();
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    const wasArmed = state.armed;
    for (const [k, { newValue }] of Object.entries(changes)) state[k] = newValue;

    // Only an actual flip of `armed` is an arming decision. Without this, the
    // breaks counter that up() writes re-entered this handler and tore the wall
    // down immediately after raising it.
    if (!P.isArmingChange(changes, wasArmed)) return;

    if (!state.armed) {
      engaged = false;
      releaseKeyboardLock();
      down();
    } else if (inFullscreen()) {
      // Armed mid-lecture, already full screen: take the lock now rather than
      // waiting for the next transition, which may never come.
      engaged = true;
      store({ engaged: true });
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
