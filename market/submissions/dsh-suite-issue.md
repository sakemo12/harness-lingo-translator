# [收录] sakemo12/harness-lingo-translator — DSH Web 界面的屏幕翻译

<!-- 中英任选其一填写即可 / Fill in either language. -->

## 插件信息 / Plugin info

- **npm 包名 / package name**：`harness-lingo-translator`（尚未发布到 npm，待发布后补 / not yet on npm）
- **GitHub 仓库 / repo**：`sakemo12/harness-lingo-translator`
- **一句话描述 / one-line description**：在 DSH Web 界面显示思考与回复的译文，翻译走本地 OpenAI 兼容模型；代码与路径保持原样。
- **分类 / category**：`ui`

## 为什么值得收录 / Why it belongs

它解决的是非英语用户读 DSH 思考与回复的问题，做法与“改系统提示词让模型说中文”不同：只改渲染层，
把代码、路径、命令、URL、标识符与数字遮成占位符，只把散文送去翻译，再把遮住的内容原样还原；
占位符对不上的段落保留原文（fail closed）。翻译走本地 OpenAI 兼容服务（默认 LM Studio / llama.cpp /
vLLM 承载 tencent/HY-MT1.5-1.8B），不经过云端；也可以切到当前会话的模型接口。会话日志、工作区文件与
DSH 配置都不会被写入，唯一的文件写入是 `~/.dsh/cache/harness-lingo-translator/` 下的按工作区缓存。

与同类插件的区别：不做整页机翻，不做 OCR；只翻译当前可见内容并跟随流式生成，静止悬停可看原文，
译文行按原文/译文较大者固定高度，避免列表跳动。

## 兼容性 / Compatibility

- **DSH 最低版本 / min DSH version**：`>=0.2.1-0 <0.3.0`
- **Node**：`^22.19.0 || >=24.0.0`
- **是否已在 DSH 上实测 / verified on DSH?**：未在干净 profile 上自动实测；仓库自带 161 个用例与 lint 门禁，
  欢迎 CI 的兼容性日检给出结论。

## 备注 / Notes

- 许可 / license：Apache-2.0（由 PerryLink/dsh-translate 改造而来，保留原版权与 NOTICE）
- 平台 / platform：仅 Web（`dsh.client.platform = web`），客户端逻辑运行在浏览器中
- 外部依赖 / external：需要一个 OpenAI 兼容的翻译服务；不配置时插件仍可加载，但翻译请求会失败并显示真实错误

<!-- 维护者可直接使用的目录条目（字段见 docs/catalog-schema.md）

{
  "id": "harness-lingo-translator",
  "name": "harness-lingo-translator",
  "npm": null,
  "repo": "sakemo12/harness-lingo-translator",
  "url": "https://github.com/sakemo12/harness-lingo-translator",
  "category": "ui",
  "description": { "en": "Shows translated thinking and replies in the DSH web UI through a local OpenAI-compatible model; code and paths stay verbatim.", "zh": "在 DSH Web 界面显示思考与回复的译文，翻译走本地 OpenAI 兼容模型；代码与路径保持原样。" },
  "author": "sakemo12",
  "stars": 1,
  "license": "Apache-2.0",
  "tags": ["translation", "i18n", "hy-mt", "local-model", "web-ui"],
  "dsh": { "minVersion": ">=0.2.1-0 <0.3.0", "peerCordis": "^4.0.5", "node": "^22.19.0 || >=24.0.0" },
  "compat": { "status": "unknown", "dshVersion": null, "lastVerified": null, "note": null }
}
-->
