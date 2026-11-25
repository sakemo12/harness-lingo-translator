# 插件市场接入 / Marketplace listing

这个仓库用一份文案源（[`listing.json`](listing.json)）生成全部市场物料。当前状态：

| 渠道 | 状态 |
| --- | --- |
| DSH 官方「发现」页索引 | ✅ 已上线（jsDelivr 可访问，官方校验器通过）；安装源已切到 npm `harness-lingo-translator@1.14.1` |
| dsh-plugin.org（DSH Plugin Hub） | ✅ **已收录并 Verified**（2026-11-21）：<https://dsh-plugin.org/plugins/sakemo12/harness-lingo-translator>；issue [#875](https://github.com/dshplugin/dsh-plugin-hub/issues/875) 已关闭，并在 11-25 评论告知 npm 已发布——页面当前仍显示 GitHub 装法，等对方切主通道 |
| dsh-suite | 🟡 收录 issue [#83](https://github.com/whyihaveyou/dsh-suite/issues/83) 已开，并已补充 npm 包名/版本供目录填 `npm` 字段，等维护者 |
| awesome-dsh-plugin | ✅ **已合并**（2026-11-24，PR [#18602](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/18602)，CI 双检查通过） |
| awesome-DSH-plugin（Alex-Yanggg） | 🟡 PR [#200](https://github.com/Alex-Yanggg/awesome-DSH-plugin/pull/200) 已开（catalog + 中文镜像 + 英文目录），11-25 留了一条礼貌催办 + npm 安装命令 |
| dshbase | ⏳ 未收录：它按 npm/GitHub 元数据批量抓取，目前页面仍是通用目录（数据快照滞后）；topic 已加，等下一轮 |
| npm | ✅ **已发布 `harness-lingo-translator@1.14.1`**（2026-11-26，1.14.0 于 11-25 首发）：<https://www.npmjs.com/package/harness-lingo-translator>；索引安装源已切到 registry |
| dsh.so / AllDSH / DSH Hub / dshai.org | ⬜ 表单类：`pnpm run market:build` 后复制 `market/submissions/dsh-plugin-org.md` 改写即可 |

```sh
pnpm run market:build    # 由 listing.json 重新生成 index.json 与 submissions/*
pnpm run market:check    # 校验生成物没有漂移（离线，CI 也跑）
pnpm run market:verify   # 联网核对 topic、仓库年龄、npm 包名、锚定提交是否可达
pnpm run market:submit status   # 已提交的 issue / PR / topic 现场（只读）
```

> 不要手改 `index.json`（`market:check` 会拦下漂移）；提交材料是本地临时产物，也不该手改。
> 文案只改 [`listing.json`](listing.json)。

## 索引源（已经可用）

在插件页 → **发现** → **添加索引源**填：

```
https://cdn.jsdelivr.net/gh/sakemo12/harness-lingo-translator@main/market/index.json
```

- 「发现」标签页来自官方实验性组合包：插件页 → 实验性插件 → 更多 → 启用「自定义插件市场」。
- `@main` 走 CDN（约 12 小时缓存）；要立即生效用
  `https://raw.githubusercontent.com/sakemo12/harness-lingo-translator/main/market/index.json`。
- 索引里的安装源锚定发布提交（当前 `00f2086`），文档提交不会改变用户装到的代码。

## 剩余动作

### 1. 后续发版

```sh
# 1) 升版本、跑门禁、提交（这个提交就是新的发布提交）
pnpm test && pnpm run lint && pnpm run verify:self-contained
git add -A && git commit -m "release: vX.Y.Z"
# 2) 用这个提交重建市场物料
pnpm run market:build && git add market && git commit -m "market: publish vX.Y.Z"
# 3) 打标签推送（Release 工作流建 GitHub Release）
git tag -a vX.Y.Z -m vX.Y.Z && git push origin main --tags
# 4) 发 npm（先 npm login，或配 NPM_TOKEN 走 Actions → Publish to npm）
npm publish --access public
```

`listing.json` 的 `source.type` 已经是 `npm`，所以索引会自动装 `harness-lingo-translator@X.Y.Z`；
只有想回到「锚定提交」的装法时才需要改回 `git`。

### 2. 回复 dsh-plugin.org（已做，留作记录）

收录时维护者留言：「发布到 npm 后回复一声，我们会自动切到 npm 主通道」。所以 npm 发布完成后，
在 [#875](https://github.com/dshplugin/dsh-plugin-hub/issues/875) 回一句即可（它已关闭，评论仍会通知）：

```
已发布到 npm：dsh plugin --profile web add harness-lingo-translator
```

同时把 [`listing.json`](listing.json) 的 `source.type` 改成 `npm`，再 `pnpm run market:build`，
让「发现」页索引的安装源也切到 registry。

### 3. 表单类站点（可选）

dsh.so、AllDSH、DSH Hub、dshai.org 都是网页表单：先 `pnpm run market:build` 生成
`market/submissions/dsh-plugin-org.md`，把里面的字段复制过去即可（同一份中英简介）。

## 提交材料的存放方式

`market/submissions/` 里的 YAML、catalog 条目、issue/PR 正文都**不进仓库**（`.gitignore` 已忽略），
需要时用 `pnpm run market:build` 现生成；仓库里只版本化两个文件：

- `market/index.json` — 线上索引（CDN 直接取它），必须跟着版本走
- `market/listing.json` — 文案源，索引与提交材料都从它生成

一次性提交（已全部完成，留档备查）：

- **awesome-dsh-plugin**：一个 PR 只加一个文件，直接提交 `data/plugins/<owner>__<repo>.yml`；
  CI 会检查仓库年龄（R5 ≥24h）
- **awesome-DSH-plugin（Alex-Yanggg）**：PR 必须同时含 `catalog/plugins.json` 的一条、用列表自带
  `scripts/generate_readmes.py` 重新生成的中文镜像 `docs/README.zh-CN.md`、以及手工维护的英文 `README.md` 那一行
- **dsh-plugin.org / dshbase**：topic 与 npm 元数据驱动，无需手工提交

## 维护：发新版本时

```sh
pnpm test && pnpm run lint && pnpm run verify:self-contained
# 1. 升 package.json 版本，提交（这个提交就是新的发布提交）
git add -A && git commit -m "release: vX.Y.Z"
# 2. 用这个提交重新生成市场物料，单独提交
pnpm run market:build && git add market && git commit -m "market: publish vX.Y.Z"
# 3. 打标签并推送
git tag -a vX.Y.Z -m vX.Y.Z && git push origin main --tags
```

`market:build` 在版本号变化时用当前 `HEAD` 作锚定提交；同一版本重复执行保持原锚定，所以第 2 步之前不要再改代码。

## 徽章（收录后替换 slug）

```md
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/sakemo12/harness-lingo-translator)
[![dshbase install-tested](https://dshbase.com/badges/harness-lingo-translator.svg)](https://dshbase.com/plugins/harness-lingo-translator/)
```

## 各渠道的规则要点

- **awesome-dsh-plugin**：一个 PR 一个 `data/plugins/<owner>__<repo>.yml`；必须 `dsh.bundle`（本仓库有）；
  patch 必须真的 `insert`（有）；有效代码 ≥10 行；仓库 ≥24 小时；必须 topic；描述单行、句号结尾、无营销词、
  每句能在代码里找到对应；`icon` 只收 GitHub 托管位图（SVG 会被拒，所以本条目不声明 icon）。
- **awesome-DSH-plugin**：`catalog/plugins.json` 必填 name / url / category / description(en+zh-CN)；
  改完必须跑它自带的生成器，中文镜像才算「current」；英文 README 手工维护。
- **dsh-suite**：Issue 模板五段；目录字段见其 `docs/catalog-schema.md`，双语各 ≤140 字符（本仓库文案已校验）。
- **dsh-plugin.org**：public 仓库 + topic + 根 `package.json` + `apply(ctx)` 导出 + README 里有安装命令。
  这些都已满足（README 的安装命令由 `market:check` 守着）。
- **dshbase**：不人工提交，按 npm / GitHub 元数据生成。

## 文案

全部中英文案在 [`listing.json`](listing.json)：`headline`（标题短句）、`short`（≤140 字符，卡片/目录）、
`oneLine`（"装上之后有什么变化"）、`long`（详情页/README）。改文案只改这一处，再 `pnpm run market:build`。
