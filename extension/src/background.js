// No importScripts here, deliberately.
//
// A service worker registers its listeners by running top to bottom. If
// anything above a listener throws, that listener is never registered and the
// feature silently does not exist: no error surfaces on the page, the guard
// simply never fires. Depending on a second file to load before
// chrome.tabs.onActivated is registered puts the single most important guard in
// the extension behind an avoidable failure.
//
// So the three values the worker needs are inlined instead. They are small, and
// the copy is asserted against the real module by the test suite.

const WORKER_DEFAULTS = {
  armed: false,
  engaged: false,
  holdSeconds: 8,
  phrase: "",
  strict: false,
  breaks: 0,
};

/** Mirror of LatchPersuade.canDisarmFromPopup. Kept in step by a test. */
function canDisarmFromPopup({ armed = false, engaged = false } = {}) {
  if (!armed) return true;
  return !engaged;
}

// Tab switching is two separate problems and needs two separate answers.
//
//   Keyboard (Cmd-T, Cmd-W, Cmd-1..9, Ctrl-Tab) is handled in the page by
//   Keyboard Lock, which stops the browser acting on the shortcut at all.
//
//   The mouse is not. Nothing in a page can stop a click on the tab strip,
//   because the tab strip is browser chrome and no page can see it. That is
//   what this file is for: notice the switch and put you back.
//
// The service worker can be killed and restarted at any time, so every piece of
// state it needs lives in chrome.storage rather than in a variable.

const onYouTube = (url) => {
  try {
    return /(^|\.)youtube\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

const KEY = {
  armed: "armed",
  engaged: "engaged",
  tabId: "lockedTabId",
  url: "lockedUrl",
  breaks: "breaks",
};

async function get() {
  return chrome.storage.local.get({
    [KEY.armed]: false,
    [KEY.engaged]: false,
    [KEY.tabId]: null,
    [KEY.url]: null,
    [KEY.breaks]: 0,
  });
}

/** Arming pins the current tab. That pin is what "back" means later. */
async function arm(tabId) {
  // The URL is pinned too, so navigating the tab away from the lecture can be
  // undone. Without it, typing any address into the locked tab walks straight
  // out: the content script does not run off YouTube, so nothing would notice.
  let url = null;
  try {
    url = (await chrome.tabs.get(tabId)).url ?? null;
  } catch { /* tab vanished between the query and here */ }
  await chrome.storage.local.set({
    [KEY.armed]: true,
    [KEY.engaged]: false,
    [KEY.tabId]: tabId,
    [KEY.url]: url,
    [KEY.breaks]: 0,
  });
}

async function disarm() {
  await chrome.storage.local.set({
    [KEY.armed]: false,
    [KEY.engaged]: false,
    [KEY.tabId]: null,
    [KEY.url]: null,
  });
}

/**
 * Disarm requested from the popup or the keyboard shortcut, rather than from
 * the wall's hold. Refused once the lock has engaged.
 *
 * Enforced here and not only by greying the toggle, because the popup is a page
 * the user can open devtools on. A rule that lives only in the UI is a
 * suggestion.
 */
async function requestDisarm() {
  const s = await get();
  if (!canDisarmFromPopup({ armed: s[KEY.armed], engaged: s[KEY.engaged] })) {
    return false;
  }
  await disarm();
  return true;
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-lock") return;
  const s = await get();
  if (s[KEY.armed]) {
    // Same rule as the popup: the shortcut cannot undo an engaged lock either.
    await requestDisarm();
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) await arm(tab.id);
});

// The popup only knows it wants to arm; it does not know which tab. Resolving
// that here keeps one definition of "the locked tab".
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "arm") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id != null) await arm(tab.id);
      sendResponse({ ok: true });
      return;
    } else if (msg?.type === "disarm") {
      const ok = await requestDisarm();
      sendResponse({ ok, reason: ok ? null : "engaged" });
      return;
    } else if (msg?.type === "snapback") {
      // Sent by the page when it loses focus. Cheap, and independent of
      // tabs.onActivated ever firing.
      const s = await get();
      if (s[KEY.armed] && s[KEY.engaged]) await snapBack("page-blur");
      sendResponse({ ok: true });
      return;
    } else if (msg?.type === "release") {
      // The wall's completed hold. The one route allowed to end an engaged lock.
      await disarm();
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: true });
  })();
  return true; // keep the channel open for the async reply
});

/**
 * Activate a tab, retrying while Chrome refuses.
 *
 * chrome.tabs.update rejects with "Tabs cannot be edited right now (user may be
 * dragging a tab)" during the transient state right after a tab is clicked.
 * That is exactly when the snap-back runs, so the single call rejected, the
 * rejection was unhandled, and the switch stood. The guard was firing correctly
 * the whole time and losing at the last step.
 *
 * Backs off over roughly a second, which outlasts the drag state, and gives up
 * rather than looping: a snap-back that cannot land must not spin forever.
 */
async function activate(tabId, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    try {
      await chrome.tabs.update(tabId, { active: true });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 60 + i * 60));
    }
  }
  return false;
}

async function snapBack(reason) {
  const s = await get();
  if (!s[KEY.armed] || s[KEY.tabId] == null) return;

  // If the lecture tab is gone there is nothing to go back to, and holding the
  // lock would strand the user in a browser that keeps yanking them nowhere.
  let target;
  try {
    target = await chrome.tabs.get(s[KEY.tabId]);
  } catch {
    await disarm();
    return;
  }

  const activated = await activate(target.id);
  if (!activated) return; // could not put them back; do not count it as a catch
  if (target.windowId != null) {
    await chrome.windows.update(target.windowId, { focused: true }).catch(() => {});
  }
  // Feeds the wall's "that is 4 times" copy.
  await chrome.storage.local.set({ [KEY.breaks]: (s[KEY.breaks] || 0) + 1 });
  void reason;
}

chrome.tabs.onActivated.addListener(async (info) => {
  const s = await get();
  if (!s[KEY.armed] || s[KEY.tabId] == null) return;
  // Activating the locked tab is the desired state, not a violation. Without
  // this guard snapBack would re-trigger itself forever.
  if (info.tabId === s[KEY.tabId]) return;
  snapBack("activated");
});

chrome.tabs.onCreated.addListener(async (tab) => {
  const s = await get();
  if (!s[KEY.armed] || s[KEY.tabId] == null) return;

  // Close only a genuinely blank new tab, which by definition holds nothing to
  // lose. Anything opened with a real URL is left alone and merely deactivated:
  // closing a user's tab because they mistyped a shortcut would be its own bug.
  const blank = !tab.url || tab.url === "chrome://newtab/" || tab.url === "about:blank";
  if (blank && tab.id != null) {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
  snapBack("created");
});

// Losing the lecture tab is the one thing that must always disarm, otherwise
// every later tab switch snaps toward a tab that no longer exists.
chrome.tabs.onRemoved.addListener(async (tabId, info) => {
  const s = await get();
  if (!s[KEY.armed] || tabId !== s[KEY.tabId]) return;

  // Closing the whole window is not fought. Fighting it means fighting a quit,
  // and a lock that reopens windows during shutdown is a malfunction.
  if (info?.isWindowClosing) {
    await disarm();
    return;
  }

  // Before it engaged, closing the tab is just closing a tab.
  const back = s[KEY.url];
  if (!s[KEY.engaged] || !back || !onYouTube(back)) {
    await disarm();
    return;
  }

  // Cmd-W then Cmd-Shift-T used to be a two key bypass: closing the tab
  // disarmed the lock, and reopening it came back unlocked. Reopen it ourselves
  // and re-pin, so closing the lecture costs the same as any other exit.
  try {
    const tab = await chrome.tabs.create({ url: back, active: true });
    if (tab?.id != null) {
      await chrome.storage.local.set({
        [KEY.tabId]: tab.id,
        [KEY.breaks]: (s[KEY.breaks] || 0) + 1,
      });
      return;
    }
  } catch { /* fall through */ }
  // Could not reopen. Disarm rather than hold a lock pointing at nothing.
  await disarm();
});

// A new window is another way to land somewhere the lock is not looking.
chrome.windows.onCreated.addListener(async () => {
  const s = await get();
  if (s[KEY.armed] && s[KEY.engaged]) snapBack("window-created");
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return; // left the browser entirely
  const s = await get();
  if (!s[KEY.armed] || s[KEY.tabId] == null) return;
  try {
    const target = await chrome.tabs.get(s[KEY.tabId]);
    if (target.windowId !== windowId) snapBack("window");
  } catch {
    await disarm();
  }
});

/**
 * The locked tab leaving YouTube.
 *
 * Only acted on once the lock has engaged, and only when the destination is off
 * YouTube. Navigating between lectures, or to a different video, is ordinary
 * use and is left alone: this is for the address bar, not for browsing.
 */
chrome.tabs.onUpdated.addListener(async (tabId, change) => {
  if (!change.url) return;
  const s = await get();
  if (!s[KEY.armed] || !s[KEY.engaged]) return;
  if (tabId !== s[KEY.tabId]) return;
  if (onYouTube(change.url)) return;

  const back = s[KEY.url];
  if (!back || !onYouTube(back)) return; // nothing safe to return to
  await chrome.storage.local.set({ [KEY.breaks]: (s[KEY.breaks] || 0) + 1 });
  chrome.tabs.update(tabId, { url: back }).catch(() => {});
});

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(WORKER_DEFAULTS);
  // Never restore an armed state on install or update: a lock nobody chose is
  // indistinguishable from a broken browser.
  await chrome.storage.local.set({
    ...WORKER_DEFAULTS,
    ...current,
    [KEY.armed]: false,
    [KEY.engaged]: false,
    [KEY.tabId]: null,
    [KEY.url]: null,
  });
});

// Lets the popup prove the worker is alive and show the live state. Guessing at
// why a guard did not fire wasted two rounds; this makes it answerable in one
// screenshot.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "diagnostics") return;
  (async () => {
    const s = await get();
    let pinnedTabAlive = false;
    if (s[KEY.tabId] != null) {
      try { await chrome.tabs.get(s[KEY.tabId]); pinnedTabAlive = true; } catch { /* gone */ }
    }
    sendResponse({
      workerAlive: true,
      armed: s[KEY.armed],
      engaged: s[KEY.engaged],
      pinnedTab: s[KEY.tabId],
      pinnedTabAlive,
      hasTabsPermission: typeof chrome.tabs?.onActivated?.addListener === "function",
      breaks: s[KEY.breaks],
    });
  })();
  return true;
});
