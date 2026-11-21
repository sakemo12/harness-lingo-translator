# Harness Lingo Translator

### 使用大语言模型翻译Deepseek Harness思考、执行过程，在不污染上下文的情况下在前端显示翻译结果，便利非英文母语用户Vibe Coding，支持本地翻译服务来源（推荐hy-mt1.5-1.8b），支持翻译历史缓存，支持悬停对照，支持自定义提示词，更多设置选项。

###### 本仓库由上一仓库 [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate) 改造而来；原版权归 PerryLink，当前仓库为 [sakemo12/harness-lingo-translator](https://github.com/sakemo12/harness-lingo-translator)。1.14.0 起包名/插件 ID 从 `dsh-translate` 改为 `harness-lingo-translator`。


## 功能总览

- **前端显示，不污染上下文**：只改渲染层，不写会话日志、不改工作区；译文写入内存并同步至本地缓存，关闭翻译开关即恢复。
- **两种后端**：自定义 OpenAI 兼容服务，接入本地部署小型翻译模型服务；也可选当前会话最近一次请求的模型接口（可能较慢并产生费用）。
- **内容保真**：代码、路径、URL、标识符等遮成 `⟦n⟧`；翻译完成后将原文覆盖回原位，内容保真。
- **悬停对照**：静止悬停显示原文，移开恢复；语块高度按原文/译文较大者固定，不会出现排版跳动。
- **更多设置**：连接方式、自定义提示词头、悬停时长、并发数、思考多段落合并翻译、缓存清理等。
- **被动翻译**：只翻译当前可见内容，新生成自动跟进、未展开思考只翻译第一段用作预览。

## 快速开始

### 1. 启动本地翻译服务

推荐 `hy-mt1.5-1.8b`，其他模型请自行调整提示词。

<details open name="deployment">
<summary><b>图形化：LM Studio（推荐）</b></summary>

1. 下载安装 [LM Studio](https://lmstudio.ai/)。
2. 在 **Discover** 搜索并下载 `tencent/HY-MT1.5-1.8B-GGUF`（Q8_0；显存不足可选 Q4_K_M）。搜不到时可在 Hugging Face 下载 GGUF 后导入。
3. 打开 **Developer**（旧版为 **Local Server**），在顶部选择该模型，点击 **Start Server**；默认端口是 `1234`。
4. 在 DSH 设置页「连接」填写：
   - 服务地址：`http://127.0.0.1:1234/v1`
   - 模型名：LM Studio 中加载的模型标识，以 `GET /v1/models` 返回为准
   - API 令牌：LM Studio 开启鉴权时填写，否则留空
5. LM Studio 使用 JIT 加载时，建议把并发数设为 `1`。

确认服务：

```sh
curl http://127.0.0.1:1234/v1/models
```

</details>


<details name="deployment">
<summary><b>命令行：vLLM</b></summary>

```sh
vllm serve tencent/HY-MT1.5-1.8B \
  --served-model-name hy-mt1.5-1.8b --port 8000
```

- 服务地址：`http://127.0.0.1:8000/v1`
- 模型名：`hy-mt1.5-1.8b`（与 `--served-model-name` 一致）

确认服务：

```sh
curl http://127.0.0.1:8000/v1/models
```

</details>

### 2. 安装插件

本仓库是本地目录包：

```sh
dsh plugin --profile web add /path/to/harness-lingo-translator
```

也可以在 Harness 插件管理里以本地目录安装。重载 Web GUI 后，右下角出现「自动翻译：关」按钮。

> [!IMPORTANT]
> 安装或升级后请重启 DSH；宿主半加载后才会写入本地翻译缓存。

### 3. 配置

**Plugins → Installed plugins → Harness Lingo Translator → 配置**，四个标签页：

- **连接**：自定义服务 / 系统模型、服务地址、模型名、API 令牌。
- **翻译**：并发数、长思考合并请求、翻译提示词头、关键词保留。
- **悬停**：悬停显示原文、悬停时长。
- **翻译缓存**：默认目录、复制路径、清理已删除对话的缓存。

保存后立即生效；API 令牌只写不回显。高级字段直接改 profile 的 `cordis.patch.yml`，完整 schema 以 `index.mjs` 的 `Config` 为准。

## 工作方式

浏览器遍历渲染后的 DOM，把代码、路径、命令、URL、标识符、版本、哈希、数字和产品名遮成 `⟦n⟧`，只把散文发给宿主；宿主调用本地服务或系统模型；浏览器校验占位符后写回原文本节点。译文只存在于 DOM、`localStorage` 和宿主私有缓存目录；会话记录、工作区文件、DSH 配置不会被写入。

## 已知限制

- 图片、Canvas、PDF 不做 OCR。
- 1.8B 模型对 `⟦n⟧` 的处理不是 100% 稳定；失败段最多重试 3 次，仍失败则保留原文。需要更高稳定性可换用更大的翻译模型、调整提示词，或接入其他 OpenAI 兼容服务。

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
