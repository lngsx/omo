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
