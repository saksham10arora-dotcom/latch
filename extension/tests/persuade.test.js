import { describe, it, expect } from "vitest";

// Imported for its side effect, the same way Chrome loads it: a classic content
// script that hangs its API off the global.
import "../src/persuade.js";
const P = globalThis.LatchPersuade;

describe("nudge", () => {
  it("is never empty, whatever the page knows", () => {
    // Whatever this returns is what you read at the exact moment you are trying
    // to quit. There is no fallback behind it.
    for (const watchedSeconds of [0, 61, 900, 3600]) {
      for (const breaks of [0, 1, 3, 12]) {
        for (const remainingSeconds of [null, 0, 60, 200, 4000]) {
          const n = P.nudge({ watchedSeconds, breaks, remainingSeconds });
          expect(n.headline, JSON.stringify({ watchedSeconds, breaks, remainingSeconds })).toBeTruthy();
          expect(n.body).toBeTruthy();
        }
      }
    }
  });

  it("leads with how little is left when the video is nearly over", () => {
    const n = P.nudge({ watchedSeconds: 3000, breaks: 5, remainingSeconds: 90 });
    expect(n.headline).toMatch(/minute/i);
  });

  it("does not claim minutes are left when the video is over", () => {
    const n = P.nudge({ watchedSeconds: 3600, breaks: 0, remainingSeconds: 0 });
    expect(n.headline).not.toMatch(/0 minutes left/);
  });

  it("calls out repeated attempts with the real count", () => {
    expect(P.nudge({ watchedSeconds: 120, breaks: 4 }).headline).toContain("4");
  });

  it("names the minutes already watched once it is substantial", () => {
    expect(P.nudge({ watchedSeconds: 22 * 60, breaks: 0 }).headline).toContain("22");
  });

  it("does not invoke sunk time two minutes in", () => {
    expect(P.nudge({ watchedSeconds: 120, breaks: 0 }).headline).not.toMatch(/minutes in/);
  });

  it("is stable for the same moment so the wall does not flicker", () => {
    const a = P.nudge({ watchedSeconds: 300, breaks: 1 });
    const b = P.nudge({ watchedSeconds: 300, breaks: 1 });
    expect(a).toEqual(b);
  });

  it("varies across attempts so it does not go stale", () => {
    const seen = new Set();
    for (let m = 0; m < 12; m++) seen.add(P.nudge({ watchedSeconds: m * 60, breaks: 0 }).headline);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe("unlockReady", () => {
  const base = { holdSeconds: 8, phrase: "" };

  it("refuses until the hold is complete", () => {
    expect(P.unlockReady({ ...base, held: 7.9 })).toBe(false);
    expect(P.unlockReady({ ...base, held: 8 })).toBe(true);
  });

  it("also requires the phrase when one is configured", () => {
    const cfg = { ...base, phrase: "let me out", held: 10 };
    expect(P.unlockReady({ ...cfg, typed: "" })).toBe(false);
    expect(P.unlockReady({ ...cfg, typed: "let me ou" })).toBe(false);
    expect(P.unlockReady({ ...cfg, typed: "let me out" })).toBe(true);
  });

  it("tolerates stray whitespace around a correct phrase", () => {
    expect(P.unlockReady({ ...base, phrase: "out", held: 10, typed: "  out " })).toBe(true);
  });

  it("does not let a correct phrase skip the hold", () => {
    // Typing is fast. The hold is the part that actually costs you something.
    expect(P.unlockReady({ ...base, phrase: "out", held: 2, typed: "out" })).toBe(false);
  });
});

describe("keyboard lock expectations", () => {
  // The mechanism lives in lock.js against real browser APIs and cannot be unit
  // tested here. What can be pinned is the contract the UI copy depends on: the
  // ritual must be long enough that the browser's own 2s Escape hold is never
  // the cheaper way out, or people will just use that every time.
  it("the hold is longer than the browser's 2s force-exit", () => {
    expect(P.DEFAULTS.holdSeconds).toBeGreaterThan(2);
  });
});

describe("defaults", () => {
  it("ships disarmed, so installing it never traps a tab", () => {
    expect(P.DEFAULTS.armed).toBe(false);
  });

  it("has a hold long enough to outlast a reflex", () => {
    expect(P.DEFAULTS.holdSeconds).toBeGreaterThanOrEqual(5);
  });
});

describe("isArmingChange", () => {
  // Regression: raising the wall writes a breaks counter, which fired the
  // storage listener, which saw "armed and windowed" and tore the wall down a
  // frame after it went up. The wall was destroyed by its own side effect.
  it("ignores the breaks counter the wall itself writes", () => {
    expect(P.isArmingChange({ breaks: { newValue: 3 } }, true)).toBe(false);
  });

  it("ignores the pinned tab id moving", () => {
    expect(P.isArmingChange({ lockedTabId: { newValue: 42 } }, true)).toBe(false);
  });

  it("reacts when arming", () => {
    expect(P.isArmingChange({ armed: { newValue: true } }, false)).toBe(true);
  });

  it("reacts when disarming", () => {
    expect(P.isArmingChange({ armed: { newValue: false } }, true)).toBe(true);
  });

  it("ignores a rewrite of armed to the value it already had", () => {
    expect(P.isArmingChange({ armed: { newValue: true } }, true)).toBe(false);
  });

  it("ignores an armed key bundled with others when nothing flipped", () => {
    // arm() writes armed, lockedTabId and breaks in one call.
    expect(
      P.isArmingChange(
        { armed: { newValue: true }, lockedTabId: { newValue: 7 }, breaks: { newValue: 0 } },
        true
      )
    ).toBe(false);
  });

  it("survives an empty or missing change set", () => {
    expect(P.isArmingChange({}, true)).toBe(false);
    expect(P.isArmingChange(undefined, true)).toBe(false);
  });
});

describe("canDisarmFromPopup", () => {
  // The bypass this closes: the wall appears, and two clicks in the toolbar
  // popup dismiss it, making the eight second hold theatre.
  it("refuses once the lock has engaged", () => {
    expect(P.canDisarmFromPopup({ armed: true, engaged: true })).toBe(false);
  });

  it("allows it before full screen was ever entered", () => {
    // Arming and immediately changing your mind is not an escape attempt, and
    // the popup is the only way back at that point.
    expect(P.canDisarmFromPopup({ armed: true, engaged: false })).toBe(true);
  });

  it("allows it when nothing is armed", () => {
    expect(P.canDisarmFromPopup({ armed: false, engaged: false })).toBe(true);
    expect(P.canDisarmFromPopup({ armed: false, engaged: true })).toBe(true);
  });

  it("defaults to allowing rather than trapping on missing state", () => {
    // A missing flag must never be the thing that locks someone out.
    expect(P.canDisarmFromPopup({})).toBe(true);
    expect(P.canDisarmFromPopup()).toBe(true);
  });
});

describe("engaged default", () => {
  it("ships false, so a fresh install is never already locked", () => {
    expect(P.DEFAULTS.engaged).toBe(false);
  });
});

describe("shouldRaiseWallOnLoad", () => {
  // Regression: Cmd-R was a one-key bypass. Reloading drops full screen and
  // builds a brand new content script, so a locally-held "engaged" flag was
  // forgotten and the page came back completely unlocked.
  it("raises the wall when an engaged lock comes back without full screen", () => {
    expect(P.shouldRaiseWallOnLoad({ armed: true, engaged: true, inFullscreen: false })).toBe(true);
  });

  it("stays quiet when the page loads already in full screen", () => {
    expect(P.shouldRaiseWallOnLoad({ armed: true, engaged: true, inFullscreen: true })).toBe(false);
  });

  it("stays quiet for an armed lock that never engaged", () => {
    // Armed from the popup and then reloaded before ever going full screen is
    // not an escape attempt.
    expect(P.shouldRaiseWallOnLoad({ armed: true, engaged: false, inFullscreen: false })).toBe(false);
  });

  it("stays quiet when nothing is armed", () => {
    expect(P.shouldRaiseWallOnLoad({ armed: false, engaged: true, inFullscreen: false })).toBe(false);
  });

  it("defaults to quiet on missing state rather than walling a stranger", () => {
    expect(P.shouldRaiseWallOnLoad({})).toBe(false);
    expect(P.shouldRaiseWallOnLoad()).toBe(false);
  });
});

describe("the wall and full screen are one lock, not lock and aftermath", () => {
  // Most bypasses so far came from gating a guard on being in full screen. The
  // wall is shown precisely when full screen is gone, so that condition
  // disabled every in-page guard at the exact moment the wall was on screen.
  // These pin the shape the guards must share rather than the DOM wiring.

  it("an engaged lock stays engaged after full screen ends", () => {
    // shouldRaiseWallOnLoad is the same predicate the load path uses, and it
    // must treat "engaged and windowed" as locked, never as finished.
    expect(P.shouldRaiseWallOnLoad({ armed: true, engaged: true, inFullscreen: false })).toBe(true);
  });

  it("the popup still refuses while the wall is up", () => {
    // Being out of full screen must not soften the disarm rule either.
    expect(P.canDisarmFromPopup({ armed: true, engaged: true })).toBe(false);
  });

  it("nothing is enforced before the lock ever engaged", () => {
    expect(P.shouldRaiseWallOnLoad({ armed: true, engaged: false, inFullscreen: false })).toBe(false);
    expect(P.canDisarmFromPopup({ armed: true, engaged: false })).toBe(true);
  });
});

describe("worker copy stays in step with the module", () => {
  // background.js deliberately inlines these instead of calling importScripts,
  // so that a load failure cannot stop chrome.tabs.onActivated being
  // registered. The cost of that choice is duplication, and this keeps it
  // honest. Comments are stripped first, since the file explains at length why
  // it avoids importScripts and matching that explanation is not a test.
  const fs = require("node:fs");
  const worker = fs.readFileSync(new URL("../src/background.js", import.meta.url), "utf8");
  const code = worker
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  it("does not reintroduce a load-time dependency before the listeners", () => {
    expect(code).not.toMatch(/importScripts\s*\(/);
  });

  it("registers the tab guard that the snap-back depends on", () => {
    expect(code).toMatch(/chrome\.tabs\.onActivated\.addListener/);
    expect(code).toMatch(/chrome\.tabs\.onRemoved\.addListener/);
    expect(code).toMatch(/chrome\.windows\.onFocusChanged\.addListener/);
  });

  it("inlines every default the module declares", () => {
    const block = code.match(/const WORKER_DEFAULTS = \{[\s\S]*?\}/)[0];
    for (const key of Object.keys(P.DEFAULTS)) {
      expect(block, `WORKER_DEFAULTS is missing ${key}`).toContain(key);
    }
  });

  it("its disarm rule agrees with the module's on every input", () => {
    const body = code.match(/function canDisarmFromPopup\([\s\S]*?\n\}/)[0];
    const workerFn = new Function(`${body}; return canDisarmFromPopup;`)();
    for (const armed of [true, false]) {
      for (const engaged of [true, false]) {
        expect(workerFn({ armed, engaged }), `armed=${armed} engaged=${engaged}`)
          .toBe(P.canDisarmFromPopup({ armed, engaged }));
      }
    }
  });
});

describe("resilience of the two calls that were actually failing", () => {
  const fs = require("node:fs");
  const worker = fs.readFileSync(new URL("../src/background.js", import.meta.url), "utf8");
  const content = fs.readFileSync(new URL("../src/lock.js", import.meta.url), "utf8");

  it("retries activating a tab instead of letting the rejection stand", () => {
    // "Tabs cannot be edited right now (user may be dragging a tab)" is thrown
    // by chrome.tabs.update during the transient state right after a tab is
    // clicked, which is exactly when the snap-back runs. A single call loses.
    expect(worker).toMatch(/async function activate\(/);
    expect(worker).toMatch(/for \(let i = 0; i < attempts; i\+\+\)/);
    expect(worker).not.toMatch(/await chrome\.tabs\.update\(target\.id/);
  });

  it("gives up rather than looping forever when a tab cannot be activated", () => {
    const body = worker.match(/async function activate\([\s\S]*?\n\}/)[0];
    expect(body).toMatch(/return false;/);
  });

  it("routes content-script chrome calls through the orphan guards", () => {
    // Reloading the extension orphans running content scripts; every chrome.*
    // call then throws "Extension context invalidated".
    expect(content).toMatch(/function alive\(\)/);
    expect(content).toMatch(/chrome\.runtime\?\.id/);
    // The only raw uses left are inside the guards themselves and the boot read.
    const raw = content.match(/chrome\.(storage\.local\.set|runtime\.sendMessage)\(/g) || [];
    expect(raw.length, "an unguarded chrome call crept back in").toBeLessThanOrEqual(2);
  });
});
