// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadClient } from './helpers.mjs'

const client = await loadClient()
const { ConfigPanel, commitConfig, diffConfigDraft, DICTS, SETTINGS_SLOT_KEY } = client.__test
const t = (key) => DICTS.zh[key] ?? key

const values = {
  baseUrl: 'http://192.168.1.10:8080/v1',
  model: 'hy-mt1.5-1.8b',
  concurrency: 2,
  batchReasoning: false,
  systemModel: false,
  promptHeader: '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释',
  placeholderGuard: true,
  placeholderFormat: '[n]',
  placeholderHint: '',
  hoverRestore: true,
  hoverRestoreMs: 200,
}

function form(overrides = {}) {
  return {
    state: {
      status: 'ready',
      value: values,
      base: {},
      user: {},
      writable: true,
      revision: 3,
      ...overrides,
    },
    mutate: async () => true,
  }
}

test('the settings page is keyed to the bundle row', () => {
  assert.equal(SETTINGS_SLOT_KEY, 'harness-lingo-translator#harness-lingo-translator')
})

test('the settings fields use the host config names', () => {
  const fields = client.__test.SETTINGS_FIELDS
  assert.ok(fields.includes('systemModel'))
  assert.ok(fields.includes('placeholderFormat'))
  assert.equal(fields.includes('sessionModel'), false)
  assert.deepEqual(diffConfigDraft({ systemModel: true }, values), {
    ops: [{ op: 'set', path: ['systemModel'], value: true }],
    error: null,
  })
})

test('diffConfigDraft writes only changed fields', () => {
  assert.deepEqual(diffConfigDraft({}, values), { ops: [], error: null })
  assert.deepEqual(diffConfigDraft({ apiKey: '' }, values), { ops: [], error: null })
  assert.deepEqual(diffConfigDraft({ apiKey: '  sk-test  ' }, values), {
    ops: [{ op: 'set', path: ['apiKey'], value: 'sk-test' }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ concurrency: '4' }, values), {
    ops: [{ op: 'set', path: ['concurrency'], value: 4 }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ concurrency: '2' }, values), { ops: [], error: null })
  assert.equal(diffConfigDraft({ concurrency: '0' }, values).error, 'invalid')
  assert.equal(diffConfigDraft({ concurrency: '1.5' }, values).error, 'invalid')
  assert.equal(diffConfigDraft({ concurrency: '99' }, values).error, 'invalid')
  assert.deepEqual(diffConfigDraft({ batchReasoning: true }, values), {
    ops: [{ op: 'set', path: ['batchReasoning'], value: true }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ batchReasoning: false }, values), { ops: [], error: null })
  assert.deepEqual(diffConfigDraft({ promptHeader: '  Use a formal tone.  ' }, values), {
    ops: [{ op: 'set', path: ['promptHeader'], value: 'Use a formal tone.' }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ promptHeader: '' }, { ...values, promptHeader: 'Old header' }), {
    ops: [{ op: 'unset', path: ['promptHeader'] }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ placeholderGuard: false }, values), {
    ops: [{ op: 'set', path: ['placeholderGuard'], value: false }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ placeholderFormat: '[n]' }, values), { ops: [], error: null })
  assert.deepEqual(diffConfigDraft({ placeholderFormat: '⟦n⟧' }, values), {
    ops: [{ op: 'set', path: ['placeholderFormat'], value: '⟦n⟧' }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ placeholderFormat: '' }, { ...values, placeholderFormat: '⟦n⟧' }), {
    ops: [{ op: 'unset', path: ['placeholderFormat'] }],
    error: null,
  })
  assert.equal(diffConfigDraft({ placeholderFormat: '[]' }, values).error, 'invalid')
  assert.equal(diffConfigDraft({ placeholderFormat: 'n' }, values).error, 'invalid')
  assert.deepEqual(diffConfigDraft({ placeholderHint: '  Keep tokens.  ' }, values), {
    ops: [{ op: 'set', path: ['placeholderHint'], value: 'Keep tokens.' }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ placeholderHint: '' }, { ...values, placeholderHint: 'Old' }), {
    ops: [{ op: 'unset', path: ['placeholderHint'] }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ hoverRestore: false }, values), {
    ops: [{ op: 'set', path: ['hoverRestore'], value: false }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ hoverRestoreMs: '2000' }, values), {
    ops: [{ op: 'set', path: ['hoverRestoreMs'], value: 2000 }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ systemModel: true }, values), {
    ops: [{ op: 'set', path: ['systemModel'], value: true }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ hoverRestoreMs: '0' }, values), {
    ops: [{ op: 'set', path: ['hoverRestoreMs'], value: 0 }],
    error: null,
  })
  assert.equal(diffConfigDraft({ hoverRestoreMs: '-1' }, values).error, 'invalid')
  assert.deepEqual(diffConfigDraft({ baseUrl: 'http://192.168.1.10:8080/v1' }, values), { ops: [], error: null })
  assert.deepEqual(diffConfigDraft({ baseUrl: 'http://192.168.1.11:8080/v1' }, values), {
    ops: [{ op: 'set', path: ['baseUrl'], value: 'http://192.168.1.11:8080/v1' }],
    error: null,
  })
  assert.deepEqual(diffConfigDraft({ baseUrl: '  http://192.168.1.11:8080/v1  ' }, values), {
    ops: [{ op: 'set', path: ['baseUrl'], value: 'http://192.168.1.11:8080/v1' }],
    error: null,
  })
  assert.match(diffConfigDraft({ baseUrl: '   ' }, values).error, /^empty/)
  assert.equal(diffConfigDraft({ baseUrl: '192.168.1.10:8080/v1' }, values).error, 'invalid')
  assert.equal(diffConfigDraft({ baseUrl: 'ftp://192.168.1.10/v1' }, values).error, 'invalid')
  assert.deepEqual(diffConfigDraft({ baseUrl: 'http://192.168.1.10:8080/v1' }, values).ops, [])
})

test('commitConfig writes through the page form only when something changed', async () => {
  const written = []
  const fake = { ...form(), mutate: async (ops) => { written.push(ops); return true } }

  const unchanged = await commitConfig(fake, {}, values)
  assert.equal(unchanged.accepted, null)
  assert.equal(written.length, 0)

  const empty = await commitConfig(fake, { model: '  ' }, values)
  assert.equal(empty.diff.error, 'empty')
  assert.equal(empty.accepted, null)
  assert.equal(written.length, 0)

  const invalid = await commitConfig(fake, { baseUrl: '192.168.1.10:8080/v1' }, values)
  assert.equal(invalid.diff.error, 'invalid')
  assert.equal(invalid.accepted, null)
  assert.equal(written.length, 0)

  const accepted = await commitConfig(fake, { baseUrl: 'http://192.168.2.20:8080/v1', model: 'hy-mt1.5-1.8b' }, values)
  assert.equal(accepted.accepted, true)
  assert.deepEqual(written, [[{ op: 'set', path: ['baseUrl'], value: 'http://192.168.2.20:8080/v1' }]])
})

test('commitConfig can write the token and concurrency on their own', async () => {
  const written = []
  const fake = { ...form(), mutate: async (ops) => { written.push(ops); return true } }
  const tokenResult = await commitConfig(fake, { apiKey: 'sk-local-token' }, values)
  assert.equal(tokenResult.accepted, true)
  assert.deepEqual(written[0], [{ op: 'set', path: ['apiKey'], value: 'sk-local-token' }])
  const concurrencyResult = await commitConfig(fake, { concurrency: '3' }, values)
  assert.equal(concurrencyResult.accepted, true)
  assert.deepEqual(written[1], [{ op: 'set', path: ['concurrency'], value: 3 }])
  const batchResult = await commitConfig(fake, { batchReasoning: true }, values)
  assert.equal(batchResult.accepted, true)
  assert.deepEqual(written[2], [{ op: 'set', path: ['batchReasoning'], value: true }])
  const headerResult = await commitConfig(fake, { promptHeader: 'Use a formal tone.' }, values)
  assert.equal(headerResult.accepted, true)
  assert.deepEqual(written[3], [{ op: 'set', path: ['promptHeader'], value: 'Use a formal tone.' }])
  const guardResult = await commitConfig(fake, { placeholderGuard: false }, values)
  assert.equal(guardResult.accepted, true)
  assert.deepEqual(written[4], [{ op: 'set', path: ['placeholderGuard'], value: false }])
  const hintResult = await commitConfig(fake, { placeholderHint: 'Keep tokens.' }, values)
  assert.equal(hintResult.accepted, true)
  assert.deepEqual(written[5], [{ op: 'set', path: ['placeholderHint'], value: 'Keep tokens.' }])
})

test('commitConfig reports a rejected write', async () => {
  const rejected = await commitConfig(
    { ...form(), mutate: async () => false },
    { baseUrl: 'http://192.168.2.20:8080/v1' },
    values,
  )
  assert.equal(rejected.accepted, false)
})

test('the page renders the top tabs and the connection fields', () => {
  const html = renderToStaticMarkup(React.createElement(ConfigPanel, { t, view: 'page', form: form() }))
  for (const label of ['连接', '翻译', '悬停', '翻译缓存']) assert.match(html, new RegExp(label))
  assert.match(html, /自定义服务/)
  assert.match(html, /系统模型/)
  assert.match(html, /服务地址/)
  assert.match(html, /http:\/\/192\.168\.1\.10:8080\/v1/)
  assert.match(html, /模型名/)
  assert.match(html, /hy-mt1\.5-1\.8b/)
  assert.match(html, /API 令牌/)
  assert.match(html, /type="password"/)
  assert.match(html, /留空 = 不修改/)
  assert.match(html, /保存/)
  assert.equal(html.includes('并发数'), false)
})

test('the translation and hover tabs show only their own fields', () => {
  const translation = renderToStaticMarkup(React.createElement(ConfigPanel, { t, initialTab: 'translation', view: 'page', form: form() }))
  assert.match(translation, /并发数/)
  assert.match(translation, /长思考合并请求/)
  assert.match(translation, /翻译提示词头/)
  assert.match(translation, /关键词保留/)
  assert.match(translation, /遮罩格式/)
  assert.match(translation, /value="\[n\]"/)
  assert.match(translation, /更高的模型智商/)
  assert.match(translation, /（一般来说默认模式准确度已经极高，开启此项目反而可能会引入错误）/)
  assert.match(translation, /自定义关键词保留提示词/)
  assert.match(translation, /<textarea/)
  assert.equal(translation.includes('服务地址'), false)
  const hover = renderToStaticMarkup(React.createElement(ConfigPanel, { t, initialTab: 'hover', view: 'page', form: form() }))
  assert.match(hover, /悬停显示原文/)
  assert.match(hover, /悬停时长/)
  assert.equal(hover.includes('并发数'), false)
  const cache = renderToStaticMarkup(React.createElement(ConfigPanel, { t, initialTab: 'cache', view: 'page', form: form() }))
  assert.match(cache, /默认保存目录/)
  assert.match(cache, /清理已删除对话的缓存/)
})

test('the stored token is never rendered', () => {
  const withToken = form({ value: { ...values, apiKey: 'sk-secret-should-not-render' } })
  const html = renderToStaticMarkup(React.createElement(ConfigPanel, { t, view: 'page', form: withToken }))
  assert.equal(html.includes('sk-secret-should-not-render'), false)
})

test('the summary and unavailable states stay short', () => {
  const summary = renderToStaticMarkup(React.createElement(ConfigPanel, { t, view: 'summary' }))
  assert.equal(summary.replace(/<[^>]*>/g, ''), DICTS.zh['settings.summary'])

  const loading = renderToStaticMarkup(React.createElement(ConfigPanel, { t, view: 'page', form: form({ status: 'loading' }) }))
  assert.match(loading, /正在读取配置/)

  const unavailable = renderToStaticMarkup(React.createElement(ConfigPanel, { t, view: 'page' }))
  assert.match(unavailable, /cordis\.patch\.yml/)
})

test('a read-only profile disables the save control', () => {
  const html = renderToStaticMarkup(React.createElement(ConfigPanel, { t, view: 'page', form: form({ writable: false }) }))
  assert.match(html, /不接受配置写入/)
  assert.match(html, /disabled/)
})


test('the hover restore settings are written together', async () => {
  const written = []
  const fake = { ...form(), mutate: async (ops) => { written.push(ops); return true } }
  const off = await commitConfig(fake, { hoverRestore: false }, values)
  assert.equal(off.accepted, true)
  assert.deepEqual(written[0], [{ op: 'set', path: ['hoverRestore'], value: false }])
  const delay = await commitConfig(fake, { hoverRestoreMs: '2500' }, values)
  assert.equal(delay.accepted, true)
  assert.deepEqual(written[1], [{ op: 'set', path: ['hoverRestoreMs'], value: 2500 }])
})


test('the system-model checkbox shows only one explanation', () => {
  const html = renderToStaticMarkup(React.createElement(ConfigPanel, {
    t,
    initialDraft: { systemModel: true },
    view: 'page',
    form: form({ value: { ...values } }),
  }))
  assert.match(html, /自定义服务/)
  assert.match(html, /系统模型/)
  assert.match(html, /provider\/model/)
  assert.equal(html.includes('服务地址'), false)
  assert.equal(html.includes('API 令牌'), false)
})

test('a persisted systemModel renders the system-model state without a draft', () => {
  const html = renderToStaticMarkup(React.createElement(ConfigPanel, {
    t,
    view: 'page',
    form: form({ value: { ...values, systemModel: true } }),
  }))
  assert.match(html, /provider\/model/)
  assert.equal(html.includes('服务地址'), false)
  assert.equal(html.includes('API 令牌'), false)
  assert.equal((html.match(/type="checkbox" checked=""/g) || []).length, 1)
})
test('the dependent inputs appear only while their checkbox is checked', () => {
  const offTranslation = renderToStaticMarkup(React.createElement(ConfigPanel, {
    t,
    initialTab: 'translation',
    view: 'page',
    form: form({ value: { ...values, placeholderGuard: false } }),
  }))
  assert.equal(offTranslation.includes('自定义关键词保留提示词'), false)
  assert.equal(offTranslation.includes('遮罩格式'), false)
  assert.match(offTranslation, /关键词保留/)
  const offHover = renderToStaticMarkup(React.createElement(ConfigPanel, {
    t,
    initialTab: 'hover',
    view: 'page',
    form: form({ value: { ...values, hoverRestore: false } }),
  }))
  assert.equal(offHover.includes('悬停时长'), false)
  assert.match(offHover, /悬停显示原文/)
})

test('the token sits after the model name in the connection tab', () => {
  const html = renderToStaticMarkup(React.createElement(ConfigPanel, { t, view: 'page', form: form() }))
  assert.ok(html.indexOf('模型名') < html.indexOf('API 令牌'))
  assert.ok(html.indexOf('连接') < html.indexOf('翻译'))
  assert.ok(html.indexOf('翻译') < html.indexOf('悬停'))
  assert.ok(html.indexOf('悬停') < html.indexOf('翻译缓存'))
})

test('the default header and delay are shown in their tabs', () => {
  const translation = renderToStaticMarkup(React.createElement(ConfigPanel, { t, initialTab: 'translation', view: 'page', form: form() }))
  assert.match(translation, /将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释/)
  const hover = renderToStaticMarkup(React.createElement(ConfigPanel, { t, initialTab: 'hover', view: 'page', form: form() }))
  assert.match(hover, /value="200"/)
})




test('the system-model translation tab hides local-only fields', () => {
  const html = renderToStaticMarkup(React.createElement(ConfigPanel, {
    t,
    initialDraft: { systemModel: true },
    initialTab: 'translation',
    view: 'page',
    form: form({ value: { ...values } }),
  }))
  assert.equal(html.includes('<textarea'), false)
  assert.match(html, /系统模型使用内置 JSON 翻译提示词/)
  assert.match(html, /长思考合并请求/)
})
