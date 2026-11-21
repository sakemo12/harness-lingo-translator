// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorkspaceCache, defaultCacheDir, legacyCacheDir } from '../lib/cache.mjs'

async function cacheDir() {
  return mkdtemp(join(tmpdir(), 'harness-lingo-translator-cache-'))
}

test('stores content-addressed entries per workspace and config', async () => {
  const cache = new WorkspaceCache({ dir: await cacheDir() })
  await cache.save('/work/one', 'cfg1', [
    { source: 'Hello', translation: '你好' },
    { source: 'Bye', translation: '再见' },
  ])
  assert.deepEqual(await cache.load('/work/one', 'cfg1'), { Hello: '你好', Bye: '再见' })
  assert.deepEqual(await cache.load('/work/one', 'cfg2'), {})
  assert.deepEqual(await cache.load('/work/two', 'cfg1'), {})
  await cache.save('/work/one', 'cfg1', [{ source: 'Hello', translation: '您好' }])
  assert.deepEqual(await cache.load('/work/one', 'cfg1'), { Hello: '您好', Bye: '再见' })
})

test('writes one document per workspace with metadata', async () => {
  const dir = await cacheDir()
  const cache = new WorkspaceCache({ dir })
  await cache.save('/work/one', 'cfg1', [{ source: 'Hello', translation: '你好', sessionId: 's1', messageKey: 'm1' }])
  await cache.save('/work/two', 'cfg1', [{ source: 'Hello', translation: '您好' }])
  const document = JSON.parse(await readFile(cache.pathFor('/work/one'), 'utf8'))
  assert.equal(document.workspace, '/work/one')
  assert.equal(document.version, 1)
  const entry = Object.values(document.entries)[0]
  assert.equal(entry.s, 'Hello')
  assert.equal(entry.t, '你好')
  assert.equal(entry.c, 'cfg1')
  assert.equal(entry.sid, 's1')
  assert.equal(entry.mk, 'm1')
  assert.notEqual(cache.pathFor('/work/one'), cache.pathFor('/work/two'))
})

test('ignores a corrupt document and caps the entry count', async () => {
  const dir = await cacheDir()
  const cache = new WorkspaceCache({ dir, maxEntries: 2 })
  await writeFile(cache.pathFor('/work/one'), '{broken', 'utf8')
  assert.deepEqual(await cache.load('/work/one', 'cfg1'), {})
  await cache.save('/work/one', 'cfg1', [
    { source: 'a', translation: 'A' },
    { source: 'b', translation: 'B' },
    { source: 'c', translation: 'C' },
  ])
  const entries = await cache.load('/work/one', 'cfg1')
  assert.equal(Object.keys(entries).length, 2)
})

test('rejects a non-absolute workspace', async () => {
  const cache = new WorkspaceCache({ dir: await cacheDir() })
  await assert.rejects(() => cache.save('relative/path', 'cfg1', [{ source: 'a', translation: 'b' }]), /absolute path/)
  assert.deepEqual(await cache.load('relative/path', 'cfg1'), {})
})


test('prunes entries whose session no longer exists', async () => {
  const cache = new WorkspaceCache({ dir: await cacheDir() })
  await cache.save('/work/one', 'cfg1', [
    { source: 'a', translation: 'A', sessionId: 'live' },
    { source: 'b', translation: 'B', sessionId: 'deleted' },
    { source: 'c', translation: 'C' },
  ])
  const result = await cache.prune(['live'])
  assert.deepEqual(result, { removed: 1, files: 1 })
  assert.deepEqual(await cache.load('/work/one', 'cfg1'), { a: 'A', c: 'C' })
})

test('uses the renamed cache directory with a pre-rename fallback', () => {
  assert.match(defaultCacheDir(), /harness-lingo-translator$/u)
  assert.match(legacyCacheDir(), /dsh-translate$/u)
})

test('reads the pre-rename cache directory and migrates it on first write', async () => {
  const legacy = await cacheDir()
  const current = await cacheDir()
  const old = new WorkspaceCache({ dir: legacy })
  await old.save('/work/one', 'cfg1', [{ source: 'Hello', translation: '你好' }])
  const cache = new WorkspaceCache({ dir: current, legacyDir: legacy })
  assert.deepEqual(await cache.load('/work/one', 'cfg1'), { Hello: '你好' })
  await cache.save('/work/one', 'cfg1', [{ source: 'Bye', translation: '再见' }])
  assert.deepEqual(await cache.load('/work/one', 'cfg1'), { Hello: '你好', Bye: '再见' })
  const document = JSON.parse(await readFile(cache.pathFor('/work/one'), 'utf8'))
  assert.equal(Object.keys(document.entries).length, 2)
})

test('the new cache wins over the pre-rename entry for the same source', async () => {
  const legacy = await cacheDir()
  const current = await cacheDir()
  await new WorkspaceCache({ dir: legacy }).save('/work/one', 'cfg1', [{ source: 'Hello', translation: '你好' }])
  await new WorkspaceCache({ dir: current }).save('/work/one', 'cfg1', [{ source: 'Hello', translation: '您好' }])
  const cache = new WorkspaceCache({ dir: current, legacyDir: legacy })
  assert.deepEqual(await cache.load('/work/one', 'cfg1'), { Hello: '您好' })
})

test('prunes entries in the pre-rename directory too', async () => {
  const legacy = await cacheDir()
  const current = await cacheDir()
  const old = new WorkspaceCache({ dir: legacy })
  await old.save('/work/one', 'cfg1', [{ source: 'a', translation: 'A', sessionId: 'deleted' }])
  const cache = new WorkspaceCache({ dir: current, legacyDir: legacy })
  assert.deepEqual(await cache.prune(['live']), { removed: 1, files: 1 })
  assert.deepEqual(await old.load('/work/one', 'cfg1'), {})
})
