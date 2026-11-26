// Injected into the OpenCode web UI.
// Served from /__omo/app.js, prefixed by omo with `const OMO_VERSION="..."`.

// A document load already pulls this file fresh, so the only way to end up
// running an old payload is to never reload at all: the app was merely resumed
// from memory. Re-check when the app comes back to the foreground and reload
// once if the server has moved on.
document.addEventListener("visibilitychange", async () => {
  // Only when the tab actually became visible; hidden is not worth a request.
  if (document.visibilityState !== "visible") return;

  // At most one reload per session, so a check that never converges (omo
  // restarting mid-reload, a stale proxy in front) cannot reload forever.
  if (sessionStorage.getItem("omo-reloaded")) return;

  const res = await fetch("/__omo/version", { cache: "no-store" }).catch(() => null);

  // omo unreachable: leave the app alone, it works fine with the payload it has.
  if (!res?.ok) return;
  if ((await res.text()).trim() === OMO_VERSION) return;

  sessionStorage.setItem("omo-reloaded", "1");

  location.reload();
});

// ---------------------------------------------------------------------------
// Collapsible composer (touch devices)
// ---------------------------------------------------------------------------

// On a phone the composer takes a big slice of the screen and stays open while
// you read. OpenCode moves the composer's actions into a "touch bar" docked at
// the bottom edge, but only for coarse pointers (`(hover: none) and (pointer:
// coarse)`), so the bar's presence is our phone test: no bar, no folding, and a
// narrow desktop window is left alone.
//
// Folded, we hide the session composer form and the bar's own buttons, and our
// button fills the bar as a compact prompt. Tapping it brings the form back.
// The state lives on <html> so the CSS can switch both looks from one attribute.

const STATE_ATTRIBUTE = "data-omo-composer";
const TOGGLE_ATTRIBUTE = "data-omo-toggle";

// OpenCode's own hooks. The form is the only thing we hide: its wrapper also
// holds the permission and question docks, which must stay on screen.
const TOUCH_BAR = '[data-slot="composer-touch-bar"]';
const SESSION_DOCK = '[data-component="session-composer-dock"]';
const COMPOSER = 'form[data-component="composer"]';
const COMPOSER_FORM = `[data-slot="composer-face"] ${COMPOSER}`;
const EDITOR = '[data-component="composer-editor"]';

// Memory only: a page load starts folded, and so does a newly mounted composer.
let expanded = false;

// The live OpenCode elements, cached between passes of the observer below.
let bar;
let dock;
let form;

// The one node we add to the bar. Both faces live in the CSS: a full-width
// "open the composer" pill when folded, a small chevron when it is open. The
// icons come from OpenCode's sprite, so the button matches the bar's own.
const toggle = document.createElement("button");

toggle.type = "button";
toggle.setAttribute(TOGGLE_ATTRIBUTE, "");
toggle.innerHTML = `
  <span data-omo-face="composer">Ask anything…</span>
  <svg data-omo-face="composer" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><use href="#opencode-v2-icon-chevron-up"></use></svg>
  <svg data-omo-face="collapse" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><use href="#opencode-v2-icon-chevron-down"></use></svg>
`;

// Write the state only when it changed: the observer below runs on every DOM
// batch, and rewriting the same value would invalidate styles for nothing.
// No bar or no dock means folding does not apply here (a desktop never has a
// bar, the landing screen never has a dock), so the attribute is cleared.
function apply() {
  const root = document.documentElement;
  const applies = !!bar?.isConnected && !!dock?.isConnected;
  const value = expanded ? "open" : "collapsed";
  const label = expanded ? "Collapse composer" : "Open composer";

  if (!applies) {
    if (root.hasAttribute(STATE_ATTRIBUTE)) root.removeAttribute(STATE_ATTRIBUTE);
    return;
  }

  if (root.getAttribute(STATE_ATTRIBUTE) !== value) root.setAttribute(STATE_ATTRIBUTE, value);
  if (toggle.getAttribute("aria-label") !== label) toggle.setAttribute("aria-label", label);
}

// Fold or unfold. Folding hides the editor, so its focus goes first or the
// phone keyboard would stay open over an empty bar. Unfolding focuses the
// editor once the form is visible again, which is what brings that keyboard up.
function setExpanded(next) {
  expanded = next;

  if (!next) document.querySelector(EDITOR)?.blur();

  apply();

  if (next) requestAnimationFrame(() => document.querySelector(EDITOR)?.focus());
}

// True when the editor currently holds nothing the user typed (or mentioned).
// Attachments alone do not count, so a draft holding only an image folds once
// you look away; mention chips do, because they carry text.
function editorIsEmpty() {
  const text = document.querySelector(EDITOR)?.textContent ?? "";

  return text.trim() === "";
}

// An empty composer has nothing to come back to, so fold it. Guarded by the
// session dock: the landing screen's centered composer is none of our business.
function foldIfEmpty() {
  if (!document.querySelector(SESSION_DOCK)) return;
  if (!editorIsEmpty()) return;

  setExpanded(false);
}

// Fold and unfold on tap. preventDefault keeps focus where it is until our own
// focus handling runs, the same trick OpenCode's bar buttons use.
toggle.addEventListener("mousedown", (event) => event.preventDefault());
toggle.addEventListener("click", () => setExpanded(!expanded));

// A send ends the turn of typing: fold back down so the reply gets the screen.
// Deferred a task, because the app clears the editor inside its own click handler.
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('[data-action="composer-submit"]')) return;

  setTimeout(foldIfEmpty, 0);
});

// Leaving an empty composer folds it too. The check runs a task later because
// focus may be moving to another control inside the composer, which is not the
// same as being done with it.
document.addEventListener("focusout", (event) => {
  if (!(event.target instanceof Element) || !event.target.matches(EDITOR)) return;

  setTimeout(() => {
    if (!expanded) return;

    const active = document.activeElement;
    if (active && (active.closest(SESSION_DOCK) || active.closest(TOUCH_BAR))) return;

    foldIfEmpty();
  }, 0);
});

// The bar and the composer mount long after this payload runs, and they are
// torn down and rebuilt on navigation, so we look for them on changes instead
// of polling. Cached nodes keep the common pass down to a few property reads.
function reconcile() {
  if (!bar?.isConnected) bar = document.querySelector(TOUCH_BAR);

  // No bar: a desktop, or OpenCode unmounted the composer (a permission prompt
  // takes its place). Leave the state alone, so a remount comes back folded.
  if (!bar) return;

  if (!dock?.isConnected) dock = document.querySelector(SESSION_DOCK);

  // The landing screen has a composer and a bar of its own, but no session
  // dock. It is the only thing on that page, so it keeps its size.
  if (!dock) {
    expanded = false;
    toggle.remove();
    document.documentElement.removeAttribute(STATE_ATTRIBUTE);
    return;
  }

  // A different form means a different session, or a fresh mount of the same
  // one: start folded rather than carrying the last state over.
  if (!form?.isConnected) {
    form = dock.querySelector(COMPOSER_FORM);
    expanded = false;
  }

  // OpenCode re-portals the bar on navigation, taking our button with it.
  if (toggle.parentElement !== bar) bar.append(toggle);

  apply();
}

// Only a few changes matter: the bar arriving or leaving, the dock mounting or
// unmounting, and the form being replaced. Every streamed token is ignored, so
// the timeline can mutate as much as it likes without costing us a scan.
const MIGHT_MATTER = `${TOUCH_BAR}, ${SESSION_DOCK}, ${COMPOSER}`;

function mightMatter(records) {
  return records.some((record) =>
    [...record.addedNodes, ...record.removedNodes].some(
      (node) => node instanceof Element && (node.matches(MIGHT_MATTER) || node.querySelector(MIGHT_MATTER)),
    ),
  );
}

// documentElement, not body: this script may run while <head> is still parsing.
new MutationObserver((records) => {
  if (mightMatter(records)) reconcile();
}).observe(document.documentElement, { childList: true, subtree: true });

reconcile();
