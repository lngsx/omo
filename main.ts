// Reverse proxy in front of the OpenCode web UI.
//
// This file is the Bun server and nothing else: config, wiring, Bun.serve.
// It does three jobs:
//   1. Forward every request to the real OpenCode server untouched.
//   2. Serve the payload itself at /__omo/* (never cached).
//   3. For HTML responses only, inject the Browser Loader into <head>.
//
// Everything else (JS bundles, JSON, SSE streams) streams straight through,
// so the app keeps working exactly as if the proxy were not there.

import { isHtml } from "./lib/helpers.ts";
import { injectBrowserLoader } from "./lib/browser-loader-injection.ts";
import { preparePayload } from "./lib/payload-preparation.ts";
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
// Injected payload
// ---------------------------------------------------------------------------

// Prepare the reusable Payload values once, keeping derivation out of the server wiring.
const { version, payloadJs, injectedHead, browserLoaderHash } = preparePayload(appCss, appJs);

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
    // Our own payload routes. Checked before forwarding so omo can answer
    //    them itself; everything else still has no route of its own. The
    //    Browser Loader in <head> always requests these exact paths.
    const { pathname } = new URL(req.url);
    if (pathname === "/__omo/app.css") return omoAsset("text/css; charset=utf-8", appCss);
    if (pathname === "/__omo/app.js") return omoAsset("text/javascript; charset=utf-8", payloadJs);
    if (pathname === "/__omo/version") return omoAsset("text/plain; charset=utf-8", version);

    // Everything else goes to upstream first.
    const upstream = await forward(req, UPSTREAM);

    // Non-HTML responses pass through untouched (and stay streamed).
    if (!isHtml(upstream)) return upstream;

    // Keep this HTML-only branch thin; the helper owns the streaming Injection and related headers.
    return injectBrowserLoader(upstream, injectedHead, browserLoaderHash);
  },
});

console.log(`omo proxy listening on http://127.0.0.1:${server.port}`);
