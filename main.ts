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

  // Bun closes a connection that sits idle for 10s by default. OpenCode's event
  // stream (SSE) is quiet between events and only proves it is alive with a
  // heartbeat every 15s — so the default would kill the stream just before each
  // heartbeat, forever. 0 disables idle closing; the upstream still drops the
  // connection when the stream really ends.
  idleTimeout: 0,

  // Our own payload routes. Bun matches these BEFORE fetch ever runs, so the
  //    proxy below never sees them. Handlers (not static Responses) on purpose:
  //    static routes get Bun's automatic ETag/304 caching, and this payload's
  //    whole trick is cache-control: no-store — nothing may answer for us.
  routes: {
    "/__omo/app.css": () => omoAsset("text/css; charset=utf-8", appCss),
    "/__omo/app.js": () => omoAsset("text/javascript; charset=utf-8", payloadJs),
    "/__omo/version": () => omoAsset("text/plain; charset=utf-8", version),
  },

  // Only requests no route matched land here. This is the proxy, nothing else.
  async fetch(req) {
    // Everything goes to upstream first.
    const upstream = await forward(req, UPSTREAM);

    // Non-HTML responses pass through untouched (and stay streamed).
    if (!isHtml(upstream)) return upstream;

    // Keep this HTML-only branch thin; the helper owns the streaming Injection and related headers.
    return injectBrowserLoader(upstream, injectedHead, browserLoaderHash);
  },
});

console.log(`omo proxy listening on http://127.0.0.1:${server.port}`);
