# dsh-translate (local-model edition)

> Host compatibility: DeepSeek Harness `>=0.2.1-0 <0.3.0` (verified on `0.2.1-rc.2`).
>
> GitHub: [sakemo12/harness-lingo-translator](https://github.com/sakemo12/harness-lingo-translator) · based on [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate) (Apache-2.0)

**Translate the whole Web UI into your language — with a translation model you
run locally. Code, paths, commands and proper names stay untouched.**

A full-page translator for DeepSeek Harness. The browser half walks the rendered
DOM, masks everything that must stay verbatim (code blocks and inline code, file
paths, shell commands, URLs, identifiers, versions, hashes, numbers, product
names) into `⟦n⟧` placeholders, and asks the host half to translate the prose.
The host half calls the **local OpenAI-compatible endpoint** that serves the
Hunyuan translation model
([tencent/HY-MT1.5-1.8B-GGUF](https://huggingface.co/tencent/HY-MT1.5-1.8B-GGUF)),
one segment per request, using the **official prompt templates from the model
card**. The browser restores the placeholders and writes the result back into the
same text nodes. The original text stays in memory; one click on "Original"
restores it.

Display-only: **no session log, no workspace file.** Translations live in the
DOM, `localStorage`, and a host-private per-workspace document under
`~/.dsh/cache/dsh-translate/`; the transcript always keeps exactly what the
model said.

> This edition is built around a local OpenAI-compatible endpoint. The optional
> **System model** switch reuses the newest `request/header` provider/model from
> the current session; there is no provider/model dropdown and no conversation
> context is sent.

[English](README.en.md) · [简体中文](README.md)

## What is translated, what is not

| Translated | Kept verbatim |
|---|---|
| Assistant replies, reasoning summaries, prose in tool output | Code blocks and inline code (`code` / `pre`) |
| Markdown headings, lists, tables, link text | File paths, globs, commands and flags, URLs, e-mails |
| Buttons, labels, settings copy | JSON keys, environment variables, `dsh-*` / `snake_case` / `camelCase` identifiers |
| Tool descriptions (the task name) | The command line and output of a terminal card |
| Text from other plugins once it appears | File content (read), diffs, JSON, code blocks |
| — | Blocks that are already Chinese |
| — | Messages sent by the user |
| — | Versions, hashes, plain numbers, the `⟦n⟧` placeholders themselves |
| — | Product names from the glossary: DeepSeek Harness, Cordis, npm, GitHub, Phocinae, … |

Code-like surfaces are recognised by their semantics, not their tag: `pre`
blocks, `[data-terminal]` (terminal card with command and output),
`[data-command-text]`, `[data-read]` (file content), `[data-diff]`,
`[data-json]` and `[data-code]` are skipped; a tool card's title and description
(the task name) are prose and are translated.

**Inline code no longer splits a paragraph**: `<code>` / `<kbd>` / `<samp>` runs
inside prose become `⟦n⟧` placeholders and the paragraph is translated in one
request, with the code element left untouched. `The host <code>resolveConfig</code>
validates …` is sent as one sentence, so `host` is translated with its context
(宿主) instead of as an isolated “主持人”.

Masking targets real code features only: product names match on word boundaries
(`bundle` and `digit` are not hit by `bun` and `git`); a hyphenated word is an
identifier only with a digit (`gpt-4o`) or the `dsh-` prefix, so `fail-closed`
and `state-of-the-art` stay translatable; a slash sequence needs a path boundary
(`/etc/hosts`, `./src/app.ts` are masked; `lost/duplicated/invented` is not);
`HY-MT1.5-1.8B-GGUF`, `1.8B` and `v0.2.1-rc.2` each become one placeholder instead
of several fragments.

A text node with no translatable prose (for example a path or a code fragment) is
skipped. A translation that drops, changes or invents a placeholder — or that is
empty or truncated — is discarded and the segment keeps its original text.

## Deploy the local service first

The plugin neither downloads the model nor starts a server; it only speaks the
OpenAI-compatible protocol to an endpoint you run. llama.cpp with the GGUF
weights is the shortest path:

```sh
llama-server -hf tencent/HY-MT1.5-1.8B-GGUF:Q8_0 \
  --host 127.0.0.1 --port 8080 -c 4096 --jinja
```

Or vLLM with the original weights:

```sh
vllm serve tencent/HY-MT1.5-1.8B --served-model-name hy-mt1.5-1.8b --port 8000
# baseUrl: http://127.0.0.1:8000/v1, model: hy-mt1.5-1.8b
```

If `huggingface.co` is unreachable, point the download at a mirror (llama.cpp and vLLM both honour `HF_ENDPOINT`), or download a GGUF manually and pass `-m /path/to/hy-mt1.5-1.8b-q8_0.gguf`:

```sh
export HF_ENDPOINT=https://hf-mirror.com
```

Check it:

```sh
curl http://127.0.0.1:8080/v1/models
```

The model card recommends `temperature 0.7`, `top_k 20`, `top_p 0.6`,
`repetition_penalty 1.05`; the plugin's defaults match and are sent per request,
so the server defaults do not need to change.

## Install

This repository is a local directory package:

```sh
dsh plugin --profile web add /path/to/dsh-translate
```

or install the directory from the Harness plugin manager. Reload the Web GUI: an
**Auto-translate: off** button appears at the bottom-right. Click it to switch
passive translation on; click again to switch it off and restore the originals.

**Change behavior or credentials:** **Plugins → Installed plugins →
dsh-translate → Configure** opens four tabs: **Connection** (Custom service vs
System model, service address, model, API token), **Translation** (concurrency,
batch reasoning, prompt header, placeholder guard), **Hover** (on/off and delay)
and **Translation cache** (default directory, copy path, prune deleted
conversations). Saving applies immediately, with no restart and no YAML edit.

- **API token** is a write-only secret field: it is never echoed back or included
  in any settings read; leaving it blank keeps the current token, entering a new
  value replaces it. To clear it, delete or empty `apiKey` in the profile (a blank
  form field means "keep").
- The token (and the address/model) live in the profile's `cordis.patch.yml`; the
  plugin only sends it as `Authorization: Bearer` to the configured `baseUrl`.


The first time the switch is turned on, the plugin probes `GET {baseUrl}/models`;
when the service is down the button shows the reason (for example
`cannot reach http://127.0.0.1:8080/v1/models …`) and the page is left untouched.

## When does it translate

The button is a **passive translation switch**, not "translate this page now":

- **Enabling does not translate existing content**: text already on screen and no
  longer changing keeps its original language.
- **Non-Chinese blocks only**: a text node containing two consecutive Chinese
  characters is skipped outright; **quoted citations do not count**, so an
  English sentence quoting a Chinese phrase (`The reply was “好的” and then it
  stopped.`) is still translated. Japanese kana and Korean are not treated as
  Chinese; this rule ignores the target language.
- **User messages are never translated**: `data-chat-flow-kind="user"` and
  `"steering"` nodes are skipped entirely; the composer was never touched.
- **Only after a block finishes generating**: blocks marked `data-streaming` or
  `aria-busy="true"` are skipped; the block is translated once the mark
  disappears. Existing text that is still streaming at enable time is
  translated after it settles.
- **Collapsed content is never translated proactively**: `display:none`,
  `visibility:hidden`, `[hidden]`, `[aria-hidden="true"]` and the body of a
  closed `<details>` are skipped; expanding it (a style/attribute change)
  triggers translation for that text.
- **Content already expanded at enable time is not translated**: only text that
  appears after enabling, or is revealed afterwards, triggers translation (cache
  hits render immediately without a model call).
- **Switching off** restores every translated node to its original text.
- **Switching back on** re-applies translations from the local cache without new
  requests; text without a cached translation still follows the baseline rule.
- **Per-workspace cache document**: successful translations are also written by
  the host to `~/.dsh/cache/dsh-translate/<sha256(workspace)>.json`, one file per
  workspace, never inside the repository. Entries are content-addressed by
  `configHash + masked source`; a different model/prompt/glossary/target/batch
  mode misses, and a changed workspace or conversation can only miss, never map
  a translation onto different text. The file is loaded and applied before new
  requests; writes are debounced and atomic.
- **Collapsed reasoning** uses its visible summary (the first line of the first
  paragraph) as the translation source, shows it in place and truncates the
  display to about 160 characters. A summary that existed before the switch was
  turned on is translated too; the body still waits until it is expanded.
- **Re-renders keep the translation**: expanding a reasoning row makes React
  write the original text back into nodes it controls; when the text matches a
  stored original, the previous translation is re-applied without a request.
- **Hover for the original**: with Auto-translate on, resting the pointer on a
  translated block for the configured delay (200 ms by default; 0 shows it
  immediately) shows that block's original text. Moving **inside the block**
  keeps the original; leaving the block, scrolling, or leaving the page restores
  the translation. The preview scope is the nearest block ancestor (paragraph,
  list item, ...) so a leading icon counts, but it is used only when every
  translated node in it shares one direct parent, so a neighbouring paragraph is
  never restored. The settings form has an on/off switch and the delay; toggle
  Auto-translate off and on after saving.

## Request protection

The service is a small local model (LM Studio / llama.cpp often has a single
instance and JIT model loading), so the plugin hard-limits its request rate:

- **At most 3 attempts per segment**, spaced 5 s / 20 s / 60 s; afterwards the
  segment stays original until its text changes, a cache hit, or the switch is
  toggled. Failures are never cached.
- **Serial scans + in-flight deduplication**: only one scan runs at a time, and a
  segment currently being translated is never sent again because the page kept
  changing.
- **No global pause**: a failed batch only backs off the failing segments
  (5 s / 20 s / 60 s); newly appeared segments are sent immediately instead of
  waiting 30 s.
- **Concurrency defaults to 2**: use `concurrency: 1` for LM Studio JIT loading;
  llama.cpp / vLLM can take 2–4.

## Prompts

The prompts are the official templates from the model card. No system prompt is
sent — the card states the model has no default system prompt.

**ZH⇄XX** (used automatically for Chinese targets):

```text
将以下文本翻译为{target_language}，注意只需要输出翻译后的结果，不要额外解释：

{source_text}
```

**XX⇄XX** (used automatically for every other target):

```text
Translate the following segment into {target_language}, without additional explanation.

{source_text}
```

**Batched reasoning** (setting `batchReasoning`, off by default): when on, the
paragraphs of one reasoning block (`data-variant="think"` in the UI) are sent in
numbered batches of up to 8 segments (measured 4/4 at 8 segments; `<sn>`, JSON
and delimiter formats merged segments in Chinese and are not used):

```text
Translate the following numbered lines into {target_language}, without additional explanation. Each numbered line is one segment: keep the same number of lines, the same numbering and order; do not merge or split segments. Keep placeholders like ⟦0⟧ exactly as they appear.

1. {segment_1}
2. {segment_2}
```

The answer is split by numbering and each segment is verified; when the numbering
is unusable or a segment lost a placeholder, that batch falls back to
per-segment requests, so nothing is dropped. Toggle Auto-translate off and on
after saving, because the mode is read when the switch starts.

The clause is configurable in the settings form:

- **Keyword retention via text masking** switches it off for placeholder-bearing
  requests (the segment is still translated, but the model may rewrite the
  tokens).
- **Custom keyword-retention prompt** (shown only while the box is checked)
  replaces the built-in sentence and is inlined into the instruction (not a
  separate line, so the model does not translate it); blank uses the built-in.

**Placeholder clause.** A segment that contains `⟦n⟧` placeholders gets one more
clause (measured: the 1.8B model rewrites a bare `⟦0⟧` into `《0》` or drops it;
with the clause 30/30 segments kept their placeholders). Segments without a
placeholder keep the pristine template above, because the clause itself leaks
into the answer otherwise:

```text
Translate the following segment into {target_language}, without additional explanation. Keep placeholders such as ⟦0⟧ exactly as they appear.

{source_text}
```

**Terminology intervention** (appended when `source=target` glossary pairs exist):

```text
参考下面的翻译：
{source_term} 翻译成 {target_term}

将以下文本翻译为{target_language}，注意只需要输出翻译后的结果，不要额外解释：
{source_text}
```

`promptTemplate` is `auto` (default), `zh`, `en` or `custom`. With `custom`,
`customTemplate` is required and supports `{source_text}` (mandatory),
`{target_language}`, `{target_lang}` and `{glossary}`.

## Two backends

The Connection tab has two mutually exclusive checkboxes: **Custom service** and
**System model**.

- **Custom service (default):** local OpenAI-compatible HY-MT service.
- **System model:** the host integration — the host calls `llm.stream` with
  the newest `request/header` provider/model and sends masked segments as a JSON
  array. No conversation context and no model cache hints are sent. Send one
  message first when no route exists.
- There is no provider/model dropdown or add-model entry; the DSH session route
  decides the model.

**Translation prompt header** (`promptHeader` in the form) is the instruction
line for every translation and replaces the built-in instruction (per-segment
and batched). It defaults to `将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释`,
supports `{target_language}` and `{target_lang}`, and is Chinese-specific: for
other targets change it to the matching instruction, or leave it blank to use
the built-in template. It takes effect on the next translation after saving.

> The service port is not restricted: the host uses `node:http`, not the
> browser-style `fetch`, which rejects WHATWG bad ports such as 123 (`bad port`).

## Configuration

Every key in `cordis.patch.yml` is a Schemastery field; an invalid value fails
the profile load loudly. `baseUrl` and `model` are volatile fields, editable in
the Plugins page's Configure form with immediate effect; the others are edited in
`cordis.patch.yml`.

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch; `false` mounts nothing |
| `systemModel` | `false` | Use the newest `request/header` provider/model (host integration) instead of the local service |
| `baseUrl` | `http://127.0.0.1:8080/v1` | OpenAI-compatible API root, **including the `/v1` segment** |
| `apiKey` | `''` | Optional bearer token; editable in the form, never echoed back, blank keeps the current value |
| `model` | `hy-mt1.5-1.8b` | `model` field of the request; llama.cpp ignores it, vLLM needs the served name |
| `targetLang` | `''` | Target language; empty follows the Web GUI locale (browser language on an English UI) |
| `promptTemplate` | `auto` | `auto` / `zh` / `en` / `custom` |
| `customTemplate` | `''` | Required with `custom`; must contain `{source_text}` |
| `promptHeader` | `将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释` | Translation instruction header, replaces the built-in sentence; `{target_language}` supported; editable |
| `placeholderGuard` | `true` | Keyword retention via text masking: whether placeholder-bearing requests get the retention sentence; editable |
| `placeholderHint` | `''` | Custom retention sentence replacing the built-in one; blank uses the built-in; editable in the form |
| `hoverRestore` | `true` | Show a block's original text after a stationary hover while Auto-translate is on |
| `hoverRestoreMs` | `200` | Hover delay in milliseconds (0–60000; 0 shows the original immediately) |
| `glossary` | `[]` | Plain entries stay verbatim; `source=target` entries become terminology pairs |
| `temperature` | `0.7` | Sampling temperature (model-card recommendation) |
| `topP` | `0.6` | `top_p` (model-card recommendation) |
| `topK` | `20` | `top_k` (model-card recommendation); `0` omits the field |
| `repetitionPenalty` | `1.05` | `repetition_penalty` (model-card recommendation); `0` omits the field |
| `maxTokens` | `2048` | Max generated tokens per segment; a truncated segment keeps its original |
| `concurrency` | `2` | Parallel requests (1–16); editable in the form; 1–2 for a single-instance / JIT-loaded model |
| `batchReasoning` | `false` | Batch one reasoning block into numbered requests; editable in the form |
| `timeoutMs` | `60000` | Per-request deadline in ms (1000–600000) |
| `retries` | `1` | Retries for transient failures (network, 429, 5xx), 0–3 |

If a strict OpenAI server rejects `top_k` / `repetition_penalty`, the plugin
retries once without those two extensions.

Example: translate to Japanese, pin an internal term, and protect a product name:

```yaml
- id: dsh-translate
  name: dsh-translate
  config:
    enabled: true
    baseUrl: http://127.0.0.1:8080/v1
    model: hy-mt1.5-1.8b
    targetLang: ja
    glossary:
      - Acme Ledger
      - 工单=チケット
```

> An id override replaces the row's whole `config`; write the complete object
> rather than a partial merge.

## Cost and privacy

- **Only new or newly revealed text**: the switch is off by default; when on, it
  translates completed new blocks and folded content expanded afterwards.
  Existing on-screen text is not scanned or translated.
- **Two backends**: the default sends only to your local `baseUrl`; with
  **System model** selected it does not call the local service and instead uses
  the host `llm` service with the newest session `request/header`
  provider/model, sending a standalone JSON array of masked segments with no
  conversation context and no model-side cache hints.
- **Cache**: the same source segment (same target language) is translated once
  and cached in `localStorage` (600 entries), and the host writes a per-workspace
  document at `~/.dsh/cache/dsh-translate/<sha256(workspace)>.json` (5000-entry
  LRU, filtered by config hash); clearing site data or deleting that directory
  removes it.
- **What leaves the page**: only prose after protected spans were masked; paths,
  code, commands and secret-shaped identifiers are not sent as translatable text.
- **No session or workspace write**: translations live in the DOM and the two
  caches above; the session log, workspace files and DSH config are never
  written.
- **Credentials**: `apiKey` is sent only as a bearer header to the configured
  endpoint and never appears in `status()` or an error message.

## Known limits

- Translation happens in the render layer: when React re-renders a node the
  MutationObserver re-applies the cached translation (without another model
  call), and an extremely short flicker is possible.
- Streaming blocks are detected through `data-streaming` / `aria-busy`; without
  such a marker the plugin waits for a 350 ms quiet period before translating.
- **One request per segment**: a 40-segment page makes 40
  `/chat/completions` calls, bounded by `concurrency`. A local 1.8B model is
  fast, but the first screen still takes a few seconds.
- No OCR for images, Canvas or PDF previews.
- Folded content (hidden dialogs, collapsed reasoning/tool output) is not
  translated before it is expanded; expanding triggers it, and cached text needs
  no new request.
- The baseline is per text node: when the UI re-renders the same text into a new
  node (for example virtual scrolling removing and re-inserting it), that node
  counts as new content and is translated once.
- The model supports 33 languages; the UI already ships 8 built-in locales. The
  plugin translates **content** and third-party English copy, it does not
  replace the built-in locale files.
- Placeholder handling is not 100% stable; a failed segment keeps its original
  text instead of corrupting the page.

## Development

```sh
pnpm install
pnpm test        # 152 cases: prompt templates, glossary, placeholders, HTTP, concurrency/retries, DOM/heights, cache, settings, descriptor parity
pnpm run lint
pnpm run verify:self-contained
```

- `index.mjs` — host entry (Config + `resolveConfig` + service mount)
- `lib/service.mjs` — `translatePage` Typert service (status / translate / cache / workspace)
- `lib/engine.mjs` — official prompts, glossary, HTTP call, concurrency, cleaning
  and placeholder verification (no cordis, no DOM; unit-test seam)
- `lib/cache.mjs` — per-workspace cache documents: atomic write and LRU bound
- `lib/session-backend.mjs` — the system-model session route
- `lib/transport.mjs` — `node:http`/`node:https` transport with a fetch shape
- `lib/wire.mjs` — invocation descriptors shared by both halves
- `typert.host.mjs` — host Typert manifest
- `client/index.js` — hand-written client bundle: DOM walk, masking, cache, hover, block-height pinning, floating button and settings page
- `locale/*.json` — plugin-manager title and description
- `test/*.test.mjs` — `node --test` (jsdom DOM tests and a real loopback HTTP test)

## License

Apache-2.0. Copyright 2026 PerryLink; modifications Copyright 2026 sakemo12.
Based on [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate),
a community plugin not affiliated with DeepSeek. See [LICENSE](LICENSE),
[NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
