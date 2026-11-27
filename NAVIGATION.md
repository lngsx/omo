# NAVIGATION.md
# Project navigation and file map for agent orientation.
# Format: YAML with usage instructions as header comments.

# ── How to use this file ──
# Before reading a file, check its entry here. The annotations often answer
# your question without opening the file.
#
# Each file entry is a four-item sequence:
# [path, description, token_density, annotations]
#
# - path, description, token_density: mandatory positional prefix, in that order.
# - annotations: fourth item, a keyed mapping. purpose is required.
# - token_density: light = safe to read directly. dense = use the active file-examine route or read selectively.
# - purpose: why the file exists. Use this to decide if it's relevant.
# - key_concepts: what you'd learn by reading it. Use this to orient without reading.
# - key_exports: what it exposes — interfaces, commands, outputs.
# - reads_from: dependencies. Use this to trace relationships.

files:
  - - main.ts
    - Bun server and request pipeline
    - light
    - purpose: Entry point. Configures upstream/port, prepares the Payload, serves its routes (/__omo/*, no-store), and runs the request pipeline — forwarding upstream and injecting the Browser Loader into HTML responses.
      key_concepts:
        - reverse proxy
        - payload routes owned by omo
        - HTMLRewriter streaming transformation
        - response header stripping (content-length, content-encoding, hop-by-hop)
        - CSP hash whitelisting
        - cache-busting via no-store
      key_exports:
        - Bun.serve on port 6969
        - UPSTREAM and PORT config constants
      reads_from:
        - lib/helpers.ts
        - lib/core.ts
        - lib/payload-preparation.ts
        - payload-registry.ts

  - - lib/payload-preparation.ts
    - Startup Payload preparation
    - light
    - purpose: Derives the version, versioned JavaScript, Browser Loader markup, and CSP hash once from CSS/JS text already loaded by payload-registry.ts. Performs no file I/O.
      key_concepts:
        - startup-only preparation
        - derived values shared by payload routes and HTML injection
      key_exports:
        - preparePayload(appCss, appJs) → { version, payloadJs, injectedHead, browserLoaderHash }
      reads_from:
        - lib/helpers.ts

  - - lib/core.ts
    - Request forwarding logic
    - light
    - purpose: Forwards one request to the upstream server preserving method, headers, and streaming body. Contains the two subtle proxy decisions — keep Host untouched, force identity encoding — with the reasons documented inline.
      key_concepts:
        - Host header passthrough (session cookie name and same-origin check derive from it)
        - accept-encoding identity (Bun fetch decompresses but keeps content-encoding header, breaking the client)
        - manual redirects
        - half-duplex request streaming
      key_exports:
        - forward(req, upstream) → Promise<Response>

  - - lib/helpers.ts
    - Pure injection helpers
    - light
    - purpose: Stateless helpers for the payload version label, the inline Browser Loader, and patching the CSP string. No I/O by design — callers pass text in.
      key_concepts:
        - Browser Loader stays the same across Payload versions; cached HTML may retain older code after edits
        - payload version derived from CSS+JS
        - script-early-termination escaping (</script> caveat noted inline)
        - CSP sha256 hash format ('sha256-<base64>')
        - idempotent CSP directive patching
      key_exports:
        - payloadVersion(js, css)
        - buildBrowserLoader()
        - buildInjectedHead(browserLoaderJs)
        - cspHash(js)
        - isHtml(response)
        - addCspSource(csp, directive, source)

  - - payload-registry.ts
    - Startup loader for payload assets
    - light
    - purpose: Reads the payload CSS/JS once at startup into memory and exposes them as text. Payload edits need a proxy restart to take effect.
      key_concepts:
        - top-level await loading
        - read-once in-memory assets
      key_exports:
        - appCss, appJs (string exports)
      reads_from:
        - payload/app.css
        - payload/app.js

  - - payload/app.js
    - Injected JavaScript, served at /__omo/app.js
    - light
    - purpose: The JS half of the payload. Swaps the composer's Enter and Shift+Enter (Enter adds a line, Shift+Enter sends), folds the session composer into a compact bar on touch devices, and on foregrounding compares its baked-in version with /__omo/version, silently reloading once if omo has a newer payload.
      key_concepts:
        - Enter newline / Shift+Enter send via a capture-phase keydown (preventDefault + stopPropagation beats the app's bubble-phase handler)
        - submitting by clicking [data-action="composer-submit"] instead of calling app internals
        - suggestion popover defers the key to the app; touch keyboards unchanged
        - collapsible composer on touch devices
        - touch bar as the phone detector (coarse pointer, no width query)
        - folding only the composer form, never the wrapper holding permission docks
        - MutationObserver gated to composer-related mutations
        - empty-editor rules for auto-folding
        - visibilitychange version check
        - one reload per session cap (sessionStorage)
      key_exports:
        - inline script body (consumed via payload-registry.ts)

  - - payload/app.css
    - Payload stylesheet, served at /__omo/app.css
    - light
    - purpose: The CSS half of the payload. First rule: pointer cursor on links/buttons, not-allowed on disabled buttons. Then the folded and open looks of the collapsible composer, keyed off `data-omo-composer` on <html> so nothing applies on desktop or the landing screen.
      key_concepts:
        - state carried by a single attribute on <html>
        - hiding the composer form without hiding the docks beside it
        - touch-bar restyling, including the app's own sprite icons
      key_exports:
        - inline style body (consumed via payload-registry.ts)

  - - README.md
    - Project intro and run instructions
    - light
    - purpose: Explains what omo does (forward everything, rewrite HTML only), how to run it (bun dev / bun start), and the port 6969 + tailscale serve setup.
      key_concepts:
        - port 6969 listening setup
        - tailscale serve integration

  - - AGENTS.md
    - Agent working instructions
    - light
    - purpose: Project mandates for agents — Bun-only stack, no tests or linting, explanatory comments, learning-oriented pacing, where the OpenCode reference source lives.
      key_concepts:
        - no tests / no linting mandate
        - explanatory comment convention
        - opencode/ as gitignored source reference

  - - package.json
    - Bun package manifest
    - light
    - purpose: Defines the two run scripts and the minimal dependency set (only @types/bun; TypeScript as peer dependency). No runtime packages.
      key_concepts:
        - zero runtime dependencies
      key_exports:
        - bun start / bun dev scripts

  - - CONTEXT.md
    - Project glossary
    - light
    - purpose: Defines the project's canonical vocabulary — omo, Upstream, Payload, Browser Loader, Injection, Pass-through — and the words to avoid instead.

  - - docs/adr/0001-payload-served-from-proxy.md
    - ADR: payload served from proxy routes
    - light
    - purpose: Records why the payload is served from /__omo/* with no-store instead of inlined — a precaching service worker freezes inlined HTML, so payload edits would never reach an installed PWA.
      key_concepts:
        - service worker precache freezing HTML
        - stable inline loader + CSP hash

  - - docs/adr/0002-keep-host-header-untouched.md
    - ADR: Host header passthrough
    - light
    - purpose: Records why omo never rewrites the Host header — OpenCode derives session cookie name and same-origin checks from it, so rewriting breaks auth.
      key_concepts:
        - Host-derived session cookies
        - reverse proxy header handling

  - - docs/adr/0003-identity-encoding-and-header-stripping.md
    - ADR: identity encoding and stale header stripping
    - light
    - purpose: Records the Bun fetch compression mismatch (decompresses body, keeps content-encoding header) and the identity-encoding workaround.
      key_concepts:
        - accept-encoding identity
        - stale content-length after rewriting

  - - opencode/
    - Reference copy of the OpenCode source (branch dev, gitignored)
    - dense
    - purpose: Read-only vendored copy of the upstream project's source, kept for inspecting how OpenCode serves its web UI (CSP, auth, HTML shape). Never part of the build; do not edit. Too large to read wholesale — grep into it for specific questions.
      key_concepts:
        - upstream web UI internals
        - session cookie derivation from Host
