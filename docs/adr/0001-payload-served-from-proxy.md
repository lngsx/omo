# Serve the payload from the proxy instead of inlining it into HTML

We first inlined the payload into the HTML, but OpenCode's service worker precaches that page
and never re-fetches it, so inlined payload edits never reached an installed PWA. The payload
now lives at `/__omo/app.css`, `/__omo/app.js` and `/__omo/version`, each served `no-store`,
with a small stable inline loader (allowed by a CSP hash) requesting them. Only the loader can
go stale, and only until the service worker updates.
