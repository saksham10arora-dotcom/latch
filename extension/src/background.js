importScripts("persuade.js");
/* global LatchPersuade */

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

const KEY = { armed: "armed", tabId: "lockedTabId", breaks: "breaks" };

async function get() {
  return chrome.storage.local.get({
    [KEY.armed]: false,
    [KEY.tabId]: null,
    [KEY.breaks]: 0,
  });
}

/** Arming pins the current tab. That pin is what "back" means later. */
async function arm(tabId) {
  await chrome.storage.local.set({ [KEY.armed]: true, [KEY.tabId]: tabId, [KEY.breaks]: 0 });
}

async function disarm() {
  await chrome.storage.local.set({ [KEY.armed]: false, [KEY.tabId]: null });
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-lock") return;
  const s = await get();
  if (s[KEY.armed]) return disarm();
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
    } else if (msg?.type === "disarm") {
      await disarm();
    }
    sendResponse({ ok: true });
  })();
  return true; // keep the channel open for the async reply
});

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

  await chrome.tabs.update(target.id, { active: true });
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
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const s = await get();
  if (s[KEY.armed] && tabId === s[KEY.tabId]) await disarm();
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

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(LatchPersuade.DEFAULTS);
  // Never restore an armed state on install or update: a lock nobody chose is
  // indistinguishable from a broken browser.
  await chrome.storage.local.set({
    ...LatchPersuade.DEFAULTS,
    ...current,
    [KEY.armed]: false,
    [KEY.tabId]: null,
  });
});
