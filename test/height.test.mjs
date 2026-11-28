// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// Height pinning: a translated block is as tall as the larger of its original
// and translated renderings, so applying a translation and previewing the
// original on hover never reflow the surrounding list. Only height is handled.
import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { loadClient } from './helpers.mjs'

const client = await loadClient()
const { createEngine } = client.__test

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(predicate, timeout = 3000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (predicate()) return
    await delay(20)
  }
  throw new Error('condition not reached in time')
}

/**
 * jsdom has no layout. Simulate wrapping as one 20px line per 10 characters,
 * add padding/borders according to the element's box-sizing, and honor the
 * inline min-height the engine writes, which is what the browser would do after
 * the pin.
 */
function installLayout(dom) {
  const natural = (text) => Math.max(1, Math.ceil((text || '').length / 10)) * 20
  dom.window.Element.prototype.getBoundingClientRect = function () {
    const style = dom.window.getComputedStyle(this)
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
    const border = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
    const min = parseFloat(this.style.minHeight) || 0
    const text = natural(this.textContent || '')
    const height = style.boxSizing === 'border-box'
      ? Math.max(text + padding + border, min)
      : Math.max(text, min) + padding + border
    return { height, width: 100, top: 0, left: 0, right: 100, bottom: height, x: 0, y: 0 }
  }
}

function withDom(html) {
  // The engine is scoped to the conversation flow column.
  const dom = new JSDOM(
    '<!doctype html><html><body><div class="EvIC1a_column" data-chat-flow>' + html + '</div></body></html>',
    { url: 'https://example.test/' },
  )
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.NodeFilter = dom.window.NodeFilter
  globalThis.MutationObserver = dom.window.MutationObserver
  installLayout(dom)
  return dom
}

function fakeApi(translation) {
  return {
    status: async () => ({
      ready: true,
      targetLang: 'zh',
      baseUrl: 'http://127.0.0.1:8080/v1',
      model: 'hy-mt1.5-1.8b',
      glossary: [],
      batchReasoning: false,
      hoverRestore: true,
      hoverRestoreMs: 0,
      configHash: 'testconfig',
      reason: null,
    }),
    translate: async (targetLang, segments) => ({
      translations: segments.map(() => translation),
      failed: [],
      baseUrl: 'http://127.0.0.1:8080/v1',
      model: 'hy-mt1.5-1.8b',
      error: null,
    }),
    cacheLoad: async () => ({ entries: {} }),
    cacheSave: async (request) => ({ saved: request.entries.length, total: request.entries.length }),
    sessionWorkspace: async () => ({ path: null }),
  }
}

/** Mount an empty root, start the engine, then let the body append new blocks. */
async function withEngine(translation, body) {
  withDom('<div id="root"></div>')
  const engine = createEngine({ api: fakeApi(translation), targetLang: 'zh', getWorkspace: () => '' })
  try {
    await engine.start()
    return await body(engine)
  } finally {
    engine.stop()
  }
}

test('pins the taller translated height and keeps it while hovering', async () => {
  await withEngine('译'.repeat(40), async () => {
    const block = document.createElement('p')
    block.textContent = 'Hi'
    document.getElementById('root').appendChild(block)
    await waitFor(() => block.textContent.startsWith('译'))
    assert.equal(block.style.minHeight, '80px')
    assert.equal(block.getBoundingClientRect().height, 80)

    block.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    assert.equal(block.textContent, 'Hi')
    assert.equal(block.style.minHeight, '80px')
    assert.equal(block.getBoundingClientRect().height, 80)

    document.dispatchEvent(new window.MouseEvent('mouseleave'))
    assert.equal(block.textContent.startsWith('译'), true)
    assert.equal(block.style.minHeight, '80px')
  })
})

test('keeps the taller original height when the translation is shorter', async () => {
  await withEngine('译', async () => {
    const block = document.createElement('p')
    block.textContent = 'This is a long original sentence that wraps.'
    document.getElementById('root').appendChild(block)
    await waitFor(() => block.textContent === '译')
    // 43 characters simulate five wrapped lines; the one-character translation
    // must not shrink the block.
    assert.equal(block.style.minHeight, '100px')
    assert.equal(block.getBoundingClientRect().height, 100)

    block.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    assert.equal(block.textContent, 'This is a long original sentence that wraps.')
    assert.equal(block.getBoundingClientRect().height, 100)
  })
})

test('does not keep a tall intermediate state from a partly translated block', async () => {
  withDom('<div id="root"></div>')
  const api = {
    ...fakeApi(''),
    translate: async (targetLang, segments) => ({
      translations: segments.map((segment) => segment === 'Hi' ? '译'.repeat(20) : '短'),
      failed: [],
      baseUrl: 'http://127.0.0.1:8080/v1',
      model: 'hy-mt1.5-1.8b',
      error: null,
    }),
  }
  const engine = createEngine({ api, targetLang: 'zh', getWorkspace: () => '' })
  try {
    await engine.start()
    const block = document.createElement('p')
    block.textContent = 'Hi'
    const bold = document.createElement('b')
    bold.textContent = 'This is a very long original second part that wraps.'
    block.appendChild(bold)
    document.getElementById('root').appendChild(block)
    await waitFor(() => block.textContent === '译'.repeat(20) + '短')
    // Original: 52 characters -> 120px. Translating only the short first part
    // first would render 70 characters -> 140px, but the completed block is
    // 21 characters -> 60px; the pin must settle on max(120, 60), not 140.
    assert.equal(block.style.minHeight, '120px')
  } finally {
    engine.stop()
  }
})

test('writes a content-box min-height for content-box blocks and a border-box one otherwise', async () => {
  await withEngine('译'.repeat(40), async () => {
    const contentBox = document.createElement('p')
    contentBox.style.padding = '10px 0'
    contentBox.style.border = '2px solid'
    contentBox.textContent = 'Hi'
    const borderBox = document.createElement('p')
    borderBox.style.boxSizing = 'border-box'
    borderBox.style.padding = '10px 0'
    borderBox.style.border = '2px solid'
    borderBox.textContent = 'Hi'
    document.getElementById('root').append(contentBox, borderBox)
    await waitFor(() => contentBox.textContent.startsWith('译') && borderBox.textContent.startsWith('译'))
    // The translated text is 80px of content. content-box min-height is the
    // content height; border-box min-height includes its 24px padding/border.
    assert.equal(contentBox.style.minHeight, '80px')
    assert.equal(borderBox.style.minHeight, '104px')
    assert.equal(contentBox.getBoundingClientRect().height, 104)
    assert.equal(borderBox.getBoundingClientRect().height, 104)
  })
})

test('pins the block ancestor of an inline text node and restores its inline min-height', async () => {
  withDom('<div id="root"></div>')
  const engine = createEngine({ api: fakeApi('译'.repeat(40)), targetLang: 'zh', getWorkspace: () => '' })
  try {
    await engine.start()
    const block = document.createElement('p')
    block.style.minHeight = '30px'
    const span = document.createElement('span')
    span.textContent = 'Hi'
    block.appendChild(span)
    document.getElementById('root').appendChild(block)
    await waitFor(() => span.textContent.startsWith('译'))
    assert.equal(span.style.minHeight, '')
    assert.equal(block.style.minHeight, '80px')

    span.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    assert.equal(span.textContent, 'Hi')
    assert.equal(block.style.minHeight, '80px')

    engine.stop()
    // The engine restores the page's own inline value, not an empty string.
    assert.equal(block.style.minHeight, '30px')
    assert.equal(block.textContent, 'Hi')
    assert.equal(span.textContent, 'Hi')
  } finally {
    engine.stop()
  }
})
