// Reverse proxy in front of the OpenCode web UI.
//
// This file is the Bun server and nothing else: config, wiring, Bun.serve.
// It does three jobs:
//   1. Forward every request to the real OpenCode server untouched.
//   2. Serve the payload itself at /__omo/* (never cached).
//   3. For HTML responses only, inject a small loader into <head>.
//
// Everything else (JS bundles, JSON, SSE streams) streams straight through,
// so the app keeps working exactly as if the proxy were not there.

import { addCspSource, buildInjectedHead, buildLoader, cspHash, isHtml, payloadVersion } from "./lib/helpers.ts";
import { forward } from "./lib/core.ts";
import { appCss, appJs } from "./payload-registry.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Where the real OpenCode server listens. Tailscale points at *us*, we point here.
const UPSTREAM = "http://127.0.0.1:49374";

// Port we listen on. Tailscale serve should target this.
// 6969: symmetric, unforgettable, lickable, and *definitely* keeps the connection… intimate.
const PORT = 6969;

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

// Hop-by-hop + stale headers we must not copy from the upstream response.
// - content-length: the body changes after rewriting, so it would be wrong.
// - content-encoding: kept as a safety net in case an endpoint ignores our
//   "identity" request; a compressed label on plain text would break the client.
// - connection/keep-alive/transfer-encoding: connection-level, not ours to pass.
const STRIP_RESPONSE_HEADERS = [
  "content-length",
  "content-encoding",
  "connection",
  "keep-alive",
  "transfer-encoding",
];

// ---------------------------------------------------------------------------
// Injected payload
// ---------------------------------------------------------------------------

// The assets themselves live in payload/. Here we derive, once at startup:
// - version: a label for this exact payload, served alongside it,
// - payloadJs: the payload prefixed with that version, so the running page can
//   compare what it loaded against what the server has now,
// - loader: the inline script that pulls both files from /__omo/*,
// - loaderHash: the CSP hash that lets the browser run that inline script.
const version = payloadVersion(appJs, appCss);
const payloadJs = `const OMO_VERSION=${JSON.stringify(version)};${appJs}`;
const loader = buildLoader(version);
const injectedHead = buildInjectedHead(loader);
const loaderHash = cspHash(loader);

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

// Serve one of our own payload files. no-store is the whole trick: the page
// asks for it on every document load, and nothing (browser or service worker
// cache) may answer with an older copy.
function omoAsset(type: string, body: string): Response {
  return new Response(body, {
    headers: { "content-type": type, "cache-control": "no-store" },
  });
}

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    // 0. Our own payload routes. Checked before forwarding so omo can answer
    //    them itself; everything else still has no route of its own. The
    //    loader in <head> always requests these exact paths.
    const { pathname } = new URL(req.url);
    if (pathname === "/__omo/app.css") return omoAsset("text/css; charset=utf-8", appCss);
    if (pathname === "/__omo/app.js") return omoAsset("text/javascript; charset=utf-8", payloadJs);
    if (pathname === "/__omo/version") return omoAsset("text/plain; charset=utf-8", version);

    // 1. Everything else goes to upstream first.
    const upstream = await forward(req, UPSTREAM);

    // 2. Non-HTML responses pass through untouched (and stay streamed).
    if (!isHtml(upstream)) return upstream;

    // 3. HTML: rewrite the body, appending our loader before </head>.
    //    We work on a Response (not a string) so HTMLRewriter can stream and so
    //    async handlers would be allowed later.
    const rewritten = new HTMLRewriter()
      .on("head", {
        element(head) {
          head.append(injectedHead, { html: true });
        },
      })
      .transform(upstream);

    // 4. Fix headers: remove stale ones and disable caching so edits to our
    //    injected files are visible on the next refresh.
    for (const name of STRIP_RESPONSE_HEADERS) rewritten.headers.delete(name);
    rewritten.headers.set("cache-control", "no-store");

    // 5. Let the browser use our injected code: the inline loader needs its
    //    hash, and both the external script and stylesheet ship from 'self'.
    const csp = rewritten.headers.get("content-security-policy");
    if (csp) {
      let next = addCspSource(csp, "script-src", "'self'");
      next = addCspSource(next, "script-src", `'sha256-${loaderHash}'`);
      next = addCspSource(next, "style-src", "'self'");
      rewritten.headers.set("content-security-policy", next);
    }

    return rewritten;
  },
});

console.log(`omo proxy listening on http://127.0.0.1:${server.port}`);
