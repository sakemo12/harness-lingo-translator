// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from './helpers.mjs'

const client = await loadClient()
const { protectText, restoreText, isChineseText } = client.__test

test('protects commands, paths and file names', () => {
  const source = 'Run `npm test` in /repo/src then read README.md'
  const result = protectText(source, [])
  assert.ok(result !== null)
  assert.equal(result.slots.length, 3)
  assert.ok(result.masked.includes('⟦0⟧'))
  assert.equal(restoreText(result.masked, result.slots), source)
})

test('protects product names verbatim', () => {
  const result = protectText('DeepSeek Harness uses Cordis', [])
  assert.ok(result !== null)
  assert.equal(restoreText(result.masked, result.slots), 'DeepSeek Harness uses Cordis')
  assert.equal(result.masked.replace(/⟦\d+⟧/g, 'X'), 'X uses X')
})

test('keeps numbers, versions and identifiers', () => {
  const source = 'Set max_tokens=4096 and retry 3 times on v0.2.1-rc.1'
  const result = protectText(source, [])
  assert.ok(result !== null)
  assert.match(result.masked, /⟦\d+⟧/)
  assert.equal(restoreText(result.masked, result.slots), source)
})

test('protects a command with arguments before the bare product term', () => {
  const source = 'Run npm test before you commit.'
  const result = protectText(source, [])
  assert.ok(result !== null)
  assert.deepEqual(result.slots, ['npm test'])
  assert.equal(restoreText(result.masked, result.slots), source)
})

test('does not swallow ordinary prose after a command word', () => {
  const result = protectText('git is a tool, not a command.', [])
  assert.ok(result !== null)
  assert.deepEqual(result.slots, ['git'])
})

test('protects a curl command with its URL', () => {
  const source = 'Fetch it with curl https://example.com/x now.'
  const result = protectText(source, [])
  assert.ok(result !== null)
  assert.deepEqual(result.slots, ['curl https://example.com/x'])
  assert.equal(restoreText(result.masked, result.slots), source)
})

test('returns null when there is no prose left', () => {
  assert.equal(protectText('`npm test`', []), null)
  assert.equal(protectText('/only/a/path', []), null)
  assert.equal(protectText('12345', []), null)
})

test('rejects translations that drop or invent placeholders', () => {
  assert.equal(restoreText('⟦0⟧ only', ['a', 'b']), null)
  assert.equal(restoreText('⟦0⟧ and ⟦9⟧', ['a']), null)
  assert.equal(restoreText('⟦0⟧ x', ['a']), 'a x')
})

test('honours an extra glossary term', () => {
  const result = protectText('Use Acme Widgets here', ['Acme Widgets'])
  assert.ok(result !== null)
  assert.equal(result.masked, 'Use ⟦0⟧ here')
})

test('does not mask prose that only looks like a path or identifier', () => {
  assert.deepEqual(protectText('lost/duplicated/invented words', []).slots, [])
  assert.deepEqual(protectText('a fail-closed and state-of-the-art design', []).slots, [])
  assert.deepEqual(protectText('The bundle and a digit are legitimate.', []).slots, [])
})

test('keeps model names, versions and real paths as single slots', () => {
  const result = protectText('tencent/HY-MT1.5-1.8B-GGUF v0.2.1-rc.2 1.8B /etc/hosts', [])
  assert.deepEqual(result.slots, ['HY-MT1.5-1.8B-GGUF', 'v0.2.1-rc.2', '1.8B', '/etc/hosts'])
  assert.equal(result.masked.replace(/⟦\d+⟧/g, 'X'), 'tencent/X X X X')
})


test('recognises Chinese blocks without swallowing Japanese or Korean', () => {
  assert.equal(isChineseText('这是中文段落'), true)
  assert.equal(isChineseText('打开 README.md 文件'), true)
  assert.equal(isChineseText('Hello world'), false)
  assert.equal(isChineseText('日本語のテキストです'), false)
  assert.equal(isChineseText('한국어 텍스트입니다'), false)
})

test('quoted citations do not make an English block Chinese', () => {
  assert.equal(isChineseText('The reply was “好的” and then it stopped.'), false)
  assert.equal(isChineseText('He wrote "中文" once.'), false)
  assert.equal(isChineseText('“你好”'), false)
  assert.equal(isChineseText('他说“hello”然后走了。'), true)
  assert.equal(isChineseText('这是“中文”引用'), true)
})
