// Pure helpers for injecting our code into the OpenCode HTML.
// No I/O here on purpose: the server reads the files and passes the text in,
// which keeps these functions easy to reason about and reuse.

// Build the exact HTML we append to <head>: our CSS then our JS, inlined so
// the browser does not need a second request per file.
export function buildInjectedHead(js: string, css: string): string {
  // NOTE: if js ever contains the literal text "</script>", escape it as
  // "<\/script>" so the HTML parser does not end the tag early.
  return ["<style>" + css + "</style>", "<script>" + js + "</script>"].join("");
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

// Add our script hash to the script-src directive of a CSP string.
// A CSP hash must be written as 'sha256-<base64>'. If script-src is missing we
// append a new directive; otherwise we extend the existing one.
export function allowInlineScript(csp: string, hash: string): string {
  const token = `'sha256-${hash}'`;
  if (csp.includes(token)) return csp;

  // Split into individual directives, dropping empties.
  const directives = csp
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);

  // Make sure a script-src directive exists, defaulting to 'self'.
  const hasScriptSrc = directives.some((d) => d.startsWith("script-src"));
  const base = hasScriptSrc ? directives : [...directives, "script-src 'self'"];

  // Append our hash to that directive, then join back into a CSP string.
  return base
    .map(function (d) {
      return d.startsWith("script-src") ? `${d} ${token}` : d;
    })
    .join("; ");
}
