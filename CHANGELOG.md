# Changelog

> 1.14.0 renamed the project from `dsh-translate` to
> `harness-lingo-translator`. Entries before 1.14.0 use the old name.

## [1.14.1] - 2026-11-26

### Changed

- Trimmed the npm tarball to the plugin plus the documents it needs: the shipped
  set is `index.mjs`, `typert.host.mjs`, `lib/`, `client/`, `locale/`, `icon.svg`,
  `cordis.patch.yml`, `scripts/migrate-profile.mjs`, `README.md`, `CHANGELOG.md`,
  `LICENSE`, `NOTICE` and `THIRD_PARTY_NOTICES.md`. `PRIVACY.md`, `SECURITY.md`
  and `README.en.md` stay in the repository only (npm force-includes every
  `README*`, so `README.en.md` still appears in the tarball).
- No runtime change.

## [Unreleased]

### Changed

- The 关键词保留 hint now notes that the default mode is already highly
  accurate and that enabling keyword retention may actually introduce errors.

## [1.15.0] - 2026-11-28

### Added

- A configurable mask template, `placeholderFormat` (Settings → Translation →
  遮罩格式 / Mask format). The first `n` is the slot number, so `[n]`, `{{n}}` and
  `⟦n⟧` all work; the default is `[n]`. Client and host build their tokens and
  regex from the same template, `status()` exposes it, and cache entries are
  keyed by it. Invalid templates (no `n`, only `n`, over 24 characters) are
  rejected.
- The settings hint now notes that keyword retention is demanding for small
  models and may require a smarter model.

### Changed

- The default mask format is now `[n]` instead of `⟦n⟧`. The built-in retention
  sentence and the system-model prompt use the configured format; a saved hint
  that still contains legacy `⟦n⟧` tokens is adapted to the active format.
- The setting formerly titled 基于文字遮罩的关键词保留 / “Keyword retention via
  text masking” is now 关键词保留 / “Keyword retention”, and the mask template is
  a separate field.

### Fixed

- Translation is strictly scoped to the conversation flow column
  (`div.EvIC1a_column[data-chat-flow]`). The sidebar, settings page, file viewer,
  composer and the floating control are never walked, baselined or requested;
  the DOM tests now mount their fixtures inside that column, and a regression
  test asserts that text outside it stays original.
- Turning off "关键词保留" / "Keyword retention" (`placeholderGuard: false`)
  now sends the plain source text: no masks, no inline-code placeholders, no
  retention clause and no placeholder verification (a literal token in prose is
  content, not a token). `status()` exposes the setting to the client, and
  re-toggling Auto-translate picks it up.
- The source text in a translation request no longer starts with a blank line:
  the instruction is joined to the source without `\n\n`, and leading whitespace
  plus literal `\n` / `\"` escape sequences are stripped. JSON still escapes
  quotes and newlines on the wire; the model receives the decoded text.
- A relative path with a directory and a known extension is masked as one
  placeholder (`client/index.js`), not `client/[0]`. The latter made HY-MT drop
  or rewrite the adjacent placeholder, so the fail-closed guard discarded an
  otherwise good translation.
- Text that was already visible when the switch was first turned on is no longer
  translated from a warm cache. `reapplyCached()` restores only segments
  translated in this page session (`translatedKeys`), so the baseline wins on a
  fresh start, while re-enabling still restores translated segments without new
  requests. Regression tests cover plain text, inline-code paragraphs and the
  selective re-enable case.
- Expanding a reasoning row no longer translates the already-visible parent
  layer. Baseline is also remembered per `[data-chat-flow-key]` + text, so a
  React re-render that replaces the parent subtree is treated as baseline while
  the newly revealed reasoning body still translates.
- A collapsed reasoning summary that was already visible no longer bypasses the
  baseline. The old `releaseThinkSummaries` / `forceTranslatable` exception was
  removed; only a newly appeared or newly revealed summary is translated and
  truncated to `THINK_SUMMARY_MAX`.
- The floating switch is no longer disabled while translating; clicking it stops
  the run and restores the originals. Error messages are localized (Chinese in a
  Chinese UI), shown above the button instead of beside it, and unknown details
  keep a localized prefix.

### Removed

- The one-time marketplace scaffolding: `market/submissions/` (regenerated on
  demand by `pnpm run market:build` and now gitignored), the
  `scripts/submit-market.mjs` helper that filed the listings, and the
  unreferenced `CODE_OF_CONDUCT.md`. Only `market/index.json` and
  `market/listing.json` stay versioned.

### Added

- Marketplace distribution under `market/`: a format-1 plugin-market index
  (`market/index.json`) that DSH's experimental **Discover** tab can add as an
  index source, plus ready-to-submit artifacts for dsh-plugin.org, dshbase,
  awesome-dsh-plugin, awesome-DSH-plugin (Alex-Yanggg) and dsh-suite. All copy
  comes from `market/listing.json` through `scripts/build-market.mjs`
  (`pnpm run market:build` / `market:check` / `market:verify`); `market:check`
  also runs in CI.
- A manual **Publish to npm** workflow (`.github/workflows/publish-npm.yml`).
  It is not wired to a tag: the Release workflow stays GitHub-Release-only, and
  publishing `harness-lingo-translator` needs an `NPM_TOKEN` secret and a
  deliberate Run workflow.
- README install section now documents the npm, GitHub and local-directory
  commands (dsh-plugin.org requires an install command in the README).

### Changed

- Published to npm as `harness-lingo-translator@1.14.0` (2026-11-25); the
  marketplace index now installs from the registry (`name@version`) instead of a
  commit-pinned git URL, and the READMEs lead with the npm command.
- The repository icon's `aria-label` is the current package name.
- Listed and verified on dsh-plugin.org (2026-11-21); the repository now carries
  the `dsh-plugin` topic set that DSH directories crawl, and both READMEs carry
  the listing badge. The awesome-dsh-plugin entry was merged on 2026-11-24.
  Submission state lives in `market/README.md`.

## [1.14.0] - 2026-11-21

### Breaking

- Renamed the package and plugin row ID from `dsh-translate` to
  `harness-lingo-translator`. The settings form key is now
  `harness-lingo-translator#harness-lingo-translator`, the client loader ID and
  Typert package IDs use the new name, the host cache moved to
  `~/.dsh/cache/harness-lingo-translator/`, and the browser cache key is now
  `harness-lingo-translator:cache:v2`.

### Added

- `scripts/migrate-profile.mjs` migrates an existing profile: it updates the
  dependency and `dsh.profile.bundles`, renames the matching patch row while
  preserving its config, and copies the old cache directory. See the README's
  upgrade section; restart DSH after running it.
- The cache reads the pre-rename directory and the old localStorage key as
  fallbacks, merges the old document on every load, and seeds the new document
  from it when it does not exist, so an upgrade does not lose cached
  translations.

### Changed

- The release workflow now creates a GitHub Release only; it no longer publishes
  to npm, which avoids attempting a publish under a package name this fork does
  not own.
- Metadata, NOTICE, third-party notices and READMEs point at
  `sakemo12/harness-lingo-translator` while retaining the upstream
  `PerryLink/dsh-translate` copyright and attribution.
- Removed the stale 0.3.6 README hero/flow/demo assets; they described the old
  session-route backend and a 32-test demo.

## [1.13.2] - 2026-11-21

### Fixed

- A translated block no longer reflows when the translation wraps differently
  from the original: its nearest block-level ancestor is pinned with an inline
  `min-height` equal to the larger of the original and translated rendered
  heights. The height is content-box aware (`offsetHeight` first, transformed
  rect only as a fallback), previewing the original on hover keeps the pinned
  height, and switching translation off restores the page's own inline value.
  Only height is pinned; width is untouched.

## [1.13.1] - 2026-11-21

### Fixed

- Saving the system model now writes the Host config field `systemModel`. The
  settings form had been writing `sessionModel`, which the settings service
  rejects as a non-volatile field, so every save was refused and the note
  blamed unrelated `baseUrl`/`model`/`concurrency` values. The rejection note
  now names the real cause (host rejected the write / host is an older version).
- The translation-cache notes use their registered dictionary keys. A cache
  write that throws synchronously (for example a Host started before the cache
  invocations were loaded) no longer escapes the debounce timer or loses its
  entries: the translations stay queued for the next flush instead of retrying
  in a 50 ms loop. Restart DSH after updating so the Host half exposes
  `loadCache` / `saveCache` / `workspace`; the cache file itself was already
  correct once those invocations are mounted.

## [1.13.0] - 2026-11-21

### Added

- Paragraph-level translation for prose with inline code: `<code>` / `<kbd>` /
  `<samp>` runs become placeholders, the whole paragraph is sent as one unit,
  and the code elements stay untouched. This restores context across inline code
  (e.g. `The host <code>resolveConfig</code> validates …` now translates “host”
  as 宿主 instead of 主持人). Cached paragraphs reuse the same combined source.

## [1.12.1] - 2026-11-21

### Fixed

- Removed the 30 s global pause (client and host) after repeated whole-batch
  failures; translation reports the actual error and retries new segments
  immediately. Per-segment retry caps and backoff remain.
- Saving the system model no longer requires valid local `baseUrl`/`model`
  values: local validation is skipped while `systemModel` is true (so the
  settings checkbox can be saved).
- Workspace cache files are now actually written: the client session controller
  exposes no session list, so the old workspace lookup always failed and the
  cache load/save was skipped. The host `workspace` invocation resolves
  `sessions.get(id).header.cwd`; cache pruning is host-side too.
- The original upstream translation service (host `llm` route, JSON batches) is
  kept and named **系统模型**. The settings checkbox is clickable again (it was
  wired to a removed handler). It persists `systemModel`, shows the upstream
  route hint, and hides local-only fields while selected. No provider/model
  dropdown or add-model entry is included.

## [1.8.0] - 2026-11-21

### Added

- Per-workspace translation cache documents at
  `~/.dsh/cache/dsh-translate/<sha256(cwd)>.json`. Entries are content-addressed
  by `configHash + masked source`, include session/message metadata for
  inspection, are filtered by the current config on load, and are written with a
  debounced atomic rename and a 5000-entry LRU bound. The host exposes
  `loadCache`/`saveCache`; `status()` now returns `configHash`. The browser
  resolves the current workspace from `[data-conversation-session]` and the
  sessions catalog, loads the file before translating, and saves successful
  translations without touching the workspace itself.

## [1.7.2] - 2026-11-21

### Fixed

- Expanding a reasoning row (or any React re-render) no longer reverts a
  translated node to English: when the app writes back the same original text,
  the stored translation is immediately re-applied without a new request. This
  fixes both the collapsed summary and the expanded body.

## [1.7.1] - 2026-11-21

### Added

- Turning Auto-translate back on re-applies cached translations immediately, so
  previously translated text shows its translation again without new requests.
- Collapsed reasoning rows translate their visible summary (the first paragraph
  excerpt) in place, truncated to about 160 characters. Such summaries are
  translated even when they already existed before the switch was turned on;
  the hidden body still waits for expansion.

## [1.7.0] - 2026-11-21

### Changed

- The default placeholder-retention sentence is now: “原文中的⟦0⟧、⟦1⟧、⟦2⟧
  这类占位符必须原样保留，你可以把占位符当做未知内容（一般是专有名词、数值、
  代码块）插入翻译好的句子，但不要把括号里的编号当做数字翻译进内容里”.
- The default hover delay is 200 ms (was 1500 ms).
- “Additional prompt header” is now **Translation prompt header**: it is the
  instruction line and replaces the built-in instruction, defaulting to
  “将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释”; it supports
  `{target_language}`/`{target_lang}` and is ignored for non-Chinese targets
  while the default is unchanged.
- The guard setting is renamed **基于文字遮罩的关键词保留** with the new
  explanation; its custom sentence field is “自定义关键词保留提示词” and only
  appears when the box is checked.
- The component settings form is grouped into 连接 / 翻译 / 悬停, has larger
  section titles (15px) and labels (14px), and the API token moved directly
  under the model name. The hover delay input only appears while enabled.

## [1.6.2] - 2026-11-20

### Fixed

- The hover preview scope is now the nearest block ancestor (paragraph, list
  item, ...) of the hovered element, so resting on a leading icon previews the
  text beside it. The scope is used only when every translated node inside
  shares one direct parent, so a neighbouring paragraph is never restored; with
  several text parents only the hovered element's own text is previewed.

## [1.6.1] - 2026-11-20

### Fixed

- Hover restore now accepts `hoverRestoreMs: 0`, which shows the original as
  soon as the pointer is over a translated block.
- Moving inside the previewed block keeps the original text; the translation
  returns only after leaving the block (or scrolling / leaving the page).
- Preview scope is the direct parent of the translated text nodes, so moving
  onto a container (for example `<body>`) no longer previews unrelated text.

## [1.6.0] - 2026-11-20

### Added

- **Hover restore**: while Auto-translate is on, resting the pointer on a
  translated block for `hoverRestoreMs` (default 1500 ms) shows that block's
  original text; any pointer movement, scroll or leave restores the translation.
  Both `hoverRestore` (on/off) and `hoverRestoreMs` (200–60000) are editable in
  the row settings form and apply after toggling Auto-translate off and on.

## [1.5.1] - 2026-11-20

### Fixed

- Quoted citations no longer make an English block look Chinese: `“…”`, `「…」`,
  `『…』`, `‘…’` and `"…"` are ignored for the two-CJK test, so an English
  sentence quoting a Chinese phrase is translated. A Chinese sentence quoting
  English still counts as Chinese and is skipped.

## [1.5.0] - 2026-11-20

### Changed

- The browser now skips text blocks that are already Chinese (two consecutive
  CJK ideographs; kana and Hangul are not treated as Chinese), regardless of the
  target language.
- Messages sent by the user (`data-chat-flow-kind="user"` / `"steering"`) are
  never translated.

## [1.4.0] - 2026-11-20

### Added

- The placeholder-retention sentence is configurable in the row settings form:
  - `placeholderGuard` (default `true`) switches it off for requests that carry
    `⟦n⟧`;
  - `placeholderHint` (default empty) replaces the built-in sentence and is
    inlined into the instruction, so the model does not translate it as content.

## [1.3.0] - 2026-11-20

### Added

- **Additional prompt header** (`promptHeader`, empty by default, editable in
  the row settings form). A non-empty value is prepended to every translation
  prompt (per-segment and batched) with one blank line, for tone or style
  instructions; it is applied on the next translation, without a restart.

## [1.2.1] - 2026-11-20

### Fixed

- Over-masking of ordinary prose:
  - product terms are now matched with word boundaries, so `bun` no longer
    matches inside `bundle` and `git` no longer matches inside `digit` or
    `legitimate`;
  - a hyphenated word is an identifier only when it carries a digit
    (`gpt-4o`, `x86-64`) or the `dsh-` prefix, so `fail-closed` and
    `state-of-the-art` are translated;
  - a slash sequence is a path only at a path boundary, so
    `lost/duplicated/invented` is no longer masked;
  - `HY-MT1.5-1.8B-GGUF` is one placeholder, and versions with a letter suffix
    (`1.8B`) no longer split into `1.8` + `B`.
- Measured over 60 historical reasoning paragraphs against the reference
  deployment: failures dropped from 17 to 14, and every remaining mask is a
  genuine product/version/identifier/number token (the remaining failures are
  segments with 4–11 placeholders, where the 1.8B model drops one).

## [1.2.0] - 2026-11-20

### Added

- **Batch reasoning requests** (`batchReasoning`, off by default, editable in the
  row settings form). The browser groups the paragraphs of one reasoning block
  (`[data-variant="think"]`) and the host translates up to 8 of them in one
  numbered-lines request, instead of one request per paragraph. The answer is
  split by numbering and verified per segment; an unusable answer falls back to
  per-segment requests. Measured against the reference deployment: 6 segments in
  1 request, no failures.

## [1.1.2] - 2026-11-20

### Fixed

- Command lines and terminal output were translated because the app renders
  them as spans inside `[data-terminal]`, not as `<pre>`/`<code>`. The browser
  half now skips the app's semantic code surfaces: `[data-terminal]`,
  `[data-command-text]`, `[data-read]`, `[data-diff]`, `[data-json]` and
  `[data-code]`. Tool descriptions (the task name shown on the tool card) stay
  prose and are translated as before.

## [1.1.1] - 2026-11-20

### Fixed

- **Request storm / runaway retries.** A segment that failed translation was
  requested again on every DOM mutation, and scans could overlap while a slow
  batch was in flight, multiplying identical `/chat/completions` requests (a
  service log showed one sentence requested 28,805 times). Now:
  - scans are serialized (one at a time, with a single folded follow-up),
  - segments in flight are deduplicated,
  - a failing segment gets at most 3 attempts (5 s / 20 s / 60 s) and is then
    left in its original language until its text changes or the switch is
    toggled; failures are not cached,
  - three whole failed batches in a row pause requests for 30 s, in both the
    browser half and the host service.

### Changed

- `concurrency` defaults to `2` (was `4`); the profile row uses `2`. A
  single-instance / JIT-loaded model (LM Studio) should use `1`.
- `concurrency` is now a volatile Config field and is editable in the row's
  settings form (an integer from 1 to 16).

## [1.1.0] - 2026-11-20

### Changed

- The floating button is now a **passive translation switch** instead of a
  translate-this-page action. Enabling it does not translate existing content;
  switching it off restores every translated node.
- **Per-block completion**: text inside `[data-streaming]` or
  `[aria-busy="true"]` is skipped and translated once the mark disappears.
- **Collapsed content is never translated proactively**: hidden elements,
  `aria-hidden` subtrees and closed `<details>` bodies are skipped; expanding
  them triggers translation for the revealed text.
- **Baseline**: text that was already rendered and visible at enable time is
  left in its original language unless its content later changes (for example a
  block still streaming at enable time).
- The DOM observer now also watches `style`, `class`, `open`, `hidden`,
  `aria-hidden`, `aria-busy`, `data-streaming` and `data-expanded` so expansion
  and generation completion retrigger a scan.
- The row configuration form gained a write-only **API token** field.
  `apiKey` is a volatile `role('secret')` field, so the settings service strips
  it from every read; leaving the input blank keeps the current token.

## [1.0.0] - 2026-11-19

### Changed (breaking)

- The translation backend is now a **local OpenAI-compatible endpoint**
  (`baseUrl`) serving `tencent/HY-MT1.5-1.8B-GGUF`. The session model route,
  `provider`/`model` route config, `reasoningEffort`, the `sessions`/`llm`
  injection and the `BlockAssembler` stream handling are removed.
- Prompts are the official model-card templates (ZH⇄XX, XX⇄XX, terminology
  intervention) instead of the JSON-array batch prompt. Each masked segment is
  one `/chat/completions` request, bounded by `concurrency`.
- New settings: `baseUrl`, `apiKey`, `model`, `promptTemplate`,
  `customTemplate`, glossary pairs (`source=target`), `temperature`, `topP`,
  `topK`, `repetitionPenalty`, `maxTokens`, `concurrency`, `timeoutMs`,
  `retries`. `maxSegments` / `maxChars` are gone.
- `status()` / `translate()` results carry `baseUrl`, `model` and `glossary`
  instead of `provider`.
- A strict OpenAI server rejecting `top_k` / `repetition_penalty` is retried
  once without the extensions; truncated output (`finish_reason: length`) keeps
  the original segment.
- HTTP goes through `lib/transport.mjs` (`node:http`) instead of global `fetch`,
  so services on WHATWG bad ports such as 123 work (measured against a LAN
  deployment; `fetch` failed with `bad port`).
- Masked segments get a placeholder-retention clause; plain segments keep the
  pristine model-card template because the clause leaks into their answer.
  Measured on the reference deployment: bare `⟦0⟧` was rewritten to `《0》`
  without the clause; 30/30 segments preserved it with the clause.
- Plugin-manager metadata: `locale/en.json`, `locale/zh.json` and the `./icon`
  export.
- A configuration page for the row on the Plugins page
  (`plugins.row.config`, key `dsh-translate#dsh-translate`) with **Service
  address** and **Model name**. `baseUrl` and `model` are volatile Config fields,
  so a save applies live through the settings service without a restart.

### Removed

- `@deepseek-ai/dsh-llm` and `@deepseek-ai/dsh-session` usage, `test/route.test.mjs`,
  and the Spanish / Portuguese / Hindi READMEs (they documented the old backend).

## [0.3.5] - 2026-11-09

### Changed

- Re-release from the 0.3.4 tree to attach SLSA provenance via npm trusted publishing.
- Added `repository`/`homepage`/`bugs` metadata, required for npm provenance validation.
  No runtime change.

## [0.3.4] - 2026-11-09

### Fixed

- Command masking now protects a command with a known subcommand (`npm test`, `git status`,
  `curl https://...`) before the bare product-term rule, without swallowing ordinary prose after
  a command word. Adds regression tests.

## [0.3.3] - 2026-11-09

### Fixed

- All five README editions now state that hidden elements are translated when they become visible,
  matching the implementation (repo `57de189`). No runtime change.

## [0.3.2] - 2026-11-08

### Added

- Five-language READMEs: the Spanish, Brazilian Portuguese and Hindi editions are full translations of the
  English source, and every edition now carries the language switcher. No runtime change.

## [0.3.1] - 2026-11-08

### Changed

- Document the 0.2.x migration explicitly in both READMEs: `dsh-translate` 0.3.0+ is the full-page translator;
  the former vendor-parameter + JSON-repair plugin is `dsh-param-repair`, and old config keys are ignored
  rather than rejected.

### Fixed

- README test count matches the repository again (21 cases).
## [0.3.0] - 2026-11-08

### Added

- **Full-page translation driven by the user's own model route.** The browser half walks the rendered DOM, masks code, paths, commands, identifiers, versions, hashes, numbers and product names into `⟦n⟧`, and sends the remaining prose to the `translatePage` Typert service; the host half resolves the route from the newest live `request/header` (or an explicit `provider`/`model` pair) and calls `ctx.llm.stream`.
- **Display-only by construction.** No session event, no workspace write, no on-disk translation cache: originals stay in memory, the floating control restores the page, and translations are cached in browser `localStorage` (600 entries).
- **Fail-closed merging.** A translation that loses, renumbers or invents a placeholder keeps its original text; a segment with no prose left is never sent. The render-layer mutation observer re-applies cached translations after React re-renders without calling the model again.
- **Bounded calls.** `maxSegments` (40), `maxChars` (6000) and `timeoutMs` (60000) bound every model call; the glossary keeps extra product names verbatim.
- Hand-written client bundle (no build step) with a Typert descriptor parity test, plus jsdom coverage for the DOM engine.

### Known limits

- Render-layer translation can flicker when React re-renders a node; streaming text is translated after a 350 ms quiet period.
- Images, Canvas and PDF previews are not OCR'd; hidden elements are translated when they become visible.

## Historical: abandoned 2.x experiment

The following entries describe a 2.x branch that was rolled back before the
current 1.x line. They are kept for reference and are not part of the current
release history.

## [2.2.0] - 2026-11-21

### Removed

- Rolled back the system-model backend and its settings (provider/model route,
  model dropdown, add-model link, `sessionModel`/`systemProvider`/`systemModel`
  config, `routes` invocation). The **System model** checkbox remains as a
  placeholder: checking it shows one explanation sentence; translation always
  uses the custom/local service. The cache tab and prune action are unchanged.

## [2.1.1] - 2026-11-21

### Fixed

- The system-model dropdown now reads the reachable DSH sources instead of only
  live session headers: host `llm.listProviders()` + `listModels(provider)` and
  the `settings.describe()` document are merged with session `request/header`
  routes. A loading hint is shown while the catalog is read; provider catalog
  failures are ignored so session routes remain available.

## [2.1.0] - 2026-11-21

### Changed

- The plugin settings page is now four top tabs (连接 / 翻译 / 悬停 / 翻译缓存);
  only the selected tab's fields are shown.
- Connection uses two mutually exclusive checkboxes: **自定义服务** (local
  endpoint) and **系统模型** (DSH user-settings models). System model adds a
  route dropdown fed by live-session `request/header` routes, an “添加模型…”
  link to DSH Settings → Models, and “刷新模型列表”.
- New **翻译缓存** tab: shows `~/.dsh/cache/dsh-translate/`, copies the path, and
  prunes entries whose session id is no longer in the DSH session list.
- All settings strings were re-checked for zh/en parity; local-only fields
  (concurrency, prompt header, guard) are hidden while the system model is
  selected.

## [2.0.0] - 2026-11-21

### Added

- **Session-model backend** (the original upstream integration): the Connection
  settings section now has a “Use the session model (original integration)”
  checkbox. When checked, the host resolves the newest `request/header`
  provider/model from the live sessions and calls `llm.stream` with a JSON array
  of masked segments. No conversation context and no model-side cache hints are
  sent; the local address/model/token are disabled. When unchecked the local
  HY-MT backend is unchanged.
