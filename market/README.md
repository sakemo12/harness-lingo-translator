# 插件市场接入 / Marketplace listing

一句话：这个仓库用一份文案源（[`listing.json`](listing.json)）生成全部市场物料，其中「官方发现页索引」和
「dsh-plugin.org 自动收录」只差两个外部动作：给仓库加 `dsh-plugin` topic、把包发到 npm。

```sh
pnpm run market:build   # 由 listing.json 重新生成 index.json 与 submissions/*
pnpm run market:check   # 校验生成的物料没有漂移（离线，CI 也跑）
pnpm run market:verify  # 联网核对 topic、仓库年龄、npm 包名、锚定提交是否可达
```

> 不要手改 `index.json` 或 `submissions/`：它们由 `scripts/build-market.mjs` 生成，`market:check` 会拦下漂移。
> 文案只改 [`listing.json`](listing.json)。

## 渠道总览

| # | 渠道 | 类型 | 入口 | 自动程度 | 现在缺什么 |
| --- | --- | --- | --- | --- | --- |
| 1 | **dsh-plugin.org（DSH Plugin Hub）** | topic 爬取 + 审核 | <https://dsh-plugin.org/submit> | 加 topic 后自动 | `dsh-plugin` topic；想进 DSH 内市场还需 npm 包 |
| 2 | **dshbase**（2.6 万条目录） | 元数据爬取 | <https://dshbase.com/plugins/directory/> | 全自动 | npm 包与更清楚的仓库描述（可选） |
| 3 | **awesome-dsh-plugin**（一插件一文件） | PR | <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin> | 手开 PR | topic；仓库满 24 小时；一个新增 YAML |
| 4 | **awesome-DSH-plugin**（Alex-Yanggg） | PR | <https://github.com/Alex-Yanggg/awesome-DSH-plugin> | 手开 PR | 一条 `catalog/plugins.json` 条目 |
| 5 | **dsh-suite 目录** | Issue | <https://github.com/whyihaveyou/dsh-suite/issues/new/choose> | 手开 Issue | 按模板填一份收录申请 |
| 6 | **DSH 官方「发现」页**（format 1 索引） | 自建索引源 | 本仓库 [`index.json`](index.json) | 已完成 | 无（用户手动添加索引源即可） |
| 7 | **npm** | registry | <https://www.npmjs.com/package/harness-lingo-translator> | 手动发布 | `NPM_TOKEN`（名字 `harness-lingo-translator` 目前未被占用） |
| 8 | dsh.so / AllDSH / DSH Hub / dshai.org | 表单提交 | 各自 `/submit`、`/publish` | 手填表单 | 复制 [`dsh-plugin-org.md`](submissions/dsh-plugin-org.md) 的内容改写 |

渠道 1、2 和 dsh-recommend、dsh-plugin-hub 这类聚合器都按 GitHub topic `dsh-plugin` 抓取，所以**第 1 步永远是加 topic**。

## 一次性动作（按顺序，约 10 分钟）

### 1. 加 `dsh-plugin` topic（必须）

```sh
gh repo edit sakemo12/harness-lingo-translator \
  --add-topic dsh-plugin --add-topic dsh --add-topic deepseek-harness \
  --add-topic translation --add-topic i18n
```

没有 `gh` 就在仓库首页 About 旁的齿轮里加 Topics：`dsh-plugin`、`dsh`、`deepseek-harness`、`translation`、`i18n`。

只有 `dsh-plugin` 是硬的收录条件，其余四个帮搜索；加完后 `pnpm run market:verify` 应当只剩「仓库年龄」和 npm 两条提示。

### 2. 发布到 npm（渠道 1 的内市场、渠道 2 的 npm 映射都靠它）

```sh
npm login --registry=https://registry.npmjs.org
npm publish --registry=https://registry.npmjs.org --access public
```

也可以用现成的手动工作流：GitHub → Actions → **Publish to npm** → Run workflow（需要先在该仓库 Secrets 里配
`NPM_TOKEN`）。发布成功后把 [`listing.json`](listing.json) 的 `source.type` 改成 `npm`，再
`pnpm run market:build`：索引里的安装源就从「锚定提交的 git 地址」变成 `harness-lingo-translator@x.y.z`，
和 DSH Plugin Hub 的一键安装命令一致。

> 发布前自检：`pnpm test && pnpm run lint && pnpm run verify:self-contained && pnpm pack`。

### 3. 提交三个 PR / Issue（素材已生成）

| 渠道 | 复制这个 | 目标 |
| --- | --- | --- |
| 3 | [`submissions/awesome-dsh-plugin.yml`](submissions/awesome-dsh-plugin.yml) → `data/plugins/sakemo12__harness-lingo-translator.yml` | 新分支 → PR，正文用 [`awesome-dsh-plugin-pr.md`](submissions/awesome-dsh-plugin-pr.md) |
| 4 | [`submissions/alex-yanggg-catalog-entry.json`](submissions/alex-yanggg-catalog-entry.json) → 追加进 `catalog/plugins.json`，再跑 `python scripts/generate_readmes.py` | 正文用 [`alex-yanggg-pr.md`](submissions/alex-yanggg-pr.md) |
| 5 | [`submissions/dsh-suite-issue.md`](submissions/dsh-suite-issue.md) | 直接贴进 issue 正文 |

> ⚠️ 渠道 3 的 CI 要求仓库创建满 24 小时。本仓库创建于 `2026-11-21T09:21:30Z`，
> **北京时间 2026-11-22 17:21 之后**再开这个 PR（`pnpm run market:verify` 会实时算）。

### 4. 让用户在 DSH 里找到它

插件页 → **发现** → **添加索引源**，填：

```
https://cdn.jsdelivr.net/gh/sakemo12/harness-lingo-translator@main/market/index.json
```

- `@main` 走 CDN，更新后约 12 小时生效；要立即生效用
  `https://raw.githubusercontent.com/sakemo12/harness-lingo-translator/main/market/index.json`。
- 「发现」标签页来自官方的实验性组合包：插件页 → 实验性插件 → 更多 → 启用「自定义插件市场」。
- 索引里的安装源锚定到发布提交（当前 `00f2086`），所以 `@main` 之后推送的文档改动不会改变装到的代码。

## 维护：发新版本时

```sh
# 1. 改代码，跑门禁
pnpm test && pnpm run lint && pnpm run verify:self-contained
# 2. 升 package.json 版本，提交（这个提交就是新的发布提交）
git add -A && git commit -m "release: vX.Y.Z"
# 3. 用这个提交重新生成市场物料，然后单独提交
pnpm run market:build && git add market && git commit -m "market: publish vX.Y.Z"
# 4. 打标签（Release 工作流会建 GitHub Release），推送
git tag -a vX.Y.Z -m vX.Y.Z && git push origin main --tags
```

`market:build` 在版本号变化时会用当前 `HEAD` 作为锚定提交；同一版本重复执行保持原锚定，所以第 3 步之前不要
再改代码。

## 徽章（收录后替换 slug）

```md
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/sakemo12/harness-lingo-translator)
[![dshbase install-tested](https://dshbase.com/badges/harness-lingo-translator.svg)](https://dshbase.com/plugins/harness-lingo-translator/)
```

dshbase 的徽章会随它的 L1/L2/L3/L4 实测结果自己变，本站不承诺状态。

## 各渠道的规则要点（免得白跑一趟）

- **awesome-dsh-plugin**：一个 PR 一个 `data/plugins/<owner>__<repo>.yml`；必须 `dsh.bundle`（本仓库有）；
  patch 文件要真的 `insert`（本仓库有）；有效代码 ≥10 行；仓库 ≥24 小时；必须 topic；描述单行、句号结尾、
  无营销词、每句能在代码里找到对应；`icon` 只收 GitHub 托管的 png/jpg/webp（SVG 会被拒，所以本条目不声明 icon）。
- **dsh-suite**：Issue 模板五个字段；目录字段见其 `docs/catalog-schema.md`，双语各 ≤140 字符（本仓库文案已按
  140 字符校验）。
- **dsh-plugin.org**：public 仓库 + topic + 根 `package.json` + `apply(ctx)` 导出 + README 里有安装命令。
  前四项仓库都满足；README 的安装命令由 `market:check` 守着。
- **dshbase**：不做人工提交，按 npm/GitHub 元数据生成；保证仓库有 `dsh.bundle`、有 README、有清楚的一句话描述即可。

## 文案

全部中英文案在 [`listing.json`](listing.json)：`short`（≤140 字符，卡片/目录用）、`oneLine`（渠道 1、8 的
"装上之后有什么变化"）、`long`（详情页/README）。改文案只改这一处，再 `pnpm run market:build`。
