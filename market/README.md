# 插件市场接入 / Marketplace listing

这个仓库用一份文案源（[`listing.json`](listing.json)）生成全部市场物料。当前状态：

| 渠道 | 状态 |
| --- | --- |
| DSH 官方「发现」页索引 | ✅ 已上线（jsDelivr 可访问，官方校验器通过） |
| dsh-plugin.org（DSH Plugin Hub） | ✅ **已收录并 Verified**（2026-11-21）：<https://dsh-plugin.org/plugins/sakemo12/harness-lingo-translator>；提交 issue [#875](https://github.com/dshplugin/dsh-plugin-hub/issues/875) 已关闭，对方留言「发布到 npm 后回复一声，会自动切到 npm 主通道」 |
| dsh-suite | 🟡 收录 issue [#83](https://github.com/whyihaveyou/dsh-suite/issues/83) 已开，等维护者 |
| awesome-dsh-plugin | ✅ **已合并**（2026-11-24，PR [#18602](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/18602)，CI 双检查通过） |
| awesome-DSH-plugin（Alex-Yanggg） | 🟡 PR [#200](https://github.com/Alex-Yanggg/awesome-DSH-plugin/pull/200) 已开（catalog + 中文镜像 + 英文目录），等维护者 |
| dshbase | ⏳ 未收录：它按 npm/GitHub 元数据批量抓取，目前页面仍是通用目录（数据快照滞后）；topic 已加，等下一轮 |
| npm | ⬜ 名字 `harness-lingo-translator` 未被占用，等发布——发布后 Hub 内市场与 dshbase 都会切到 npm 主通道 |
| dsh.so / AllDSH / DSH Hub / dshai.org | ⬜ 表单类，复制 [`submissions/dsh-plugin-org.md`](submissions/dsh-plugin-org.md) 改写即可 |

```sh
pnpm run market:build    # 由 listing.json 重新生成 index.json 与 submissions/*
pnpm run market:check    # 校验生成物没有漂移（离线，CI 也跑）
pnpm run market:verify   # 联网核对 topic、仓库年龄、npm 包名、锚定提交是否可达
pnpm run market:submit status   # 已提交的 issue / PR / topic 现场（只读）
```

> 不要手改 `index.json` 或 `submissions/`：由 `scripts/build-market.mjs` 生成，`market:check` 会拦下漂移。
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

### 1. 发布到 npm（渠道 1 的内市场、渠道 2 的 npm 映射）

```sh
npm login --registry=https://registry.npmjs.org
npm publish --registry=https://registry.npmjs.org --access public
```

或走 Actions → **Publish to npm**（先在仓库 Secrets 配 `NPM_TOKEN`）。发布后把 [`listing.json`](listing.json)
的 `source.type` 改成 `npm`，再 `pnpm run market:build`，索引安装源就从「锚定提交」变成 `name@version`。

> 网络考虑：`git+https://github.com/...` 与 `github:owner/repo` 两种装法都要连 GitHub。国内网络下 npm 包
> （含镜像 registry）是唯一稳的装法，所以 npm 不只是「让 Hub 一键装」，也是让墙内用户装得上。

### 2. npm 发布后回复 dsh-plugin.org

收录时维护者留言：「发布到 npm 后回复一声，我们会自动切到 npm 主通道」。所以 npm 发布完成后，
在 [#875](https://github.com/dshplugin/dsh-plugin-hub/issues/875) 回一句即可（它已关闭，评论仍会通知）：

```
已发布到 npm：dsh plugin --profile web add harness-lingo-translator
```

同时把 [`listing.json`](listing.json) 的 `source.type` 改成 `npm`，再 `pnpm run market:build`，
让「发现」页索引的安装源也切到 registry。

### 3. 表单类站点（可选）

dsh.so、AllDSH、DSH Hub、dshai.org 都是网页表单，把 [`submissions/dsh-plugin-org.md`](submissions/dsh-plugin-org.md)
的字段复制过去即可（同一份中英简介）。

## 提交流程（带令牌时）

`scripts/submit-market.mjs` 走 GitHub REST API，令牌从 `GH_TOKEN` 或 `~/.dsh-market-token` 读，从不打印。
没有 `--apply` 时只打印将要做的事。

```sh
node scripts/submit-market.mjs status              # 只读
node scripts/submit-market.mjs topics  --apply     # 加 dsh-plugin 等 topic
node scripts/submit-market.mjs issues  --apply     # 开 dsh-suite / dsh-plugin.org 收录 issue
node scripts/submit-market.mjs fork-awesome --apply # 建 fork + 分支 + 提交 YAML（24h 内不自动开 PR）
```

令牌要求：**classic PAT，scope `public_repo`**（`ghp_...`，7 天过期）。生成入口
<https://github.com/settings/tokens/new?scopes=public_repo&description=dsh-plugin-market>，
存到 `~/.dsh-market-token`（`chmod 600`），用完删掉。

### 两个 awesome 列表的 PR 为什么走 git 而不是纯 API

- **awesome-DSH-plugin（Alex-Yanggg）**：PR 必须同时包含 `catalog/plugins.json` 里的一条、由列表自带
  `scripts/generate_readmes.py` 重新生成的中文镜像 `docs/README.zh-CN.md`，以及手工维护的英文目录 `README.md`
  那一行。所以流程是：fork → clone → 写入条目 → `python3 scripts/generate_readmes.py` → 补英文行 → 提交 → 开 PR。
- **awesome-dsh-plugin**：规则是「一个 PR 只加一个文件」，所以 API 直接提交 `data/plugins/<owner>__<repo>.yml`
  就够了；但 CI 会检查仓库年龄（R5），因此 branch 先推、PR 后开。

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
