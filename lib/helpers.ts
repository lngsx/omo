// Pure helpers for injecting our code into the OpenCode HTML.
// No I/O here on purpose: the server reads the files and passes the text in,
// which keeps these functions easy to reason about and reuse.

// A short label for the current payload (CSS + JS together). omo stamps this
// into the served JavaScript, so the running page can
// tell whether the payload it loaded is still the one the server has.
export function payloadVersion(js: string, css: string): string {
  return new Bun.CryptoHasher("sha256").update(css + js).digest("hex").slice(0, 8);
}

// The Browser Loader requests the Payload's CSS and JavaScript. Its output
// does not vary with the Payload version, but cached HTML may keep an older
// copy after the Loader changes.
// NOTE: if this ever contains the literal text "</script>", escape it as
// "<\/script>" so the HTML parser does not end the tag early.
export function buildBrowserLoader(): string {
  return [
    `{const c=document.createElement("link");c.rel="stylesheet";c.href="/__omo/app.css";document.head.appendChild(c)}`,
    `{const s=document.createElement("script");s.src="/__omo/app.js";document.head.appendChild(s)}`,
  ].join("");
}

// Build the exact HTML we append to <head>. Only the Browser Loader is inline; the
// payload arrives from /__omo/* as separate, never-cached requests.
export function buildInjectedHead(browserLoaderJs: string): string {
  return "<script>" + browserLoaderJs + "</script>";
}

// OpenCode sends a Content-Security-Policy that only allows scripts from 'self'
// plus one specific hash. Our injected inline <script> is neither, so the
// browser blocks it. This computes the sha256 the browser expects, as base64.
export function cspHash(js: string): string {
  return new Bun.CryptoHasher("sha256").update(js).digest("base64");
}

// True when a response is an HTML document we should rewrite.
export function isHtml(response: Response): boolean {
  const type = response.headers.get("content-type") ?? "";

  return type.includes("text/html");
}

// Add one source token (a hash, 'self', a host) to a CSP directive, creating
// the directive when it is missing. Idempotent, so callers can chain it.
export function addCspSource(csp: string, directive: string, source: string): string {
  // Split into individual directives, dropping empties.
  const directives = csp
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);

  const existing = directives.find((d) => d === directive || d.startsWith(directive + " "));
  if (!existing) return [...directives, `${directive} ${source}`].join("; ");
  if (existing.split(/\s+/).includes(source)) return directives.join("; ");

  // Append the token to that one directive, then join back into a CSP string.
  return directives.map((d) => (d === existing ? `${d} ${source}` : d)).join("; ");
}
