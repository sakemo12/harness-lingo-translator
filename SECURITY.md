# Security

## Reporting

Open a private security advisory on this repository
(`Security` → `Advisories` → `Report a vulnerability`). Do not open a public
issue for a vulnerability.

## Scope

- With `systemModel: false` (the default), the host half calls exactly one
  destination: the configured `baseUrl`. It resolves no session model route and
  contacts no cloud provider.
- With `systemModel: true`, the host calls its `llm` service with the newest
  session `request/header` provider/model. It sends a standalone JSON array of
  masked segments, no conversation context and no model-side cache hints.
- The optional `apiKey` is sent only as `Authorization: Bearer` to `baseUrl`;
  `status()` and error messages never echo it. The system-model path uses the
  host's own model credentials, which the plugin neither reads nor copies.
- Only prose with protected spans masked leaves the browser. In the default
  backend it goes only to `baseUrl`.
- The host half writes no session event and no workspace file. Its only file
  write is the per-workspace cache under `~/.dsh/cache/dsh-translate/`; the
  browser half writes only a bounded translation cache in `localStorage`.
- Placeholder verification is the trust boundary: a translation that loses,
  renumbers or invents a `⟦n⟧` token — or that is empty or truncated — is
  discarded and the original text stays.
- `baseUrl` is validated as an `http(s)` URL at profile load; a `file:` or other
  scheme fails loudly.

## Supported versions

The `1.x` line targets DeepSeek Harness `>=0.2.1-0 <0.3.0`.
