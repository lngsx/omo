# Invariant: forward the Host header to upstream untouched

A conventional reverse proxy rewrites `Host` to point at itself, but OpenCode derives its session cookie name (`opencode_session_<port>`) and its same-origin check from the incoming Host header. Rewriting Host made every API call return 401, so omo passes Host through exactly as received and instead relies on `tailscale serve` to present the right hostname to clients. Anyone tempted to "fix" the untouched Host in `lib/core.ts` should read its comment first — that behavior is load-bearing for auth.
