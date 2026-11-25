// Core proxying behavior: forward one request to the upstream server.
// The upstream base URL is passed in so this file stays free of server config.
//
// Method, headers and body are preserved so POST/PUT/streaming endpoints behave
// normally.
export function forward(req: Request, upstream: string): Promise<Response> {
  const url = new URL(req.url);
  const target = upstream + url.pathname + url.search;

  // Copy the request headers but override the one that must change:
  // - accept-encoding: force "identity" (no compression). If we let
  //   compression through, Bun's fetch decompresses the body but *keeps* the
  //   content-encoding header, so the browser tries to decompress plain text
  //   and fails. Asking for identity sidesteps the whole mismatch.
  //
  // We keep `host` untouched on purpose. OpenCode derives its session cookie
  // name (opencode_session_<port>) and its same-origin check from the Host
  // header, so rewriting it to our proxy address makes every API call 401.
  const headers = new Headers(req.headers);
  headers.set("accept-encoding", "identity");

  // GET/HEAD have no request body; everything else streams the incoming body.
  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  return fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // Pass redirects back to the browser instead of following them here.
    redirect: "manual",
    // Required by the fetch spec when streaming a request body.
    duplex: "half",
  } as RequestInit);
}
