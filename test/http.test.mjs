// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// End-to-end over a real loopback HTTP server: proves the fetch wiring, the
// request body and the prompt without any fake transport.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { probeEndpoint, translateSegments } from '../lib/engine.mjs'
import { baseConfig } from './helpers.mjs'

function listen(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler)
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('speaks the OpenAI-compatible protocol end to end', async (t) => {
  const requests = []
  const server = await listen((request, response) => {
    let raw = ''
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => {
      const body = raw.length > 0 ? JSON.parse(raw) : undefined
      requests.push({ method: request.method, url: request.url, body, authorization: request.headers.authorization })
      if (request.url === '/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ data: [{ id: 'hy-mt1.5-1.8b' }] }))
        return
      }
      const prompt = body.messages[0].content
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: prompt.includes('Hello') ? '你好 [0]' : '你好' }, finish_reason: 'stop' }],
      }))
    })
  })
  t.after(() => new Promise((resolve) => server.close(resolve)))

  const { port } = server.address()
  const config = baseConfig({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'local-token' })

  const status = await probeEndpoint({ config })
  assert.equal(status.ok, true)
  assert.equal(status.model, 'hy-mt1.5-1.8b')

  const result = await translateSegments({ config, targetLang: 'zh', segments: ['Hello [0]'] })
  assert.deepEqual(result.translations, ['你好 [0]'])
  assert.deepEqual(result.failed, [])
  assert.equal(result.error, null)

  const completion = requests.find((entry) => entry.url === '/v1/chat/completions')
  assert.equal(requests[0].url, '/v1/models')
  assert.equal(requests[0].authorization, 'Bearer local-token')
  assert.equal(completion.body.messages[0].content, '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释，原文中的[0]、[1]、[2]这类占位符必须原样保留，你可以把占位符当做未知内容（一般是专有名词、数值、代码块）插入翻译好的句子，但不要把占位符里的编号当做数字翻译进内容里：Hello [0]')
  assert.equal(completion.body.top_k, 20)
  assert.equal(completion.body.temperature, 0.7)
  assert.equal(completion.authorization, 'Bearer local-token')
})
