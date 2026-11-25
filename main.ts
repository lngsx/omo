// Reverse proxy in front of the OpenCode web UI.
//
// This file is the Bun server and nothing else: config, wiring, Bun.serve.
// It does exactly two jobs:
//   1. Forward every request to the real OpenCode server untouched.
//   2. For HTML responses only, inject our own CSS/JS into <head>.
//
// Everything else (JS bundles, JSON, SSE streams) streams straight through,
// so the app keeps working exactly as if the proxy were not there.

import { allowInlineScript, buildInjectedHead, cspHash, isHtml } from "./lib/helpers.ts";
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

// The assets themselves live in payload/. Here we just build
// the two derived values once at startup: the head snippet to append, and the
// CSP hash that lets the browser run our inline script.
const injectedHead = buildInjectedHead(appJs, appCss);
const scriptHash = cspHash(appJs);

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    // 1. Always ask upstream first; the proxy has no routes of its own.
    const upstream = await forward(req, UPSTREAM);

    // 2. Non-HTML responses pass through untouched (and stay streamed).
    if (!isHtml(upstream)) return upstream;

    // 3. HTML: rewrite the body, injecting our styles and script before </head>.
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

    // 5. Let the browser run our inline script by adding its hash to the CSP.
    const csp = rewritten.headers.get("content-security-policy");
    if (csp) rewritten.headers.set("content-security-policy", allowInlineScript(csp, scriptHash));

    return rewritten;
  },
});

console.log(`omo proxy listening on http://127.0.0.1:${server.port}`);
