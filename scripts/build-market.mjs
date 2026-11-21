#!/usr/bin/env node
/**
 * Generate every marketplace artifact from `market/listing.json`.
 *
 *   node scripts/build-market.mjs            # write market/index.json + market/submissions/*
 *   node scripts/build-market.mjs --check    # fail if the committed artifacts drifted (no network)
 *   node scripts/build-market.mjs --verify   # also query GitHub and the npm registry (network)
 *   node scripts/build-market.mjs --commit <sha>  # pin a new release commit after bumping the version
 *
 * The market index format 1 is validated here structurally, and by the official
 * `@deepseek-ai/dsh-plugin-market-index` parser when that package is resolvable.
 * Nothing else in the repository may hand-edit the generated files.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const MARKET = join(ROOT, 'market')
const SUBMISSIONS = join(MARKET, 'submissions')
const INDEX_PATH = join(MARKET, 'index.json')

const args = parseArgs(process.argv.slice(2))
const checkOnly = args.check === true
const verify = args.verify === true

const listing = JSON.parse(readFileSync(join(MARKET, 'listing.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const iconSvg = readFileSync(join(ROOT, 'icon.svg'))
const icon = `data:image/svg+xml;base64,${iconSvg.toString('base64')}`

const repo = listing.repository
const pluginName = pkg.name
const short = listing.descriptions.short
const oneLine = listing.descriptions.oneLine
const long = listing.descriptions.long
const headline = listing.descriptions.headline

// The index pins the commit that carries the released code, not the commit that
// adds these artifacts: build before committing, and the pinned SHA is the
// release commit. --commit overrides it when a version bump lands afterwards.
const existingIndex = existsSync(INDEX_PATH) ? JSON.parse(readFileSync(INDEX_PATH, 'utf8')) : undefined
const existingVersion = existingIndex?.plugins?.[0]?.versions?.find((entry) => entry.version === pkg.version)
const sourceType = listing.source?.type ?? 'git'
if (sourceType !== 'git' && sourceType !== 'npm') throw new Error('market/listing.json source.type must be "git" or "npm"')
const commit = args.commit ?? existingVersion?.source?.commit ?? git(['rev-parse', 'HEAD'])
const publishTimestamp = args.commit === undefined && existingVersion?.publishTimestamp !== undefined
  ? existingVersion.publishTimestamp
  : commitTimestamp(commit)
const source = sourceType === 'npm' ? { type: 'npm' } : { type: 'git', url: repo, commit }

const index = {
  format: 1,
  title: { en: 'Harness Lingo Translator', zh: 'Harness Lingo Translator' },
  description: short,
  metadata: {
    categories: { [listing.category.id]: { title: listing.category.title } },
    labels: Object.fromEntries(Object.entries(listing.labels).map(([id, title]) => [id, { title }])),
    sortKeys: {},
  },
  plugins: [
    {
      name: pluginName,
      title: { en: 'Harness Lingo Translator', zh: 'Harness Lingo Translator' },
      description: short,
      icon,
      author: listing.author,
      homepage: `${repo}#readme`,
      repository: { url: repo },
      metadata: {
        category: listing.category.id,
        keywords: listing.keywords,
        labels: Object.keys(listing.labels),
      },
      versions: [
        {
          version: pkg.version,
          publishTimestamp,
          source,
          engines: { dsh: pkg.engines.dsh },
        },
      ],
    },
  ],
}

const problems = validate(index)
if (problems.length > 0) {
  for (const problem of problems) console.error(`market: ${problem}`)
  process.exit(1)
}
validateOfficially(index)

const outputs = new Map()
outputs.set(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`)
outputs.set(join(SUBMISSIONS, 'awesome-dsh-plugin.yml'), awesomeYaml())
outputs.set(join(SUBMISSIONS, 'awesome-dsh-plugin-pr.md'), awesomePullRequest())
outputs.set(join(SUBMISSIONS, 'alex-yanggg-catalog-entry.json'), alexCatalogEntry())
outputs.set(join(SUBMISSIONS, 'alex-yanggg-pr.md'), alexPullRequest())
outputs.set(join(SUBMISSIONS, 'dsh-suite-issue.md'), dshSuiteIssue())
outputs.set(join(SUBMISSIONS, 'dsh-plugin-org.md'), dshPluginOrgIssue())

mkdirSync(SUBMISSIONS, { recursive: true })
const drifted = []
for (const [path, content] of outputs) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : undefined
  if (checkOnly) {
    if (current !== content) drifted.push(relative(ROOT, path))
    continue
  }
  if (current !== content) writeFileSync(path, content)
  console.log(`market: wrote ${relative(ROOT, path)}`)
}

if (checkOnly) {
  if (drifted.length > 0) {
    console.error('market: generated artifacts are stale; run `pnpm run market:build`:')
    for (const path of drifted) console.error(`  - ${path}`)
    process.exit(1)
  }
  console.log(`market: ${String(outputs.size)} artifacts are up to date (v${pkg.version}, source ${sourceType === 'git' ? `git ${commit.slice(0, 7)}` : 'npm'})`)
}

if (verify) await verifyOnline(index)

// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--check') parsed.check = true
    else if (arg === '--verify') parsed.verify = true
    else if (arg === '--commit') parsed.commit = argv[++i]
    else if (arg.startsWith('--commit=')) parsed.commit = arg.slice('--commit='.length)
    else throw new Error(`unknown argument ${arg}`)
  }
  if (parsed.commit !== undefined && !/^[0-9a-f]{40}$/u.test(parsed.commit)) {
    throw new Error('--commit must be a lowercase 40-hex-digit commit SHA')
  }
  return parsed
}

function git(argv) {
  return execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function commitTimestamp(sha) {
  const raw = Number(git(['show', '-s', '--format=%ct', sha]))
  if (!Number.isInteger(raw) || raw < 0) throw new Error(`no commit timestamp for ${sha}`)
  return raw
}

/** Mirror the format-1 rules this repository can violate, so CI fails without DSH installed. */
function validate(value) {
  const found = []
  const fail = (where, reason) => found.push(`${where} ${reason}`)
  if (value.format !== 1) fail('$.format', 'must be 1')
  if (!value.title.en?.trim()) fail('$.title.en', 'must be a non-empty string')

  const declaredCategories = Object.keys(value.metadata.categories)
  const declaredLabels = Object.keys(value.metadata.labels)
  const names = new Set()

  value.plugins.forEach((plugin, position) => {
    const at = `$.plugins[${String(position)}]`
    if (!/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u.test(plugin.name)) fail(`${at}.name`, 'must be a valid npm package name')
    if (plugin.name !== pluginName) fail(`${at}.name`, `must be ${pluginName}`)
    if (names.has(plugin.name)) fail(`${at}.name`, 'must be unique')
    names.add(plugin.name)
    if (plugin.metadata.category !== listing.category.id) fail(`${at}.metadata.category`, `must be ${listing.category.id}`)
    if (!declaredCategories.includes(plugin.metadata.category)) fail(`${at}.metadata.category`, 'must be declared in $.metadata.categories')
    for (const label of plugin.metadata.labels) {
      if (!declaredLabels.includes(label)) fail(`${at}.metadata.labels`, `undeclared label ${label}`)
    }
    if (new Set(plugin.metadata.labels).size !== plugin.metadata.labels.length) fail(`${at}.metadata.labels`, 'must not repeat')
    if (!plugin.homepage?.startsWith('https://') && !plugin.homepage?.startsWith('http://')) fail(`${at}.homepage`, 'must be absolute http(s)')
    if (plugin.repository?.url !== repo) fail(`${at}.repository.url`, `must be ${repo}`)
    checkDataIcon(plugin.icon, `${at}.icon`, fail)
    if (!Array.isArray(plugin.versions) || plugin.versions.length === 0) fail(`${at}.versions`, 'must be a non-empty array')
    const seen = new Set()
    for (const [versionAt, version] of plugin.versions.entries()) {
      const where = `${at}.versions[${String(versionAt)}]`
      if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(version.version)) fail(`${where}.version`, 'must be an exact SemVer version')
      if (version.version !== pkg.version) fail(`${where}.version`, `must be ${pkg.version}`)
      if (seen.has(version.version)) fail(`${where}.version`, 'must be unique')
      seen.add(version.version)
      if (!Number.isInteger(version.publishTimestamp) || version.publishTimestamp < 0 || version.publishTimestamp >= 1e11) fail(`${where}.publishTimestamp`, 'must be integer Unix seconds')
      if (version.source?.type !== sourceType) fail(`${where}.source.type`, `must be "${sourceType}"`)
      if (sourceType === 'git') {
        if (version.source?.url !== repo) fail(`${where}.source.url`, `must be ${repo}`)
        if (!/^[0-9a-f]{40}$/u.test(version.source?.commit ?? '')) fail(`${where}.source.commit`, 'must be a lowercase 40-hex-digit commit SHA')
      }
      if (version.engines?.dsh !== pkg.engines.dsh) fail(`${where}.engines.dsh`, `must be ${pkg.engines.dsh}`)
      if (typeof version.engines?.dsh === 'string' && (version.engines.dsh.includes('workspace:') || !/\d/u.test(version.engines.dsh))) fail(`${where}.engines.dsh`, 'must be a SemVer range')
    }
  })

  for (const [language, text] of Object.entries(short)) {
    if (typeof text !== 'string' || text.trim() === '') fail(`$.description.${language}`, 'must be a non-empty string')
    if ([...text].length > 140) fail(`market/listing.json descriptions.short.${language}`, `is ${String([...text].length)} characters; dsh-suite allows 140`)
    if (!/[.。]$/u.test(text.trim())) fail(`market/listing.json descriptions.short.${language}`, 'must end with a period')
    if (/\n/u.test(text)) fail(`market/listing.json descriptions.short.${language}`, 'must be a single line')
    for (const word of ['best', 'amazing', 'revolutionary', 'powerful', 'seamless', 'ultimate', 'blazing', '最强大', '神器', '极致', '无敌', '惊艳']) {
      const pattern = /^[a-z]+$/u.test(word) ? new RegExp(String.raw`\b${word}\b`, 'iu') : new RegExp(word, 'u')
      if (pattern.test(text)) fail(`market/listing.json descriptions.short.${language}`, `contains the marketing word "${word}"`)
    }
  }

  for (const language of ['en', 'zh']) {
    if (!headline[language]?.trim()) fail(`market/listing.json descriptions.headline.${language}`, 'must be a non-empty string')
    if ([...headline[language]].length > 80) fail(`market/listing.json descriptions.headline.${language}`, 'must stay under 80 characters so issue titles stay readable')
    if (!oneLine[language]?.trim()) fail(`market/listing.json descriptions.oneLine.${language}`, 'must be a non-empty string')
    if (!long[language]?.trim()) fail(`market/listing.json descriptions.long.${language}`, 'must be a non-empty string')
  }

  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  if (!readme.includes(listing.descriptions.install.git)) fail('README.md', `must contain the install command ${listing.descriptions.install.git}`)

  const categoryId = listing.category.byMarket['awesome-dsh-plugin']
  const awesomeCategories = 'agi ui usage theme model identity session memory tools wsl browser vision voice docs skill workflow git notify dev security remote market fun'.split(' ')
  if (!awesomeCategories.includes(categoryId)) fail('market/listing.json category.byMarket.awesome-dsh-plugin', `must be one of ${awesomeCategories.join(', ')}`)

  return found
}

function checkDataIcon(value, where, fail) {
  if (typeof value !== 'string') return fail(where, 'must be a string')
  const match = /^data:(?:image\/svg\+xml|image\/png|image\/jpeg|image\/webp);base64,(.*)$/u.exec(value)
  if (match === null) return fail(where, 'must be a base64 SVG, PNG, JPEG, or WebP data URL')
  const bytes = Buffer.from(match[1], 'base64')
  if (bytes.length === 0 || bytes.length > 32 * 1024) fail(where, 'must decode to at most 32 KiB')
}

/** The authoritative check when the DSH packages are installed; skipped otherwise. */
function validateOfficially(value) {
  let parseMarketIndex
  try {
    const require = createRequire(join(ROOT, 'package.json'))
    ;({ parseMarketIndex } = require('@deepseek-ai/dsh-plugin-market-index'))
  } catch {
    console.log('market: official index validator not installed; structural checks only')
    return
  }
  parseMarketIndex(value, 'https://example.invalid/market/index.json')
  console.log('market: official format-1 validator accepted the index')
}

function awesomeYaml() {
  const category = listing.category.byMarket['awesome-dsh-plugin']
  return [
    `url: ${repo}`,
    `name: ${listing.author}/${pluginName}`,
    `category: ${category}`,
    'description:',
    `  en: ${yamlString(short.en)}`,
    `  zh: ${yamlString(short.zh)}`,
    '',
  ].join('\n')
}

function yamlString(text) {
  // YAML reads an unquoted ": " as a nested mapping key; quote anything risky.
  if (/^[\s'"]|[:#]\s|:\s/u.test(text) || /^[-?*&!|>%@`]/u.test(text)) return `'${text.replaceAll("'", "''")}'`
  return text
}

function awesomePullRequest() {
  const earliest = earliestAwesomeDate()
  return [
    `# Add ${listing.author}/${pluginName}`,
    '',
    'New entry file: `data/plugins/' + `${listing.author}__${pluginName}.yml` + '` (the only change in this PR).',
    '',
    '## What it does',
    '',
    short.en,
    '',
    'Translation runs through a local OpenAI-compatible endpoint (LM Studio, llama.cpp or vLLM serving',
    '`tencent/HY-MT1.5-1.8B`) or through the session\'s own model route. The browser masks code, paths,',
    'commands, URLs, identifiers and numbers as `⟦n⟧` placeholders, the host translates only the prose, and',
    'the masked text is restored verbatim. Session logs and workspace files are never written.',
    '',
    '## Rule check',
    '',
    '| Rule | Where |',
    '| --- | --- |',
    `| R2 \`dsh.bundle\` + R3 patch inserts a row | \`package.json\` → \`dsh.bundle.patch\`, \`cordis.patch.yml\` |`,
    '| R4 real code (no placeholder repo) | `index.mjs`, `lib/*.mjs`, `client/index.js`, `test/*.test.mjs` |',
    `| R5 repo older than one day | created ${listing.github.createdAt}; safe to open from ${earliest} |`,
    '| R6 `dsh-plugin` topic | **pending — add before opening the PR** |',
    '| R7 description | one line, ends with a period, no marketing words, every claim backed by code |',
    `| R8 category | \`${listing.category.byMarket['awesome-dsh-plugin']}\` — a display-layer translation UI |`,
    '| R10 icon | not declared: the repo icon is SVG, which the list rejects; the author avatar is the fallback |',
    '| R16 peers | `@deepseek-ai/*` packages are `peerDependencies` with pre-release ranges |',
    '',
    '## Install',
    '',
    '```sh',
    listing.descriptions.install.git,
    '```',
    '',
    `Upstream of this fork: ${'https://github.com/PerryLink/dsh-translate'}. Apache-2.0, Copyright 2026 PerryLink; modifications Copyright 2026 sakemo12.`,
    '',
  ].join('\n')
}

function alexCatalogEntry() {
  return `${JSON.stringify(
    {
      name: pluginName,
      url: repo,
      category: listing.category.byMarket['awesome-dsh-plugin-alex-yanggg'],
      description: { en: short.en, 'zh-CN': short.zh },
    },
    null,
    2,
  )}\n`
}

function alexPullRequest() {
  return [
    `# Add ${pluginName} to UI & user experience`,
    '',
    'One entry added to `catalog/plugins.json`; the Chinese mirror regenerated with',
    '`python scripts/generate_readmes.py`; and the matching bullet added by hand to the English catalog in',
    '`README.md`, which this list maintains manually.',
    '',
    '```json',
    alexCatalogEntry().trim(),
    '```',
    '',
    '## Both languages',
    '',
    `- en: ${short.en}`,
    `- zh-CN: ${short.zh}`,
    '',
    '## Install',
    '',
    '```sh',
    listing.descriptions.install.git,
    '```',
    '',
    'Apache-2.0. Community plugin, not affiliated with DeepSeek.',
    '',
  ].join('\n')
}

function dshSuiteIssue() {
  return [
    `# [收录] ${listing.author}/${pluginName} — ${headline.zh}`,
    '',
    '<!-- 中英任选其一填写即可 / Fill in either language. -->',
    '',
    '## 插件信息 / Plugin info',
    '',
    `- **npm 包名 / package name**：\`${pluginName}\`（尚未发布到 npm，待发布后补 / not yet on npm）`,
    `- **GitHub 仓库 / repo**：\`${listing.author}/${pluginName}\``,
    `- **一句话描述 / one-line description**：${short.zh}`,
    `- **分类 / category**：\`${listing.category.byMarket['dsh-suite']}\``,
    '',
    '## 为什么值得收录 / Why it belongs',
    '',
    '它解决的是非英语用户读 DSH 思考与回复的问题，做法与“改系统提示词让模型说中文”不同：只改渲染层，',
    '把代码、路径、命令、URL、标识符与数字遮成占位符，只把散文送去翻译，再把遮住的内容原样还原；',
    '占位符对不上的段落保留原文（fail closed）。翻译走本地 OpenAI 兼容服务（默认 LM Studio / llama.cpp /',
    'vLLM 承载 tencent/HY-MT1.5-1.8B），不经过云端；也可以切到当前会话的模型接口。会话日志、工作区文件与',
    'DSH 配置都不会被写入，唯一的文件写入是 `~/.dsh/cache/harness-lingo-translator/` 下的按工作区缓存。',
    '',
    '与同类插件的区别：不做整页机翻，不做 OCR；只翻译当前可见内容并跟随流式生成，静止悬停可看原文，',
    '译文行按原文/译文较大者固定高度，避免列表跳动。',
    '',
    '## 兼容性 / Compatibility',
    '',
    `- **DSH 最低版本 / min DSH version**：\`${pkg.engines.dsh}\``,
    `- **Node**：\`${pkg.engines.node}\``,
    '- **是否已在 DSH 上实测 / verified on DSH?**：未在干净 profile 上自动实测；仓库自带 161 个用例与 lint 门禁，',
    '  欢迎 CI 的兼容性日检给出结论。',
    '',
    '## 备注 / Notes',
    '',
    '- 许可 / license：Apache-2.0（由 PerryLink/dsh-translate 改造而来，保留原版权与 NOTICE）',
    '- 平台 / platform：仅 Web（`dsh.client.platform = web`），客户端逻辑运行在浏览器中',
    '- 外部依赖 / external：需要一个 OpenAI 兼容的翻译服务；不配置时插件仍可加载，但翻译请求会失败并显示真实错误',
    '',
    '<!-- 维护者可直接使用的目录条目（字段见 docs/catalog-schema.md）',
    '',
    '{',
    `  "id": "${pluginName}",`,
    `  "name": "${pluginName}",`,
    `  "npm": null,`,
    `  "repo": "${listing.author}/${pluginName}",`,
    `  "url": "${repo}",`,
    `  "category": "${listing.category.byMarket['dsh-suite']}",`,
    `  "description": { "en": ${JSON.stringify(short.en)}, "zh": ${JSON.stringify(short.zh)} },`,
    `  "author": "${listing.author}",`,
    `  "stars": ${String(listing.github.stars)},`,
    '  "license": "Apache-2.0",',
    '  "tags": ["translation", "i18n", "hy-mt", "local-model", "web-ui"],',
    `  "dsh": { "minVersion": "${pkg.engines.dsh}", "peerCordis": "${pkg.peerDependencies['@deepseek-ai/cordis']}", "node": "${pkg.engines.node}" },`,
    '  "compat": { "status": "unknown", "dshVersion": null, "lastVerified": null, "note": null }',
    '}',
    '-->',
    '',
  ].join('\n')
}

function dshPluginOrgIssue() {
  const body = [
    '### Repository',
    repo,
    '',
    '### One-line value',
    oneLine.en,
    '',
    '### Category',
    'UI & Experience',
    '',
    '### Install command',
    listing.descriptions.install.git,
    `(npm: \`${listing.descriptions.install.npm}\` once the package is published)`,
    '',
    '### Compatibility',
    listing.descriptions.compatibility.en,
    '',
    '### License',
    'Apache-2.0',
    '',
    '### Screenshots / demo',
    '_None yet._',
    '',
    '### Notes',
    `${listing.descriptions.permissions.en} ${listing.descriptions.limitations.en}`,
    '',
    '### Pre-submission checklist',
    '- [x] Repository is public',
    '- [ ] GitHub topic `dsh-plugin` added',
    '- [x] README includes the install command',
    '- [x] Plugin exports an `apply(ctx)` module',
    '- [x] Repository root includes a `package.json`',
    '',
  ].join('\n')

  const title = `[Plugin submission] ${listing.author}/${pluginName} — ${headline.en}`
  const url = `https://github.com/dshplugin/dsh-plugin-hub/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`

  return [
    '# dsh-plugin.org (DSH Plugin Hub) submission',
    '',
    'The hub crawls every public repository that carries the `dsh-plugin` topic, so the topic is the',
    'submission. The issue is the faster route and gives a human a checklist to review.',
    '',
    '## Open the prefilled issue',
    '',
    url,
    '',
    '## Body',
    '',
    body,
  ].join('\n')
}

function earliestAwesomeDate() {
  const created = Date.parse(listing.github.createdAt)
  if (Number.isNaN(created)) return 'the day after the repo was created'
  return new Date(created + 24 * 60 * 60 * 1000).toISOString().replace(/\.000Z$/u, ' UTC')
}

async function verifyOnline(value) {
  const failures = []
  const notes = []
  const repoInfo = await github(`repos/${listing.author}/${pluginName}`)
  if (!repoInfo.ok || repoInfo.data === undefined) {
    failures.push(`GitHub API: repository lookup failed (${describe(repoInfo)}); cannot confirm the listing gates`)
  } else {
    const info = repoInfo.data
    const topics = (await github(`repos/${listing.author}/${pluginName}/topics`)).data?.names ?? info.topics ?? []
    if (!topics.includes('dsh-plugin')) failures.push(`GitHub: the repo has no "dsh-plugin" topic (topics: ${topics.join(', ') || 'none'}); dsh-plugin.org, awesome-dsh-plugin and every crawler index by it`)
    const ageHours = (Date.now() - Date.parse(info.created_at)) / 3_600_000
    if (ageHours < 24) failures.push(`GitHub: the repo is ${ageHours.toFixed(1)}h old; awesome-dsh-plugin needs 24h (opens ${earliestAwesomeDate()})`)
    if (!info.description) failures.push('GitHub: the repo description is empty; dsh-plugin.org and dshbase read it')
    if (listing.github.createdAt !== info.created_at) notes.push(`market/listing.json github.createdAt is ${listing.github.createdAt}; GitHub says ${info.created_at}`)
    if (listing.github.stars !== info.stargazers_count) notes.push(`market/listing.json github.stars is ${String(listing.github.stars)}; GitHub says ${String(info.stargazers_count)}`)
  }

  const npm = await npmNameStatus(pluginName)
  if (npm === 'taken') failures.push(`npm: ${pluginName} is already published; switch market/listing.json source.type to "npm" and rebuild`)
  if (npm === 'free') notes.push(`npm name ${pluginName} is free; publish it to appear in the DSH Plugin Hub and dshbase`)
  if (npm === 'unknown') notes.push(`npm registry did not answer; could not confirm the ${pluginName} name`)

  for (const version of value.plugins[0].versions) {
    if (version.source.type !== 'git') continue
    const commitInfo = await github(`repos/${listing.author}/${pluginName}/commits/${version.source.commit}`)
    if (commitInfo.status === 404) failures.push(`GitHub: pinned commit ${version.source.commit} is not on the remote; push it before anyone installs from the index`)
    else if (!commitInfo.ok) notes.push(`GitHub: could not check pinned commit ${version.source.commit} (${describe(commitInfo)})`)
  }

  for (const note of notes) console.log(`market: note: ${note}`)
  if (failures.length === 0) {
    console.log('market: online checks passed')
    return
  }
  for (const failure of failures) console.error(`market: ${failure}`)
  process.exitCode = 1
}

function describe(result) {
  return result.status === 0 ? 'network error' : `HTTP ${String(result.status)}`
}

async function github(path) {
  try {
    const response = await fetch(`https://api.github.com/${path}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'harness-lingo-translator-market' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return { ok: false, status: response.status, data: undefined }
    return { ok: true, status: response.status, data: await response.json() }
  } catch {
    return { ok: false, status: 0, data: undefined }
  }
}

async function npmNameStatus(name) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 404) return 'free'
    if (response.ok) return 'taken'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}
