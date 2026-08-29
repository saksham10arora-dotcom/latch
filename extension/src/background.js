importScripts("persuade.js");
/* global LatchPersuade */

// The keyboard shortcut is the main way to arm this. Reaching for the popup
// mid-lecture means leaving full screen, which is the thing being prevented.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-lock") return;
  const { armed } = await chrome.storage.local.get({ armed: false });
  await chrome.storage.local.set({ armed: !armed, breaks: 0 });
});

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(LatchPersuade.DEFAULTS);
  await chrome.storage.local.set({ ...LatchPersuade.DEFAULTS, ...current, armed: false });
});
