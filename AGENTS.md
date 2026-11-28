# AGENTS.md — harness-lingo-translator

Standalone DeepSeek Harness plugin repository (`harness-lingo-translator`, JS form:
plain-JS host + hand-written client bundle). Repo-local decisions live here.

## Shape

Chat-flow translator. The browser walks the conversation flow column, masks
everything that must stay verbatim into `[n]` tokens (unless masking is off), and asks
the host to translate the prose with a **local OpenAI-compatible HY-MT
endpoint** (tencent/HY-MT1.5-1.8B-GGUF under llama.cpp / vLLM / any compatible
server) or, with `systemModel: true`, the host `llm` route. Local mode uses only
an optional bearer token; system mode uses the host's own model credentials.

## Layout

- `index.mjs` — the host face (`name` / `Config` / `resolveConfig` / `apply`;
  no default export). Mounts the `translatePage` service.
- `lib/service.mjs` — `TranslateService extends TypertRemoteService`; `status()`
  probes `/models` or the host route, `translate()` delegates to the engine,
  and the cache/workspace methods own the per-workspace document. The only file
  write is the cache under `~/.dsh/cache/harness-lingo-translator/`; no session append.
- `lib/cache.mjs` — per-workspace cache document: atomic rename, config-hash
  filtering and a bounded LRU.
- `lib/session-backend.mjs` — the system-model path: host `llm.stream` with the
  newest session route, no conversation context and no model cache hints.
- `lib/engine.mjs` — official HY-MT prompt templates (ZH<=>XX, XX<=>XX,
  terminology intervention), glossary parsing, the OpenAI-compatible HTTP
  call, concurrency, output cleaning and placeholder verification. No cordis,
  no DOM; the unit-test seam.
- `lib/transport.mjs` — `nodeFetch` over `node:http`/`node:https`, shaped like a
  fetch response. Global `fetch` is deliberately not used: it rejects WHATWG
  bad ports such as 123, which a LAN translation server may use.
- `lib/wire.mjs` — hand-written request/result validators (no runtime schema dependency)
  plus the invocation descriptors shared by the host
  manifest and (by hand) the client bundle.
- `typert.host.mjs` — host Typert manifest exported as `./typert`.
- `client/index.js` — hand-written client bundle (`window.__ModuleLoader__.load`):
  DOM walk, masking, cache, flicker handling, the floating **passive switch**
  (baseline of already-visible text; new/completed/revealed text only), and the
  row configuration page registered at `plugins.row.config` under
  `harness-lingo-translator#harness-lingo-translator`. It holds a hand-copied descriptor list;
  `test/descriptors.test.mjs` fails on drift.
- `test/*.test.mjs` — `node --test`; `http.test.mjs` drives a real loopback
  server, the DOM tests use jsdom.

## Hard rules

- **Display-only.** No `session.append`, no workspace write, and no config write
  from the plugin code. Translations live in the DOM, a bounded `localStorage`
  cache, and the host-private per-workspace document under
  `~/.dsh/cache/harness-lingo-translator/`. The only configuration write is the user's
  explicit Save on the Plugins page form, which goes through the host settings
  service.
- **Two backends.** `systemModel: true` uses the host integration: the host
  `llm` service with the newest `request/header` route (`lib/session-backend.mjs`),
  sending a standalone JSON array with **no conversation context and no model
  cache hints**. `false` uses the local endpoint. Host injection requires
  `sessions`; `llm` is lazy. The settings checkbox must remain clickable.
- **Local endpoint only.** When `systemModel` is false, the host half calls
  exactly `config.baseUrl`; it never resolves a session model route or contacts a
  cloud provider.
- **Prompt header.** `promptHeader` is the instruction line for every prompt
  (per-segment and batched): it replaces the built-in instruction when set, and
  an empty value falls back to the built-in template. `{target_language}` and
  `{target_lang}` are substituted. Its default is Chinese-specific and is
  ignored for non-Chinese styles (`DEFAULT_PROMPT_HEADER`). It never replaces
  the placeholder guard.
- **Official prompts.** The model card's templates are reproduced in
  `lib/engine.mjs`; a placeholder-retention clause is added only to segments
  that actually carry a configured placeholder token (on a plain segment it leaks into the answer), and
  the pristine template is used otherwise. `{source_text}` output is the only
  thing sent in the user message. No system prompt is sent (the model card says
  the model has none). The clause is configurable: `placeholderGuard` switches
  both the masking and the clause off, and `placeholderHint` replaces the clause
  **inline in the instruction** (never as a separate line, which the model
  translates as content).
- **Batched reasoning.** With `batchReasoning` on, the browser groups a
  reasoning block (`[data-variant="think"]`) and the host sends it as numbered
  lines, `BATCH_LIMIT` (8) per request; a malformed numbering or placeholder
  mismatch falls back to per-segment requests. Do not switch to JSON, delimiter
  or `<sn>` formats: measured against the reference deployment they merge
  segments in Chinese.
- **Chinese blocks and user messages are never translated.** A text node with
  two consecutive CJK ideographs outside quotation marks is Chinese (quoted
  citations are ignored, so an English sentence quoting Chinese is translated;
  kana or Hangul keep Japanese/Korean translatable); `[data-chat-flow-kind="user"]`
  and `"steering"` are user input and are skipped. These are product rules, not
  settings.
- **Hover restore.** While the switch is on, a stationary pointer (no
  `mousemove` for `hoverRestoreMs`, default 200; `0` means immediate) over a translated block
  shows that block's original text. Moving inside the previewed block keeps the
  original; leaving it, scrolling or leaving the page restores the translation.
  Preview scope is the closest block ancestor (`p`, `li`, `div`, ...) of the
  hovered element, so a leading icon shares it, but that scope is used only when
  every translated node inside shares one direct parent; otherwise only the
  hovered element's own text nodes are previewed. A container such as `<body>`
  must never preview the whole page. Previewed nodes are skipped by scans. Both
  settings are read when the switch starts.
- **Pinned block height.** Applying a translation must not reflow the list when
  the translation wraps differently from the original: the nearest block-level
  ancestor of a translated text node is pinned with an inline `min-height` equal
  to the larger of the original and translated rendered heights. Use
  `offsetHeight` first and the transformed rect only as a fallback; when
  `box-sizing` is not `border-box`, subtract padding/borders before writing the
  content-box `min-height`. Previewing the original on hover keeps the pinned
  height. Never pin `body`/`html`, save and restore the page's own inline
  `min-height` on stop, and only pin height (never width).
- **Controlled re-renders and baseline text.** React writes the original text
  back into nodes it controls when a row expands or re-renders. `collectPending`
  must re-apply the stored `displayed` value when the current text equals
  `originals.get(node)` (before the baseline check) — never issue a request for
  this case. Expanding a reasoning row can also replace the parent message's
  text nodes; baseline is therefore remembered per `[data-chat-flow-key]` +
  text (`baselineTexts`), and a new node whose text matches a baseline string in
  the same flow counts as baseline. The newly revealed reasoning body has no
  baseline entry and still translates. Collapsed thoughts are not a special
  case: a summary that was visible at baseline stays original.
- **Per-workspace cache document.** The only host file write is
  `~/.dsh/cache/harness-lingo-translator/<sha256(workspace)>.json` (never inside the
  workspace). Entries are content-addressed by `configHash + "\0" + masked
  source`; `loadCache` filters by the current `configHash`, so config changes
  miss, and workspace/conversation changes can only miss, never mis-map.
  `status()` returns `configHash`; the client loads the file in `start()`,
  applies it before `reapplyCached()`, and saves successful translations with
  `saveCache` (debounced, atomic rename, bounded LRU). The client's session
  controller has **no `list`**; the workspace comes from the host `workspace`
  invocation (`sessions.get(id).header.cwd`) using `[data-conversation-session]`,
  with the client store only as an optional shortcut. `pruneCache` runs
  host-side over `sessions.list()`; the client cannot supply a catalog.
- **Rename migration.** 1.14.0 renamed the package/plugin from `dsh-translate`
  to `harness-lingo-translator` and moved the cache to
  `~/.dsh/cache/harness-lingo-translator/`. `scripts/migrate-profile.mjs` updates
  an existing profile and copies the old cache. Keep the legacy cache directory
  and the old `dsh-translate:cache:v2` localStorage key as read-only fallbacks;
  the host merges the legacy document on every load and seeds the new document
  from it when the new one is missing. Do not remove those fallbacks without a
  major-version migration plan.
- **Re-enable and collapsed previews.** `start()` re-applies cached translations
  (`reapplyCached`) only for segments translated in this page session
  (`translatedKeys`), so turning the switch back on restores them without
  requests. A fresh page must not replay a warm cache onto text that was already
  visible when the switch was first turned on: the baseline wins on first start.
  Collapsed reasoning summaries follow the baseline: one that was already
  visible stays original; a newly appeared or newly revealed summary is
  translated and truncated to `THINK_SUMMARY_MAX` (160); the hidden body still
  waits for expansion.
- **Passive triggers.** On the first enable, the switch snapshots the text already
  visible and translates nothing from that snapshot; only blocks that finish
  generating, text that changes afterwards, and collapsed content that is later
  revealed are translated. Re-enabling restores only the segments recorded in
  `translatedKeys` (see above). Streaming (`data-streaming`, `aria-busy`) and
  hidden content are skipped. Switching off restores every translated node.
- **Scope is the chat flow column.** Only text inside
  `div.EvIC1a_column[data-chat-flow]` is walked, baselined, cached or requested.
  The sidebar, settings page, file viewer, composer and the plugin's own control
  are outside it; translating them is a bug. When no conversation column is
  rendered, the translator does nothing. Keep every scan (`collectPending`,
  `markBaseline`, `reapplyCached`) on this scope; the tests mount fixtures inside
  the column and one asserts outside text stays original.
- **Masking can be turned off.** With `placeholderGuard: false` (the settings
  checkbox "关键词保留" / "Keyword retention"), the client sends the plain
  source: no masks, no inline-code unit assembly, no retention clause, and no
  placeholder verification on either backend (a literal token in prose is
  content). `status()` exposes the setting; re-toggling the switch picks it up.
- **Mask format is configurable.** `placeholderFormat` (volatile, default `[n]`)
  uses the first `n` as the slot number; `[n]`, `{{n}}` and `⟦n⟧` are valid.
  Both the client and the host build their tokens and regex from it, the status
  exposes it, and saved hints that still use legacy `⟦n⟧` tokens are adapted to
  the active format. Reject a format with no `n`, only `n`, or more than 24
  characters. The default `[n]` is the easiest for small models; custom formats
  may require a smarter model.
- **Masking targets code, not prose.** Product terms use lookarounds
  (`bundle`/`digit` must not match `bun`/`git`); a hyphenated word is an
  identifier only with a digit or the `dsh-` prefix; a slash sequence needs a
  path boundary; model names and versions are one token; a relative path with a
  directory and a known extension (`client/index.js`) is one token. Masking only
  its basename leaves `client/[0]`, which HY-MT then drops or rewrites. Ordinary
  prose such as `fail-closed`, `state-of-the-art`, `lost/duplicated/invented`
  must stay translatable.
- **Inline code is a placeholder, not a split.** A paragraph (`p`, `li`, `td`,
  `h1`–`h6`, `blockquote`, `dd`, `dt`, `figcaption`) with prose text on both sides
  of `<code>`/`<kbd>`/`<samp>` is one translation unit: each inline code becomes
  a placeholder, the combined source is sent once, and the parts are restored
  around the untouched code elements. `pre` code blocks remain skipped. With
  masking off the unit is not built; the prose text nodes are translated
  separately so no placeholder is ever sent.
- **Prompt text has no leading blank line.** The instruction is joined to the
  source without `\n\n`; leading whitespace and literal `\n` / `\"` escape
  sequences are stripped from the source before the prompt is built. JSON still
  escapes quotes and newlines on the wire — the model receives the decoded text.
- **Code-like surfaces stay verbatim.** `pre`/`code` plus the app's semantic
  surfaces (`[data-terminal]`, `[data-command-text]`, `[data-read]`,
  `[data-diff]`, `[data-json]`, `[data-code]`) are never translated. Tool
  descriptions (task names) are prose and are translated. Do not detect code by
  font family: jsdom reports monospace for everything and the check becomes
  untestable.
- **Fail closed when masking is on.** A translation that drops, renumbers or
  invents a configured placeholder, or that is empty/truncated, keeps the original
  text. With masking off there are no generated tokens, so placeholder
  verification is skipped: a literal token in prose is content, not a token.
- **Live switch and localized errors.** The floating switch must not be disabled
  while `state.working`; clicking it calls `stop()` (generation bump, restore and
  cache flush). Error text goes through `localizeError` into the active locale
  and is rendered above the button; an unknown raw detail may follow a localized
  prefix, but an error must never contain `apiKey`.
- **No secrets in logs or status.** `apiKey` is an optional volatile
  `role('secret')` field: the settings form only writes it, the settings service
  strips it from every read, and it is only sent as a bearer header. It never
  appears in `status()`, an error message, or a rendered form.
- **Bounded calls and bounded retries.** `concurrency`, `timeoutMs`, `retries`,
  `maxTokens` are Config fields. A segment failing in the browser is retried at
  most 3 times (5 s / 20 s / 60 s), failed positions are never re-sent on every
  mutation, scans are serialized, and in-flight segments are deduplicated. Do not
  add a global 30 s pause; failures must show the real error and new segments
  retry immediately. Never remove the per-segment guards: an earlier version without them retried one failing sentence on every
  DOM mutation and sent tens of thousands of requests to the service.
- **No build step.** The client bundle is loaded raw; do not add a bundler
  without updating the loader shape and the descriptor parity test.
- **Settings form.** Four top tabs (`Connection`, `Translation`, `Hover`,
  `Translation cache`); only the active tab renders. `Connection` has two
  mutually exclusive checkboxes — `Custom service` shows `baseUrl`/`model`/`apiKey`;
  `System model` (`systemModel: true`) shows the host route hint and hides
  local-only translation fields. The Translation tab carries the `关键词保留` checkbox, the `遮罩格式` field and
  the custom retention sentence. The cache tab shows
  `~/.dsh/cache/harness-lingo-translator/` and prunes entries whose session id is gone. Defaults must be visible in the
  fields; tab titles are 15px and field labels 14px.
- **Live settings fields.** `baseUrl`, `model`, `concurrency`, `batchReasoning`, `promptHeader`, `placeholderGuard`, `placeholderFormat`, `placeholderHint`, `systemModel`, `hoverRestore`, `hoverRestoreMs` and `apiKey` are
  Schemastery volatile fields, so the Plugins page form writes them through the
  settings service and the running service re-reads them on every call
  (`createConfigSource`). The form must use the Host field name `systemModel`
  (never `sessionModel`), or the settings service rejects the write as a
  non-volatile field. `apiKey` also carries `role('secret')`; keep both
  markers, and never read the token back into the form.

## Marketplace listing

`market/` holds every distribution artifact; `market/README.md` is the channel
runbook (which marketplace needs what, and which step still needs a human).

- **One copy source.** `market/listing.json` owns the title, category, labels,
  keywords and every description length (zh/en). `pnpm run market:build`
  regenerates `market/index.json` (the only versioned artifact, because the live
  index URL serves it) and `market/submissions/*` (scratch copy for a listing PR
  or issue; gitignored). Never hand-edit either; `pnpm run market:check` (a CI
  gate) fails on index drift. All copy must stay factual: awesome-dsh-plugin rejects claims the code
  does not back up and caps `descriptions.short` at 140 characters, which the
  builder enforces together with the single-line/period/no-marketing-word rules.
- **The index follows the release.** `market/index.json` is a format-1
  plugin-market index. With `listing.json` `source.type: "npm"` (the current
  value) each version installs `name@version` from the registry; with `"git"`
  it pins a `git+https` target to the commit that carries the released code,
  which is why a git index is built *before* committing the regenerated
  artifacts. A version bump picks the current `HEAD` automatically and
  `--commit <sha>` overrides it.
- **Static assets are checked, not trusted.** The SVG icon is inlined as a
  `data:image/svg+xml;base64` URL in the index (the list reject SVG icons, the
  index accepts an inline one), and the builder mirrors the format-1 rules
  (https URLs, 40-hex commit, SemVer, declared category/label ids) so CI can
  validate without DSH installed; the official
  `@deepseek-ai/dsh-plugin-market-index` validator is used when resolvable.
- **README is a listing requirement.** dsh-plugin.org requires the README to
  carry an install command, so `market:check` fails if
  `market/listing.json` `descriptions.install.git` is missing from the README.
- **Discovery is the `dsh-plugin` GitHub topic.** dsh-plugin.org, dshbase,
  dsh-recommend and the aggregators crawl that topic; a listing PR also
  requires it. `pnpm run market:verify` checks the topic, the 24-hour repo-age
  gate, the npm name and that the pinned commit is reachable.

## Checks

`pnpm test && pnpm run lint && pnpm run verify:self-contained && pnpm run market:check && pnpm pack`
