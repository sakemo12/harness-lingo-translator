// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// Regression: the cache write must never escape as a synchronous throw, and a
// failed write must keep its entries for the next flush. A Host process that
// started before the cache invocations existed is the real-world trigger: the
// Remote method is missing, so `api.cacheSave` throws synchronously.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { WorkspaceCache } from '../lib/cache.mjs'
import { loadClient } from './helpers.mjs'

const client = await loadClient()

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('a cache write that throws keeps the entries for the next flush', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-translate-cache-write-'))
  const cache = new WorkspaceCache({ dir })
  const dom = new JSDOM(
    '<!doctype html><html><body><div data-conversation-session="s1"><p>Already here</p><div id="flow"></div></div></body></html>',
    { url: 'https://example.test/' },
  )
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.NodeFilter = dom.window.NodeFilter
  globalThis.MutationObserver = dom.window.MutationObserver

  const calls = []
  let failNext = 1
  const api = {
    async status() {
      return {
        ready: true,
        targetLang: 'zh',
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'hy-mt1.5-1.8b',
        glossary: [],
        batchReasoning: false,
        hoverRestore: false,
        hoverRestoreMs: 200,
        configHash: 'cfghash',
        reason: null,
      }
    },
    async translate(targetLang, segments) {
      return {
        translations: segments.map((segment) => '译 ' + segment),
        failed: [],
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'hy-mt1.5-1.8b',
        error: null,
      }
    },
    async sessionWorkspace() {
      return { path: '/work/one' }
    },
    async cacheLoad() {
      return { entries: {} }
    },
    cacheSave(request) {
      calls.push(request.entries.map((entry) => entry.source))
      if (failNext > 0) {
        failNext -= 1
        throw new Error('the host predates the cache invocations')
      }
      return cache.save(request.workspace, request.configHash, request.entries)
    },
  }

  const engine = client.__test.createEngine({ api, targetLang: 'zh', getWorkspace: () => '' })
  try {
    await engine.start()
    const append = (text) => {
      const paragraph = document.createElement('p')
      paragraph.textContent = text
      document.getElementById('flow').appendChild(paragraph)
    }
    append('First sentence here')
    await wait(2000)
    append('Second sentence here')
    await wait(2000)
  } finally {
    engine.stop()
  }

  assert.ok(calls.length >= 2, 'the failed chunk is retried by the next translation')
  assert.deepEqual(await cache.load('/work/one', 'cfghash'), {
    'First sentence here': '译 First sentence here',
    'Second sentence here': '译 Second sentence here',
  })
})
