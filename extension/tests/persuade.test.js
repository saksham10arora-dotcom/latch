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
