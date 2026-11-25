# Add harness-lingo-translator to UI & user experience

One entry added to `catalog/plugins.json`; the Chinese mirror regenerated with
`python scripts/generate_readmes.py`; and the matching bullet added by hand to the English catalog in
`README.md`, which this list maintains manually.

```json
{
  "name": "harness-lingo-translator",
  "url": "https://github.com/sakemo12/harness-lingo-translator",
  "category": "ui-user-experience",
  "description": {
    "en": "Shows translated thinking and replies in the DSH web UI through a local OpenAI-compatible model; code and paths stay verbatim.",
    "zh-CN": "在 DSH Web 界面显示思考与回复的译文，翻译走本地 OpenAI 兼容模型；代码与路径保持原样。"
  }
}
```

## Both languages

- en: Shows translated thinking and replies in the DSH web UI through a local OpenAI-compatible model; code and paths stay verbatim.
- zh-CN: 在 DSH Web 界面显示思考与回复的译文，翻译走本地 OpenAI 兼容模型；代码与路径保持原样。

## Install

```sh
dsh plugin --profile web add harness-lingo-translator
```

Apache-2.0. Community plugin, not affiliated with DeepSeek.
