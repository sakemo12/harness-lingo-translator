// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { loadClient } from './helpers.mjs'

const client = await loadClient()
const { createEngine } = client.__test

function withDom(html) {
  const dom = new JSDOM('<!doctype html><html><body>' + html + '</body></html>', { url: 'https://example.test/' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.NodeFilter = dom.window.NodeFilter
  globalThis.MutationObserver = dom.window.MutationObserver
  return dom
}

/** A remote double shaped like the host `translatePage` namespace. */
function fakeApi(overrides = {}) {
  const calls = { status: 0, translate: 0, cacheLoad: 0, cacheSave: 0, log: [] }
  return {
    calls,
    status: async () => {
      calls.status += 1
      if (overrides.statusDelay) await delay(overrides.statusDelay)
      return {
        ready: true,
        targetLang: 'zh',
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'hy-mt1.5-1.8b',
        glossary: [],
        batchReasoning: false,
        hoverRestore: false,
        hoverRestoreMs: 1500,
        configHash: 'testconfig',
        backend: 'local',
        reason: null,
        ...overrides.status,
      }
    },
    translate: async (lang, segments, batch) => {
      calls.translate += 1
      calls.log.push({ segments: segments.slice(), batch: batch === true })
      return {
        translations: segments.map((segment) => '译 ' + segment),
        failed: [],
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'hy-mt1.5-1.8b',
        error: null,
        ...overrides.translate,
      }
    },
    cacheLoad: async () => {
      calls.cacheLoad += 1
      const entries = overrides.cacheEntries === undefined ? {} : overrides.cacheEntries
      return { entries: { ...entries } }
    },
    cacheSave: async (request) => {
      calls.cacheSave += 1
      calls.log.push({ cache: request.entries.slice() })
      return { saved: request.entries.length, total: request.entries.length }
    },
    sessionWorkspace: async () => ({ path: overrides.workspacePath ?? null }),
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Poll until the predicate holds (real timers: the engine debounces 350 ms). */
async function waitFor(predicate, timeout = 3000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (predicate()) return
    await delay(20)
  }
  throw new Error('condition not reached in time')
}

/** Mount a fresh DOM, run the body with an engine, and always switch it off. */
async function withEngine(html, overrides, body) {
  withDom(html)
  const api = fakeApi(overrides)
  const engine = createEngine({ api, targetLang: 'zh', getWorkspace: overrides.getWorkspace })
  try {
    return await body(engine, api)
  } finally {
    engine.stop()
  }
}

function paragraph(text) {
  const element = document.createElement('p')
  element.textContent = text
  return element
}

test('turning the switch on leaves existing text alone', async () => {
  await withEngine('<p id="a">Hello world</p><p id="b">Another line</p>', {}, async (engine, api) => {
    await engine.start()
    assert.equal(engine.state().enabled, true)
    await delay(700)
    assert.equal(document.getElementById('a').textContent, 'Hello world')
    assert.equal(document.getElementById('b').textContent, 'Another line')
    assert.equal(api.calls.translate, 0)
  })
})

test('translates a block that appears after the switch is on', async () => {
  await withEngine('', {}, async (engine) => {
    await engine.start()
    const node = paragraph('New message here')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 New message here')
  })
})

test('waits for a streaming block to finish generating', async () => {
  await withEngine('', {}, async (engine) => {
    await engine.start()
    const block = document.createElement('div')
    block.setAttribute('data-streaming', '')
    const node = paragraph('Streaming answer')
    block.appendChild(node)
    document.body.appendChild(block)
    await delay(700)
    assert.equal(node.textContent, 'Streaming answer')
    block.removeAttribute('data-streaming')
    await waitFor(() => node.textContent === '译 Streaming answer')
  })
})

test('never translates collapsed text until it is revealed', async () => {
  await withEngine('', {}, async (engine) => {
    await engine.start()
    const box = document.createElement('div')
    box.style.display = 'none'
    const node = paragraph('Collapsed content')
    box.appendChild(node)
    document.body.appendChild(box)
    await delay(700)
    assert.equal(node.textContent, 'Collapsed content')
    box.style.display = ''
    await waitFor(() => node.textContent === '译 Collapsed content')
  })
})

test('translates text that appears while the status probe runs', async () => {
  await withEngine('', { statusDelay: 150 }, async (engine) => {
    const pending = engine.start()
    await delay(30)
    const node = paragraph('Arrived during probe')
    document.body.appendChild(node)
    await pending
    await waitFor(() => node.textContent === '译 Arrived during probe')
  })
})

test('keeps text that was already visible when the switch was turned on', async () => {
  await withEngine('<p id="old">Visible before</p>', {}, async (engine) => {
    await engine.start()
    const fresh = paragraph('Fresh line')
    document.body.appendChild(fresh)
    await waitFor(() => fresh.textContent === '译 Fresh line')
    assert.equal(document.getElementById('old').textContent, 'Visible before')
  })
})

test('translates a closed details body only after it opens', async () => {
  await withEngine('', {}, async (engine) => {
    await engine.start()
    const details = document.createElement('details')
    const summary = document.createElement('summary')
    summary.textContent = 'More'
    const body = paragraph('Details body')
    details.append(summary, body)
    document.body.appendChild(details)
    await delay(700)
    assert.equal(body.textContent, 'Details body')
    details.setAttribute('open', '')
    await waitFor(() => body.textContent === '译 Details body')
  })
})

test('translates a baseline text node once its content changes', async () => {
  await withEngine('<p id="p">Draft</p>', {}, async (engine) => {
    await engine.start()
    const node = document.getElementById('p')
    node.firstChild.nodeValue = 'Draft complete'
    await waitFor(() => node.textContent === '译 Draft complete')
  })
})

test('does not retry a failing segment on every mutation', async () => {
  await withEngine('', {}, async (engine, api) => {
    api.translate = async (lang, segments) => {
      api.calls.translate += 1
      return {
        translations: segments,
        failed: segments.map((_, index) => index),
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'hy-mt1.5-1.8b',
        error: 'segment 0: placeholder',
      }
    }
    await engine.start()
    const node = paragraph('Failing segment')
    document.body.appendChild(node)
    await delay(1000)
    assert.equal(api.calls.translate, 1)
    for (let i = 0; i < 12; i += 1) {
      document.body.appendChild(document.createElement('span'))
      await delay(50)
    }
    await delay(600)
    assert.equal(api.calls.translate, 1)
    assert.equal(node.textContent, 'Failing segment')
  })
})

test('does not duplicate segments while a batch is in flight', async () => {
  await withEngine('', {}, async (engine, api) => {
    const requested = []
    api.translate = async (lang, segments) => {
      api.calls.translate += 1
      for (const segment of segments) requested.push(segment)
      await delay(1500)
      return {
        translations: segments.map((segment) => '译 ' + segment),
        failed: [],
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'hy-mt1.5-1.8b',
        error: null,
      }
    }
    await engine.start()
    const nodes = [paragraph('First new line'), paragraph('Second new line'), paragraph('Third new line')]
    document.body.append(...nodes)
    await delay(500)
    for (let i = 0; i < 30; i += 1) {
      document.body.appendChild(document.createElement('span'))
      await delay(30)
    }
    await waitFor(() => nodes.every((node) => node.textContent.startsWith('译 ')), 6000)
    assert.equal(new Set(requested).size, requested.length, 'duplicate segments requested')
  })
})

test('pauses after repeated whole-batch failures', async () => {
  await withEngine('', {}, async (engine, api) => {
    api.translate = async (lang, segments) => {
      api.calls.translate += 1
      return {
        translations: segments,
        failed: segments.map((_, index) => index),
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'hy-mt1.5-1.8b',
        error: 'boom',
      }
    }
    await engine.start()
    // Distinct texts: a shared number would mask to the same key and be
    // deduplicated by the failure guard, not by the pause rule.
    for (const text of ['Alpha line', 'Beta line', 'Gamma line', 'Delta line']) {
      document.body.appendChild(paragraph(text))
      await delay(600)
    }
    assert.equal(api.calls.translate, 4)
    assert.match(engine.state().error, /boom/)
    const calls = api.calls.translate
    document.body.appendChild(paragraph('Should retry without a pause'))
    await delay(800)
    assert.equal(api.calls.translate, calls + 1)
  })
})

test('translates tool descriptions but never command or code surfaces', async () => {
  await withEngine('', {}, async (engine) => {
    await engine.start()
    const card = document.createElement('div')
    card.setAttribute('data-tool', 'bash')
    const description = paragraph('Check the translation service health')
    const terminal = document.createElement('div')
    terminal.setAttribute('data-terminal', '')
    const command = document.createElement('span')
    command.setAttribute('data-command-text', '')
    command.textContent = 'curl http://192.168.1.10:8080/v1/models'
    const output = document.createElement('div')
    output.textContent = 'HTTP/1.1 200 OK'
    terminal.append(command, output)
    const mono = document.createElement('span')
    mono.style.fontFamily = 'monospace'
    mono.textContent = 'git status'
    const read = document.createElement('div')
    read.setAttribute('data-read', '')
    read.textContent = 'line of file content'
    const diff = document.createElement('div')
    diff.setAttribute('data-diff', '')
    diff.textContent = '+ const answer = 42'
    card.append(description, terminal, mono, read, diff)
    document.body.append(card)

    await waitFor(() => description.textContent === '译 Check the translation service health')
    await delay(500)
    assert.equal(command.textContent, 'curl http://192.168.1.10:8080/v1/models')
    assert.equal(output.textContent, 'HTTP/1.1 200 OK')
    assert.equal(mono.textContent, 'git status')
    assert.equal(read.textContent, 'line of file content')
    assert.equal(diff.textContent, '+ const answer = 42')
  })
})

test('batches one reasoning block into a single request', async () => {
  await withEngine('', { status: { batchReasoning: true } }, async (engine, api) => {
    await engine.start()
    const first = document.createElement('div')
    first.setAttribute('data-variant', 'think')
    first.append(paragraph('First thought'), paragraph('Second thought'))
    const second = document.createElement('div')
    second.setAttribute('data-variant', 'think')
    second.append(paragraph('Third thought'), paragraph('Fourth thought'))
    const plain = paragraph('Plain message text')
    document.body.append(first, second, plain)
    const nodes = [first, second].flatMap((block) => [...block.querySelectorAll('p')]).concat(plain)
    await waitFor(() => nodes.every((node) => node.textContent.startsWith('译 ')), 5000)

    const batched = api.calls.log.filter((entry) => entry.batch)
    assert.equal(batched.length, 2)
    assert.deepEqual(batched.map((entry) => entry.segments.length), [2, 2])
    const singles = api.calls.log.filter((entry) => !entry.batch)
    assert.equal(singles.length, 1)
    assert.deepEqual(singles[0].segments, ['Plain message text'])
  })
})

test('does not batch when the switch is off', async () => {
  await withEngine('', {}, async (engine, api) => {
    await engine.start()
    const block = document.createElement('div')
    block.setAttribute('data-variant', 'think')
    block.append(paragraph('Alpha thought'), paragraph('Beta thought'))
    document.body.append(block)
    await waitFor(() => [...block.querySelectorAll('p')].every((node) => node.textContent.startsWith('译 ')), 5000)
    assert.equal(api.calls.log.length, 2)
    assert.ok(api.calls.log.every((entry) => entry.batch === false))
  })
})

test('never translates Chinese blocks', async () => {
  await withEngine('', {}, async (engine, api) => {
    await engine.start()
    const chinese = paragraph('这是一个中文段落，不需要翻译。')
    const english = paragraph('This English paragraph needs translation.')
    document.body.append(chinese, english)
    await waitFor(() => english.textContent === '译 This English paragraph needs translation.')
    await delay(400)
    assert.equal(chinese.textContent, '这是一个中文段落，不需要翻译。')
    assert.equal(api.calls.translate, 1)
  })
})

test('translates an English block that only quotes Chinese', async () => {
  await withEngine('', {}, async (engine) => {
    await engine.start()
    const node = paragraph('The reply was “好的” and then it stopped.')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 The reply was “好的” and then it stopped.')
  })
})

test('never translates messages sent by the user', async () => {
  await withEngine('', {}, async (engine, api) => {
    await engine.start()
    const userMessage = document.createElement('div')
    userMessage.setAttribute('data-chat-flow-kind', 'user')
    const userText = paragraph('This is what the user typed.')
    userMessage.appendChild(userText)
    const assistant = document.createElement('div')
    assistant.setAttribute('data-chat-flow-kind', 'assistant')
    const assistantText = paragraph('This is the assistant reply.')
    assistant.appendChild(assistantText)
    document.body.append(userMessage, assistant)
    await waitFor(() => assistantText.textContent === '译 This is the assistant reply.')
    await delay(400)
    assert.equal(userText.textContent, 'This is what the user typed.')
    assert.equal(api.calls.translate, 1)
  })
})

test('shows the original after a stationary hover; moving inside the block keeps it', async () => {
  await withEngine('', { status: { hoverRestore: true, hoverRestoreMs: 300 } }, async (engine) => {
    await engine.start()
    const node = paragraph('Hovered message text')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 Hovered message text')
    node.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    await delay(500)
    assert.equal(node.textContent, 'Hovered message text')
    node.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    await delay(200)
    assert.equal(node.textContent, 'Hovered message text')
    document.body.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    await delay(80)
    assert.equal(node.textContent, '译 Hovered message text')
  })
})

test('a zero hover delay shows the original immediately and keeps it inside the block', async () => {
  await withEngine('', { status: { hoverRestore: true, hoverRestoreMs: 0 } }, async (engine) => {
    await engine.start()
    const node = paragraph('Hovered message text')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 Hovered message text')
    node.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    await delay(30)
    assert.equal(node.textContent, 'Hovered message text')
    node.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    await delay(30)
    assert.equal(node.textContent, 'Hovered message text')
    document.body.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    await delay(30)
    assert.equal(node.textContent, '译 Hovered message text')
  })
})

test('hovering a leading icon previews its block without touching a neighbour', async () => {
  await withEngine('', { status: { hoverRestore: true, hoverRestoreMs: 0 } }, async (engine) => {
    await engine.start()
    const first = document.createElement('p')
    const icon = document.createElement('span')
    icon.textContent = '→'
    const firstText = document.createTextNode('First block text')
    first.append(icon, firstText)
    const second = paragraph('Second block text')
    document.body.append(first, second)
    await waitFor(() => firstText.nodeValue === '译 First block text' && second.textContent === '译 Second block text')

    icon.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    await delay(40)
    assert.equal(firstText.nodeValue, 'First block text')
    assert.equal(second.textContent, '译 Second block text')

    first.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    await delay(40)
    assert.equal(firstText.nodeValue, 'First block text')
  })
})

test('does not preview when hover restore is off', async () => {
  await withEngine('', {}, async (engine) => {
    await engine.start()
    const node = paragraph('Hovered message text')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 Hovered message text')
    node.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
    await delay(500)
    assert.equal(node.textContent, '译 Hovered message text')
  })
})

test('re-enabling shows cached translations again without new requests', async () => {
  await withEngine('', {}, async (engine, api) => {
    await engine.start()
    const node = paragraph('Cached message text')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 Cached message text')
    const count = api.calls.translate
    await engine.stop()
    assert.equal(node.textContent, 'Cached message text')
    await engine.start()
    await delay(100)
    assert.equal(node.textContent, '译 Cached message text')
    assert.equal(api.calls.translate, count)
  })
})

test('keeps a collapsed reasoning summary that was already visible original', async () => {
  await withEngine('', {}, async (engine, api) => {
    const row = document.createElement('div')
    row.setAttribute('data-variant', 'think')
    const text = 'First paragraph preview text that was visible before enabling and is long enough to exceed the collapsed limit. '.repeat(3).trim()
    const summary = paragraph(text)
    row.appendChild(summary)
    document.body.appendChild(row)
    await engine.start()
    await delay(700)
    assert.equal(summary.textContent, text)
    assert.equal(api.calls.translate, 0)
  })
})

test('translates a newly appeared collapsed reasoning summary, truncated', async () => {
  await withEngine('', {}, async (engine) => {
    await engine.start()
    const row = document.createElement('div')
    row.setAttribute('data-variant', 'think')
    const summary = paragraph('First paragraph preview text that appeared after enabling and is long enough to exceed the collapsed limit. '.repeat(3).trim())
    row.appendChild(summary)
    document.body.appendChild(row)
    await waitFor(() => summary.textContent.startsWith('译 '))
    assert.ok(summary.textContent.endsWith('…'))
    assert.ok(summary.textContent.length <= 170)
  })
})

test('re-applies a translation when the app renders the original text again', async () => {
  await withEngine('', {}, async (engine, api) => {
    await engine.start()
    const node = paragraph('Rendered reply text')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 Rendered reply text')
    const count = api.calls.translate
    node.nodeValue = 'Rendered reply text'
    await delay(150)
    assert.equal(node.textContent, '译 Rendered reply text')
    assert.equal(api.calls.translate, count)
  })
})

test('keeps a newly translated collapsed reasoning summary when the row expands', async () => {
  await withEngine('', {}, async (engine, api) => {
    await engine.start()
    const row = document.createElement('div')
    row.setAttribute('data-variant', 'think')
    const text = 'First paragraph preview text that stays translated after expanding.'
    const summary = paragraph(text)
    row.appendChild(summary)
    document.body.appendChild(row)
    await waitFor(() => summary.textContent.startsWith('译 '))
    const count = api.calls.translate
    row.setAttribute('data-expanded', '')
    summary.nodeValue = text
    await delay(150)
    assert.ok(summary.textContent.startsWith('译 '))
    assert.equal(api.calls.translate, count)
  })
})

test('keeps a re-rendered parent original while the newly revealed reasoning body translates', async () => {
  await withEngine([
    '<div data-chat-flow-key="m1">',
    '  <p id="parent">Parent message above thinking.</p>',
    '  <div data-variant="think" id="think">',
    '    <div><span>思考</span><span>Summary line visible.</span></div>',
    '    <div id="body"></div>',
    '  </div>',
    '</div>',
  ].join('\n'), {}, async (engine) => {
    await engine.start()
    await delay(500)
    const parent = document.getElementById('parent')
    const row = document.getElementById('think')
    const body = document.getElementById('body')
    // Expanding the row makes React replace the parent text node and add the
    // body. The parent text is baseline; the body text is newly revealed.
    parent.textContent = 'Parent message above thinking.'
    const reasoning = paragraph('Reasoning body text here.')
    body.appendChild(reasoning)
    row.setAttribute('data-expanded', '')
    await waitFor(() => reasoning.textContent === '译 Reasoning body text here.')
    assert.equal(parent.textContent, 'Parent message above thinking.')
  })
})

test('restores originals when the switch is turned off', async () => {
  await withEngine('', {}, async (engine) => {
    await engine.start()
    const node = paragraph('New message here')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 New message here')
    engine.stop()
    assert.equal(node.textContent, 'New message here')
    assert.equal(engine.state().enabled, false)
  })
})

test('masks the glossary terms reported by the host', async () => {
  await withEngine('', { status: { glossary: ['Acme Widgets'] } }, async (engine) => {
    await engine.start()
    const node = paragraph('Use Acme Widgets here')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 Use Acme Widgets here')
  })
})

test('reports an unreachable service and stays off', async () => {
  await withEngine('<p id="p">Hello world</p>', {
    status: { ready: false, model: null, reason: 'cannot reach http://127.0.0.1:8080/v1/models' },
  }, async (engine) => {
    await engine.start()
    assert.equal(engine.state().enabled, false)
    assert.match(engine.state().error, /cannot reach/)
    assert.equal(document.getElementById('p').textContent, 'Hello world')
  })
})


test('does not replay host-cached translations onto text that was already visible', async () => {
  await withEngine('<p id="a">Existing cached text</p>', {
    getWorkspace: () => '/tmp/workspace',
    cacheEntries: { 'Existing cached text': '译 Existing cached text' },
  }, async (engine, api) => {
    await engine.start()
    await delay(120)
    assert.equal(document.getElementById('a').textContent, 'Existing cached text')
    assert.equal(api.calls.cacheLoad, 1)
    assert.equal(api.calls.translate, 0)
  })
})

test('does not replay a host-cached inline-code paragraph onto existing text', async () => {
  await withEngine('<p id="u">The host <code>resolveConfig</code> validates input.</p>', {
    getWorkspace: () => '/tmp/workspace',
    cacheEntries: { 'The host ⟦0⟧ validates input.': '宿主 ⟦0⟧ 校验输入。' },
  }, async (engine, api) => {
    await engine.start()
    await delay(120)
    assert.equal(document.getElementById('u').textContent, 'The host resolveConfig validates input.')
    assert.equal(api.calls.cacheLoad, 1)
    assert.equal(api.calls.translate, 0)
  })
})

test('re-enabling restores only segments translated in this page session', async () => {
  await withEngine('<p id="a">Existing cached text</p>', {
    getWorkspace: () => '/tmp/workspace',
    cacheEntries: { 'Existing cached text': '译 Existing cached text' },
  }, async (engine, api) => {
    await engine.start()
    const fresh = paragraph('Fresh translated text')
    document.body.appendChild(fresh)
    await waitFor(() => fresh.textContent === '译 Fresh translated text')
    const count = api.calls.translate
    assert.equal(document.getElementById('a').textContent, 'Existing cached text')
    await engine.stop()
    assert.equal(fresh.textContent, 'Fresh translated text')
    await engine.start()
    await delay(120)
    assert.equal(document.getElementById('a').textContent, 'Existing cached text')
    assert.equal(fresh.textContent, '译 Fresh translated text')
    assert.equal(api.calls.translate, count)
  })
})

test('saves successful translations into the workspace cache', async () => {
  await withEngine('<p id="a">New translation text</p>', { getWorkspace: () => '/tmp/workspace' }, async (engine, api) => {
    await engine.start()
    const node = paragraph('New translation text')
    document.body.appendChild(node)
    await waitFor(() => node.textContent === '译 New translation text')
    await delay(1000)
    assert.equal(api.calls.cacheSave, 1)
    const saved = api.calls.log.find((entry) => entry.cache !== undefined).cache
    assert.equal(saved.some((entry) => entry.source === 'New translation text' && entry.translation === '译 New translation text'), true)
  })
})


test('resolves the workspace from the host session header and uses its cache for new text', async () => {
  await withEngine('<div data-conversation-session="s1"><p id="a">Cached from host workspace</p></div>', {
    workspacePath: '/work/one',
    cacheEntries: { 'Cached from host workspace': '译 Cached from host workspace' },
  }, async (engine, api) => {
    await engine.start()
    await delay(120)
    assert.equal(document.getElementById('a').textContent, 'Cached from host workspace')
    const fresh = paragraph('Cached from host workspace')
    document.body.appendChild(fresh)
    await waitFor(() => fresh.textContent === '译 Cached from host workspace')
    assert.equal(document.getElementById('a').textContent, 'Cached from host workspace')
    assert.equal(api.calls.cacheLoad, 1)
    assert.equal(api.calls.translate, 0)
  })
})


test('translates a paragraph with inline code as one unit and keeps the code', async () => {
  await withEngine('', {}, async (engine, api) => {
    await engine.start()
    const paragraph = document.createElement('p')
    const before = document.createTextNode('The host ')
    const code = document.createElement('code')
    code.textContent = 'resolveConfig'
    const after = document.createTextNode(' validates baseUrl/model/concurrency regardless of systemModel.')
    paragraph.append(before, code, after)
    const afterOriginal = after.nodeValue
    document.body.appendChild(paragraph)
    await waitFor(() => before.nodeValue.startsWith('译 The host') && after.nodeValue !== afterOriginal)
    assert.equal(api.calls.translate, 1)
    const sent = api.calls.log[0].segments
    assert.equal(sent.length, 1)
    assert.equal(sent[0].includes('The host ⟦0⟧ validates ⟦1⟧/model/concurrency regardless of ⟦2⟧.'), true)
    assert.equal(code.textContent, 'resolveConfig')
    assert.ok(after.nodeValue.includes('baseUrl/model/concurrency'))
  })
})
