# Third-party notices

## Upstream project

This repository is a derivative of
[PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate),
licensed under the Apache License 2.0. The original copyright notice is
retained in `LICENSE` and `NOTICE`. Changes for the local-model edition and
this fork are Copyright 2026 sakemo12.

## tencent/HY-MT1.5-1.8B-GGUF prompt templates

`lib/engine.mjs` reproduces the translation prompt templates published on the
model card of
[tencent/HY-MT1.5-1.8B-GGUF](https://huggingface.co/tencent/HY-MT1.5-1.8B-GGUF)
(Tencent Hunyuan). The model weights and tokenizer are **not** distributed with
this package; users deploy the model separately and are responsible for
complying with the model's own license.

## DeepSeek Harness

This package is a plugin for DeepSeek Harness and uses its public plugin APIs
(`@deepseek-ai/cordis`, `@deepseek-ai/dsh-typert-protocol`,
`@deepseek-ai/schemastery`). Those packages are not bundled; they are provided
by the host profile or installed as peer/dev dependencies under their own
licenses. This project is a community plugin and is not affiliated with
DeepSeek.
