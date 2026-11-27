# omo

A reverse proxy that sits in front of the OpenCode web UI, forwarding everything untouched except HTML pages, which get custom CSS and JS injected to make the UI pleasant — especially on small mobile screens.

## Language

**omo**:
The proxy itself. The name refers to the whole program, not to any single component.
_Avoid_: the server, the middleware

**Upstream**:
The real OpenCode server that omo forwards every request to. There is exactly one.
_Avoid_: backend, origin, target

**Payload**:
The custom CSS and JavaScript that omo serves to OpenCode's pages. It is content owned by this project, kept separate from the proxying machinery.
_Avoid_: injection code, patch, asset

**Browser Loader**:
The inline JavaScript omo appends to each HTML page. It runs in the browser and requests the Payload's CSS and JavaScript. Its contents do not vary with the Payload version. It can be refactored, but a service worker may keep serving cached HTML with an older copy.
_Avoid_: unqualified “loader”, bootstrap, shim, snippet

**Injection**:
The one modification omo makes to upstream HTML: appending the Browser Loader to the page as it streams through. Applies to HTML responses only.
_Avoid_: rewriting, patching

**Pass-through**:
A response forwarded to the client byte-for-byte as the upstream sent it. Everything that is not HTML and not a payload route is pass-through.
_Avoid_: untouched response, direct forwarding

**Color scheme switch**:
The three-segment light/dark/system control in the omo bar. It changes OpenCode's color scheme, which lives in the browser, not its theme, which is the palette — two separate settings on the same Appearance tab.
_Avoid_: theme switch, mode switch
