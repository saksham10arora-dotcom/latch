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

it("the worker's inlined host list matches the module's", () => {
    // background.js cannot importScripts, so it carries its own copy. If the
    // two drift, a site locks in the page but the tab guard ignores it.
    const list = code.match(/const SUPPORTED_HOSTS = \[([\s\S]*?)\]/)[1];
    const workerHosts = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(workerHosts).toEqual(Object.keys(P.SITES).sort());
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

describe("only one thing may end a session", () => {
  const fs = require("node:fs");
  const worker = fs.readFileSync(new URL("../src/background.js", import.meta.url), "utf8");
  const code = worker
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

  // Cmd-W closed the tab, the reopen began, and for a moment the pinned id
  // pointed at the tab that had just closed. snapBack saw a missing tab and
  // disarmed, so the tab came back with the lock off and Cmd-W stayed a bypass.
  it("snapBack never disarms", () => {
    const body = code.match(/async function snapBack\([\s\S]*?\n\}/)[0];
    expect(body).not.toMatch(/disarm\(\)/);
  });

  it("the window focus handler never disarms either", () => {
    const body = code.match(/chrome\.windows\.onFocusChanged\.addListener\([\s\S]*?\n\}\);/)[0];
    expect(body).not.toMatch(/disarm\(\)/);
  });

  it("reopening after a close is flagged so it is not read as an escape", () => {
    expect(code).toMatch(/let reopening = false;/);
    const created = code.match(/chrome\.tabs\.onCreated\.addListener\([\s\S]*?\n\}\);/)[0];
    expect(created).toMatch(/if \(reopening\) return;/);
  });

  it("re-pins the replacement tab before clearing the flag", () => {
    const removed = code.match(/chrome\.tabs\.onRemoved\.addListener\([\s\S]*?\n\}\);/)[0];
    const setIdx = removed.indexOf("chrome.storage.local.set");
    const clearIdx = removed.indexOf("reopening = false");
    expect(setIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeGreaterThan(setIdx);
  });
});

describe("site adapters", () => {
  it("resolves the big platforms, and www or subdomains of them", () => {
    expect(P.siteKey("www.youtube.com")).toBe("youtube.com");
    expect(P.siteKey("m.youtube.com")).toBe("youtube.com");
    expect(P.siteKey("www.udemy.com")).toBe("udemy.com");
    expect(P.siteKey("www.coursera.org")).toBe("coursera.org");
    expect(P.siteKey("courses.edx.org")).toBe("edx.org");
    expect(P.siteKey("onlinecourses.nptel.ac.in")).toBe("nptel.ac.in");
  });

  it("does not match a lookalike host", () => {
    // The classic suffix bug: notyoutube.com must not resolve to youtube.com.
    expect(P.siteKey("notyoutube.com")).toBeNull();
    expect(P.siteKey("youtube.com.evil.test")).toBeNull();
    expect(P.siteKey("example.com")).toBeNull();
  });

  it("always returns a usable adapter, even for an unknown host", () => {
    // This is what makes "etc" work: an unlisted platform still locks, using
    // accessibility labels rather than a class name nobody has looked up.
    const s = P.siteFor("some-course-site.test");
    expect(s.video).toBe("video");
    expect(s.fullscreenButtons).toContain("aria-label");
    expect(s.title).toBeTruthy();
    expect(s.key).toBeNull();
  });

  it("lets a named site override only what it needs", () => {
    const yt = P.siteFor("www.youtube.com");
    expect(yt.player).toBe("#movie_player");
    expect(yt.key).toBe("youtube.com");
    // nptel names no overrides at all, so it should be pure defaults
    const nptel = P.siteFor("nptel.ac.in");
    expect(nptel.video).toBe(P.DEFAULT_SITE.video);
    expect(nptel.fullscreenButtons).toBe(P.DEFAULT_SITE.fullscreenButtons);
    expect(nptel.key).toBe("nptel.ac.in");
  });

  it("every site entry only uses keys the default defines", () => {
    // A typo like `fullScreenButtons` would silently do nothing.
    const allowed = new Set(Object.keys(P.DEFAULT_SITE));
    for (const [host, cfg] of Object.entries(P.SITES)) {
      for (const k of Object.keys(cfg)) {
        expect(allowed.has(k), `${host} has unknown key "${k}"`).toBe(true);
      }
    }
  });

  it("every selector is structurally well formed", () => {
    // No DOM in this suite, so this checks the shapes a malformed selector
    // takes: unbalanced brackets or quotes, a stray comma, an empty string.
    // lock.js additionally wraps every use so a bad one cannot throw.
    const all = [P.DEFAULT_SITE, ...Object.values(P.SITES)];
    for (const cfg of all) {
      for (const [k, sel] of Object.entries(cfg)) {
        if (sel === null) continue;
        expect(typeof sel, k).toBe("string");
        expect(sel.trim().length, k).toBeGreaterThan(0);
        const count = (c) => [...sel].filter((x) => x === c).length;
        expect(count("["), `${k}: ${sel}`).toBe(count("]"));
        expect(count("("), `${k}: ${sel}`).toBe(count(")"));
        expect(count('"') % 2, `${k}: ${sel}`).toBe(0);
        expect(sel.split(",").every((p) => p.trim().length > 0), `${k}: ${sel}`).toBe(true);
      }
    }
  });

  it("lock.js cannot be thrown by a bad selector", () => {
    const fs = require("node:fs");
    const lock = fs.readFileSync(new URL("../src/lock.js", import.meta.url), "utf8");
    expect(lock).toMatch(/function q\(selector, root\)/);
    expect(lock).toMatch(/function closestSafe\(el, selector\)/);
    // no raw querySelector on a site-table selector
    expect(lock).not.toMatch(/document\.querySelector\(site\./);
    expect(lock).not.toMatch(/closest\?\.\(site\./);
  });

  it("isSupportedHost gates on the same table", () => {
    expect(P.isSupportedHost("https://www.udemy.com/course/x/learn/lecture/1")).toBe(true);
    expect(P.isSupportedHost("https://reddit.com/r/all")).toBe(false);
    expect(P.isSupportedHost("not a url")).toBe(false);
  });
});

describe("the host list lives in three places and must not drift", () => {
  const fs = require("node:fs");
  const manifest = JSON.parse(
    fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );

  const hostsFromPattern = (p) => p.replace(/^\*:\/\/\*\./, "").split("/")[0];

  // file:///* is a protocol, not a course platform, so it has no row in SITES
  // and is exempted from the host comparisons below rather than being allowed
  // to quietly widen them.
  const FILE_MATCH = "file:///*";
  const siteMatches = (list) => list.filter((p) => p !== FILE_MATCH);

  it("asks for local files in both places", () => {
    // A PDF on disk is the common reading case. If this were in host_permissions
    // but not in matches the content script would never run on it, which is the
    // failure that looks exactly like the lock being broken.
    expect(manifest.host_permissions).toContain(FILE_MATCH);
    expect(manifest.content_scripts[0].matches).toContain(FILE_MATCH);
  });

  it("does not ask for every site on the web", () => {
    // Reading arbitrary web PDFs would need <all_urls>, which is the single
    // largest permission a Chrome extension can request. Latch deliberately
    // does not, so this guards against it creeping in.
    const all = [...manifest.host_permissions, ...manifest.content_scripts[0].matches];
    expect(all).not.toContain("<all_urls>");
    expect(all).not.toContain("*://*/*");
  });

  it("manifest matches cover exactly the sites the module knows", () => {
    // A host in the table but not the manifest means the content script never
    // runs there. A host in the manifest but not the table means the extension
    // asks for a permission it never uses, which a store review will ask about.
    const fromManifest = [...new Set(
      siteMatches(manifest.content_scripts[0].matches).map(hostsFromPattern)
    )].sort();
    expect(fromManifest).toEqual(Object.keys(P.SITES).sort());
  });

  it("host_permissions and content script matches agree", () => {
    expect([...manifest.host_permissions].sort())
      .toEqual([...manifest.content_scripts[0].matches].sort());
  });

  it("scopes the broad domains to their learning section", () => {
    // linkedin.com and oreilly.com are general sites. Requesting all of either
    // would be a much larger ask than the extension needs.
    const byHost = Object.fromEntries(
      siteMatches(manifest.content_scripts[0].matches).map((p) => [hostsFromPattern(p), p])
    );
    expect(byHost["linkedin.com"]).toBe("*://*.linkedin.com/learning/*");
    expect(byHost["oreilly.com"]).toBe("*://*.oreilly.com/library/*");
  });

  it("has no duplicate hosts", () => {
    const keys = Object.keys(P.SITES);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("document tabs", () => {
  it("recognises the PDF viewer by content type", () => {
    // Chrome renders a PDF as a real document whose contentType is the PDF
    // type, not text/html. That single fact is the whole detection: there is no
    // <embed> to look for, because the viewer lives in a frame this extension
    // is not allowed to see into.
    expect(P.isDocumentTab("application/pdf")).toBe(true);
    expect(P.isDocumentTab("application/pdf; charset=binary")).toBe(true);
    expect(P.isDocumentTab("APPLICATION/PDF")).toBe(true);
    expect(P.isDocumentTab("text/html")).toBe(false);
    expect(P.isDocumentTab("")).toBe(false);
    expect(P.isDocumentTab(undefined)).toBe(false);
  });

  it("asks for a full screen gesture when the page has no player to use", () => {
    // Every video platform already gives you a way into full screen, so Latch
    // just waits for it. A PDF gives you none: no player, no f shortcut, no
    // full screen button. Without something to click, an armed lock on a PDF
    // could never engage at all.
    expect(P.needsManualFullscreen({ hasVideo: false })).toBe(true);
    expect(P.needsManualFullscreen({ hasVideo: true })).toBe(false);
  });

  it("defers to the player on anything that has one", () => {
    // The site's own full screen button is always the better route: it puts the
    // player wrapper in full screen, keeping its controls, which a bare
    // documentElement request would lose.
    expect(P.needsManualFullscreen({ hasVideo: true })).toBe(false);
  });

  it("names the document without its file extension", () => {
    expect(P.readingTitle("lecture-07-spectral.pdf")).toBe("lecture-07-spectral");
    expect(P.readingTitle("18.06 Linear Algebra.PDF")).toBe("18.06 Linear Algebra");
    expect(P.readingTitle("notes")).toBe("notes");
    expect(P.readingTitle("")).toBe("");
  });

  it("treats local files as lockable", () => {
    // The dominant PDF case is a lecture handout already on disk. If the worker
    // did not count file:// as supported it would refuse to guard the tab, and
    // the wall would go up with tab switching left wide open.
    expect(P.isSupportedHost("file:///Users/x/lectures/week3.pdf")).toBe(true);
  });

  it("still refuses hosts that are not course platforms", () => {
    expect(P.isSupportedHost("https://reddit.com/r/all")).toBe(false);
  });
});
