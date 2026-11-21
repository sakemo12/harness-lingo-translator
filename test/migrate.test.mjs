// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 sakemo12
//
// Profile migration for the 1.14.0 rename. The script itself is CLI-only; these
// tests exercise the pure transforms and the cache copy.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NEW_NAME, OLD_NAME, migrateCache, migrateManifest, migratePatch } from '../scripts/migrate-profile.mjs'

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'harness-lingo-translator-migrate-'))
}

test('migrates the profile dependency and bundle name', () => {
  const input = {
    dependencies: {
      [OLD_NAME]: 'link:/work/plugins/dsh-translate',
      jsdom: '^31.0.1',
    },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', OLD_NAME, 'dsh-whale-widget'] } },
  }
  const first = migrateManifest(input)
  assert.equal(first.changed, true)
  assert.deepEqual(first.manifest.dependencies, {
    [NEW_NAME]: 'link:/work/plugins/dsh-translate',
    jsdom: '^31.0.1',
  })
  assert.deepEqual(first.manifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', NEW_NAME, 'dsh-whale-widget'])
  assert.deepEqual(migrateManifest(first.manifest), { manifest: first.manifest, changed: false })
})

test('keeps an existing new dependency and still removes the old key', () => {
  const result = migrateManifest({ dependencies: { [OLD_NAME]: 'old', [NEW_NAME]: 'new' } })
  assert.equal(result.changed, true)
  assert.deepEqual(result.manifest.dependencies, { [NEW_NAME]: 'new' })
})

test('renames only the plugin row and preserves its config', () => {
  const input = [
    '- id: ui-theme',
    '  name: "@deepseek-ai/dsh-client-ui-theme"',
    '  config:',
    '    preference: dark',
    '- id: dsh-translate',
    '  name: dsh-translate',
    '  config:',
    '    enabled: true',
    "    promptHeader: 'translate this'",
    '  disabled: false',
    '- id: git-panel',
    '  name: "@xbzbing/dsh-git-panel"',
    '',
  ].join('\n')
  const result = migratePatch(input)
  assert.equal(result.changed, true)
  assert.match(result.text, /- id: harness-lingo-translator\n  name: harness-lingo-translator\n  config:\n    enabled: true/)
  assert.match(result.text, /- id: ui-theme/)
  assert.match(result.text, /- id: git-panel/)
  assert.deepEqual(migratePatch(result.text), { text: result.text, changed: false })
})

test('does not touch a different row that happens to use the old word', () => {
  const input = '- id: notes\n  name: dsh-translate-notes\n'
  assert.deepEqual(migratePatch(input), { text: input, changed: false })
})

test('copies the pre-rename cache directory once', async () => {
  const cacheHome = await tempDir()
  const oldDir = join(cacheHome, OLD_NAME)
  const newDir = join(cacheHome, NEW_NAME)
  await mkdir(oldDir, { recursive: true })
  await writeFile(join(oldDir, 'workspace.json'), '{"version":1}\n', 'utf8')
  const first = await migrateCache({ cacheHome })
  assert.deepEqual(first, { copied: true })
  assert.equal(await readFile(join(newDir, 'workspace.json'), 'utf8'), '{"version":1}\n')
  const second = await migrateCache({ cacheHome })
  assert.deepEqual(second, { copied: false, reason: 'new cache directory already exists' })
})
