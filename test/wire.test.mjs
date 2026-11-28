// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INVOCATIONS,
  parseCacheLoad,
  parseCacheLoadResult,
  parseCacheSave,
  parseCacheSaveResult,
  parsePruneCacheResult,
  parseWorkspace,
  parseWorkspaceResult,
  parseTranslateRequest,
  parseTranslateResult,
  parseTranslateStatus,
} from '../lib/wire.mjs'

test('records validate a request with and without a target language', () => {
  assert.deepEqual(parseTranslateRequest({ segments: ['Hello'] }), { segments: ['Hello'] })
  assert.deepEqual(parseTranslateRequest({ targetLang: 'zh', segments: ['Hello'] }), { targetLang: 'zh', segments: ['Hello'] })
  assert.deepEqual(parseTranslateRequest({ targetLang: 'zh', segments: ['Hello'], batch: true }), { targetLang: 'zh', segments: ['Hello'], batch: true })
  assert.throws(() => parseTranslateRequest({ targetLang: 'zh', segments: ['Hello'], batch: 'yes' }), /batch/)
  assert.throws(() => parseTranslateRequest(null), /object/)
  assert.throws(() => parseTranslateRequest({ targetLang: 7, segments: ['x'] }), /targetLang/)
  assert.throws(() => parseTranslateRequest({ targetLang: 'x'.repeat(36), segments: ['x'] }), /35/)
})

test('records reject malformed segment lists', () => {
  assert.throws(() => parseTranslateRequest({ segments: [] }), /1 to 200/)
  assert.throws(() => parseTranslateRequest({ segments: new Array(201).fill('x') }), /1 to 200/)
  assert.throws(() => parseTranslateRequest({ segments: [''] }), /segments\[0\]/)
  assert.throws(() => parseTranslateRequest({ segments: ['x'.repeat(4001)] }), /segments\[0\]/)
  assert.throws(() => parseTranslateRequest({ segments: [1] }), /segments\[0\]/)
})

test('records validate a status result', () => {
  const status = {
    ready: true,
    targetLang: 'zh',
    baseUrl: 'http://x/v1',
    model: 'm',
    glossary: [],
    batchReasoning: false,
    placeholderGuard: true,
    placeholderFormat: '[n]',
    hoverRestore: true,
    hoverRestoreMs: 1500,
    configHash: 'abcdef0123456789',
    reason: null,
  }
  assert.equal(parseTranslateStatus(status), status)
  assert.throws(() => parseTranslateStatus({ ...status, ready: 'yes' }), /ready/)
  assert.throws(() => parseTranslateStatus({ ...status, glossary: ['ok', 1] }), /glossary/)
  assert.throws(() => parseTranslateStatus({ ...status, reason: 1 }), /reason/)
  assert.throws(() => parseTranslateStatus({ ...status, batchReasoning: 'yes' }), /batchReasoning/)
  assert.throws(() => parseTranslateStatus({ ...status, placeholderGuard: 'yes' }), /placeholderGuard/)
  assert.equal(parseTranslateStatus({ ...status, placeholderGuard: false }).placeholderGuard, false)
  assert.throws(() => parseTranslateStatus({ ...status, placeholderFormat: 1 }), /placeholderFormat/)
  assert.throws(() => parseTranslateStatus({ ...status, placeholderFormat: 'x'.repeat(25) }), /placeholderFormat/)
  assert.throws(() => parseTranslateStatus({ ...status, hoverRestore: 'yes' }), /hoverRestore/)
  assert.equal(parseTranslateStatus({ ...status, hoverRestoreMs: 0 }).hoverRestoreMs, 0)
  assert.throws(() => parseTranslateStatus({ ...status, hoverRestoreMs: -1 }), /hoverRestoreMs/)
  assert.throws(() => parseTranslateStatus({ ...status, configHash: 1 }), /configHash/)
})

test('records validate a translate result', () => {
  const result = { translations: ['你好'], failed: [], baseUrl: 'http://x/v1', model: 'm', error: null }
  assert.equal(parseTranslateResult(result), result)
  assert.throws(() => parseTranslateResult({ ...result, translations: [1] }), /translations/)
  assert.throws(() => parseTranslateResult({ ...result, failed: [-1] }), /failed/)
  assert.throws(() => parseTranslateResult({ ...result, model: 1 }), /model/)
})

test('the descriptors expose codecs the gateway can consume', () => {
  for (const descriptor of INVOCATIONS) {
    assert.equal(descriptor.result.mode, 'strict')
    assert.equal(typeof descriptor.result.create, 'function')
    assert.equal(typeof descriptor.result.create().parse, 'function')
  }
})


test('records validate cache reads and writes', () => {
  assert.deepEqual(parseCacheLoad({ workspace: '/work/one', configHash: 'abc' }), { workspace: '/work/one', configHash: 'abc' })
  assert.throws(() => parseCacheLoad({ workspace: 1, configHash: 'abc' }), /workspace/)
  assert.throws(() => parseCacheLoad({ workspace: '/w', configHash: '' }), /configHash/)
  assert.deepEqual(parseCacheLoadResult({ entries: { Hello: '你好' } }), { entries: { Hello: '你好' } })
  assert.throws(() => parseCacheLoadResult({ entries: { Hello: 7 } }), /strings/)
  const save = parseCacheSave({
    workspace: '/work/one',
    configHash: 'abc',
    entries: [{ source: 'Hello', translation: '你好', sessionId: 's1', messageKey: 'm1' }],
  })
  assert.equal(save.entries[0].translation, '你好')
  assert.equal(save.entries[0].sessionId, 's1')
  assert.throws(() => parseCacheSave({ workspace: '/w', configHash: 'c', entries: [] }), /500|1 to/)
  assert.deepEqual(parseCacheSaveResult({ saved: 2, total: 5 }), { saved: 2, total: 5 })
  assert.throws(() => parseCacheSaveResult({ saved: -1, total: 0 }), /saved/)
})

test('the descriptor list includes the cache invocations', () => {
  assert.equal(INVOCATIONS.length, 6)
  assert.deepEqual(INVOCATIONS.map((entry) => entry.method), ['status', 'translate', 'loadCache', 'saveCache', 'workspace', 'pruneCache'])
  assert.deepEqual(parsePruneCacheResult({ removed: 3, files: 2 }), { removed: 3, files: 2 })
  assert.deepEqual(parseWorkspace({ sessionId: 's1' }), { sessionId: 's1' })
  assert.throws(() => parseWorkspace({ sessionId: 1 }), /sessionId/)
  assert.deepEqual(parseWorkspaceResult({ path: '/w' }), { path: '/w' })
  assert.deepEqual(parseWorkspaceResult({ path: null }), { path: null })
})
