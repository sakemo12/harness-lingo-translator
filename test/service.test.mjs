// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TranslateService } from '../lib/service.mjs'
import { createConfigSource } from '../index.mjs'
import { baseConfig, completion, jsonResponse } from './helpers.mjs'

/** A fetch double: `/models` answers ready, `/chat/completions` translates. */
function fakeFetch() {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    if (init.method === 'GET') return jsonResponse({ data: [{ id: 'hy-mt1.5-1.8b' }] })
    const body = JSON.parse(init.body)
    const prompt = body.messages[0].content
    return prompt.endsWith('⟦0⟧') ? completion('你好 ⟦0⟧') : completion('你好')
  }
  impl.calls = calls
  return impl
}

/** Mount the service on a throwaway context with a fake endpoint. */
function service(overrides) {
  const fetchImpl = fakeFetch()
  const instance = new TranslateService(new Context(), { config: baseConfig(overrides), fetchImpl })
  return { fetchImpl, instance }
}

test('status() reports the local endpoint and the merged glossary', async () => {
  const { instance } = service({ glossary: ['Acme', 'OK=确定'] })
  const status = await instance.status()
  assert.equal(status.ready, true)
  assert.equal(status.baseUrl, 'http://127.0.0.1:8080/v1')
  assert.equal(status.model, 'hy-mt1.5-1.8b')
  assert.equal(status.targetLang, 'zh')
  assert.deepEqual(status.glossary, ['Acme'])
  assert.equal(status.batchReasoning, false)
  assert.equal(status.hoverRestore, true)
  assert.equal(status.hoverRestoreMs, 200)
  assert.match(status.configHash, /^[0-9a-f]{16}$/)
  assert.equal(status.reason, null)
})

test('status() explains an unreachable endpoint', async () => {
  const instance = new TranslateService(new Context(), {
    config: baseConfig(),
    fetchImpl: async () => { throw new Error('connect ECONNREFUSED') },
  })
  const status = await instance.status()
  assert.equal(status.ready, false)
  assert.equal(status.model, null)
  assert.match(status.reason, /cannot reach/)
})

test('translate() returns one translation per segment', async () => {
  const { instance, fetchImpl } = service()
  const result = await instance.translate({ targetLang: 'zh', segments: ['Hello ⟦0⟧', 'Hello'] })
  assert.deepEqual(result.translations, ['你好 ⟦0⟧', '你好'])
  assert.deepEqual(result.failed, [])
  assert.equal(result.error, null)
  assert.equal(result.baseUrl, 'http://127.0.0.1:8080/v1')
  assert.equal(result.model, 'hy-mt1.5-1.8b')
  assert.equal(fetchImpl.calls.filter((call) => call.init.method === 'POST').length, 2)
})

test('translate() rejects a malformed request without calling out', async () => {
  const { instance, fetchImpl } = service()
  const result = await instance.translate({ targetLang: 'zh', segments: [] })
  assert.deepEqual(result.translations, [])
  assert.match(result.error, /invalid request/)
  assert.equal(fetchImpl.calls.length, 0)
})

test('translate() requires a target language', async () => {
  const { instance, fetchImpl } = service({ targetLang: '' })
  const result = await instance.translate({ targetLang: '', segments: ['Hello'] })
  assert.deepEqual(result.failed, [0])
  assert.match(result.error, /target language/)
  assert.equal(fetchImpl.calls.length, 0)
})

test('translate() falls back to the configured target language', async () => {
  const { instance } = service({ targetLang: 'ja' })
  const result = await instance.translate({ targetLang: '', segments: ['Hello'] })
  assert.equal(result.error, null)
  assert.deepEqual(result.translations, ['你好'])
})

test('status() and translate() follow a live config source', async () => {
  const urls = []
  let baseUrl = 'http://127.0.0.1:8080/v1'
  const fetchImpl = async (url, init) => {
    urls.push(url)
    if (init.method === 'GET') return jsonResponse({ data: [{ id: 'hy-mt1.5-1.8b' }] })
    return completion('你好')
  }
  const instance = new TranslateService(new Context(), {
    config: { read: () => baseConfig({ baseUrl }) },
    fetchImpl,
  })
  assert.equal((await instance.status()).baseUrl, 'http://127.0.0.1:8080/v1')
  baseUrl = 'http://192.168.1.10:8080/v1'
  assert.equal((await instance.status()).baseUrl, 'http://192.168.1.10:8080/v1')
  const result = await instance.translate({ targetLang: 'zh', segments: ['Hello'] })
  assert.equal(result.error, null)
  assert.ok(urls.some((url) => url.startsWith('http://192.168.1.10:8080/v1/chat/completions')))
})

test('translate() does not pause after repeated whole-batch failures', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return jsonResponse({ error: 'down' }, 500)
  }
  const instance = new TranslateService(new Context(), { config: baseConfig({ retries: 0 }), fetchImpl })
  for (let round = 0; round < 3; round += 1) {
    const result = await instance.translate({ targetLang: 'zh', segments: ['hello'] })
    assert.deepEqual(result.failed, [0])
  }
  assert.equal(calls, 3)
  const retried = await instance.translate({ targetLang: 'zh', segments: ['again'] })
  assert.match(retried.error, /HTTP 500/)
  assert.deepEqual(retried.failed, [0])
  assert.equal(calls, 4)
})


test('translate() sends one numbered request for a batched thinking block', async () => {
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body)
    const prompt = body.messages[0].content
    assert.match(prompt, /每行一段/)
    assert.match(prompt, /1\. One\n2\. Two/)
    return completion('1. 一\n2. 二')
  }
  const instance = new TranslateService(new Context(), {
    config: baseConfig({ batchReasoning: true }),
    fetchImpl,
  })
  const result = await instance.translate({ targetLang: 'zh', segments: ['One', 'Two'], batch: true })
  assert.deepEqual(result.translations, ['一', '二'])
  assert.deepEqual(result.failed, [])
  assert.equal(result.error, null)
})


test('the service exposes the per-workspace cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-translate-service-cache-'))
  const service = new TranslateService(new Context(), {
    config: { get: () => ({}) },
    cacheOptions: { dir },
  })
  await service.saveCache({
    workspace: '/work/one',
    configHash: 'cfg1',
    entries: [{ source: 'Hello', translation: '你好' }],
  })
  assert.deepEqual(await service.loadCache({ workspace: '/work/one', configHash: 'cfg1' }), { entries: { Hello: '你好' } })
  assert.deepEqual(await service.loadCache({ workspace: '/work/two', configHash: 'cfg1' }), { entries: {} })
})


test('pruneCache deletes entries for missing sessions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-translate-prune-'))
  const service = new TranslateService(new Context(), {
    config: { get: () => ({}) },
    cacheOptions: { dir },
    sessions: { list: () => [{ id: 'live' }] },
  })
  await service.saveCache({
    workspace: '/work/one',
    configHash: 'cfg1',
    entries: [
      { source: 'a', translation: 'A', sessionId: 'live' },
      { source: 'b', translation: 'B', sessionId: 'deleted' },
    ],
  })
  assert.deepEqual(await service.pruneCache(), { removed: 1, files: 1 })
})




test('workspace() reads the host session header', () => {
  const service = new TranslateService(new Context(), {
    config: { get: () => ({}) },
    sessions: { get: (id) => (id === 's1' ? { header: { cwd: '/work/one' } } : undefined) },
  })
  assert.deepEqual(service.workspace({ sessionId: 's1' }), { path: '/work/one' })
  assert.deepEqual(service.workspace({ sessionId: 'missing' }), { path: null })
})
