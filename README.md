# Harness Lingo Translator

##> 使用大语言模型翻译Deepseek Harness思考、执行过程，在不污染上下文的情况下在前端显示翻译结果，便利非英文母语用户Vibe Coding，支持本地翻译服务来源（推荐hy-mt1.5-1.8b），支持翻译历史缓存，支持悬停对照，支持自定义提示词，更多设置选项。

####> 本仓库由上一仓库 [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate) 改造而来；原版权归 PerryLink，当前仓库为 [sakemo12/harness-lingo-translator](https://github.com/sakemo12/harness-lingo-translator)。1.14.0 起包名/插件 ID 从 `dsh-translate` 改为 `harness-lingo-translator`。

[English](README.en.md) · [简体中文](README.md)

## 功能总览

- **前端显示，不污染上下文**：只改渲染层，不写会话日志、不改工作区、不修改 DSH 配置；原文留在内存，关闭开关即恢复。
- **两种后端**：默认调用本地 OpenAI 兼容服务；也可选「系统模型」，用当前会话最近一次请求的 provider/model，不发送对话上下文。
- **思考与执行过程**：翻译推理摘要、工具输出和助手回复；支持 `batchReasoning` 合并同一段思考的多个语块，流式块完成后再翻。
- **翻译历史缓存**：浏览器 `localStorage`（600 条）+ 宿主按工作区缓存 `~/.dsh/cache/harness-lingo-translator/<sha256(workspace)>.json`（5000 条，按配置哈希失效）；重开开关或 React 重渲染直接复用。
- **悬停对照**：静止悬停显示原文，移开恢复；语块高度按原文/译文较大者固定，不跳版。
- **自定义提示词**：提示词头、模板（auto / zh / en / custom）、术语词表、占位符保留开关与自定义句子。
- **内容保真**：代码、路径、命令、URL、标识符、版本、哈希、数字、产品名遮成 `⟦n⟧`；占位符丢失/改号/新增或空输出时保留原文；行内代码作为占位符，不切断段落。
- **更多设置**：连接、翻译、悬停、翻译缓存四个 tab；并发、思考合并、提示词、缓存清理等。
- **被动翻译**：开启时已显示的内容不翻；只翻新生成、之后变化或新展开的内容。
- **迁移兼容**：旧 `dsh-translate` 配置可保留；旧缓存目录与 localStorage 键作为回退，首次写入自动合并。

## 快速开始

### 1. 启动本地翻译服务

推荐 `hy-mt1.5-1.8b`。llama.cpp：

```sh
llama-server -hf tencent/HY-MT1.5-1.8B-GGUF:Q8_0 \
  --host 127.0.0.1 --port 8080 -c 4096 --jinja
```

vLLM：

```sh
vllm serve tencent/HY-MT1.5-1.8B \
  --served-model-name hy-mt1.5-1.8b --port 8000
# baseUrl: http://127.0.0.1:8000/v1, model: hy-mt1.5-1.8b
```

确认服务：

```sh
curl http://127.0.0.1:8080/v1/models
```

### 2. 安装插件

本仓库是本地目录包：

```sh
dsh plugin --profile web add /path/to/harness-lingo-translator
```

也可以在 Harness 插件管理里以本地目录安装。重载 Web GUI 后，右下角出现「自动翻译：关」按钮。

### 3. 配置

**Plugins → Installed plugins → Harness Lingo Translator → 配置**，四个 tab：

- **连接**：自定义服务 / 系统模型、服务地址、模型名、API 令牌。
- **翻译**：并发数、长思考合并请求、翻译提示词头、关键词保留。
- **悬停**：悬停显示原文、悬停时长。
- **翻译缓存**：默认目录、复制路径、清理已删除对话的缓存。

保存后立即生效；API 令牌只写不回显。高级字段直接改 profile 的 `cordis.patch.yml`，完整 schema 以 `index.mjs` 的 `Config` 为准。

## 从上一仓库升级

1.14.0 改了包名/插件 ID。旧 profile 执行：

```sh
node scripts/migrate-profile.mjs --profile ~/.dsh/profiles/web
cd ~/.dsh/profiles/web && pnpm install
```

然后重启 DSH。脚本会更新依赖、`dsh.profile.bundles` 和插件行，保留原 `config`，并复制旧缓存；旧缓存目录和旧 localStorage 键也会作为回退合并读取。

## 工作方式

浏览器遍历渲染后的 DOM，把代码、路径、命令、URL、标识符、版本、哈希、数字和产品名遮成 `⟦n⟧`，只把散文发给宿主；宿主调用本地服务或系统模型；浏览器校验占位符后写回原文本节点。译文只存在于 DOM、`localStorage` 和宿主私有缓存目录；会话记录、工作区文件、DSH 配置不会被写入。

## 已知限制

- 翻译在渲染层进行，React 重新渲染时可能有一次极短闪动。
- 流式块要等生成完成（或 350ms 安静期）后才翻。
- 图片、Canvas、PDF 不做 OCR。
- 模型对 `⟦n⟧` 的处理不是 100% 稳定；失败段保留原文。
- 系统模型需要当前会话已有一次模型路由；没有时先在会话里发一条消息。

## 开发

```sh
pnpm install
pnpm test        # 161 个用例
pnpm run lint
pnpm run verify:self-contained
pnpm pack
```

结构（简）：

- `index.mjs` — 宿主入口
- `lib/engine.mjs` — 提示词、HTTP 调用、并发与占位符校验
- `lib/service.mjs` — `translatePage` 服务
- `lib/cache.mjs` — 按工作区缓存
- `client/index.js` — 手写客户端：DOM、遮罩、缓存、悬停、高度固定、设置页
- `scripts/migrate-profile.mjs` — 1.14.0 迁移
- `test/*.test.mjs` — Node test / jsdom / loopback HTTP

## License

Apache-2.0。Copyright 2026 PerryLink；修改部分 Copyright 2026 sakemo12。本项目由 [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate) 改造而来，社区插件，与 DeepSeek 官方无关。详见 [LICENSE](LICENSE)、[NOTICE](NOTICE)、[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
