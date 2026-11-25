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
    - purpose: Entry point. Configures upstream/port, then runs the whole pipeline per request — forward to upstream, inject payload into HTML responses, fix headers, patch CSP.
      key_concepts:
        - reverse proxy
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
        - payload-registry.ts

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
    - purpose: Stateless helpers for building the injected head snippet and patching the CSP string. No I/O by design — callers pass text in.
      key_concepts:
        - head injection snippet building
        - script-early-termination escaping (</script> caveat noted inline)
        - CSP sha256 hash format ('sha256-<base64>')
        - script-src directive patching
      key_exports:
        - buildInjectedHead(js, css)
        - cspHash(js)
        - isHtml(response)
        - allowInlineScript(csp, hash)

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
    - Injected JavaScript (placeholder)
    - light
    - purpose: The JS half of the payload, appended to every OpenCode page. Currently an intentional placeholder — UI enhancement work lands here.
      key_concepts:
        - mobile UI enhancement
      key_exports:
        - inline script body (consumed via payload-registry.ts)

  - - payload/app.css
    - Injected stylesheet (placeholder)
    - light
    - purpose: The CSS half of the payload, appended to every OpenCode page. Currently an intentional placeholder.
      key_concepts:
        - mobile UI enhancement
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
    - purpose: Defines the project's canonical vocabulary — omo, Upstream, Payload, Injection, Pass-through — and the words to avoid instead.

  - - docs/adr/0001-inline-payloads-with-csp-hash.md
    - ADR: inline payload injection with CSP hash
    - light
    - purpose: Records why the payload is inlined into HTML (CSP blocks external scripts; inlining avoids proxy-owned routes) and the accepted restart-to-reload cost.
      key_concepts:
        - CSP script hashes
        - inline injection vs static asset serving

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
