# Harness Lingo Translator

[![npm](https://img.shields.io/npm/v/harness-lingo-translator.svg)](https://www.npmjs.com/package/harness-lingo-translator) [![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/sakemo12/harness-lingo-translator)

### Use an LLM to translate DeepSeek Harness reasoning and execution, show the translated result in the frontend without polluting the context, make Vibe Coding easier for non-native English speakers, support local translation service sources (hy-mt1.5-1.8b recommended), support translation history cache, hover comparison, custom prompts, and more settings.

###### This repository is refactored from the previous repository [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate); original copyright PerryLink. Current repository: [sakemo12/harness-lingo-translator](https://github.com/sakemo12/harness-lingo-translator). The package/plugin ID was renamed from `dsh-translate` to `harness-lingo-translator` in 1.14.0.


## Feature overview

- **Frontend display, no context pollution**: changes only the render layer; no session log, no workspace write. Translations are written into memory and synced to the local cache, and the original returns when translation is switched off.
- **Two backends**: a custom OpenAI-compatible service for a small translation model deployed locally; alternatively, the model interface used by the newest request in the current session (possibly slower and incurring provider costs).
- **Content fidelity**: code, paths, URLs, identifiers and other protected spans are masked as `⟦n⟧`; when translation finishes, the translated text is written back into the original text nodes, keeping the rendering faithful.
- **Hover comparison**: a stationary hover shows the original and moving away restores the translation; the block height is pinned to the larger of the original/translated heights, so the layout does not jump.
- **More settings**: connection mode, custom prompt header, hover delay, concurrency, multi-paragraph reasoning batching, cache cleanup and more.
- **Controllable translation**: the switch stays clickable while translating; clicking it turns translation off and restores the originals. Errors are shown above the button and follow the UI language.
- **Passive translation**: on first enable, text already on screen stays original (even if cached); only content that appears, changes or is newly revealed afterwards is translated. Newly generated content follows automatically, and a collapsed reasoning block translates just its first paragraph as a preview.

## Quick start

### 1. Start a local translation service

`hy-mt1.5-1.8b` is recommended; adjust the prompts for other models.

<details open name="deployment">
<summary><b>Graphical: LM Studio (recommended)</b></summary>

1. Download and install [LM Studio](https://lmstudio.ai/).
2. In **Discover**, search for and download `tencent/HY-MT1.5-1.8B-GGUF` (Q8_0; choose Q4_K_M if VRAM is limited). If it is not in the search results, download the GGUF from Hugging Face and import it.
3. Open **Developer** (called **Local Server** in older versions), select the model at the top and click **Start Server**. The default port is `1234`.
4. In the DSH settings **Connection** tab:
   - Service address: `http://127.0.0.1:1234/v1`
   - Model name: the identifier of the loaded model in LM Studio, as returned by `GET /v1/models`
   - API token: fill it if LM Studio requires authentication, otherwise leave it blank
5. With LM Studio's JIT loading, set concurrency to `1`.

Check the service:

```sh
curl http://127.0.0.1:1234/v1/models
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

From npm (recommended, `1.14.0` is published — `dsh plugin` installs prebuilt code, no build permission needed):

```sh
dsh plugin --profile web add harness-lingo-translator
```

Straight from GitHub (no npm account, and no build permission: the package has no `prepare` script):

```sh
dsh plugin --profile web add github:sakemo12/harness-lingo-translator
```

From a local directory (development or offline):

```sh
dsh plugin --profile web add /path/to/harness-lingo-translator
```

You can also install the directory from the Harness plugin manager. Reload the Web GUI: an **Auto-translate: off** button appears at the bottom-right.

#### Install from a plugin market

Open **Plugins → Discover** (enable the official experimental custom-market bundle first) and add this index source:

```
https://cdn.jsdelivr.net/gh/sakemo12/harness-lingo-translator@main/market/index.json
```

Index format, every marketplace channel and the submission artifacts live in [market/README.md](market/README.md).

> [!IMPORTANT]
> Restart DSH after installing or upgrading; the host half must load before it writes the local translation cache.

### 3. Configure

**Plugins → Installed plugins → Harness Lingo Translator → Configure** has four tabs:

- **Connection**: Custom service / System model, service address, model name, API token.
- **Translation**: concurrency, batch reasoning, prompt header, keyword retention.
- **Hover**: show original on hover, hover delay.
- **Translation cache**: default directory, copy path, prune deleted conversations.

Saving applies immediately; the API token is write-only and never echoed back. For advanced fields, edit the profile's `cordis.patch.yml`; the complete schema is the `Config` in `index.mjs`.

## How it works

The browser walks the rendered DOM, masks code, paths, commands, URLs, identifiers, versions, hashes, numbers and product names as `⟦n⟧`, and sends only the prose to the host. The host calls the local service or the system model; the browser verifies placeholders and writes the translation back into the same text nodes. Translations live only in the DOM, `localStorage` and the host-private cache directory; the session log, workspace files and DSH config are never written.

## Known limits

- Images, Canvas and PDF previews are not OCR'd.
- The 1.8B model is not 100% stable with `⟦n⟧`; a failed segment retries at most 3 times and then keeps its original text. For more stability, use a larger translation model, adjust the prompts, or connect another OpenAI-compatible service.

## Development

```sh
pnpm install
pnpm test        # 166 cases
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

Apache-2.0. Copyright 2026 PerryLink; modifications Copyright 2026 sakemo12. This project is refactored from [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate); community plugin, not affiliated with DeepSeek. See [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
