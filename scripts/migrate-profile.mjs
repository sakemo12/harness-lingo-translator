// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 sakemo12
//
// One-time migration for a DSH profile created before the 1.14.0 rename
// (`dsh-translate` -> `harness-lingo-translator`).
//
// It is deliberately not part of the plugin runtime: the display-only contract
// forbids the plugin from writing the profile. Run it explicitly:
//
//   node scripts/migrate-profile.mjs --profile ~/.dsh/profiles/web
//
// It changes only the profile manifest and patch, plus the host cache directory:
//   - dependencies['dsh-translate']  -> dependencies['harness-lingo-translator']
//   - dsh.profile.bundles[]           -> the new bundle name
//   - the patch row id/name            -> the new row names (config preserved)
//   - ~/.dsh/cache/dsh-translate/      -> ~/.dsh/cache/harness-lingo-translator/
import { cp, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const OLD_NAME = 'dsh-translate'
export const NEW_NAME = 'harness-lingo-translator'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Move the profile dependency and bundle entry to the new package name.
 * @param {object} manifest - parsed profile package.json.
 * @returns {{ manifest: object, changed: boolean }} migrated manifest.
 */
export function migrateManifest(manifest) {
  const next = clone(manifest)
  let changed = false
  const dependencies = next.dependencies
  if (dependencies !== null && typeof dependencies === 'object' && Object.hasOwn(dependencies, OLD_NAME)) {
    if (!Object.hasOwn(dependencies, NEW_NAME)) dependencies[NEW_NAME] = dependencies[OLD_NAME]
    delete dependencies[OLD_NAME]
    changed = true
  }
  const bundles = next.dsh?.profile?.bundles
  if (Array.isArray(bundles)) {
    for (let index = 0; index < bundles.length; index += 1) {
      if (bundles[index] !== OLD_NAME) continue
      bundles[index] = NEW_NAME
      changed = true
    }
  }
  return { manifest: next, changed }
}

/**
 * Rename the adjacent `id`/`name` pair of the plugin row while preserving its
 * config block. Only the row itself is touched; other rows are left alone.
 * @param {string} text - profile cordis.patch.yml.
 * @returns {{ text: string, changed: boolean }} migrated patch.
 */
export function migratePatch(text) {
  const pattern = new RegExp(`^(\\s*)- id: ["']?${OLD_NAME}["']?\\s*\\n(\\s*)name: ["']?${OLD_NAME}["']?\\s*$`, 'mu')
  if (!pattern.test(text)) return { text, changed: false }
  const next = text.replace(pattern, `$1- id: ${NEW_NAME}\n$2name: ${NEW_NAME}`)
  return { text: next, changed: next !== text }
}

/**
 * Copy the pre-rename cache directory when the new one does not exist yet.
 * @param {{ cacheHome?: string }} [options] - DSH cache root.
 * @returns {Promise<{ copied: boolean, reason?: string }>} migration result.
 */
export async function migrateCache(options = {}) {
  const cacheHome = options.cacheHome ?? join(homedir(), '.dsh', 'cache')
  const oldDir = join(cacheHome, OLD_NAME)
  const newDir = join(cacheHome, NEW_NAME)
  const oldExists = await stat(oldDir).then((value) => value.isDirectory()).catch(() => false)
  if (!oldExists) return { copied: false, reason: 'no pre-rename cache directory' }
  const newExists = await stat(newDir).then(() => true).catch(() => false)
  if (newExists) return { copied: false, reason: 'new cache directory already exists' }
  await cp(oldDir, newDir, { recursive: true, errorOnExist: false, force: false })
  return { copied: true }
}

async function writeAtomic(path, text) {
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, text, 'utf8')
  await rename(temporary, path)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log('usage: node scripts/migrate-profile.mjs --profile <profile-dir> [--dry-run]')
    return
  }
  const dryRun = args.includes('--dry-run')
  const profileIndex = args.indexOf('--profile')
  const profileDir = profileIndex === -1 ? join(homedir(), '.dsh', 'profiles', 'web') : resolve(args[profileIndex + 1] ?? '')
  const manifestPath = join(profileDir, 'package.json')
  const patchPath = join(profileDir, 'cordis.patch.yml')

  const manifestRaw = await readFile(manifestPath, 'utf8').catch(() => null)
  if (manifestRaw === null) throw new Error(`profile manifest not found: ${manifestPath}`)
  const patchRaw = await readFile(patchPath, 'utf8').catch(() => null)
  if (patchRaw === null) throw new Error(`profile patch not found: ${patchPath}`)

  const manifestResult = migrateManifest(JSON.parse(manifestRaw))
  const patchResult = migratePatch(patchRaw)
  const cacheResult = dryRun ? { copied: false, reason: 'dry run' } : await migrateCache()

  console.log(`profile: ${profileDir}`)
  console.log(`  package.json: ${manifestResult.changed ? 'update dependency/bundle' : 'already current'}`)
  console.log(`  cordis.patch.yml: ${patchResult.changed ? 'update row id/name' : 'already current'}`)
  console.log(`  cache: ${cacheResult.copied ? 'copied pre-rename directory' : `skipped (${cacheResult.reason})`}`)

  if (dryRun) {
    console.log('dry run: no files were written')
    return
  }
  if (manifestResult.changed) await writeAtomic(manifestPath, JSON.stringify(manifestResult.manifest, null, 2) + '\n')
  if (patchResult.changed) await writeAtomic(patchPath, patchResult.text)

  console.log('')
  console.log('next steps:')
  console.log(`  cd ${profileDir} && pnpm install`)
  console.log('  restart DSH so the loader mounts the renamed package')
}

const isMain = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
