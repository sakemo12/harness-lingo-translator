// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// lib/transport.mjs — the one HTTP call the host half makes.
//
// Node's global `fetch` follows the WHATWG bad-port list and refuses ports such
// as 123, which a LAN translation server may well use. This transport speaks
// plain `node:http`/`node:https` instead and returns a fetch-shaped response
// (`ok`, `status`, `text()`, `json()`), so the engine stays testable with a
// fake fetch double.

import http from 'node:http'
import https from 'node:https'

/**
 * An AbortError-shaped rejection for a cancelled call.
 * @returns {Error} abort error.
 */
function abortError() {
  const error = new Error('This operation was aborted')
  error.name = 'AbortError'
  return error
}

/**
 * Perform one HTTP request and buffer the response body.
 * @param {string | URL} input - absolute URL.
 * @param {object} [init] - request init.
 * @param {string} [init.method] - HTTP method, default GET.
 * @param {Record<string, string>} [init.headers] - request headers.
 * @param {string} [init.body] - request body.
 * @param {AbortSignal} [init.signal] - cancellation.
 * @returns {Promise<{ ok: boolean, status: number, text: () => Promise<string>, json: () => Promise<unknown> }>} response.
 */
export function nodeFetch(input, init = {}) {
  const url = new URL(String(input))
  const transport = url.protocol === 'https:' ? https : http
  const body = init.body === undefined ? undefined : String(init.body)
  const headers = { ...(init.headers ?? {}) }
  if (body !== undefined) {
    const length = Object.keys(headers).some((name) => name.toLowerCase() === 'content-length')
    if (!length) headers['content-length'] = String(Buffer.byteLength(body))
  }
  return new Promise((resolve, reject) => {
    if (init.signal?.aborted) {
      reject(abortError())
      return
    }
    const request = transport.request(url, { method: init.method ?? 'GET', headers }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('error', reject)
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve({
          ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
          status: response.statusCode ?? 0,
          async text() { return raw },
          async json() { return JSON.parse(raw) },
        })
      })
    })
    const onAbort = () => {
      request.destroy()
      reject(abortError())
    }
    const cleanup = () => {
      init.signal?.removeEventListener('abort', onAbort)
    }
    request.on('close', cleanup)
    request.on('error', (error) => {
      cleanup()
      reject(init.signal?.aborted ? abortError() : error)
    })
    init.signal?.addEventListener('abort', onAbort, { once: true })
    if (body !== undefined) request.write(body)
    request.end()
  })
}
