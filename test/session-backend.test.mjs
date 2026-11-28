// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { buildSessionSystemPrompt, latestRoute, translateViaSession } from '../lib/session-backend.mjs'
import { TranslateService } from '../lib/service.mjs'
import { createConfigSource } from '../index.mjs'

function fakeLlm(answer) {
  return {
    stream(request) {
      return (async function* () {
        yield { type: 'text-delta', index: 0, text: answer }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    },
  }
}

function header(provider, model) {
  return { type: 'request/header', data: { header: { config: { provider, model } } } }
}

test('resolves the newest request/header across sessions', () => {
  const sessions = { list: () => [{ events: [header('old', 'a')] }, { snapshotEvents: () => [header('new', 'b')] }] }
  assert.deepEqual(latestRoute(sessions), { provider: 'new', model: 'b' })
  assert.equal(latestRoute({ list: () => [] }), undefined)
})

test('translates a JSON batch through the session route', async () => {
  const calls = []
  const result = await translateViaSession({
    llm: { stream: (request) => { calls.push(request); return fakeLlm('["你好 [0]","世界"]').stream(request) } },
    route: { provider: 'p', model: 'm' },
    targetLang: 'zh',
    segments: ['Hello [0]', 'World'],
  })
  assert.deepEqual(result.translations, ['你好 [0]', '世界'])
  assert.deepEqual(result.failed, [])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].reasoningEffort, 'off')
  assert.deepEqual(JSON.parse(calls[0].messages[0].content[0].text), ['Hello [0]', 'World'])
})

test('marks a batch that loses a placeholder', async () => {
  const result = await translateViaSession({
    llm: fakeLlm('["你好"]'),
    route: { provider: 'p', model: 'm' },
    targetLang: 'zh',
    segments: ['Hello [0]'],
  })
  assert.deepEqual(result.translations, ['Hello [0]'])
  assert.deepEqual(result.failed, [0])
  assert.match(result.error, /placeholder/)
})

test('the session system prompt omits placeholder rules when masking is off', () => {
  assert.match(buildSessionSystemPrompt('zh', [], true), /\[0\]/)
  assert.doesNotMatch(buildSessionSystemPrompt('zh', [], false), /\[\d+\]/)
  assert.match(buildSessionSystemPrompt('zh', [], true, '⟦n⟧'), /⟦0⟧/)
  assert.match(buildSessionSystemPrompt('zh', [], false), /1\. Never translate or alter/)
})

test('disabling the guard accepts a session answer without the literal placeholder', async () => {
  const result = await translateViaSession({
    llm: fakeLlm('["你好"]'),
    route: { provider: 'p', model: 'm' },
    targetLang: 'zh',
    segments: ['Hello [0]'],
    guard: false,
  })
  assert.deepEqual(result.translations, ['你好'])
  assert.deepEqual(result.failed, [])
  assert.equal(result.error, null)
})

test('the service dispatches to the session backend when systemModel is on', async () => {
  const service = new TranslateService(new Context(), {
    config: createConfigSource({ systemModel: true, targetLang: 'zh' }),
    sessions: { list: () => [{ events: [header('p', 'm')] }] },
    getLlm: () => fakeLlm('["你好"]'),
  })
  const status = await service.status()
  assert.equal(status.ready, true)
  assert.equal(status.model, 'm')
  assert.equal(status.baseUrl, 'session:p')
  const result = await service.translate({ segments: ['Hello'] })
  assert.deepEqual(result.translations, ['你好'])
  assert.equal(result.failed.length, 0)
  assert.equal(result.baseUrl, 'session:p')
})
