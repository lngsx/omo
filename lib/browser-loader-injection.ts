import { addCspSource } from "./helpers.ts";

// These stale and hop-by-hop headers no longer describe the injected response
// or belong to the upstream connection.
const STRIP_RESPONSE_HEADERS = [
  "content-length",
  "content-encoding",
  "connection",
  "keep-alive",
  "transfer-encoding",
];

// Append the Browser Loader to HTML as it streams, then adjust headers for the
// changed body and the Payload files the Browser Loader requests.
export function injectBrowserLoader(
  response: Response,
  injectedHead: string,
  browserLoaderHash: string,
): Response {
  // Transform the Response directly so HTMLRewriter can stream its body.
  const injectedResponse = new HTMLRewriter()
    .on("head", {
      element(head) {
        head.append(injectedHead, { html: true });
      },
    })
    .transform(response);

  // Remove headers invalidated by Injection or specific to the upstream connection.
  for (const name of STRIP_RESPONSE_HEADERS) injectedResponse.headers.delete(name);

  // Prevent browsers and service workers from keeping HTML with stale Payload references.
  injectedResponse.headers.set("cache-control", "no-store");

  // Extend an existing CSP for the inline Browser Loader and same-origin Payload files.
  const csp = injectedResponse.headers.get("content-security-policy");
  if (csp) {
    let next = addCspSource(csp, "script-src", "'self'");
    next = addCspSource(next, "script-src", `'sha256-${browserLoaderHash}'`);
    next = addCspSource(next, "style-src", "'self'");
    injectedResponse.headers.set("content-security-policy", next);
  }

  return injectedResponse;
}
