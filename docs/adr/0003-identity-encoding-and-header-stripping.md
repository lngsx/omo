# Force identity encoding and drop stale response headers

Bun's fetch decompresses the upstream body but keeps the `content-encoding` header, so a browser
receives plain text labelled as compressed and fails. omo therefore asks upstream for
`accept-encoding: identity`, and on every rewritten response deletes `content-encoding` anyway as
a net, plus `content-length` (the body changed) and the hop-by-hop headers that are not ours to pass.
