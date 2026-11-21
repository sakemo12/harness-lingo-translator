// Dependency-free repository lint. The package has no runtime schema or lint
// dependency, so the CI gate checks what can be checked portably:
//   - every JavaScript module parses (`node --check`);
//   - every locale document is valid JSON;
//   - the license/notice files and the client loader shape are present.
//
// SPDX-License-Identifier: Apache-2.0
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const failures = []
const jsFiles = []
const jsonFiles = []

async function entriesOf(directory) {
  try {
    return await readdir(join(root, directory), { withFileTypes: true })
  } catch {
    return []
  }
}

async function collect(directory, pattern, target) {
  for (const entry of await entriesOf(directory)) {
    if (entry.isFile() && pattern.test(entry.name)) target.push(join(directory, entry.name))
  }
}

await collect('.', /\.mjs$/u, jsFiles)
await collect('client', /\.js$/u, jsFiles)
await collect('lib', /\.mjs$/u, jsFiles)
await collect('test', /\.mjs$/u, jsFiles)
await collect('scripts', /\.mjs$/u, jsFiles)
await collect('locale', /\.json$/u, jsonFiles)

for (const file of jsFiles) {
  const checked = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' })
  if (checked.status !== 0) failures.push(`${file}: ${(checked.stderr || '').trim()}`)
}

for (const file of jsonFiles) {
  try {
    JSON.parse(await readFile(join(root, file), 'utf8'))
  } catch (error) {
    failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if (packageJson.license !== 'Apache-2.0') failures.push('package.json: license must be Apache-2.0')
for (const file of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) {
  try {
    await readFile(join(root, file), 'utf8')
  } catch {
    failures.push(`${file}: missing`)
  }
}

const license = await readFile(join(root, 'LICENSE'), 'utf8')
if (!license.includes('Apache License') || !license.includes('Copyright 2026 PerryLink')) {
  failures.push('LICENSE: Apache-2.0 text and the copyright line are required')
}
const notice = await readFile(join(root, 'NOTICE'), 'utf8')
if (!notice.includes('Copyright 2026 PerryLink')) failures.push('NOTICE: copyright line is required')

const client = await readFile(join(root, 'client/index.js'), 'utf8')
if (!client.includes('window.__ModuleLoader__.load(') || !client.includes("id: 'dsh-translate'")) {
  failures.push('client/index.js: the hand-written module-loader shape changed')
}

if (failures.length > 0) {
  console.error('lint failed:')
  for (const failure of failures) console.error('  - ' + failure)
  process.exitCode = 1
} else {
  console.log(`lint: ${jsFiles.length} JavaScript files, ${jsonFiles.length} JSON files, license/notice present`)
}
