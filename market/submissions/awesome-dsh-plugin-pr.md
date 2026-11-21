# Add sakemo12/harness-lingo-translator

New entry file: `data/plugins/sakemo12__harness-lingo-translator.yml` (the only change in this PR).

## What it does

Shows translated thinking and replies in the DSH web UI through a local OpenAI-compatible model; code and paths stay verbatim.

Translation runs through a local OpenAI-compatible endpoint (LM Studio, llama.cpp or vLLM serving
`tencent/HY-MT1.5-1.8B`) or through the session's own model route. The browser masks code, paths,
commands, URLs, identifiers and numbers as `⟦n⟧` placeholders, the host translates only the prose, and
the masked text is restored verbatim. Session logs and workspace files are never written.

## Rule check

| Rule | Where |
| --- | --- |
| R2 `dsh.bundle` + R3 patch inserts a row | `package.json` → `dsh.bundle.patch`, `cordis.patch.yml` |
| R4 real code (no placeholder repo) | `index.mjs`, `lib/*.mjs`, `client/index.js`, `test/*.test.mjs` |
| R5 repo older than one day | created 2026-11-21T09:21:30Z; safe to open from 2026-11-22T09:21:30 UTC |
| R6 `dsh-plugin` topic | **pending — add before opening the PR** |
| R7 description | one line, ends with a period, no marketing words, every claim backed by code |
| R8 category | `ui` — a display-layer translation UI |
| R10 icon | not declared: the repo icon is SVG, which the list rejects; the author avatar is the fallback |
| R16 peers | `@deepseek-ai/*` packages are `peerDependencies` with pre-release ranges |

## Install

```sh
dsh plugin --profile web add github:sakemo12/harness-lingo-translator
```

Upstream of this fork: https://github.com/PerryLink/dsh-translate. Apache-2.0, Copyright 2026 PerryLink; modifications Copyright 2026 sakemo12.
