# dsh-translate（本地模型版）

> 宿主兼容性：DeepSeek Harness `>=0.2.1-0 <0.3.0`（本机在 `0.2.1-rc.2` 上验证）。
>
> GitHub：[sakemo12/harness-lingo-translator](https://github.com/sakemo12/harness-lingo-translator) · 基于 [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate)（Apache-2.0）

**把整个界面翻成你的语言——译文来自你本地部署的翻译模型，代码、路径、命令和专名一个都不动。**

DeepSeek Harness 的整页翻译插件。浏览器半边遍历当前页面上的文字节点，把需要保留的片段（代码块与行内代码、文件路径、shell 命令、URL、标识符、版本号、哈希、数字、产品名）先遮成 `⟦n⟧` 占位符，再把剩下的散文交给宿主半边；宿主半边调用**本地 OpenAI 兼容接口**上的 Hunyuan 翻译模型（[tencent/HY-MT1.5-1.8B-GGUF](https://huggingface.co/tencent/HY-MT1.5-1.8B-GGUF)），使用模型卡片给出的**官方提示词模板**逐段翻译；浏览器把占位符还原后写回原来的文本节点。原文一直留在内存里，关闭开关就整体还原。

只改显示层：**不写会话日志、不改工作区文件**。译文只存在于 DOM、浏览器缓存，以及宿主私有目录 `~/.dsh/cache/dsh-translate/` 的按工作区缓存文档里。会话记录里永远是模型真正说过的话。

> 本版本以本地 OpenAI 兼容端点为主；同时保留「系统模型」开关，用当前会话最近一次请求的 provider/model 翻译。没有 provider/model 下拉列表，也不发送会话上下文。

[English](README.en.md) · [简体中文](README.md)

## 翻什么，不翻什么

| 会翻译 | 原样保留 |
|---|---|
| 助手回复、推理摘要、工具输出里的散文 | 代码块与行内代码（`code` / `pre`） |
| Markdown 标题、列表、表格、链接文字 | 文件路径、glob、命令与参数、URL、邮箱 |
| 按钮、标签、设置项等界面文案 | JSON 键、环境变量、`dsh-*` / `snake_case` / `camelCase` 标识符 |
| 工具调用的描述（任务名，如「检查服务状态」） | 终端卡片里的命令行与输出 |
| 页面里其它插件新出现的文字 | 文件内容（read）、diff、JSON、代码块 |
| —— | 已经是中文的语块 |
| —— | 用户自己发送的消息 |
| —— | 版本号、哈希、纯数字、`⟦n⟧` 占位符本身 |
| —— | 词表里的产品名：DeepSeek Harness、Cordis、npm、GitHub、Phocinae 等 |

判定规则：一个文本节点里如果**没有任何可翻译的散文**（例如整段都是路径或代码），直接跳过；如果模型丢掉、改了或新增了占位符，或者输出为空/被截断，这一段就放弃翻译、保留原文，而不是把半个占位符写进页面。

代码类元素按界面语义识别，不依赖标签名：`pre` 代码块、`[data-terminal]`（终端卡片，含命令与输出）、`[data-command-text]`（命令行）、`[data-read]`（文件内容）、`[data-diff]`（diff）、`[data-json]`（JSON）、`[data-code]`（高亮代码块）一律跳过；工具卡片的标题与描述（任务名）属于散文，照常翻译。

**行内代码不再切断段落**：段落里的 `<code>` / `<kbd>` / `<samp>` 会作为一个 `⟦n⟧` 占位符参与整段翻译，段落只发一次请求，代码元素原样保留。例如 `The host <code>resolveConfig</code> validates …` 会把整句（含占位符）发给模型，`The host` 按“宿主”翻译，而不是被切成孤立片段译成“主持人”。

遮罩只针对真正的代码特征：产品名按**词边界**匹配（`bundle`、`digit` 不会被 `bun`、`git` 误伤）；连字符词只有含数字（`gpt-4o`）或 `dsh-` 前缀才算标识符，`fail-closed`、`state-of-the-art` 照常翻译；斜杠串必须从路径边界开始（`/etc/hosts`、`./src/app.ts` 会遮，`lost/duplicated/invented` 不会）；`HY-MT1.5-1.8B-GGUF`、`1.8B`、`v0.2.1-rc.2` 整体遮成一个占位符，不再拆碎。

## 先部署本地翻译服务

插件不下载模型、不启动服务，只按 OpenAI 兼容协议调用你部署好的端点。推荐用 llama.cpp（GGUF）：

```sh
# llama.cpp 编译产物，端口即默认配置里的 8080
llama-server -hf tencent/HY-MT1.5-1.8B-GGUF:Q8_0 \
  --host 127.0.0.1 --port 8080 -c 4096 --jinja
```

也可以直接用 vLLM（非 GGUF 权重）：

```sh
vllm serve tencent/HY-MT1.5-1.8B --served-model-name hy-mt1.5-1.8b --port 8000
# 对应 baseUrl: http://127.0.0.1:8000/v1，model: hy-mt1.5-1.8b
```

无法直连 `huggingface.co` 时，先设置镜像再下载（llama.cpp 与 vLLM 都遵循 `HF_ENDPOINT`），或从镜像手动下载 GGUF 后用 `-m /path/to/hy-mt1.5-1.8b-q8_0.gguf`：

```sh
export HF_ENDPOINT=https://hf-mirror.com
```

验证：

```sh
curl http://127.0.0.1:8080/v1/models
```

模型卡片推荐的推理参数是 `temperature 0.7、top_k 20、top_p 0.6、repetition_penalty 1.05`，插件的默认配置与之一致；这些参数由插件逐次请求发送，不需要改服务端默认值。

## 安装

本仓库是本地目录包，安装后 profile 里会出现 `dsh-translate` 这一行：

```sh
dsh plugin --profile web add /path/to/dsh-translate
```

或在 Harness 的插件管理里以本地目录安装。装好后重载 Web GUI，页面右下角会出现「自动翻译：关」按钮：点一下开启被动翻译，再点一下关闭并恢复原文。

**改设置**：侧边栏 **Plugins → Installed plugins → dsh-translate → 配置**。页面顶部是四个横向大标题：**连接 / 翻译 / 悬停 / 翻译缓存**，点哪个才在下方显示对应设置；保存后立即生效，不用重启，也不用改 YAML。

- **连接**：两个互斥勾选框——**自定义服务**（本地 OpenAI 兼容服务）和 **系统模型**（上游接入方式，使用当前会话的模型路由）。
- **翻译**：并发数（仅自定义服务）、长思考合并请求；自定义服务下还有翻译提示词头和关键词保留提示词。
- **悬停**：悬停显示原文和悬停时长。
- **翻译缓存**：显示默认保存目录 `~/.dsh/cache/dsh-translate/`，可复制路径，可一键清理已删除对话的缓存。

- **API 令牌**是只写的 secret 字段：保存后不会回显、也不会出现在任何设置读取结果里；留空表示保持当前令牌不变，输入新值则替换。要彻底清除，把 profile 里的 `apiKey` 删掉或留空（表单的留空代表不修改）。
- 令牌（以及服务地址、模型名）保存在 profile 的 `cordis.patch.yml` 里，插件只会把它作为 `Authorization: Bearer` 发给你配置的 `baseUrl`。


首次开启开关时，插件会请求 `GET {baseUrl}/models` 判断服务是否在线；服务没起来时按钮旁会显示原因（例如 `cannot reach http://127.0.0.1:8080/v1/models …`），页面不会被改动。

## 何时翻译

右下角的按钮是**被动翻译开关**，不是「立即翻译整页」：

- **开启不翻现有内容**：页面上已经显示且不再变化的文字保持原文。
- **只翻非中文语块**：文本节点里出现连续两个汉字即判为中文、整段跳过；**引号里的引文不计入**（英文句子里引用一句中文仍会翻译，如 `The reply was “好的” and then it stopped.`）。假名、韩文不视为中文；这条规则与目标语言无关。
- **用户消息永不翻译**：`data-chat-flow-kind="user"` / `"steering"` 的节点整段跳过，输入框本来也不处理。
- **生成完成后才翻**：流式输出期间（`data-streaming`、`aria-busy="true"`）跳过，语块生成结束后自动翻译；开启后仍在流式变化的旧文字，等它稳定后再翻。
- **折叠内容永不主动翻译**：`display:none`、`visibility:hidden`、`[hidden]`、`[aria-hidden="true"]`、未打开的 `<details>` 都跳过；展开（样式/属性变化）后才翻译该段。
- **开启时已展开的内容不翻译**：只有开启之后新出现、或之后才展开的内容会触发翻译（缓存命中时立即显示，不再请求模型）。
- **关闭开关**：已翻译的内容恢复原文。
- **重新打开**：关闭前翻译过的内容会从本地缓存立即恢复译文，不重新请求模型；没有缓存的内容仍按“开启时已显示的文字不翻”处理。
- **工作区缓存文档**：成功译文除了写浏览器 `localStorage`，还会由宿主写入 `~/.dsh/cache/dsh-translate/<sha256(工作区路径)>.json`，每个工作区一份，不会污染仓库。键是 `配置哈希 + 遮罩原文` 的内容寻址；配置（模型/提示词/词表/目标语言/合并模式）变了就不命中，工作区或对话内容变了也只会安全失配，不会把译文套到别的文本上。启动时先读该文件并应用其中的译文，再发起新请求；保存是防抖 + 原子写。设置页「翻译缓存」可以查看默认目录，并一键清理已删除对话的缓存（只删除会话 ID 已不在 DSH 会话列表中的条目）。
- **折叠的思考块**：直接把可见的摘要（展开后第一段的首行/首句）作为翻译对象，显示在该折叠行的原位置，并把显示截断到约 160 字符；即使它在打开开关前已经存在，也会翻译这一行摘要（正文仍等展开后再翻）。
- **界面重绘不丢译文**：展开思考块等操作会让 React 把文本节点写回原文；检测到写回的是我们记录过的原文时，直接重新贴回已有译文，不重新请求。
- **悬停看原文**：自动翻译开启时，鼠标在某个已翻译的语块上**静止悬停**达到设定时长（默认 200 毫秒），该语块临时显示原文；时长设为 **0** 时移上去立即显示。预览期间在**该语块内部移动保持原文**，移到语块外、滚动或移出页面才恢复译文。预览范围取最近的块级祖先（段落/列表项等），**连带前面的小图标**；只有块内译文同属一个直接父元素时才预览，所以不会把相邻段落一起还原。设置页可开关并调整毫秒数；保存后重新开关一次「自动翻译」生效。

## 请求保护

翻译服务是本地小模型（LM Studio / llama.cpp 常常单实例、JIT 加载），插件对请求量做了硬限制，避免把服务打崩：

- **同一段失败最多尝试 3 次**，间隔 5s / 20s / 60s；之后保持原文，直到这段文字变化、缓存命中或重新开关。失败段不会写缓存。
- **扫描串行 + 在途去重**：同一时刻只跑一轮扫描，正在请求的段落不会因为页面继续变动而被重复发送。
- **不设全局暂停**：整批失败只影响失败段，失败段按上面的间隔重试；新出现的语块仍然立即请求，不会等待 30 秒。
- **并发默认 2**：LM Studio 单模型 JIT 加载时建议 `concurrency: 1`；llama.cpp / vLLM 可到 2–4。

## 提示词

提示词采用模型卡片给出的官方模板，插件不额外发送 system 提示（卡片明确说明该模型没有默认 system prompt）：

**ZH⇄XX**（目标语言为中文时自动使用）：

```text
将以下文本翻译为{target_language}，注意只需要输出翻译后的结果，不要额外解释：

{source_text}
```

**XX⇄XX**（目标语言不是中文时自动使用）：

```text
Translate the following segment into {target_language}, without additional explanation.

{source_text}
```

**占位符约束**：当这一段含 `⟦n⟧` 占位符时，上面模板会多一句保留约束（实测 1.8B 模型会把裸 `⟦0⟧` 改写成 `《0》` 或直接丢掉，加上这句后 30/30 段保留成功；不含占位符的段落仍用上面的原始模板，避免约束句被模型复述进译文）。默认句现在是：

```text
将以下文本翻译为{target_language}，注意只需要输出翻译后的结果，不要额外解释，原文中的⟦0⟧、⟦1⟧、⟦2⟧这类占位符必须原样保留，你可以把占位符当做未知内容（一般是专有名词、数值、代码块）插入翻译好的句子，但不要把括号里的编号当做数字翻译进内容里：

{source_text}
```

这一句也可以在设置页控制：

- **基于文字遮罩的关键词保留**：关闭后不再附加这句话（含占位符的段落仍会翻译，但模型可能改写占位符）。
- **自定义关键词保留提示词**：勾选后才会出现；填写后替换内置句子，**内联到指令句里**（不单独成行，避免被模型当正文翻译）；留空则用内置句。示例：`编号占位符必须原样保留，不要改动。`

**长思考合并请求**（设置页开关 `batchReasoning`，默认关）：开启后，同一段思考（界面里 `data-variant="think"` 的推理块）里的多个语块按 8 段一批，用编号行模板一次发送（实测 8 段 4/4 通过；`<sn>`、JSON、分隔符格式在中文上会合段，因此不采用）：

```text
将以下文本翻译为{target_language}，注意只需要输出翻译后的结果，不要额外解释。每行一段，保持行数、顺序和编号，不要合并或拆分段落，占位符 ⟦n⟧ 原样保留：

1. {segment_1}
2. {segment_2}
```

返回后按编号拆回并逐段校验占位符；编号丢失、顺序错乱或某段占位符异常时，这一批自动回退为逐段请求，不会丢内容。开关保存后，需要重新开关一次「自动翻译」才会按新模式运行（模式在开启时读取）。

**术语干预**（配置了 `源=译` 词条时追加）：

```text
参考下面的翻译：
{source_term} 翻译成 {target_term}

将以下文本翻译为{target_language}，注意只需要输出翻译后的结果，不要额外解释：
{source_text}
```

`promptTemplate` 可选 `auto`（默认，按目标语言在中/英模板间选择）、`zh`、`en`、`custom`。`custom` 时必须提供 `customTemplate`，其中可用 `{source_text}`（必填）、`{target_language}`、`{target_lang}`、`{glossary}`。

## 两种翻译后端

设置页「连接」有 **自定义服务** 和 **系统模型** 两个互斥勾选框：

- **自定义服务（默认）**：本地 OpenAI 兼容服务（HY-MT 等）。
- **系统模型**：宿主原有的接入方式——宿主用当前会话最近一条 `request/header` 的 provider/model 调用 `llm.stream`，把遮罩后的段落作为 JSON 数组发过去；不读取对话上下文，也不使用模型侧缓存。没有路由时请先在会话里发一条消息。
- 系统模型没有额外的 provider/model 下拉或“添加模型”入口；配置由 DSH 会话的模型路由决定。

**翻译提示词头**（设置页的 `promptHeader`）：它是每次翻译的**指令句**，会替换上面的内置指令（逐段与合并请求都生效）；默认填写 `将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释`。支持 `{target_language}`、`{target_lang}` 占位；默认值只用于中文目标，翻其它语言时请改成对应语言的指令，留空则使用内置模板。保存后下一次翻译立即生效。

> 服务端口没有限制：宿主用 `node:http` 发请求，而不是浏览器的 `fetch`（`fetch` 会拒绝 123 这类 WHATWG 禁用端口，实测会报 `bad port`）。

## 配置

`cordis.patch.yml` 里的每一格都是 Schemastery 字段，写错会在 profile 加载时直接报错。`baseUrl` 与 `model` 是 volatile 字段，可直接在 Plugins 页的「配置」表单里实时修改；其余字段在 `cordis.patch.yml` 里改：

| 键 | 默认 | 含义 |
|---|---|---|
| `enabled` | `true` | 总开关；`false` 时宿主不挂载任何东西 |
| `systemModel` | `false` | 使用当前会话最近一条 `request/header` 的 provider/model（上游方案），不访问本地服务 |
| `baseUrl` | `http://127.0.0.1:8080/v1` | OpenAI 兼容 API 根地址，**含 `/v1` 版本段** |
| `apiKey` | `''` | 可选 Bearer 令牌；设置页可填，secret 字段不回显，留空保持原值 |
| `model` | `hy-mt1.5-1.8b` | 请求里的 `model` 名；llama.cpp 可任意，vLLM 需与服务名一致 |
| `targetLang` | `''` | 目标语言；空 = 跟随 Web GUI 当前语言（英文界面时跟随浏览器语言） |
| `promptTemplate` | `auto` | `auto` / `zh` / `en` / `custom`，见上节 |
| `customTemplate` | `''` | `promptTemplate: custom` 时必填，必须包含 `{source_text}` |
| `promptHeader` | `将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释` | 翻译提示词头：替换内置指令句，支持 `{target_language}`；设置页可改 |
| `placeholderGuard` | `true` | 基于文字遮罩的关键词保留：含 ⟦n⟧ 的请求是否附加保留要求；设置页可改 |
| `placeholderHint` | `''` | 自定义关键词保留提示词，替换内置句；留空用内置；设置页可改 |
| `hoverRestore` | `true` | 自动翻译开启时，鼠标静止悬停一段时间后显示该语块原文 |
| `hoverRestoreMs` | `200` | 悬停显示原文的等待时间（0–60000 毫秒；0 = 移上去立即显示） |
| `glossary` | `[]` | 词表：纯词条原样保留；`源=译` 词条作为术语干预 |
| `temperature` | `0.7` | 采样温度（官方推荐） |
| `topP` | `0.6` | `top_p`（官方推荐） |
| `topK` | `20` | `top_k`（官方推荐）；`0` = 不发送该参数 |
| `repetitionPenalty` | `1.05` | `repetition_penalty`（官方推荐）；`0` = 不发送该参数 |
| `maxTokens` | `2048` | 单段译文最大输出 token；被截断的段会保留原文 |
| `concurrency` | `2` | 并发请求数（1–16）；设置页可改；单实例/JIT 加载建议 1–2 |
| `batchReasoning` | `false` | 长思考合并请求：同一段思考的多个语块一批发送；设置页可改 |
| `timeoutMs` | `60000` | 单次请求超时（毫秒，1000–600000） |
| `retries` | `1` | 瞬时失败（网络、429、5xx）重试次数（0–3） |

严格只认标准参数的 OpenAI 服务若拒绝 `top_k` / `repetition_penalty`，插件会自动去掉这两个扩展参数重试一次。

例：翻成日文、把内部系统名固定译法交给模型，并把产品名放进保护词表：

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

> 覆盖配置时请写全整份 `config`：loader 的 id 覆盖会整体替换该行的 config，而不是逐键合并。

## 成本与隐私

- **只翻新出现或新展开的文字**：开关默认关闭；开启后只处理生成完成的新语块和之后展开的折叠内容，页面上已有的文字不会被扫描翻译。
- **两种后端**：默认只出网到你配置的本地 `baseUrl`；勾选「系统模型」时不访问本地服务，而是通过宿主 `llm` 用当前会话最近一次请求的 provider/model 翻译，发送的是遮罩后的独立 JSON 数组，不带对话上下文，也不使用模型侧缓存。
- **结果缓存**：同一段原文（同一目标语言）只翻一次，缓存在浏览器 `localStorage`（上限 600 条），同时由宿主写入 `~/.dsh/cache/dsh-translate/<工作区哈希>.json`（上限 5000 条，按配置哈希失效）；清掉站点数据或删除该目录即消失。
- **出网内容**：只有被遮掉受保护片段之后的散文会发给本地服务；路径、代码、命令、密钥形态的标识符不会作为可翻译文本发出。
- **落盘范围**：译文存在于当前页面的 DOM、浏览器 `localStorage`，以及宿主私有目录 `~/.dsh/cache/dsh-translate/<工作区哈希>.json`；不写工作区、会话日志或 DSH 配置。
- **凭据**：`apiKey` 只作为 `Authorization: Bearer` 头发给你配置的端点，不会出现在 `status()` 返回值或错误信息里。

## 已知限制

- 翻译发生在**渲染层**：React 重新渲染某个节点时会把原文写回，插件的 MutationObserver 会用缓存把译文再贴回去（不会重复调用模型）；极端情况下会看到一次极短的闪动。
- 生成中的语块按 `data-streaming` / `aria-busy` 判断，结束后才会翻译；如果宿主没有这类标记，则等 350ms 安静期后翻。
- **逐段请求**：每段一次 `/chat/completions`，一个 40 段的页面会产生 40 次请求；并发由 `concurrency` 控制。本地 1.8B 模型通常够快，但首屏翻译仍可能需要数秒。
- 图片里的文字、Canvas、PDF 预览不做 OCR。
- 折叠内容（隐藏弹窗、未展开的推理/工具输出）在展开前不会被翻译；展开后才触发，缓存过的段落无需再次请求模型。
- 判断依据是文本节点本身：同一段文字如果被界面重新渲染成新节点（例如虚拟滚动把它移出再放回），会被当作新内容翻译一次。
- 模型支持 33 种语言；界面本身已有 8 种内置语言，本插件翻的是**内容**和第三方插件的英文文案，不替代内置 locale。
- 模型对 `⟦n⟧` 占位符的处理不是 100% 稳定；失败时该段保留原文，不会写坏页面。

## 开发

```sh
pnpm install
pnpm test        # 152 个用例：提示词模板、词表、占位符、HTTP 协议、并发/重试、DOM/高度、缓存、设置页、两端 descriptor 一致性
pnpm run lint
pnpm run verify:self-contained
```

结构：

- `index.mjs` — 宿主插件入口（Config + `resolveConfig` + 挂载服务）
- `lib/service.mjs` — `translatePage` Typert 服务（status / translate / 缓存 / 工作区）
- `lib/engine.mjs` — 官方提示词模板、词表、HTTP 调用、并发、清洗与占位符校验（无 cordis / 无 DOM，可单测）
- `lib/cache.mjs` — 按工作区缓存的原子写与 LRU
- `lib/session-backend.mjs` — 系统模型的会话路由调用
- `lib/transport.mjs` — 基于 `node:http`/`node:https` 的 fetch 形状传输
- `lib/wire.mjs` — 两端共享的调用描述符
- `typert.host.mjs` — 宿主 Typert 清单
- `client/index.js` — 手写客户端包：DOM 遍历、遮罩、缓存、悬停、语块高度固定、浮动按钮与设置页
- `locale/*.json` — 插件管理里显示的标题与描述
- `test/*.test.mjs` — `node --test`（含 jsdom DOM 测试与真实 loopback HTTP 测试）

## License

Apache-2.0。Copyright 2026 PerryLink；修改部分 Copyright 2026 sakemo12。本项目基于 [PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate)，社区插件，与 DeepSeek 官方无关。详见 [LICENSE](LICENSE)、[NOTICE](NOTICE) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
