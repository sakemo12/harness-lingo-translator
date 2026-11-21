// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { loadClient } from './helpers.mjs'

const client = await loadClient()

function fakeCtx() {
  const state = { mounted: null, registered: null, injected: [], effects: [], slotInject: null, slotRegistration: null }
  const ctx = {
    slots: {
      inject(key, callback) {
        state.slotInject = key
        return callback()
      },
      register(options, component) {
        state.slotRegistration = { options, component }
        return () => {}
      },
    },
    effect(fn, label) {
      const dispose = fn()
      state.effects.push({ label, dispose })
      return dispose
    },
    locale: {
      register(ns, dicts) { state.registered = { ns, dicts }; return () => {} },
      bind() { return (key) => key },
      getLocale() { return { active: 'zh', locales: [], revision: 0 } },
    },
    remote: {
      async $mount(contribution) { state.mounted = contribution },
      translatePage: {
        async status() {
          return {
            ok: true,
            value: {
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
            },
          }
        },
        async translate(request) {
          return {
            ok: true,
            value: {
              translations: request.segments.map((segment) => '译 ' + segment),
              failed: [],
              baseUrl: 'http://127.0.0.1:8080/v1',
              model: 'hy-mt1.5-1.8b',
              error: null,
            },
          }
        },
        async loadCache() {
          return { ok: true, value: { entries: {} } }
        },
        async saveCache() {
          return { ok: true, value: { saved: 0, total: 0 } }
        },
        async workspace() {
          return { ok: true, value: { path: null } }
        },
        async pruneCache() {
          return { ok: true, value: { removed: 0, files: 0 } }
        },
      },
    },
    inject(names, callback) { state.injected.push(names); callback(ctx) },
  }
  return { ctx, state }
}

test('client apply mounts the Remote contribution and the page control', async () => {
  const dom = new JSDOM('<!doctype html><html><body><p id="p">Hello world</p></body></html>', { url: 'https://example.test/' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.NodeFilter = dom.window.NodeFilter
  globalThis.MutationObserver = dom.window.MutationObserver
  const { ctx, state } = fakeCtx()
  await client.apply(ctx)
  assert.equal(state.mounted.package, 'dsh-translate')
  assert.equal(state.mounted.descriptors.length, 6)
  assert.equal(state.registered.ns, 'translate')
  assert.ok(document.querySelector('[data-dsh-translate-ui]') !== null)
  assert.deepEqual(state.injected[0], ['remote.translatePage'])
  assert.equal(state.slotInject, 'plugins.row.config')
  assert.equal(state.slotRegistration.options.key, 'dsh-translate#dsh-translate')
  assert.equal(state.slotRegistration.options.locale, 'translate')
  assert.equal(typeof state.slotRegistration.component, 'function')
})
