// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { nodeFetch } from '../lib/transport.mjs'

function listen(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler)
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('nodeFetch posts JSON and reads the response', async (t) => {
  const seen = []
  const server = await listen((request, response) => {
    let raw = ''
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => {
      seen.push({ method: request.method, url: request.url, headers: request.headers, body: raw })
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true, echo: raw }))
    })
  })
  t.after(() => new Promise((resolve) => server.close(resolve)))

  const { port } = server.address()
  const response = await nodeFetch(`http://127.0.0.1:${port}/v1/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ a: 1 }),
  })
  assert.equal(response.ok, true)
  assert.equal(response.status, 200)
  assert.equal(seen[0].method, 'POST')
  assert.equal(seen[0].url, '/v1/check')
  assert.equal(seen[0].headers['content-length'], '7')
  assert.deepEqual(await response.json(), { ok: true, echo: '{"a":1}' })
})

test('nodeFetch surfaces a non-2xx status', async (t) => {
  const server = await listen((request, response) => {
    response.writeHead(401, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'unauthorized' }))
  })
  t.after(() => new Promise((resolve) => server.close(resolve)))

  const { port } = server.address()
  const response = await nodeFetch(`http://127.0.0.1:${port}/v1/models`)
  assert.equal(response.ok, false)
  assert.equal(response.status, 401)
  assert.match(await response.text(), /unauthorized/)
})

test('nodeFetch aborts with the caller signal', async (t) => {
  const server = await listen(() => { /* hold the response open */ })
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections()
    server.close(resolve)
  }))

  const { port } = server.address()
  const controller = new AbortController()
  const pending = nodeFetch(`http://127.0.0.1:${port}/v1/models`, { signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, /aborted/)
})
