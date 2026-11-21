// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// lib/wire.mjs — the Typert wire contract for the `translatePage` namespace.
//
// Two invocations, both read-only from the session's point of view:
//   status()             — is the configured local endpoint reachable?
//   translate(request)   — translate protected segments, nothing else.
//
// The host `./typert` manifest and the hand-written client Remote
// contribution share the descriptor shape; the client copy lives in
// client/index.js and a test asserts the two never drift.
//
// The codecs are hand-written validators instead of zod schemas: this package
// is installed as a linked directory, and pnpm does not install a linked
// package's runtime dependencies, so a schema library would not resolve. The
// Typert gateway only needs `codec.create().parse(value)`.

const PACKAGE = 'harness-lingo-translator'

/** Remote namespace and service name. */
export const SERVICE = 'translatePage'

/** Maximum masked segments per call, matching the client chunk. */
export const MAX_SEGMENTS = 200

/** Maximum characters per masked segment. */
export const MAX_SEGMENT_CHARS = 4000

function fail(message) {
  throw new TypeError(`harness-lingo-translator: ${message}`)
}

function objectOf(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`)
  return value
}

function stringOf(value, field) {
  if (typeof value !== 'string') fail(`${field} must be a string`)
  return value
}

function nullableStringOf(value, field) {
  if (value !== null && typeof value !== 'string') fail(`${field} must be a string or null`)
  return value
}

/**
 * Validate one `translatePage/translate` request.
 * @param {unknown} value - wire value.
 * @returns {{ targetLang?: string, segments: string[], batch?: boolean }} validated request.
 */
export function parseTranslateRequest(value) {
  const request = objectOf(value, 'translateRequest')
  const targetLang = request.targetLang
  if (targetLang !== undefined) {
    stringOf(targetLang, 'translateRequest.targetLang')
    if (targetLang.length > 35) fail('translateRequest.targetLang must be at most 35 characters')
  }
  if (!Array.isArray(request.segments)) fail('translateRequest.segments must be an array')
  if (request.segments.length < 1 || request.segments.length > MAX_SEGMENTS) {
    fail(`translateRequest.segments must hold 1 to ${MAX_SEGMENTS} entries`)
  }
  const segments = request.segments.map((segment, index) => {
    const text = stringOf(segment, `translateRequest.segments[${index}]`)
    if (text.length < 1 || text.length > MAX_SEGMENT_CHARS) {
      fail(`translateRequest.segments[${index}] must be 1 to ${MAX_SEGMENT_CHARS} characters`)
    }
    return text
  })
  const batch = request.batch
  if (batch !== undefined && typeof batch !== 'boolean') fail('translateRequest.batch must be a boolean')
  const result = { segments }
  if (targetLang !== undefined) result.targetLang = targetLang
  if (batch !== undefined) result.batch = batch
  return result
}

/**
 * The codec the Typert gateway consumes: `create().parse(value)`.
 * @param {string} typeSymbol - Typert type symbol for this codec.
 * @param {(value: unknown) => unknown} parse - authoritative validator.
 * @returns {{ mode: 'strict', typeSymbol: string, create: () => { parse: (value: unknown) => unknown } }} codec.
 */
function strictCodec(typeSymbol, parse) {
  return {
    mode: 'strict',
    typeSymbol,
    create: () => ({ parse }),
  }
}

/**
 * Validate a `translatePage/translate` result.
 * @param {unknown} value - wire value.
 * @returns {object} validated result.
 */
export function parseTranslateResult(value) {
  const result = objectOf(value, 'translateResult')
  if (!Array.isArray(result.translations) || result.translations.some((entry) => typeof entry !== 'string')) {
    fail('translateResult.translations must be an array of strings')
  }
  if (!Array.isArray(result.failed) || result.failed.some((entry) => !Number.isInteger(entry) || entry < 0)) {
    fail('translateResult.failed must be an array of non-negative integers')
  }
  stringOf(result.baseUrl, 'translateResult.baseUrl')
  nullableStringOf(result.model, 'translateResult.model')
  nullableStringOf(result.error, 'translateResult.error')
  return result
}

/**
 * Validate a `translatePage/status` result.
 * @param {unknown} value - wire value.
 * @returns {object} validated status.
 */
export function parseTranslateStatus(value) {
  const status = objectOf(value, 'translateStatus')
  if (typeof status.ready !== 'boolean') fail('translateStatus.ready must be a boolean')
  stringOf(status.targetLang, 'translateStatus.targetLang')
  stringOf(status.baseUrl, 'translateStatus.baseUrl')
  nullableStringOf(status.model, 'translateStatus.model')
  if (!Array.isArray(status.glossary) || status.glossary.some((entry) => typeof entry !== 'string')) {
    fail('translateStatus.glossary must be an array of strings')
  }
  if (typeof status.batchReasoning !== 'boolean') fail('translateStatus.batchReasoning must be a boolean')
  if (typeof status.hoverRestore !== 'boolean') fail('translateStatus.hoverRestore must be a boolean')
  stringOf(status.configHash, 'translateStatus.configHash')
  if (!Number.isInteger(status.hoverRestoreMs) || status.hoverRestoreMs < 0 || status.hoverRestoreMs > 60000) {
    fail('translateStatus.hoverRestoreMs must be an integer between 0 and 60000')
  }
  nullableStringOf(status.reason, 'translateStatus.reason')
  return status
}

/**
 * Validate a `translatePage/loadCache` request.
 * @param {unknown} value - wire value.
 * @returns {{ workspace: string, configHash: string }} validated request.
 */
export function parseCacheLoad(value) {
  const request = objectOf(value, 'cacheLoadRequest')
  const workspace = stringOf(request.workspace, 'cacheLoadRequest.workspace')
  if (workspace.length > 4096) fail('cacheLoadRequest.workspace must be at most 4096 characters')
  const configHash = stringOf(request.configHash, 'cacheLoadRequest.configHash')
  if (configHash.length < 1 || configHash.length > 128) fail('cacheLoadRequest.configHash must be 1 to 128 characters')
  return { workspace, configHash }
}

/**
 * Validate a `translatePage/loadCache` result.
 * @param {unknown} value - wire value.
 * @returns {{ entries: Record<string, string> }} validated result.
 */
export function parseCacheLoadResult(value) {
  const result = objectOf(value, 'cacheLoadResult')
  const entries = objectOf(result.entries, 'cacheLoadResult.entries')
  for (const [source, translation] of Object.entries(entries)) {
    if (typeof translation !== 'string') fail('cacheLoadResult.entries must map strings to strings')
    if (source.length === 0 || source.length > MAX_SEGMENT_CHARS) fail('cacheLoadResult.entries source is too long')
  }
  return { entries }
}

/**
 * Validate a `translatePage/saveCache` request.
 * @param {unknown} value - wire value.
 * @returns {{ workspace: string, configHash: string, entries: Array<{ source: string, translation: string, sessionId?: string, messageKey?: string }> }} validated request.
 */
export function parseCacheSave(value) {
  const request = objectOf(value, 'cacheSaveRequest')
  const workspace = stringOf(request.workspace, 'cacheSaveRequest.workspace')
  if (workspace.length > 4096) fail('cacheSaveRequest.workspace must be at most 4096 characters')
  const configHash = stringOf(request.configHash, 'cacheSaveRequest.configHash')
  if (configHash.length < 1 || configHash.length > 128) fail('cacheSaveRequest.configHash must be 1 to 128 characters')
  if (!Array.isArray(request.entries)) fail('cacheSaveRequest.entries must be an array')
  if (request.entries.length < 1 || request.entries.length > 500) fail('cacheSaveRequest.entries must hold 1 to 500 entries')
  const entries = request.entries.map((entry, index) => {
    const item = objectOf(entry, `cacheSaveRequest.entries[${index}]`)
    const source = stringOf(item.source, `cacheSaveRequest.entries[${index}].source`)
    if (source.length < 1 || source.length > MAX_SEGMENT_CHARS) fail(`cacheSaveRequest.entries[${index}].source is too long`)
    const translation = stringOf(item.translation, `cacheSaveRequest.entries[${index}].translation`)
    if (translation.length < 1 || translation.length > 8000) fail(`cacheSaveRequest.entries[${index}].translation is too long`)
    const result = { source, translation }
    if (item.sessionId !== undefined) result.sessionId = stringOf(item.sessionId, `cacheSaveRequest.entries[${index}].sessionId`)
    if (item.messageKey !== undefined) result.messageKey = stringOf(item.messageKey, `cacheSaveRequest.entries[${index}].messageKey`)
    return result
  })
  return { workspace, configHash, entries }
}

/**
 * Validate a `translatePage/saveCache` result.
 * @param {unknown} value - wire value.
 * @returns {{ saved: number, total: number }} validated result.
 */
export function parseCacheSaveResult(value) {
  const result = objectOf(value, 'cacheSaveResult')
  if (!Number.isInteger(result.saved) || result.saved < 0) fail('cacheSaveResult.saved must be a non-negative integer')
  if (!Number.isInteger(result.total) || result.total < 0) fail('cacheSaveResult.total must be a non-negative integer')
  return { saved: result.saved, total: result.total }
}

/**
 * Validate a `translatePage/workspace` request.
 * @param {unknown} value - wire value.
 * @returns {{ sessionId: string }} validated request.
 */
export function parseWorkspace(value) {
  const request = objectOf(value, 'workspaceRequest')
  const sessionId = stringOf(request.sessionId, 'workspaceRequest.sessionId')
  if (sessionId.length < 1 || sessionId.length > 200) fail('workspaceRequest.sessionId must be 1 to 200 characters')
  return { sessionId }
}

/**
 * Validate a `translatePage/workspace` result.
 * @param {unknown} value - wire value.
 * @returns {{ path: string | null }} validated result.
 */
export function parseWorkspaceResult(value) {
  const result = objectOf(value, 'workspaceResult')
  if (result.path !== null && typeof result.path !== 'string') fail('workspaceResult.path must be a string or null')
  return { path: result.path }
}

/** Result of `translatePage/pruneCache`. */
export function parsePruneCacheResult(value) {
  const result = objectOf(value, 'pruneCacheResult')
  if (!Number.isInteger(result.removed) || result.removed < 0) fail('pruneCacheResult.removed must be a non-negative integer')
  if (!Number.isInteger(result.files) || result.files < 0) fail('pruneCacheResult.files must be a non-negative integer')
  return { removed: result.removed, files: result.files }
}

const SOURCE_LOCATION = Object.freeze({ file: 'lib/wire.mjs', line: 1, column: 1 })

/** `translatePage/status` descriptor (no parameters). */
export const STATUS_DESCRIPTOR = Object.freeze({
  id: `${PACKAGE}#${SERVICE}/status`,
  service: SERVICE,
  namespace: SERVICE,
  method: 'status',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([]),
  result: Object.freeze(strictCodec(`${PACKAGE}/types#TranslateStatus`, parseTranslateStatus)),
  sourceLocation: SOURCE_LOCATION,
})

/** `translatePage/translate` descriptor (one request object). */
export const TRANSLATE_DESCRIPTOR = Object.freeze({
  id: `${PACKAGE}#${SERVICE}/translate`,
  service: SERVICE,
  namespace: SERVICE,
  method: 'translate',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([
    Object.freeze({
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: Object.freeze(strictCodec(`${PACKAGE}/types#TranslateRequest`, parseTranslateRequest)),
    }),
  ]),
  result: Object.freeze(strictCodec(`${PACKAGE}/types#TranslateResult`, parseTranslateResult)),
  sourceLocation: SOURCE_LOCATION,
})

/** `translatePage/loadCache` descriptor. */
export const CACHE_LOAD_DESCRIPTOR = Object.freeze({
  id: `${PACKAGE}#${SERVICE}/loadCache`,
  service: SERVICE,
  namespace: SERVICE,
  method: 'loadCache',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([
    Object.freeze({
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: Object.freeze(strictCodec(`${PACKAGE}/types#CacheLoadRequest`, parseCacheLoad)),
    }),
  ]),
  result: Object.freeze(strictCodec(`${PACKAGE}/types#CacheLoadResult`, parseCacheLoadResult)),
  sourceLocation: SOURCE_LOCATION,
})

/** `translatePage/saveCache` descriptor. */
export const CACHE_SAVE_DESCRIPTOR = Object.freeze({
  id: `${PACKAGE}#${SERVICE}/saveCache`,
  service: SERVICE,
  namespace: SERVICE,
  method: 'saveCache',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([
    Object.freeze({
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: Object.freeze(strictCodec(`${PACKAGE}/types#CacheSaveRequest`, parseCacheSave)),
    }),
  ]),
  result: Object.freeze(strictCodec(`${PACKAGE}/types#CacheSaveResult`, parseCacheSaveResult)),
  sourceLocation: SOURCE_LOCATION,
})

/** `translatePage/workspace` descriptor (one request object). */
export const WORKSPACE_DESCRIPTOR = Object.freeze({
  id: `${PACKAGE}#${SERVICE}/workspace`,
  service: SERVICE,
  namespace: SERVICE,
  method: 'workspace',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([
    Object.freeze({
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: Object.freeze(strictCodec(`${PACKAGE}/types#WorkspaceRequest`, parseWorkspace)),
    }),
  ]),
  result: Object.freeze(strictCodec(`${PACKAGE}/types#WorkspaceResult`, parseWorkspaceResult)),
  sourceLocation: SOURCE_LOCATION,
})

/** `translatePage/pruneCache` descriptor (one request object). */
export const PRUNE_CACHE_DESCRIPTOR = Object.freeze({
  id: `${PACKAGE}#${SERVICE}/pruneCache`,
  service: SERVICE,
  namespace: SERVICE,
  method: 'pruneCache',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([]),
  result: Object.freeze(strictCodec(`${PACKAGE}/types#PruneCacheResult`, parsePruneCacheResult)),
  sourceLocation: SOURCE_LOCATION,
})

/** Invocation list shared by the host manifest and the client contribution. */
export const INVOCATIONS = Object.freeze([
  STATUS_DESCRIPTOR,
  TRANSLATE_DESCRIPTOR,
  CACHE_LOAD_DESCRIPTOR,
  CACHE_SAVE_DESCRIPTOR,
  WORKSPACE_DESCRIPTOR,
  PRUNE_CACHE_DESCRIPTOR,
])
