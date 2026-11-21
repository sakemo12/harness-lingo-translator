// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { loadClient } from './helpers.mjs'

const client = await loadClient()

test('clicking the system-model checkbox switches to it and hides the local fields', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.test/' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.NodeFilter = dom.window.NodeFilter
  globalThis.MutationObserver = dom.window.MutationObserver
  const values = {
    baseUrl: 'http://127.0.0.1:8080/v1', model: 'm', concurrency: 2, batchReasoning: false,
    promptHeader: '', placeholderGuard: true, placeholderHint: '', systemModel: false,
    hoverRestore: true, hoverRestoreMs: 200,
  }
  const written = []
  const form = {
    state: { status: 'ready', value: values, base: {}, user: {}, writable: true, revision: 1 },
    mutate: async (ops) => { written.push(ops); return true },
  }
  const t = (key) => client.__test.DICTS.zh[key] ?? key
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(client.__test.ConfigPanel, { t, view: 'page', form })) })
  let inputs = document.querySelectorAll('input[type="checkbox"]')
  assert.deepEqual(Array.from(inputs).map((input) => input.checked), [true, false])
  await act(async () => { inputs[1].click() })
  inputs = document.querySelectorAll('input[type="checkbox"]')
  assert.deepEqual(Array.from(inputs).map((input) => input.checked), [false, true])
  assert.match(document.body.textContent, /provider\/model/)
  assert.equal(document.body.textContent.includes('服务地址'), false)
  // The host config field is `systemModel`; persisting any other spelling is
  // rejected by the settings service ("field is not volatile").
  const save = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === '保存')
  await act(async () => { save.click() })
  assert.deepEqual(written, [[{ op: 'set', path: ['systemModel'], value: true }]])
  await act(async () => { inputs[0].click() })
  inputs = document.querySelectorAll('input[type="checkbox"]')
  assert.deepEqual(Array.from(inputs).map((input) => input.checked), [true, false])
  assert.match(document.body.textContent, /服务地址/)
  root.unmount()
})
