// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// Shared test helpers: load the hand-written client bundle in Node and build
// OpenAI-compatible fetch doubles for the host engine.
import React from 'react'
import { resolveConfig } from '../index.mjs'

let counter = 0

/** Load client/index.js under a fake loader window and return its exports. */
export async function loadClient() {
  let spec
  globalThis.window = {
    __ModuleLoader__: {
      load(value) { spec = value },
    },
    localStorage: {
      getItem() { return null },
      setItem() {},
    },
  }
  counter += 1
  const url = new URL('../client/index.js', import.meta.url)
  url.searchParams.set('t', String(counter) + '-' + String(Date.now()))
  await import(url.href)
  if (spec === undefined) throw new Error('client bundle did not call window.__ModuleLoader__.load')
  return spec.factory((name) => {
    if (name === 'react') return React
    throw new Error(`client bundle requested an unexpected module: ${name}`)
  })
}

/** A resolved plugin config with test-friendly overrides. */
export function baseConfig(overrides = {}) {
  return resolveConfig({
    baseUrl: 'http://127.0.0.1:8080/v1',
    model: 'hy-mt1.5-1.8b',
    targetLang: 'zh',
    retries: 0,
    ...overrides,
  })
}

/** A config source shaped like `createConfigSource` output. */
export function configSource(overrides = {}) {
  return { read: () => baseConfig(overrides) }
}

/** A fetch Response double that carries a JSON body for `text()` and `json()`. */
export function jsonResponse(body, status = 200) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return raw },
    async json() { return JSON.parse(raw) },
  }
}

/** A chat-completion response carrying one message. */
export function completion(content, finishReason = 'stop') {
  return jsonResponse({ choices: [{ message: { role: 'assistant', content }, finish_reason: finishReason }] })
}

/**
 * A fetch double that answers each chat completion through `reply(prompt, body, call)`.
 * `calls` keeps every parsed request body.
 */
export function fakeFetch(reply) {
  const calls = []
  const impl = async (url, init) => {
    const body = JSON.parse(init.body)
    const prompt = body.messages[0].content
    calls.push({ url, body, prompt })
    const answer = await reply(prompt, body, calls.length)
    if (answer instanceof Error) throw answer
    return answer
  }
  impl.calls = calls
  return impl
}
