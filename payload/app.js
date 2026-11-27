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
// Folded, we hide the session composer form and OpenCode's whole touch bar, and
// our own bar (the omo bar) takes the bottom edge with one prompt button that
// opens the composer again. Open, our bar is gone and theirs is back untouched.
// The two bars take turns. The state lives on <html> so the CSS can switch both
// looks from one attribute.

const STATE_ATTRIBUTE = "data-omo-composer";

// Our own bar and the toggle that lives in it. They take turns with OpenCode's
// touch bar: folded, ours is on screen and theirs is hidden; open, the reverse.
// The bar and the button each get an attribute so CSS from either state can
// find them by a plain selector instead of a class we would have to keep in sync.
const BAR_ATTRIBUTE = "data-omo-bar";
const TOGGLE_ATTRIBUTE = "data-omo-composer-toggle";

// OpenCode's own hooks. The form is the only thing we hide: its wrapper also
// holds the permission and question docks, which must stay on screen.
const TOUCH_BAR = '[data-slot="composer-touch-bar"]';
const OMO_BAR = `[${BAR_ATTRIBUTE}]`;
const SESSION_DOCK = '[data-component="session-composer-dock"]';
const COMPOSER = 'form[data-component="composer"]';
const COMPOSER_FORM = `[data-slot="composer-face"] ${COMPOSER}`;
const EDITOR = '[data-component="composer-editor"]';

// The session header's title row; it holds the second switch copy on wide
// screens, whether or not a touch bar is present.
const HEADER_TITLE = ".session-header-title";

// Memory only: a page load starts folded, and so does a newly mounted composer.
let expanded = false;

// The live OpenCode elements, cached between passes of the observer below.
let bar;
let dock;
let form;

// Our bar. It sits directly beside OpenCode's touch bar and holds our quick
// actions: the color scheme switch leads it, and the composer toggle closes it. It
// starts empty and stays hidden by CSS until folding applies, so the app never
// sees an empty strip on a desktop or the landing screen.
const omoBar = document.createElement("div");

omoBar.setAttribute(BAR_ATTRIBUTE, "");

// The one button we add. Both faces live in the CSS: a regular-size "Toggle
// composer" prompt with a chevron-up when folded, a small chevron-down when it
// is open. One node, two homes — reconcile/apply move it between our bar and
// theirs, so moving it keeps its listeners and its identity.
const omoComposerToggle = document.createElement("button");

omoComposerToggle.type = "button";
omoComposerToggle.setAttribute(TOGGLE_ATTRIBUTE, "");

// The chevron-up is drawn inline, not taken from OpenCode's sprite: their sprite
// has chevron-down/left/right but no "up", so referencing a chevron-up symbol
// would silently render nothing. The path below is the same artwork as their
// chevron-down, minus the 180° rotation that makes it point down.
omoComposerToggle.innerHTML = `
  <span data-omo-face="composer">Toggle composer</span>
  <svg data-omo-face="composer" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 9.5L8 6.5L11.5 9.5" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/></svg>
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

  // One button, two homes. Folded it lives in our bar as the prompt; open it
  // returns to OpenCode's bar as the small chevron. Appending a connected node
  // moves it, listeners intact, so this is cheaper and safer than cloning.
  const home = expanded ? bar : omoBar;

  if (omoComposerToggle.parentElement !== home) home.append(omoComposerToggle);

  if (root.getAttribute(STATE_ATTRIBUTE) !== value) root.setAttribute(STATE_ATTRIBUTE, value);
  if (omoComposerToggle.getAttribute("aria-label") !== label) omoComposerToggle.setAttribute("aria-label", label);
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
omoComposerToggle.addEventListener("mousedown", (event) => event.preventDefault());
omoComposerToggle.addEventListener("click", () => setExpanded(!expanded));

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
    if (active && (active.closest(SESSION_DOCK) || active.closest(TOUCH_BAR) || active.closest(OMO_BAR))) return;

    foldIfEmpty();
  }, 0);
});

// ---------------------------------------------------------------------------
// Color scheme switch (light / dark / system)
// ---------------------------------------------------------------------------

// The app keeps the color scheme in localStorage and paints everything from it:
// the theme's CSS variables, `data-color-scheme` on <html>, the page background,
// and the browser chrome's theme-color. There is no server setting and no API,
// so writing this key and telling the running app is the whole feature.
const SCHEME_KEY = "opencode-color-scheme";

// The modes in the order the segments show. "system" is also what the app falls
// back to for a key it does not recognise, so our reading below matches its own.
const SCHEME_MODES = ["light", "dark", "system"];

const COLOR_SCHEME_ATTRIBUTE = "data-omo-color-scheme";
const COLOR_SCHEME_SEGMENT_ATTRIBUTE = "data-omo-color-scheme-segment";

// Drawings, not a sprite reference: OpenCode's icon catalog has no sun and no
// moon, and borrowing one of its symbols while drawing the others beside it
// shows at 16px. These are Tabler's 24-unit grid at stroke-width 1.5, which a
// 16px box scales to the 1px stroke OpenCode's own icons use (their paths set no
// width and inherit 1). Only the `<path>` children are kept.
const SCHEME_FACES = {
  light: `<path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>`,
  dark: `<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008"/>`,
  system: `<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/>`,
};

const SCHEME_LABELS = { light: "Light", dark: "Dark", system: "System" };

// One segment per mode, each asking for its own mode from a closure.
// preventDefault on mousedown keeps focus where it is, the same trick the
// composer toggle uses so a tap does not dismiss the phone keyboard.
function colorSchemeSegment(mode) {
  const segment = document.createElement("button");

  segment.type = "button";
  segment.setAttribute(COLOR_SCHEME_SEGMENT_ATTRIBUTE, mode);
  segment.setAttribute("aria-label", SCHEME_LABELS[mode]);
  segment.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SCHEME_FACES[mode]}</svg>`;

  segment.addEventListener("mousedown", (event) => event.preventDefault());
  segment.addEventListener("click", () => setScheme(mode));

  return segment;
}

// One switch group, built from scratch so two independent copies can exist: one
// leads the omo bar, one trails the session header's title row. Each copy carries
// its own buttons and listeners; only the stored preference is shared, through
// syncColorSchemeGroup below.
function createColorSchemeGroup() {
  const group = document.createElement("div");

  group.setAttribute(COLOR_SCHEME_ATTRIBUTE, "");
  group.append(...SCHEME_MODES.map(colorSchemeSegment));

  return group;
}

// Two homes, one group each. Both stay put on their own, so an absent bar or
// header simply hides its copy instead of needing the node moved around.
const barGroup = createColorSchemeGroup();
const headerGroup = createColorSchemeGroup();
const groups = [barGroup, headerGroup];

// The session header's title row, cached between reconcile passes like `bar`.
let header;

// The stored preference, read the way the app reads it: anything that is not
// light or dark means System, so the highlight always has a segment to sit on.
function readScheme() {
  const stored = localStorage.getItem(SCHEME_KEY);

  return stored === "light" || stored === "dark" ? stored : "system";
}

// Change the mode for the running app. The app follows `storage` events to keep
// other tabs in sync, but a browser never sends one to the tab that wrote the
// key, so we dispatch it ourselves. Its handler then repaints the theme tokens
// and <html data-color-scheme>: no reload, and the key persists for next time.
function setScheme(scheme) {
  if (readScheme() === scheme) return;

  localStorage.setItem(SCHEME_KEY, scheme);

  window.dispatchEvent(new StorageEvent("storage", { key: SCHEME_KEY, newValue: scheme }));

  syncColorSchemeGroup();
}

// Paint every copy's segments from the one stored preference. `aria-pressed` is
// what assistive tech announces and also what the CSS colours, so one attribute
// carries both jobs. Written only where it differs, because the observer calls
// this on every pass.
function syncColorSchemeGroup() {
  const scheme = readScheme();

  for (const group of groups) {
    for (const segment of group.children) {
      const pressed = String(segment.getAttribute(COLOR_SCHEME_SEGMENT_ATTRIBUTE) === scheme);

      if (segment.getAttribute("aria-pressed") !== pressed) segment.setAttribute("aria-pressed", pressed);
    }
  }
}

// The app can change the scheme from its own Settings page, which mutates
// nothing the observer below watches. Any tap is a chance it happened, so
// re-read the one key afterwards. Captured rather than bubbled, so a control
// that stops propagation cannot swallow the trigger; deferred a task, because
// the app writes the setting inside its own click handler.
document.addEventListener("click", () => setTimeout(syncColorSchemeGroup, 0), true);

// The bar and the composer mount long after this payload runs, and they are
// torn down and rebuilt on navigation, so we look for them on changes instead
// of polling. Cached nodes keep the common pass down to a few property reads.
function reconcile() {
  // The session header is a home for a copy whenever it is on screen, which is a
  // wide window regardless of pointer or composer state. Anchor it first, so a
  // desktop (no touch bar at all) still gets its switch.
  if (!header?.isConnected) header = document.querySelector(HEADER_TITLE);

  // Park the copy at the row's trailing edge. The flex-1 drag gap is the row's
  // last child, so "after the gap" is just "at the end" — one case, no gap
  // lookup. The guard keeps a no-op pass from re-inserting the node.
  if (header && header.lastElementChild !== headerGroup) header.append(headerGroup);

  // A pass is also the cheapest moment to re-check what the app has stored, and
  // it runs before the composer returns below so the header copy is painted even
  // on a desktop, which has no bar at all.
  syncColorSchemeGroup();

  if (!bar?.isConnected) bar = document.querySelector(TOUCH_BAR);

  // No bar: a desktop, or OpenCode unmounted the composer (a permission prompt
  // takes its place). Leave the state alone, so a remount comes back folded,
  // but take our bar off screen: it would otherwise outlive their bar and sit
  // there with nothing to fold.
  if (!bar) {
    omoBar.remove();
    return;
  }

  if (!dock?.isConnected) dock = document.querySelector(SESSION_DOCK);

  // The landing screen has a composer and a bar of its own, but no session
  // dock. It is the only thing on that page, so it keeps its size.
  if (!dock) {
    expanded = false;
    omoComposerToggle.remove();
    omoBar.remove();
    document.documentElement.removeAttribute(STATE_ATTRIBUTE);
    return;
  }

  // A different form means a different session, or a fresh mount of the same
  // one: start folded rather than carrying the last state over.
  if (!form?.isConnected) {
    form = dock.querySelector(COMPOSER_FORM);
    expanded = false;
  }

  // Keep our bar parked right before theirs. OpenCode re-portals the touch bar
  // on navigation, which would strand our bar wherever it was, so we re-anchor
  // it each pass. The guard makes a no-op pass touch no DOM at all.
  if (omoBar.parentElement !== bar.parentElement || omoBar.nextElementSibling !== bar) bar.before(omoBar);

  // The color scheme switch leads our bar and the composer prompt keeps the end.
  // Prepending a node that already leads is still a move, so guard it like the
  // anchor above.
  if (omoBar.firstElementChild !== barGroup) omoBar.prepend(barGroup);

  // apply() puts the toggle in whichever bar the state calls for.
  apply();
}

// Only a few changes matter: the header arriving or leaving, the bar arriving or
// leaving, the dock mounting or unmounting, and the form being replaced. Every
// streamed token is ignored, so the timeline can mutate as much as it likes
// without costing us a scan.
const MIGHT_MATTER = `${HEADER_TITLE}, ${TOUCH_BAR}, ${SESSION_DOCK}, ${COMPOSER}`;

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

// ---------------------------------------------------------------------------
// Enter adds a line, Shift+Enter sends
// ---------------------------------------------------------------------------

// Upstream, in packages/app/src/composer/editor/editor.tsx:
// - the input is a contenteditable div, not a textarea;
// - plain Enter sends, Shift+Enter has no handler and just makes a newline.
//
// How we take over:
// - its keydown reaches the document root in the bubble phase, so a capture
//   listener there runs first and stopPropagation keeps the app from seeing it;
// - sending = clicking the real submit button, so its guards still run;
// - a new line = insertLineBreak, the app's own command on touch keyboards.

// A plain attribute the app leaves on the send button, and all we need from it.
const SUBMIT = '[data-action="composer-submit"]';

// Only in the DOM while the "@" or "/" list is open, where Enter picks the
// highlighted item. Leave the key to the app then.
const SUGGESTIONS = '[data-component="composer-suggestions"]';

document.addEventListener("keydown", (event) => {
  // Real keypresses only, so a synthetic event can never feed back in.
  if (!event.isTrusted) return;
  if (event.key !== "Enter") return;

  // Enter confirming an IME candidate picks a word, not a command.
  if (event.isComposing || event.keyCode === 229) return;
  if (document.querySelector(SUGGESTIONS)) return;

  if (!(event.target instanceof Element) || !event.target.closest(EDITOR)) return;

  // Cmd/Ctrl+Enter and Alt+Enter are the app's own submit variants; keep them.
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  event.preventDefault();
  event.stopPropagation();

  if (event.shiftKey) {
    // A phone's composer form has no send button; sending happens in its touch
    // bar, so fall back to a document-wide lookup.
    const submit = event.target.closest(COMPOSER)?.querySelector(SUBMIT) ?? document.querySelector(SUBMIT);

    submit?.click();

    return;
  }

  document.execCommand("insertLineBreak");
}, true);

reconcile();
