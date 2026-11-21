# Harness Lingo Translator

> Use an LLM to translate DeepSeek Harness reasoning and execution, showing the result in the frontend without polluting the context — making Vibe Coding easier for non-native English speakers. Supports local translation services (hy-mt1.5-1.8b recommended), translation history cache, hover comparison, custom prompts, and more settings.

> Refactored from the previous repository [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate); original copyright PerryLink. Current repository: [sakemo12/harness-lingo-translator](https://github.com/sakemo12/harness-lingo-translator). Renamed from `dsh-translate` to `harness-lingo-translator` in 1.14.0.

[English](README.en.md) · [简体中文](README.md)

## New features

- **Frontend-only display, no context pollution**: changes only the rendered DOM — no session log, no workspace file, no DSH config write. Originals stay in memory and return when translation is switched off.
- **Two backends**: the local OpenAI-compatible service by default, or **System model**, which reuses the newest `request/header` provider/model from the current session without sending conversation context.
- **Reasoning and execution prose**: translates reasoning summaries, tool output and assistant replies; `batchReasoning` merges paragraphs of one reasoning block, and streaming blocks wait until they finish.
- **Translation history cache**: browser `localStorage` (600 entries) plus a host-private per-workspace document at `~/.dsh/cache/harness-lingo-translator/<sha256(workspace)>.json` (5000-entry LRU, filtered by config hash); re-enabling the switch or a React re-render reuses it instantly.
- **Hover comparison**: a stationary hover shows the original and moving away restores the translation; the block height is pinned to the larger of the original/translated heights so the list does not jump.
- **Custom prompts**: prompt header, templates (`auto` / `zh` / `en` / `custom`), terminology glossary, and the placeholder-retention switch with a custom sentence.
- **Content fidelity**: code, paths, commands, URLs, identifiers, versions, hashes, numbers and product names are masked as `⟦n⟧`; a translation that loses, renumbers or invents a placeholder — or is empty — keeps the original. Inline code is one placeholder, so a paragraph is not split.
- **More settings**: four tabs — Connection, Translation, Hover, Translation cache — for concurrency, batching, prompts, cache cleanup and more.
- **Passive translation**: content already visible when the switch is enabled stays original; only new, changed or newly revealed content is translated.
- **Migration compatibility**: existing `dsh-translate` settings are preserved; the old cache directory and localStorage key are merged as fallbacks.

## Quick start

### 1. Start a local translation service

`hy-mt1.5-1.8b` is recommended. With llama.cpp:

```sh
llama-server -hf tencent/HY-MT1.5-1.8B-GGUF:Q8_0 \
  --host 127.0.0.1 --port 8080 -c 4096 --jinja
```

With vLLM:

```sh
vllm serve tencent/HY-MT1.5-1.8B \
  --served-model-name hy-mt1.5-1.8b --port 8000
# baseUrl: http://127.0.0.1:8000/v1, model: hy-mt1.5-1.8b
```

Check the service:

```sh
curl http://127.0.0.1:8080/v1/models
```

### 2. Install the plugin

This repository is a local directory package:

```sh
dsh plugin --profile web add /path/to/harness-lingo-translator
```

You can also install the directory from the Harness plugin manager. Reload the Web GUI: an **Auto-translate: off** button appears at the bottom-right.

### 3. Configure

**Plugins → Installed plugins → Harness Lingo Translator → Configure** has four tabs:

- **Connection**: Custom service / System model, service address, model name, API token.
- **Translation**: concurrency, batch reasoning, prompt header, keyword retention.
- **Hover**: show original on hover, hover delay.
- **Translation cache**: default directory, copy path, prune deleted conversations.

Saving applies immediately; the API token is write-only and never echoed back. For advanced fields, edit the profile's `cordis.patch.yml`; the complete schema is the `Config` in `index.mjs`.

## Upgrade from the previous repository

1.14.0 renamed the package and plugin IDs. For an existing profile:

```sh
node scripts/migrate-profile.mjs --profile ~/.dsh/profiles/web
cd ~/.dsh/profiles/web && pnpm install
```

Then restart DSH. The script updates the dependency, `dsh.profile.bundles` and the plugin row, preserves the existing `config`, and copies the old cache; the old cache directory and old localStorage key are also merged as fallbacks.

## How it works

The browser walks the rendered DOM, masks code, paths, commands, URLs, identifiers, versions, hashes, numbers and product names as `⟦n⟧`, and sends only the prose to the host. The host calls the local service or the system model; the browser verifies placeholders and writes the translation back into the same text nodes. Translations live only in the DOM, `localStorage` and the host-private cache directory; the session log, workspace files and DSH config are never written.

## Known limits

- Translation happens in the render layer; a React re-render can cause a brief flicker.
- Streaming blocks are translated after they finish (or after a 350 ms quiet period).
- Images, Canvas and PDF previews are not OCR'd.
- Placeholder handling is not 100% stable; a failed segment keeps its original text.
- System model needs an existing model route in the session; send one message first when there is none.

## Development

```sh
pnpm install
pnpm test        # 161 cases
pnpm run lint
pnpm run verify:self-contained
pnpm pack
```

Structure (short):

- `index.mjs` — host entry
- `lib/engine.mjs` — prompts, HTTP call, concurrency and placeholder verification
- `lib/service.mjs` — `translatePage` service
- `lib/cache.mjs` — per-workspace cache
- `client/index.js` — hand-written client: DOM, masking, cache, hover, height pinning, settings page
- `scripts/migrate-profile.mjs` — 1.14.0 migration
- `test/*.test.mjs` — Node test / jsdom / loopback HTTP

## License

Apache-2.0. Copyright 2026 PerryLink; modifications Copyright 2026 sakemo12. Refactored from [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate); community plugin, not affiliated with DeepSeek. See [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
