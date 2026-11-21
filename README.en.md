# Harness Lingo Translator

> **Use an LLM to translate DeepSeek Harness reasoning and execution, showing the result in the frontend without polluting the context — making Vibe Coding easier for non-native English speakers. Supports local translation services (hy-mt1.5-1.8b recommended), translation history cache, hover comparison, custom prompts, and more settings.**
>
> Refactored from the previous repository [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate); original copyright PerryLink. Current repository: [sakemo12/harness-lingo-translator](https://github.com/sakemo12/harness-lingo-translator). Renamed from `dsh-translate` to `harness-lingo-translator` in 1.14.0.

[English](README.en.md) · [简体中文](README.md)

## Feature overview

- **Frontend-only display, no context pollution**: changes only the rendered DOM — no session log, no workspace file, no DSH config write. Originals stay in memory; translations go to local caches, and everything returns when translation is switched off.
- **Reasoning and execution prose**: translates reasoning summaries, tool output and assistant replies; batches the paragraphs of one reasoning block, and waits for streaming content to finish.
- **Hover comparison**: a stationary hover shows the original and moving away restores the translation; the block height is pinned to the larger of the original/translated heights so the list does not jump.
- **Two backends**: the local OpenAI-compatible service by default (LM Studio / llama.cpp / vLLM, etc.), or **System model**, which reuses the newest session model route without sending conversation context (it can be slower and may incur provider costs).
- **Translation cache**: browser `localStorage` plus a host-private per-workspace document at `~/.dsh/cache/harness-lingo-translator/`; entries are reused by config hash, so re-enabling the switch or a React re-render does not request them again.
- **Content fidelity**: code, paths, commands, URLs, identifiers, versions, hashes, numbers and product names are masked as `⟦n⟧`; a translation that loses, renumbers or invents a placeholder — or is empty — keeps the original. Inline code is one placeholder, so a paragraph is not split.
- **More settings**: connection mode, prompt header, hover delay, concurrency, reasoning batching, cache cleanup and more.
- **Passive translation**: content already visible when the switch is enabled stays original; only new, changed or newly revealed content is translated.

## Quick start

### 1. Start a local translation service

`hy-mt1.5-1.8b` is recommended; adjust the prompts for other models. Click the headings below to switch deployment methods; the LM Studio graphical setup is open by default.

<details open name="deployment">
<summary><b>Graphical: LM Studio (recommended)</b></summary>

1. Download and install [LM Studio](https://lmstudio.ai/).
2. In **Discover**, search for and download `tencent/HY-MT1.5-1.8B-GGUF` (Q8_0; choose Q4_K_M if VRAM is limited). If it is not in the search results, download the GGUF from Hugging Face and import it.
3. Open **Developer** (called **Local Server** in older versions), select the model at the top and click **Start Server**. The default port is `1234`.
4. In the DSH settings **Connection** tab:
   - Service address: `http://127.0.0.1:1234/v1`
   - Model name: the identifier shown by `GET /v1/models`
   - API token: fill it if LM Studio requires authentication, otherwise leave it blank
5. With LM Studio's JIT loading, set concurrency to `1`.

Check the service:

```sh
curl http://127.0.0.1:1234/v1/models
```

</details>

<details name="deployment">
<summary><b>Command line: llama.cpp</b></summary>

```sh
llama-server -hf tencent/HY-MT1.5-1.8B-GGUF:Q8_0 \
  --host 127.0.0.1 --port 8080 -c 4096 --jinja
```

- Service address: `http://127.0.0.1:8080/v1`
- Model name: any value for llama.cpp; the default `hy-mt1.5-1.8b` is fine

Check the service:

```sh
curl http://127.0.0.1:8080/v1/models
```

</details>

<details name="deployment">
<summary><b>Command line: vLLM</b></summary>

```sh
vllm serve tencent/HY-MT1.5-1.8B \
  --served-model-name hy-mt1.5-1.8b --port 8000
```

- Service address: `http://127.0.0.1:8000/v1`
- Model name: `hy-mt1.5-1.8b` (must match `--served-model-name`)

Check the service:

```sh
curl http://127.0.0.1:8000/v1/models
```

</details>

### 2. Install the plugin

This repository is a local directory package:

```sh
dsh plugin --profile web add /path/to/harness-lingo-translator
```

You can also install the directory from the Harness plugin manager. Reload the Web GUI: an **Auto-translate: off** button appears at the bottom-right.

> [!IMPORTANT]
> Restart DSH after installing or upgrading; the host half must load before it writes the local translation cache.

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

- Images, Canvas and PDF previews are not OCR'd.
- The 1.8B model is not 100% stable with `⟦n⟧`; a failed segment retries at most 3 times and then keeps its original text. For more stability, use a larger translation model, adjust the prompts, or connect another OpenAI-compatible service.

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
