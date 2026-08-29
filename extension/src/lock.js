/* global LatchPersuade */
(() => {
  const P = LatchPersuade;
  let state = { ...P.DEFAULTS };
  let overlay = null;
  let held = 0;
  let holdTimer = null;

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
    chrome.storage.local.set({ armed: false });
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

  // Escape cannot be cancelled: exiting full screen is user-agent behaviour, so
  // preventDefault here does not stop it. The wall below is what answers it.
  // This handler exists only for the in-page exits it CAN stop, like the
  // player's own full screen button and the "f" shortcut.
  document.addEventListener(
    "keydown",
    (e) => {
      if (!state.armed || !inFullscreen()) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  document.addEventListener("fullscreenchange", () => {
    if (!state.armed) return;
    if (inFullscreen()) down();
    else up();
  });

  // Closing the tab is the other way out. Strict mode makes the browser ask.
  window.addEventListener("beforeunload", (e) => {
    if (!state.armed || !state.strict) return;
    e.preventDefault();
    e.returnValue = "";
  });

  // --- wiring --------------------------------------------------------------

  chrome.storage.local.get(P.DEFAULTS, (stored) => {
    state = { ...P.DEFAULTS, ...stored };
    if (state.armed && !inFullscreen()) up();
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const [k, { newValue }] of Object.entries(changes)) state[k] = newValue;
    if (!state.armed) down();
    else if (!inFullscreen()) up();
  });
})();
