// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { loadClient } from './helpers.mjs'

const client = await loadClient()
const { createUi, localizeError, DICTS } = client.__test
const t = (key) => DICTS.zh[key] ?? key

function withDom(body = '<div id="root"></div>') {
  const dom = new JSDOM('<!doctype html><html><body>' + body + '</body></html>', { url: 'https://example.test/' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  return dom
}

test('the error is shown above the button in Chinese and the button stays clickable while working', async () => {
  withDom()
  let toggles = 0
  const ui = createUi(t, { toggle: async () => { toggles += 1 } })
  try {
    ui.render({
      enabled: true,
      working: true,
      error: 'cannot reach http://127.0.0.1:8080/v1/models: connect ECONNREFUSED',
    })
    const host = document.querySelector('[data-harness-lingo-translator-ui]')
    const badge = host.children[0]
    const button = host.children[1]
    assert.equal(host.firstElementChild, badge)
    assert.equal(badge.nextElementSibling, button)
    assert.equal(button.disabled, false)
    assert.equal(button.textContent, DICTS.zh.working)
    assert.equal(badge.style.display, 'block')
    assert.match(badge.textContent, /^无法连接翻译服务：/)
    assert.match(badge.textContent, /127\.0\.0\.1:8080/)
    assert.match(button.getAttribute('aria-label'), /关闭自动翻译/)
    assert.match(button.title, /无法连接翻译服务/)

    button.click()
    await Promise.resolve()
    assert.equal(toggles, 1)

    ui.render({ enabled: false, working: false, error: null })
    assert.equal(badge.style.display, 'none')
    assert.equal(button.textContent, DICTS.zh.idle)
    assert.equal(button.disabled, false)
  } finally {
    ui.dispose()
  }
})

test('localizes common host errors and keeps unknown details after a Chinese prefix', () => {
  assert.equal(localizeError('no model route: send one message first', t), DICTS.zh['error.noRoute'])
  assert.equal(localizeError('the llm service is not mounted in this profile', t), DICTS.zh['error.noLlm'])
  assert.equal(localizeError('the translation is empty', t), DICTS.zh['error.emptyTranslation'])
  assert.match(localizeError('HTTP 503: upstream unavailable', t), /^翻译服务返回错误：HTTP 503/)
  assert.match(localizeError('some unexpected failure', t), /^翻译失败：some unexpected failure$/)
  assert.equal(localizeError('', t), '')
})
