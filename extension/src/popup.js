/* global LatchPersuade */
const D = LatchPersuade.DEFAULTS;
const $ = (id) => document.getElementById(id);

function applyLockState(s) {
  // Greying the toggle is the visible half; the worker refuses the message
  // regardless, so this is a courtesy rather than the enforcement.
  const locked = !LatchPersuade.canDisarmFromPopup(s);
  $("armed").disabled = locked;
  $("lockedNote").hidden = !locked;
}

chrome.storage.local.get(D, (s) => {
  $("armed").checked = s.armed;
  applyLockState(s);
  $("holdSeconds").value = s.holdSeconds;
  $("phrase").value = s.phrase;
  $("strict").checked = s.strict;
  status(s.armed);
});

function status(armed) {
  $("status").textContent = armed
    ? "Armed. Escape and tab switching are off."
    : "Off. Go full screen, then arm it.";
}

// Arming resets the counter so the "that is 4 times" copy is about this
// lecture, not a tally carried over from yesterday.
// Routed through the worker so arming pins the current tab, which is what the
// snap-back later treats as "back".
$("armed").addEventListener("change", (e) => {
  const want = e.target.checked;
  chrome.runtime.sendMessage({ type: want ? "arm" : "disarm" }, (res) => {
    // Refused because the lock has engaged: put the switch back rather than
    // leaving the UI claiming something that did not happen.
    if (res && res.ok === false) {
      e.target.checked = true;
      chrome.storage.local.get(D, applyLockState);
      return;
    }
    status(want);
  });
});
$("holdSeconds").addEventListener("change", (e) =>
  chrome.storage.local.set({ holdSeconds: Math.max(3, Math.min(60, +e.target.value || D.holdSeconds)) })
);
$("phrase").addEventListener("change", (e) => chrome.storage.local.set({ phrase: e.target.value }));
$("strict").addEventListener("change", (e) => chrome.storage.local.set({ strict: e.target.checked }));

// The popup can be open while the page engages the lock.
chrome.storage.onChanged.addListener(() => chrome.storage.local.get(D, (s) => {
  $("armed").checked = s.armed;
  applyLockState(s);
  status(s.armed);
}));


/**
 * Show the shortcut Chrome has actually bound, not the one the manifest asked
 * for. Chrome drops a contested suggested_key silently, so a hardcoded label
 * both drifts when the manifest changes and lies when the binding was refused.
 * Reading it back makes the popup incapable of being wrong about it.
 */
chrome.commands.getAll((commands) => {
  const tip = $("shortcutTip");
  const cmd = (commands || []).find((c) => c.name === "toggle-lock");
  if (cmd && cmd.shortcut) {
    tip.textContent = `${cmd.shortcut} arms and disarms without opening this.`;
    tip.classList.remove("warn");
  } else {
    tip.textContent =
      "No shortcut is bound. Another extension probably claimed it. Set one at chrome://extensions/shortcuts";
    tip.classList.add("warn");
  }
});


// Ask the worker to describe itself. If this comes back empty the worker is not
// running at all, which is the difference between "the guard has a bug" and
// "the guard was never registered".
chrome.runtime.sendMessage({ type: "diagnostics" }, (d) => {
  const el = $("diag");
  if (chrome.runtime.lastError || !d) {
    el.textContent =
      "service worker did NOT respond.\n" +
      "Tab guards cannot run. Open chrome://extensions, click\n" +
      "'service worker' under Lecture Lock and read the error.";
    return;
  }
  el.textContent = [
    `worker alive     ${d.workerAlive}`,
    `armed            ${d.armed}`,
    `engaged          ${d.engaged}`,
    `pinned tab       ${d.pinnedTab ?? "none"}${d.pinnedTab != null && !d.pinnedTabAlive ? "  (GONE)" : ""}`,
    `tabs permission  ${d.hasTabsPermission}`,
    `times caught     ${d.breaks}`,
  ].join("\n");
});
