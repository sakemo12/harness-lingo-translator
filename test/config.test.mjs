// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { Config, createConfigSource, resolveConfig } from '../index.mjs'

test('Schemastery defaults match the documented local deployment', () => {
  const value = Config({})
  assert.equal(value.enabled, true)
  assert.equal(value.baseUrl.get(), 'http://127.0.0.1:8080/v1')
  assert.equal(value.model.get(), 'hy-mt1.5-1.8b')
  assert.equal(value.promptTemplate, 'auto')
  assert.equal(value.temperature, 0.7)
  assert.equal(value.topP, 0.6)
  assert.equal(value.topK, 20)
  assert.equal(value.repetitionPenalty, 1.05)
  assert.equal(value.maxTokens, 2048)
  assert.equal(value.concurrency.get(), 2)
  assert.equal(value.batchReasoning.get(), false)
  assert.equal(value.promptHeader.get(), '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释')
  assert.equal(value.placeholderGuard.get(), true)
  assert.equal(value.placeholderHint.get(), '')
  assert.equal(value.systemModel.get(), false)
  assert.equal(value.hoverRestore.get(), true)
  assert.equal(value.hoverRestoreMs.get(), 200)
  assert.equal(value.timeoutMs, 60000)
  assert.equal(value.retries, 1)
})

test('the settings form fields are volatile so writes apply without a remount', () => {
  const value = Config({ baseUrl: 'http://192.168.1.10:8080/v1' })
  assert.equal(typeof value.baseUrl.get, 'function')
  assert.equal(value.baseUrl.get(), 'http://192.168.1.10:8080/v1')
  assert.equal(typeof value.model.get, 'function')
  assert.equal(typeof value.apiKey.get, 'function')
  assert.equal(typeof value.concurrency.get, 'function')
  assert.equal(value.concurrency.get(), 2)
  assert.equal(typeof value.batchReasoning.get, 'function')
  assert.equal(value.batchReasoning.get(), false)
  assert.equal(typeof value.promptHeader.get, 'function')
  assert.equal(typeof value.placeholderGuard.get, 'function')
  assert.equal(typeof value.placeholderHint.get, 'function')
  assert.equal(typeof value.systemModel.get, 'function')
  assert.equal(typeof value.hoverRestore.get, 'function')
  assert.equal(typeof value.hoverRestoreMs.get, 'function')
  assert.equal(value.promptHeader.get(), '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释')
  assert.equal(value.placeholderGuard.get(), true)
  assert.equal(value.placeholderHint.get(), '')
  assert.equal(value.systemModel.get(), false)
  assert.equal(value.hoverRestore.get(), true)
  assert.equal(value.hoverRestoreMs.get(), 200)
  assert.equal(value.batchReasoning.get(), false)
  assert.equal(value.promptHeader.get(), '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释')
  assert.equal(value.placeholderGuard.get(), true)
  assert.equal(value.placeholderHint.get(), '')
  assert.equal(value.systemModel.get(), false)
  assert.equal(value.hoverRestore.get(), true)
  assert.equal(value.hoverRestoreMs.get(), 200)
  assert.equal(typeof value.enabled, 'boolean')
})

test('systemModel is a boolean backend selector', () => {
  assert.equal(resolveConfig({ systemModel: true }).systemModel, true)
  assert.throws(() => resolveConfig({ systemModel: 'yes' }), /config\.systemModel/)
  assert.doesNotThrow(() => resolveConfig({ systemModel: true, baseUrl: '', model: '', concurrency: '' }))
  assert.throws(() => resolveConfig({ systemModel: false, baseUrl: '', model: '' }), /config\.baseUrl/)
})

test('the token is a secret-role field', () => {
  assert.match(JSON.stringify(Config.toJSON()), /"role":"secret"/)
  assert.equal(Config({ apiKey: 'sk-local' }).apiKey.get(), 'sk-local')
  const source = createConfigSource({ apiKey: { get: () => 'sk-live' } })
  assert.equal(source.read().apiKey, 'sk-live')
})

test('resolveConfig fills the same defaults and freezes the glossary', () => {
  const config = resolveConfig(undefined)
  assert.equal(config.baseUrl, 'http://127.0.0.1:8080/v1')
  assert.equal(config.glossary.length, 0)
  assert.ok(Object.isFrozen(config))
  assert.ok(Object.isFrozen(config.glossary))
})

test('resolveConfig normalizes the base URL trailing slash', () => {
  assert.equal(resolveConfig({ baseUrl: 'http://127.0.0.1:8080/v1/' }).baseUrl, 'http://127.0.0.1:8080/v1')
})

test('resolveConfig rejects a bad endpoint loudly', () => {
  assert.throws(() => resolveConfig({ baseUrl: '' }), /config\.baseUrl/)
  assert.throws(() => resolveConfig({ baseUrl: '127.0.0.1:8080' }), /config\.baseUrl/)
  assert.throws(() => resolveConfig({ baseUrl: 'ftp://127.0.0.1/v1' }), /config\.baseUrl/)
})

test('resolveConfig rejects an empty model id', () => {
  assert.throws(() => resolveConfig({ model: '   ' }), /config\.model/)
})

test('custom prompts must be complete', () => {
  assert.throws(() => resolveConfig({ promptTemplate: 'custom' }), /customTemplate/)
  assert.throws(() => resolveConfig({ promptTemplate: 'custom', customTemplate: 'no slot here' }), /\{source_text\}/)
  assert.doesNotThrow(() => resolveConfig({ promptTemplate: 'custom', customTemplate: '译成{target_language}：{source_text}' }))
})

test('resolveConfig rejects unknown prompt styles', () => {
  assert.throws(() => resolveConfig({ promptTemplate: 'ja' }), /config\.promptTemplate/)
})

test('sampling and transport bounds are enforced', () => {
  assert.throws(() => resolveConfig({ temperature: -1 }), /config\.temperature/)
  assert.throws(() => resolveConfig({ topP: 2 }), /config\.topP/)
  assert.throws(() => resolveConfig({ topK: 1.5 }), /config\.topK/)
  assert.throws(() => resolveConfig({ repetitionPenalty: 3 }), /config\.repetitionPenalty/)
  assert.throws(() => resolveConfig({ maxTokens: 8 }), /config\.maxTokens/)
  assert.throws(() => resolveConfig({ concurrency: 0 }), /config\.concurrency/)
  assert.throws(() => resolveConfig({ timeoutMs: 500 }), /config\.timeoutMs/)
  assert.throws(() => resolveConfig({ retries: 4 }), /config\.retries/)
})

test('batchReasoning is a boolean toggle', () => {
  assert.equal(resolveConfig({ batchReasoning: true }).batchReasoning, true)
  assert.throws(() => resolveConfig({ batchReasoning: 'yes' }), /config\.batchReasoning/)
})

test('promptHeader is an optional bounded string', () => {
  assert.equal(resolveConfig({ promptHeader: 'Use a formal tone.' }).promptHeader, 'Use a formal tone.')
  assert.throws(() => resolveConfig({ promptHeader: 7 }), /config\.promptHeader/)
  assert.throws(() => resolveConfig({ promptHeader: 'x'.repeat(2001) }), /config\.promptHeader/)
})

test('the placeholder guard is a boolean with an optional custom sentence', () => {
  assert.equal(resolveConfig({ placeholderGuard: false }).placeholderGuard, false)
  assert.equal(resolveConfig({ placeholderHint: 'Keep tokens.' }).placeholderHint, 'Keep tokens.')
  assert.throws(() => resolveConfig({ placeholderGuard: 'yes' }), /config\.placeholderGuard/)
  assert.throws(() => resolveConfig({ placeholderHint: 7 }), /config\.placeholderHint/)
  assert.throws(() => resolveConfig({ placeholderHint: 'x'.repeat(501) }), /config\.placeholderHint/)
})

test('the hover restore settings are bounded', () => {
  assert.equal(resolveConfig({ hoverRestore: false }).hoverRestore, false)
  assert.equal(resolveConfig({ hoverRestoreMs: 3000 }).hoverRestoreMs, 3000)
  assert.equal(resolveConfig({ hoverRestoreMs: 0 }).hoverRestoreMs, 0)
  assert.throws(() => resolveConfig({ hoverRestore: 'yes' }), /config\.hoverRestore/)
  assert.throws(() => resolveConfig({ hoverRestoreMs: -1 }), /config\.hoverRestoreMs/)
  assert.throws(() => resolveConfig({ hoverRestoreMs: 60001 }), /config\.hoverRestoreMs/)
  assert.throws(() => resolveConfig({ hoverRestoreMs: 1.5 }), /config\.hoverRestoreMs/)
})

test('the glossary is a string array', () => {
  assert.throws(() => resolveConfig({ glossary: 'Acme' }), /config\.glossary/)
  assert.throws(() => resolveConfig({ glossary: [1] }), /config\.glossary/)
})

test('createConfigSource follows a volatile reference without remounting', () => {
  let current = 'http://127.0.0.1:8080/v1'
  const source = createConfigSource({ baseUrl: { get: () => current }, model: { get: () => 'hy-mt1.5-1.8b' } })
  assert.equal(source.read().baseUrl, 'http://127.0.0.1:8080/v1')
  current = 'http://192.168.1.10:8080/v1'
  assert.equal(source.read().baseUrl, 'http://192.168.1.10:8080/v1')
})

test('createConfigSource rejects an invalid live value on read', () => {
  let current = 'http://127.0.0.1:8080/v1'
  const source = createConfigSource({ baseUrl: { get: () => current } })
  assert.equal(source.read().baseUrl, 'http://127.0.0.1:8080/v1')
  current = 'not-a-url'
  assert.throws(() => source.read(), /config\.baseUrl/)
})

test('createConfigSource accepts a plain programmatic config', () => {
  const source = createConfigSource({ targetLang: 'ja', concurrency: 2 })
  const value = source.read()
  assert.equal(value.targetLang, 'ja')
  assert.equal(value.concurrency, 2)
  assert.equal(value.baseUrl, 'http://127.0.0.1:8080/v1')
  assert.ok(Object.isFrozen(value))
})
