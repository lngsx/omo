# 🍒 omo

A poor man's reverse proxy for OpenCode's web UI. It sits in front of the real server, slips its own CSS and JS into the page, and makes the UI feel good in your hand, and no, size doesn't matter.

Listens on **6969**, symmetric, unforgettable, lickable, and *definitely* keeps the connection… intimate. Point `tailscale serve` at it.

## What it does

- Forwards everything to `127.0.0.1:49374`, untouched.
- Serves the payload at `/__omo/app.css`, `/__omo/app.js`, `/__omo/version` (never cached).
- Rewrites only HTML: appends a tiny loader to `<head>` that pulls those files.
- Keeps the CSP and `Host` happy, so auth and streaming just work.

## Run

```sh
bun install

bun dev     # auto-restart on edits
bun start   # just run it
```

Now go make something dirty with it, something you'll have to clean up.
