// Pure logic. No DOM, no chrome APIs, so it is unit testable and shared by the
// overlay and the popup. Loaded as a classic content script (MV3 does not allow
// ESM there), with the UMD tail so tests can require it.
(function (root) {
  /**
   * The unlock ritual. Holding a button is deliberately used instead of a
   * click, because a click is a reflex and a five second hold is not. Your hand
   * has to stay there while you read why you are leaving.
   */
  const DEFAULTS = {
    armed: false,        // is the lock active for this tab
    engaged: false,      // has full screen actually been entered under this arming
    holdSeconds: 8,      // how long the unlock button must be held
    phrase: "",          // optional: also retype this
    strict: false,       // warn before closing the tab or navigating away
    breaks: 0,           // how many times the wall has caught you
  };

  const NUDGES = [
    {
      headline: "You do not want to leave.",
      body:
        "You want to not be bored for ten seconds. Those are different things, " +
        "and only one of them is worth the lecture you are in the middle of.",
    },
    {
      headline: "Nothing out there changed.",
      body:
        "No message arrived. No feed got better. It is the same tab it was four " +
        "minutes ago, and it will be the same one when this finishes.",
    },
    {
      headline: "This feeling has a half-life.",
      body:
        "The pull you feel right now fades in about ninety seconds if you do " +
        "nothing at all. This screen is deliberately slower than that.",
    },
    {
      headline: "Be honest about the reason.",
      body:
        "If the lecture got hard about a minute ago, that is not a reason to " +
        "leave. That is the exact moment you set this up for.",
    },
    {
      headline: "You already decided this.",
      body:
        "A calmer version of you turned this lock on, on purpose, before the " +
        "boring part. He knew this moment was coming. Let him win one.",
    },
  ];

  /**
   * Picks what the wall says.
   *
   * Leans on the two facts the page actually knows: how far into the video you
   * are, and how many times you have already bounced off the wall this session.
   * Specific beats generic, so those are checked first.
   */
  function nudge({ watchedSeconds = 0, breaks = 0, remainingSeconds = null } = {}) {
    if (remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 180) {
      const mins = Math.max(1, Math.round(remainingSeconds / 60));
      return {
        headline: mins === 1 ? "One minute left." : `${mins} minutes left.`,
        body:
          "You are about to quit with less time remaining than it takes to make " +
          "tea. Whatever this is, it survives " + mins + " more minute" +
          (mins === 1 ? "" : "s") + ".",
      };
    }

    if (breaks >= 3) {
      return {
        headline: `That is ${breaks} times.`,
        body:
          "You are not trying to leave, you are fidgeting. Each of these costs " +
          "you the thread you had. Put it down and let the video run.",
      };
    }

    const watchedMinutes = Math.floor(watchedSeconds / 60);
    if (watchedMinutes >= 15) {
      return {
        headline: `You are ${watchedMinutes} minutes in.`,
        body:
          "The expensive part is already paid. Starting is what costs you, and " +
          "you did that " + watchedMinutes + " minutes ago. Leaving now means " +
          "paying it again later for the same material.",
      };
    }

    // Stable within a minute so the wall does not flicker on a redraw, varied
    // across attempts so it does not go stale.
    const i = Math.abs(watchedMinutes * 31 + breaks * 7) % NUDGES.length;
    return NUDGES[i];
  }

  /** Has the ritual been satisfied? Both conditions, when both are configured. */
  function unlockReady({ held = 0, holdSeconds = 8, typed = "", phrase = "" }) {
    if (held < holdSeconds) return false;
    if (phrase && typed.trim() !== phrase.trim()) return false;
    return true;
  }

  /**
   * Should a chrome.storage change re-run the arm/disarm logic?
   *
   * Only when the `armed` flag itself flipped. This exists because of a real
   * bug: raising the wall bumps a `breaks` counter in storage, which fired the
   * change listener, which saw "armed and not in full screen" and tore the wall
   * back down a frame after it appeared. The wall was being built and destroyed
   * by the same event.
   *
   * Keys that move during a normal session (breaks, lockedTabId) must therefore
   * never be treated as an arming decision.
   */
  function isArmingChange(changes, wasArmed) {
    if (!changes || !("armed" in changes)) return false;
    const now = changes.armed.newValue;
    return now !== wasArmed;
  }

  /**
   * May the toolbar popup turn the lock off?
   *
   * No, once the lock has actually engaged. Otherwise the eight second hold is
   * theatre: the wall appears, and two clicks in the popup dismiss it. Every
   * route out has to cost the same thing or the cheapest one becomes the only
   * one anybody uses.
   *
   * Before it engages, the popup is the *only* way to disarm, so it must work:
   * arming and then changing your mind is not an escape attempt.
   */
  function canDisarmFromPopup({ armed = false, engaged = false } = {}) {
    if (!armed) return true;
    return !engaged;
  }

  /**
   * On a fresh page load, should the wall be up?
   *
   * Yes when the lock was engaged and we are no longer in full screen, because
   * that is precisely what a reload looks like from the other side. Reloading
   * drops full screen and starts a brand new content script with no memory, so
   * without this the page came back unlocked and Cmd-R was a one-key bypass
   * around the whole ritual.
   *
   * `engaged` therefore has to survive in storage rather than living in a
   * variable: the variable dies with the page, and the lock must not.
   */
  function shouldRaiseWallOnLoad({ armed = false, engaged = false, inFullscreen = false } = {}) {
    if (!armed || !engaged) return false;
    return !inFullscreen;
  }

  const api = {
    DEFAULTS,
    shouldRaiseWallOnLoad,
    NUDGES,
    nudge,
    unlockReady,
    isArmingChange,
    canDisarmFromPopup,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LatchPersuade = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
