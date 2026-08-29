/* global LatchPersuade */
const D = LatchPersuade.DEFAULTS;
const $ = (id) => document.getElementById(id);

chrome.storage.local.get(D, (s) => {
  $("armed").checked = s.armed;
  $("holdSeconds").value = s.holdSeconds;
  $("phrase").value = s.phrase;
  $("strict").checked = s.strict;
  status(s.armed);
});

function status(armed) {
  $("status").textContent = armed
    ? "Armed. Leaving full screen raises the wall."
    : "Off. Go full screen, then arm it.";
}

// Arming resets the counter so the "that is 4 times" copy is about this
// lecture, not a tally carried over from yesterday.
$("armed").addEventListener("change", (e) => {
  chrome.storage.local.set({ armed: e.target.checked, breaks: 0 });
  status(e.target.checked);
});
$("holdSeconds").addEventListener("change", (e) =>
  chrome.storage.local.set({ holdSeconds: Math.max(3, Math.min(60, +e.target.value || D.holdSeconds)) })
);
$("phrase").addEventListener("change", (e) => chrome.storage.local.set({ phrase: e.target.value }));
$("strict").addEventListener("change", (e) => chrome.storage.local.set({ strict: e.target.checked }));
