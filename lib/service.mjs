// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// lib/service.mjs — the `translatePage` Typert service.
//
// Four methods:
//   status()               — endpoint reachability plus the config fingerprint.
//   translate(request)     — masked segments in, translations out.
//   loadCache(request)     — per-workspace cache entries for the current config.
//   saveCache(request)     — merge successful translations into that document.
//
// The service talks only to the OpenAI-compatible endpoint named by
// `config.baseUrl` (the local HY-MT deployment) and writes only its own cache
// under ~/.dsh/cache/harness-lingo-translator/, never a session log or workspace file.

import { createHash } from 'node:crypto'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { WorkspaceCache } from './cache.mjs'
import { latestRoute, translateViaSession } from './session-backend.mjs'
import { parseGlossary, probeEndpoint, translateSegments } from './engine.mjs'
import { SERVICE, parseCacheLoad, parseCacheSave, parseTranslateRequest, parseWorkspace } from './wire.mjs'

/**
 * Fingerprint the translation behavior. A cached translation is only valid when
 * the model, target, prompt, glossary and batching mode are unchanged.
 * @param {object} config - resolved plugin config.
 * @returns {string} short hash.
 */
function configFingerprint(config) {
  return createHash('sha256').update(JSON.stringify({
    backend: config.systemModel ? 'session' : 'local',
    route: null,
    systemModel: config.systemModel,
    targetLang: config.targetLang,
    model: config.model,
    systemProvider: '',
    systemModel: '',
    promptTemplate: config.promptTemplate,
    customTemplate: config.customTemplate,
    promptHeader: config.promptHeader,
    placeholderGuard: config.placeholderGuard,
    placeholderHint: config.placeholderHint,
    glossary: config.glossary,
    batchReasoning: config.batchReasoning,
  })).digest('hex').slice(0, 16)
}

/**
 * Read the config of one call. The loader hands over volatile references for
 * the fields the settings form edits, so every call re-reads them instead of
 * caching the values from mount time.
 * @param {{ config?: object | { read: () => object } }} deps - service dependencies.
 * @returns {object} plain config for this call.
 */
function currentConfig(deps) {
  const source = deps.config
  return typeof source?.read === 'function' ? source.read() : source
}

/** A service-shaped plugin whose dependencies are resolved by `index.mjs`. */
export class TranslateService extends TypertRemoteService {
  /**
   * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
   * @param {{ config: object | { read: () => object }, fetchImpl?: typeof fetch }} deps - resolved dependencies.
   */
  constructor(ctx, deps) {
    super(ctx, SERVICE)
    this._deps = deps
    this._cache = new WorkspaceCache(deps.cacheOptions)
  }

  /**
   * Report whether the endpoint answers and which target language is configured.
   * @returns {Promise<{ ready: boolean, targetLang: string, baseUrl: string, model: string | null, glossary: string[], reason: string | null }>} status.
   */
  async status() {
    const config = currentConfig(this._deps)
    const { terms } = parseGlossary(config.glossary)
    if (config.systemModel === true) {
      const llm = this._deps.getLlm?.()
      const route = latestRoute(this._deps.sessions)
      const ready = llm !== undefined && llm !== null && typeof llm.stream === 'function' && route !== undefined
      const reason = llm === undefined || llm === null || typeof llm.stream !== 'function'
        ? 'the llm service is not mounted in this profile'
        : route === undefined
          ? 'no model route: send one message first so a session records a request route'
          : null
      return {
        ready,
        targetLang: config.targetLang,
        baseUrl: route === undefined ? 'session:' : `session:${route.provider}`,
        model: route === undefined ? null : route.model,
        glossary: terms,
        batchReasoning: config.batchReasoning,
        hoverRestore: config.hoverRestore,
        hoverRestoreMs: config.hoverRestoreMs,
        configHash: configFingerprint(config),
        reason,
      }
    }
    const probe = await probeEndpoint({ config, fetchImpl: this._deps.fetchImpl })
    if (!probe.ok) {
      return {
        ready: false,
        targetLang: config.targetLang,
        baseUrl: config.baseUrl,
        model: null,
        glossary: terms,
        batchReasoning: config.batchReasoning,
        hoverRestore: config.hoverRestore,
        hoverRestoreMs: config.hoverRestoreMs,
        configHash: configFingerprint(config),
        reason: probe.error ?? 'the local translation endpoint is unavailable',
      }
    }
    return {
      ready: true,
      targetLang: config.targetLang,
      baseUrl: config.baseUrl,
      model: probe.model ?? (config.model || null),
      glossary: terms,
      batchReasoning: config.batchReasoning,
      hoverRestore: config.hoverRestore,
      hoverRestoreMs: config.hoverRestoreMs,
      configHash: configFingerprint(config),
      reason: null,
    }
  }

  /**
   * Read the per-workspace cache for the current config.
   * @param {{ workspace: string, configHash: string }} request - workspace and config fingerprint.
   * @returns {Promise<{ entries: Record<string, string> }>} masked source → translation.
   */
  async loadCache(request) {
    const input = parseCacheLoad(request)
    return { entries: await this._cache.load(input.workspace, input.configHash) }
  }

  /**
   * Merge translated entries into the per-workspace cache.
   * @param {{ workspace: string, configHash: string, entries: Array<object> }} request - cache write.
   * @returns {Promise<{ saved: number, total: number }>} counts.
   */
  async saveCache(request) {
    const input = parseCacheSave(request)
    return await this._cache.save(input.workspace, input.configHash, input.entries)
  }

  /**
   * Resolve a session's workspace path from the host session header.
   * @param {{ sessionId: string }} request - session id.
   * @returns {{ path: string | null }} absolute workspace or null.
   */
  workspace(request) {
    const input = parseWorkspace(request)
    const session = this._deps.sessions?.get?.(input.sessionId)
    const path = session?.header?.cwd
    return { path: typeof path === 'string' && path.startsWith('/') ? path : null }
  }

  /**
   * Delete cache entries whose session no longer exists. The host session store
   * is authoritative, so the client cannot prune with a stale catalog.
   * @returns {Promise<{ removed: number, files: number }>} pruned counts.
   */
  async pruneCache() {
    const sessions = typeof this._deps.sessions?.list === 'function' ? this._deps.sessions.list() : []
    const liveIds = sessions.map((session) => (typeof session?.id === 'string' ? session.id : '')).filter((id) => id.length > 0)
    if (liveIds.length === 0) return { removed: 0, files: 0 }
    return await this._cache.prune(liveIds)
  }

  /**
   * Translate masked segments with the local endpoint.
   * @param {{ targetLang?: string, segments: string[] }} request - masked segments.
   * @returns {Promise<{ translations: string[], failed: number[], baseUrl: string, model: string | null, error: string | null }>} result.
   */
  async translate(request) {
    const config = currentConfig(this._deps)
    let input
    try {
      input = parseTranslateRequest(request)
    } catch (error) {
      return {
        translations: Array.isArray(request?.segments) ? request.segments.map((segment) => String(segment)) : [],
        failed: [],
        baseUrl: config.baseUrl,
        model: null,
        error: `invalid request: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
    const targetLang = input.targetLang || config.targetLang
    if (typeof targetLang !== 'string' || targetLang.length === 0) {
      return {
        translations: input.segments,
        failed: input.segments.map((_, index) => index),
        baseUrl: config.baseUrl,
        model: null,
        error: 'no target language: pass targetLang or set it in the plugin config',
      }
    }
    if (config.systemModel === true) {
      const llm = this._deps.getLlm?.()
      const route = latestRoute(this._deps.sessions)
      if (llm === undefined || llm === null || typeof llm.stream !== 'function') {
        return {
          translations: input.segments,
          failed: input.segments.map((_, index) => index),
          baseUrl: 'session:',
          model: null,
          error: 'the llm service is not mounted in this profile',
        }
      }
      if (route === undefined) {
        return {
          translations: input.segments,
          failed: input.segments.map((_, index) => index),
          baseUrl: 'session:',
          model: null,
          error: 'no model route: send one message first so a session records a request route',
        }
      }
      const sessionResult = await translateViaSession({
        llm,
        route,
        targetLang,
        segments: input.segments,
        glossary: parseGlossary(config.glossary).terms,
        timeoutMs: config.timeoutMs,
      })
      return { ...sessionResult, baseUrl: `session:${route.provider}`, model: route.model }
    }
    const result = await translateSegments({
      config,
      targetLang,
      segments: input.segments,
      batch: input.batch === true,
      fetchImpl: this._deps.fetchImpl,
    })
    return result
  }
}
