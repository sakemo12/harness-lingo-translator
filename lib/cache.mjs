// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// lib/cache.mjs — host-side, per-workspace translation cache.
//
// The file lives outside the workspace:
//   ~/.dsh/cache/dsh-translate/<sha256(workspace)>.json
// so it never pollutes a repository, while still being one file per workspace.
//
// Entries are content-addressed:
//   key = sha256(configHash + "\0" + maskedSource)
// and carry the config hash, masked source and translation. Loading filters by
// the current config hash, so a model/prompt/glossary change cannot reuse a
// stale translation; conversation or directory changes can never map a
// translation onto different text because the source is part of the key.

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CACHE_VERSION = 1
const MAX_ENTRIES = 5000
const MAX_WORKSPACE_CHARS = 4096
const MAX_SOURCE_CHARS = 4000
const MAX_TRANSLATION_CHARS = 8000

/** Default cache directory (host-private, outside any workspace). */
export function defaultCacheDir() {
  return join(homedir(), '.dsh', 'cache', 'dsh-translate')
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function entryKey(configHash, source) {
  return sha256(configHash + '\u0000' + source)
}

/** One JSON document per workspace, content-addressed entries. */
export class WorkspaceCache {
  /** @param {{ dir?: string, maxEntries?: number }} [options] - cache directory override for tests. */
  constructor(options = {}) {
    this.dir = options.dir ?? defaultCacheDir()
    this.maxEntries = options.maxEntries ?? MAX_ENTRIES
  }

  pathFor(workspace) {
    return join(this.dir, sha256(String(workspace)) + '.json')
  }

  /**
   * Read entries that belong to the current config hash.
   * @param {string} workspace - absolute workspace path.
   * @param {string} configHash - hash of the translation config.
   * @returns {Promise<Record<string, string>>} masked source → translation.
   */
  async load(workspace, configHash) {
    if (!this.validWorkspace(workspace) || typeof configHash !== 'string' || configHash.length === 0) return {}
    let raw
    try {
      raw = await readFile(this.pathFor(workspace), 'utf8')
    } catch {
      return {}
    }
    let document
    try {
      document = JSON.parse(raw)
    } catch {
      return {}
    }
    if (document === null || typeof document !== 'object' || document.version !== CACHE_VERSION) return {}
    if (document.workspace !== workspace || document.entries === null || typeof document.entries !== 'object') return {}
    const entries = {}
    for (const entry of Object.values(document.entries)) {
      if (entry === null || typeof entry !== 'object') continue
      if (entry.c !== configHash) continue
      if (typeof entry.s !== 'string' || typeof entry.t !== 'string') continue
      entries[entry.s] = entry.t
    }
    return entries
  }

  /**
   * Merge translated entries into the workspace document and write it atomically.
   * @param {string} workspace - absolute workspace path.
   * @param {string} configHash - hash of the translation config.
   * @param {Array<{ source: string, translation: string, sessionId?: string, messageKey?: string }>} entries - new translations.
   * @returns {Promise<{ saved: number, total: number }>} counts.
   */
  async save(workspace, configHash, entries) {
    if (!this.validWorkspace(workspace)) throw new Error('dsh-translate: cache workspace must be a non-empty absolute path')
    if (typeof configHash !== 'string' || configHash.length === 0) throw new Error('dsh-translate: cache configHash is required')
    if (!Array.isArray(entries) || entries.length === 0) return { saved: 0, total: 0 }
    await mkdir(this.dir, { recursive: true })
    const path = this.pathFor(workspace)
    let document = { version: CACHE_VERSION, workspace, updatedAt: Date.now(), entries: {} }
    try {
      const raw = await readFile(path, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object' && parsed.version === CACHE_VERSION && parsed.workspace === workspace && parsed.entries !== null && typeof parsed.entries === 'object') {
        document = { version: CACHE_VERSION, workspace, updatedAt: Date.now(), entries: parsed.entries }
      }
    } catch {
      // missing or unreadable: start a new document
    }
    const now = Date.now()
    let saved = 0
    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object') continue
      const source = entry.source
      const translation = entry.translation
      if (typeof source !== 'string' || source.length === 0 || source.length > MAX_SOURCE_CHARS) continue
      if (typeof translation !== 'string' || translation.length === 0 || translation.length > MAX_TRANSLATION_CHARS) continue
      const key = entryKey(configHash, source)
      document.entries[key] = {
        c: configHash,
        s: source,
        t: translation,
        at: now,
        ...(typeof entry.sessionId === 'string' ? { sid: entry.sessionId } : {}),
        ...(typeof entry.messageKey === 'string' ? { mk: entry.messageKey } : {}),
      }
      saved += 1
    }
    const keys = Object.keys(document.entries)
    if (keys.length > this.maxEntries) {
      const ordered = keys
        .map((key) => [key, Number(document.entries[key]?.at) || 0])
        .sort((left, right) => left[1] - right[1])
      const remove = ordered.length - this.maxEntries
      for (let index = 0; index < remove; index += 1) delete document.entries[ordered[index][0]]
    }
    document.updatedAt = now
    const temporary = `${path}.${process.pid}.${now}.tmp`
    await writeFile(temporary, JSON.stringify(document, null, 2) + '\n', 'utf8')
    await rename(temporary, path)
    return { saved, total: Object.keys(document.entries).length }
  }

  /**
   * Remove entries whose `sessionId` is not in the live catalog.
   * @param {readonly string[]} liveSessionIds - session ids that still exist.
   * @returns {Promise<{ removed: number, files: number }>} pruned counts.
   */
  async prune(liveSessionIds) {
    const live = new Set(Array.isArray(liveSessionIds) ? liveSessionIds.filter((id) => typeof id === 'string' && id.length > 0) : [])
    let names
    try {
      names = await readdir(this.dir)
    } catch {
      return { removed: 0, files: 0 }
    }
    let removed = 0
    let files = 0
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const path = join(this.dir, name)
      let document
      try {
        document = JSON.parse(await readFile(path, 'utf8'))
      } catch {
        continue
      }
      if (document === null || typeof document !== 'object' || document.version !== CACHE_VERSION || document.entries === null || typeof document.entries !== 'object') continue
      let changed = false
      for (const [key, entry] of Object.entries(document.entries)) {
        if (entry === null || typeof entry !== 'object') continue
        if (typeof entry.sid !== 'string' || entry.sid.length === 0) continue
        if (live.has(entry.sid)) continue
        delete document.entries[key]
        removed += 1
        changed = true
      }
      if (!changed) continue
      files += 1
      document.updatedAt = Date.now()
      const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
      await writeFile(temporary, JSON.stringify(document, null, 2) + '\n', 'utf8')
      await rename(temporary, path)
    }
    return { removed, files }
  }

  validWorkspace(workspace) {
    return typeof workspace === 'string' && workspace.length > 0 && workspace.length <= MAX_WORKSPACE_CHARS && workspace.startsWith('/')
  }
}
