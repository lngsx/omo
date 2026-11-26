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

**Loader**:
The short inline script omo appends to every HTML page. It only records the payload version and requests the payload files; it never changes, because a precaching service worker may freeze it forever.
_Avoid_: bootstrap, shim, snippet

**Injection**:
The one modification omo makes to upstream HTML: appending the loader to the page as it streams through. Applies to HTML responses only.
_Avoid_: rewriting, patching

**Pass-through**:
A response forwarded to the client byte-for-byte as the upstream sent it. Everything that is not HTML and not a payload route is pass-through.
_Avoid_: untouched response, direct forwarding
