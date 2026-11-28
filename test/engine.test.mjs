// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBatchPrompt,
  buildPrompt,
  cleanOutput,
  endpointUrl,
  languageName,
  normalizeLangTag,
  parseGlossary,
  parseNumberedAnswer,
  placeholdersIntact,
  probeEndpoint,
  resolvePromptStyle,
  translateSegments,
} from '../lib/engine.mjs'
import { baseConfig, completion, fakeFetch, jsonResponse } from './helpers.mjs'

test('language tags follow the model card abbreviations', () => {
  assert.equal(normalizeLangTag('zh-TW'), 'zh-Hant')
  assert.equal(normalizeLangTag('zh_HK'), 'zh-Hant')
  assert.equal(normalizeLangTag('zh-CN'), 'zh')
  assert.equal(normalizeLangTag('pt-BR'), 'pt')
  assert.equal(normalizeLangTag('fil'), 'tl')
  assert.equal(languageName('ja', 'zh'), '日语')
  assert.equal(languageName('zh-Hant', 'en'), 'Traditional Chinese')
  assert.equal(languageName('xx', 'en'), 'xx')
})

test('auto chooses the Chinese template only for Chinese targets', () => {
  assert.equal(resolvePromptStyle('auto', 'zh'), 'zh')
  assert.equal(resolvePromptStyle('auto', 'zh-Hant'), 'zh')
  assert.equal(resolvePromptStyle('auto', 'ja'), 'en')
  assert.equal(resolvePromptStyle('en', 'zh'), 'en')
  assert.equal(resolvePromptStyle('custom', 'ja'), 'custom')
})

test('prompts reproduce the model card templates, with a guard only for masked segments', () => {
  assert.equal(
    buildPrompt({ targetLang: 'zh', style: 'auto', text: 'Hello' }),
    '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释：Hello',
  )
  assert.equal(
    buildPrompt({ targetLang: 'zh', style: 'auto', text: 'Hello [0]' }),
    '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释，原文中的[0]、[1]、[2]这类占位符必须原样保留，你可以把占位符当做未知内容（一般是专有名词、数值、代码块）插入翻译好的句子，但不要把占位符里的编号当做数字翻译进内容里：Hello [0]',
  )
  assert.equal(
    buildPrompt({ targetLang: 'ja', style: 'auto', text: 'Hello' }),
    'Translate the following segment into Japanese, without additional explanation. Hello',
  )
  assert.equal(
    buildPrompt({ targetLang: 'ja', style: 'auto', text: 'Open [0] now' }),
    'Translate the following segment into Japanese, without additional explanation. Keep placeholders such as [0], [1] and [2] exactly as they appear. Treat them as unknown content (usually a proper noun, number or code block) to insert into the translated sentence, but never translate the number inside the placeholder as content. Open [0] now',
  )
})

test('a custom mask template drives the guard and the token check', () => {
  assert.ok(buildPrompt({ targetLang: 'zh', text: 'Hello ⟦0⟧', format: '⟦n⟧' }).includes('⟦0⟧、⟦1⟧、⟦2⟧'))
  assert.ok(buildPrompt({ targetLang: 'zh', text: 'Hello {{0}}', format: '{{n}}' }).includes('{{0}}、{{1}}、{{2}}'))
  assert.equal(placeholdersIntact('[0] a', 'x [0]'), true)
  assert.equal(placeholdersIntact('⟦0⟧ a', 'x ⟦0⟧', '⟦n⟧'), true)
  assert.equal(placeholdersIntact('⟦0⟧ a', 'x', '⟦n⟧'), false)
  assert.equal(placeholdersIntact('{{0}}', '{{0}}', '{{n}}'), true)
})

test('the source text never starts with a blank line or carries escaped quotes', () => {
  assert.equal(
    buildPrompt({ targetLang: 'zh', style: 'auto', text: '\n\nHe said \\"hi\\"' }),
    '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释：He said "hi"',
  )
  assert.equal(
    buildPrompt({ targetLang: 'de', style: 'auto', text: '\\n\\nHe said \\"hi\\"' }),
    'Translate the following segment into German, without additional explanation. He said "hi"',
  )
  assert.equal(
    buildBatchPrompt({ targetLang: 'zh', segments: ['\n\nOne', '\\"Two\\"'] }),
    '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释。每行一段，保持行数、顺序和编号，不要合并或拆分段落：1. One\n2. "Two"',
  )
})

test('glossary pairs use the terminology-intervention template', () => {
  const zh = buildPrompt({
    targetLang: 'zh',
    style: 'auto',
    pairs: [{ source: 'Button', target: '按钮' }],
    text: 'Click Button',
  })
  assert.ok(zh.startsWith('参考下面的翻译：\nButton 翻译成 按钮\n\n将以下文本翻译为中文'))
  const en = buildPrompt({
    targetLang: 'de',
    style: 'auto',
    pairs: [{ source: 'Button', target: 'Schaltfläche' }],
    text: 'Click Button',
  })
  assert.ok(en.startsWith('Refer to the following translations:\nButton is translated as Schaltfläche\n\nTranslate the following segment into German'))
})

test('custom templates receive every documented slot', () => {
  const prompt = buildPrompt({
    targetLang: 'de',
    style: 'custom',
    customTemplate: '{glossary}DE:{source_text}|{target_lang}|{target_language}',
    pairs: [{ source: 'A', target: 'B' }],
    text: 'x',
  })
  assert.equal(prompt, 'Refer to the following translations:\nA is translated as B\n\nDE:x|de|German')
})

test('glossary entries split into masked terms and terminology pairs', () => {
  assert.deepEqual(parseGlossary(['Acme Widgets', 'OK=确定', '  ', 'bad=']), {
    terms: ['Acme Widgets', 'bad='],
    pairs: [{ source: 'OK', target: '确定' }],
  })
})

test('placeholder multiset must match', () => {
  assert.equal(placeholdersIntact('[0] a [1]', 'x [1] y [0]'), true)
  assert.equal(placeholdersIntact('[0] a', 'x'), false)
  assert.equal(placeholdersIntact('[0] a [1]', '[0] a [0]'), false)
  assert.equal(placeholdersIntact('plain', '[0] invented'), false)
})

test('cleanOutput removes fences, labels, echoes and wrapping quotes', () => {
  assert.equal(cleanOutput('```json\n你好\n```'), '你好')
  assert.equal(cleanOutput('Translation: 你好'), '你好')
  assert.equal(cleanOutput('“你好”'), '你好')
  assert.equal(cleanOutput('prompt 你好', { prompt: 'prompt ' }), '你好')
  assert.equal(cleanOutput('"引用"', { source: '"quoted"' }), '"引用"')
  assert.equal(cleanOutput('   '), '')
})

test('endpoint URLs keep exactly one slash', () => {
  assert.equal(endpointUrl('http://127.0.0.1:8080/v1', '/models'), 'http://127.0.0.1:8080/v1/models')
  assert.equal(endpointUrl('http://127.0.0.1:8080/v1/', '/models'), 'http://127.0.0.1:8080/v1/models')
})

test('translates every segment with one request per segment', async () => {
  const fetchImpl = fakeFetch((prompt) => completion(prompt.endsWith('[0]') ? '你好 [0]' : '二'))
  const result = await translateSegments({
    config: baseConfig({ concurrency: 2 }),
    targetLang: 'zh',
    segments: ['Hello [0]', 'Two'],
    fetchImpl,
  })
  assert.deepEqual(result.translations, ['你好 [0]', '二'])
  assert.deepEqual(result.failed, [])
  assert.equal(result.error, null)
  assert.equal(result.baseUrl, 'http://127.0.0.1:8080/v1')
  assert.equal(result.model, 'hy-mt1.5-1.8b')
  assert.equal(fetchImpl.calls.length, 2)
  for (const call of fetchImpl.calls) {
    assert.equal(call.body.stream, false)
    assert.equal(call.body.model, 'hy-mt1.5-1.8b')
    assert.equal(call.body.top_k, 20)
    assert.equal(call.body.repetition_penalty, 1.05)
    assert.equal(call.body.messages.length, 1)
    assert.equal(call.body.messages[0].role, 'user')
    assert.match(call.body.messages[0].content, /将以下文本翻译为中文/)
  }
})

test('fails closed when a placeholder disappears', async () => {
  const fetchImpl = fakeFetch(() => completion('丢了占位符'))
  const result = await translateSegments({
    config: baseConfig(),
    targetLang: 'zh',
    segments: ['Hello [0]'],
    fetchImpl,
  })
  assert.deepEqual(result.failed, [0])
  assert.deepEqual(result.translations, ['Hello [0]'])
  assert.match(result.error, /placeholder/)
})

test('retries transient failures and stops at the configured budget', async () => {
  const flaky = fakeFetch((prompt, body, call) => (call === 1 ? jsonResponse({ error: 'boom' }, 500) : completion('你好')))
  const recovered = await translateSegments({
    config: baseConfig({ retries: 1, concurrency: 1 }),
    targetLang: 'zh',
    segments: ['Hello'],
    fetchImpl: flaky,
  })
  assert.deepEqual(recovered.translations, ['你好'])
  assert.equal(flaky.calls.length, 2)

  const down = fakeFetch(() => jsonResponse({ error: 'boom' }, 500))
  const failed = await translateSegments({
    config: baseConfig({ retries: 0 }),
    targetLang: 'zh',
    segments: ['Hello'],
    fetchImpl: down,
  })
  assert.deepEqual(failed.failed, [0])
  assert.match(failed.error, /HTTP 500/)
  assert.equal(down.calls.length, 1)
})

test('a truncated answer is not written into the page', async () => {
  const fetchImpl = fakeFetch(() => completion('半句', 'length'))
  const result = await translateSegments({
    config: baseConfig(),
    targetLang: 'zh',
    segments: ['A long sentence'],
    fetchImpl,
  })
  assert.deepEqual(result.failed, [0])
  assert.match(result.error, /maxTokens/)
})

test('a strict server rejecting top_k is retried without extensions', async () => {
  const bodies = []
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body)
    bodies.push(body)
    if (Object.hasOwn(body, 'top_k')) return jsonResponse({ error: { message: 'unknown parameter: top_k' } }, 400)
    return completion('你好')
  }
  const result = await translateSegments({
    config: baseConfig({ concurrency: 1 }),
    targetLang: 'zh',
    segments: ['Hello'],
    fetchImpl,
  })
  assert.deepEqual(result.translations, ['你好'])
  assert.equal(bodies.length, 2)
  assert.equal(Object.hasOwn(bodies[0], 'top_k'), true)
  assert.equal(Object.hasOwn(bodies[1], 'top_k'), false)
})

test('the bearer token is only sent when configured', async () => {
  const seen = []
  const fetchImpl = async (url, init) => {
    seen.push(init.headers)
    return completion('你好')
  }
  await translateSegments({ config: baseConfig(), targetLang: 'zh', segments: ['Hello'], fetchImpl })
  await translateSegments({ config: baseConfig({ apiKey: 'secret' }), targetLang: 'zh', segments: ['Hello'], fetchImpl })
  assert.equal(Object.hasOwn(seen[0], 'authorization'), false)
  assert.equal(seen[1].authorization, 'Bearer secret')
})

test('concurrency bounds the in-flight requests', async () => {
  let inFlight = 0
  let peak = 0
  const fetchImpl = async () => {
    inFlight += 1
    peak = Math.max(peak, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 10))
    inFlight -= 1
    return completion('x')
  }
  await translateSegments({
    config: baseConfig({ concurrency: 2 }),
    targetLang: 'zh',
    segments: ['a', 'b', 'c', 'd'],
    fetchImpl,
  })
  assert.equal(peak, 2)
})

test('an aborted call fails every segment without requesting', async () => {
  const controller = new AbortController()
  controller.abort()
  const fetchImpl = fakeFetch(() => completion('x'))
  const result = await translateSegments({
    config: baseConfig(),
    targetLang: 'zh',
    segments: ['a'],
    signal: controller.signal,
    fetchImpl,
  })
  assert.deepEqual(result.failed, [0])
  assert.equal(fetchImpl.calls.length, 0)
})

test('probeEndpoint reports readiness from /models', async () => {
  const ready = await probeEndpoint({
    config: baseConfig(),
    fetchImpl: async () => jsonResponse({ data: [{ id: 'hy-mt1.5-1.8b' }] }),
  })
  assert.equal(ready.ok, true)
  assert.equal(ready.model, 'hy-mt1.5-1.8b')
  assert.deepEqual(ready.models, ['hy-mt1.5-1.8b'])

  const denied = await probeEndpoint({ config: baseConfig(), fetchImpl: async () => jsonResponse({}, 401) })
  assert.equal(denied.ok, false)
  assert.match(denied.error, /credentials/)

  const noList = await probeEndpoint({ config: baseConfig(), fetchImpl: async () => jsonResponse({}, 404) })
  assert.equal(noList.ok, true)
  assert.equal(noList.model, 'hy-mt1.5-1.8b')

  const offline = await probeEndpoint({
    config: baseConfig(),
    fetchImpl: async () => { throw new Error('fetch failed') },
  })
  assert.equal(offline.ok, false)
  assert.match(offline.error, /cannot reach/)
  assert.match(offline.error, /translation server running/)
})


test('batch prompts number every segment', () => {
  const prompt = buildBatchPrompt({ targetLang: 'zh', segments: ['One', 'Two'] })
  assert.match(prompt, /每行一段/)
  assert.ok(prompt.endsWith('1. One\n2. Two'))
  assert.match(buildBatchPrompt({ targetLang: 'de', segments: ['One'] }), /numbered lines into German/)
})

test('numbered answers round-trip, including wrapped lines', () => {
  assert.deepEqual(parseNumberedAnswer('1. 一\n2. 二', 2), ['一', '二'])
  assert.deepEqual(parseNumberedAnswer('1. 一\n续行\n2. 二', 2), ['一\n续行', '二'])
  assert.deepEqual(parseNumberedAnswer('1、一\n2、二', 2), ['一', '二'])
  assert.equal(parseNumberedAnswer('1. 一', 2), undefined)
  assert.equal(parseNumberedAnswer('2. 一\n1. 二', 2), undefined)
  assert.equal(parseNumberedAnswer('merged answer', 1), undefined)
})

test('one batched request translates a thinking block', async () => {
  const fetchImpl = fakeFetch((prompt) => {
    assert.match(prompt, /每行一段/)
    return completion('1. 你好 [0]\n2. 二')
  })
  const result = await translateSegments({
    config: baseConfig({ batchReasoning: true }),
    targetLang: 'zh',
    segments: ['Hello [0]', 'Two'],
    batch: true,
    fetchImpl,
  })
  assert.deepEqual(result.translations, ['你好 [0]', '二'])
  assert.deepEqual(result.failed, [])
  assert.equal(fetchImpl.calls.length, 1)
})

test('an unusable numbered answer falls back to per-segment requests', async () => {
  const fetchImpl = fakeFetch((prompt) => {
    if (prompt.includes('每行一段')) return completion('merged without numbers')
    return prompt.endsWith('Hello [0]') ? completion('你好 [0]') : completion('二')
  })
  const result = await translateSegments({
    config: baseConfig({ batchReasoning: true }),
    targetLang: 'zh',
    segments: ['Hello [0]', 'Two'],
    batch: true,
    fetchImpl,
  })
  assert.deepEqual(result.translations, ['你好 [0]', '二'])
  assert.deepEqual(result.failed, [])
  assert.equal(fetchImpl.calls.length, 3)
})

test('batching needs both the config and the caller flag', async () => {
  const off = fakeFetch(() => completion('译'))
  await translateSegments({
    config: baseConfig({ batchReasoning: false }),
    targetLang: 'zh',
    segments: ['One', 'Two'],
    batch: true,
    fetchImpl: off,
  })
  assert.equal(off.calls.length, 2)

  const unflagged = fakeFetch(() => completion('译'))
  await translateSegments({
    config: baseConfig({ batchReasoning: true }),
    targetLang: 'zh',
    segments: ['One', 'Two'],
    fetchImpl: unflagged,
  })
  assert.equal(unflagged.calls.length, 2)
})

test('segments with newlines are translated individually even when batching', async () => {
  const fetchImpl = fakeFetch(() => completion('译'))
  const result = await translateSegments({
    config: baseConfig({ batchReasoning: true }),
    targetLang: 'zh',
    segments: ['Line one\nline two', 'Second'],
    batch: true,
    fetchImpl,
  })
  assert.equal(fetchImpl.calls.length, 2)
  assert.deepEqual(result.translations, ['译', '译'])
})


test('the configured prompt header replaces the built-in instruction', () => {
  const header = 'Use a concise, formal tone.'
  const prompt = buildPrompt({ targetLang: 'zh', text: 'Hello', header })
  assert.ok(prompt.startsWith(header + ' Hello'))
  const batch = buildBatchPrompt({ targetLang: 'zh', segments: ['One'], header })
  assert.ok(batch.startsWith('Use a concise, formal tone。每行一段'))
  assert.equal(buildPrompt({ targetLang: 'zh', text: 'Hello', header: '   ' }), buildPrompt({ targetLang: 'zh', text: 'Hello' }))
})

test('translateSegments sends the header with the request', async () => {
  const fetchImpl = fakeFetch(() => completion('你好'))
  await translateSegments({
    config: baseConfig({ promptHeader: 'Use a formal tone.' }),
    targetLang: 'zh',
    segments: ['Hello'],
    fetchImpl,
  })
  assert.ok(fetchImpl.calls[0].prompt.startsWith('Use a formal tone. '))
})


test('the placeholder guard can be disabled or customised', () => {
  const base = buildPrompt({ targetLang: 'zh', text: 'Hello [0]' })
  assert.match(base, /占位符/)
  const off = buildPrompt({ targetLang: 'zh', text: 'Hello [0]', guard: false })
  assert.doesNotMatch(off, /占位符/)
  const custom = buildPrompt({ targetLang: 'zh', text: 'Hello [0]', guardHint: '编号必须保留。' })
  assert.ok(custom.includes('，编号必须保留。 Hello [0]'))
  const bare = buildPrompt({ targetLang: 'zh', text: 'Hello [0]', guardHint: '编号必须保留' })
  assert.ok(bare.includes('，编号必须保留：Hello [0]'))
  const enOff = buildPrompt({ targetLang: 'de', text: 'Hello [0]', guard: false })
  assert.doesNotMatch(enOff, /placeholder/i)
  const enCustom = buildPrompt({ targetLang: 'de', text: 'Hello [0]', guardHint: 'Keep [0].' })
  assert.ok(enCustom.includes('explanation. Keep [0]. Hello [0]'))
})

test('disabling the guard also disables placeholder verification', async () => {
  const fetchImpl = fakeFetch(() => completion('你好'))
  const result = await translateSegments({
    config: baseConfig({ placeholderGuard: false }),
    targetLang: 'zh',
    segments: ['Hello [0]'],
    fetchImpl,
  })
  assert.deepEqual(result.translations, ['你好'])
  assert.deepEqual(result.failed, [])
  assert.equal(result.error, null)
})

test('disabling the guard also disables batched placeholder verification', async () => {
  const fetchImpl = fakeFetch(() => completion('1. 你好\n2. 世界'))
  const result = await translateSegments({
    config: baseConfig({ placeholderGuard: false, batchReasoning: true }),
    targetLang: 'zh',
    segments: ['Hello [0]', 'World [1]'],
    batch: true,
    fetchImpl,
  })
  assert.deepEqual(result.translations, ['你好', '世界'])
  assert.deepEqual(result.failed, [])
})

test('batch prompts honour the guard options', () => {
  assert.doesNotMatch(buildBatchPrompt({ targetLang: 'zh', segments: ['One'] }), /占位符/)
  assert.match(buildBatchPrompt({ targetLang: 'zh', segments: ['One [0]'] }), /这类占位符必须原样保留/)
  assert.doesNotMatch(buildBatchPrompt({ targetLang: 'zh', segments: ['One [0]'], guard: false }), /占位符/)
  const custom = buildBatchPrompt({ targetLang: 'zh', segments: ['One [0]'], guardHint: '编号必须保留。' })
  assert.ok(custom.includes('不要合并或拆分段落，编号必须保留。 1. One [0]'))
})

test('translateSegments sends the configured guard sentence', async () => {
  const fetchImpl = fakeFetch(() => completion('一 [0]'))
  await translateSegments({
    config: baseConfig({ placeholderHint: '编号必须保留。' }),
    targetLang: 'zh',
    segments: ['One [0]'],
    fetchImpl,
  })
  assert.ok(fetchImpl.calls[0].prompt.includes('，编号必须保留。 One [0]'))
})
