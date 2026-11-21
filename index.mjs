// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// index.mjs — `dsh-translate` host half.
//
// Mounts the `translatePage` Typert service (status + translate + the
// per-workspace cache). The browser half owns the DOM walk, protection and the
// on/off control; this half calls either the local OpenAI-compatible endpoint
// that serves the Hunyuan HY-MT translation model
// (tencent/HY-MT1.5-1.8B-GGUF in llama.cpp / vLLM and other compatible servers)
// or, with `systemModel` enabled, the host `llm` route. It never writes a
// session event or a workspace file; its only file write is the per-workspace
// cache under ~/.dsh/cache/dsh-translate/.

import z from '@deepseek-ai/schemastery'
import { TranslateService } from './lib/service.mjs'
import { PROMPT_STYLES } from './lib/engine.mjs'

/** Plugin name used by the Loader row and the client bundle. */
export const name = 'dsh-translate'

/** Prompt styles accepted by `promptTemplate`; `auto` picks the card's template by target language. */
const PROMPT_TEMPLATE_IDS = Object.freeze([...PROMPT_STYLES])

/** Every field of the resolved config, in schema order. */
const CONFIG_KEYS = Object.freeze([
  'enabled', 'baseUrl', 'apiKey', 'model', 'targetLang', 'promptTemplate', 'customTemplate',
  'promptHeader', 'placeholderGuard', 'placeholderHint', 'systemModel', 'hoverRestore', 'hoverRestoreMs',
  'glossary', 'temperature', 'topP', 'topK', 'repetitionPenalty', 'maxTokens', 'concurrency',
  'batchReasoning', 'timeoutMs', 'retries',
])

/** Raw plugin config; every field optional, defaults filled by {@link resolveConfig}. */
export const Config = z.object({
  /** Master switch; false registers nothing at all. */
  enabled: z.boolean().default(true).description('总开关；false 时不挂载翻译服务。'),
  /**
   * OpenAI-compatible API root, version segment included. Volatile: the Plugins
   * page edits it live through the settings form, without remounting the plugin.
   */
  baseUrl: z.string().default('http://127.0.0.1:8080/v1').description('本地 OpenAI 兼容服务地址，需含 /v1 一类的版本段，例如 http://192.168.1.10:8080/v1。').volatile(),
  /** Optional bearer token; secret-role so the settings form never echoes it. */
  apiKey: z.string().default('').role('secret').volatile().description('可选 Bearer 令牌；只有服务要求鉴权时才需要，设置页留空表示不修改。'),
  /** Model id sent in the request; volatile so the settings form can change it live. */
  model: z.string().default('hy-mt1.5-1.8b').description('请求中的 model 名；llama.cpp 可任意，vLLM 需与部署名一致。').volatile(),
  /** Default target language (BCP 47 style). Empty follows the web UI locale. */
  targetLang: z.string().default('').description('目标语言；留空跟随 Web GUI 语言。'),
  /** Prompt template: auto | zh | en | custom. */
  promptTemplate: z.union(PROMPT_TEMPLATE_IDS).default('auto').description('提示词模板：auto 按目标语言选择官方中/英模板。'),
  /** Custom template used when promptTemplate is custom; must contain {source_text}. */
  customTemplate: z.string().default('').description('自定义模板，必须包含 {source_text}，可选 {target_language}、{target_lang}、{glossary}。'),
  /** Optional extra instruction prepended to every prompt; volatile for live edits. */
  promptHeader: z.string().default('将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释').max(2000).volatile().description('翻译提示词头：作为每次翻译的指令句，支持 {target_language}、{target_lang}；留空使用内置模板。'),
  /** Whether a segment carrying placeholders gets the retention clause. */
  placeholderGuard: z.boolean().default(true).volatile().description('含 ⟦n⟧ 的请求是否附加“占位符原样保留”的要求。'),
  /** Custom retention sentence; empty uses the built-in clause. */
  placeholderHint: z.string().default('').max(500).volatile().description('自定义占位符要求句子；留空使用内置句子。'),
  /** Use the host's session model route (host integration) instead of the local endpoint. */
  systemModel: z.boolean().default(false).volatile().description('系统模型：使用当前会话最近一次请求的 provider/model 翻译，不访问本地服务。'),
  /** Show the original text after a stationary hover. */
  hoverRestore: z.boolean().default(true).volatile().description('自动翻译开启时，鼠标静止悬停一段时间后显示该语块原文。'),
  /** Wait before the hover restores the original text. */
  hoverRestoreMs: z.natural().min(0).max(60000).default(200).volatile().description('悬停显示原文的等待时间（毫秒）。'),
  /** Glossary: plain entries stay verbatim, `source=target` entries become terminology pairs. */
  glossary: z.array(z.string()).default([]).description('词表：纯词条原样保留；"源=译" 作为术语干预。'),
  /** Sampling temperature recommended by the model card. */
  temperature: z.number().min(0).max(2).default(0.7).description('采样温度（官方推荐 0.7）。'),
  /** Nucleus sampling top_p recommended by the model card. */
  topP: z.number().min(0).max(1).default(0.6).description('top_p（官方推荐 0.6）。'),
  /** top_k; 0 omits the field for strict OpenAI servers. */
  topK: z.natural().min(0).max(200).default(20).description('top_k（官方推荐 20）；0 表示不发送该参数。'),
  /** repetition_penalty; 0 omits the field for strict OpenAI servers. */
  repetitionPenalty: z.number().min(0).max(2).default(1.05).description('重复惩罚（官方推荐 1.05）；0 表示不发送该参数。'),
  /** Maximum generated tokens per segment. */
  maxTokens: z.natural().min(16).max(8192).default(2048).description('单段译文的最大输出 token 数。'),
  /** Parallel HTTP requests; volatile so the settings form can tune it live. */
  concurrency: z.natural().min(1).max(16).default(2).volatile().description('并发请求数；单实例 / JIT 加载建议 1–2。'),
  /** Merge the paragraphs of one reasoning block into one request. */
  batchReasoning: z.boolean().default(false).volatile().description('长思考合并请求：同一段思考里的多个语块一次发送，减少请求数。'),
  /** Per-request deadline in milliseconds. */
  timeoutMs: z.natural().min(1000).max(600000).default(60000).description('单次请求超时（毫秒）。'),
  /** Retries for transient failures (network, 429, 5xx). */
  retries: z.natural().min(0).max(3).default(1).description('瞬时失败（网络、429、5xx）重试次数。'),
})

/**
 * Re-judge every default and bound so programmatic mounts fail loud instead of
 * running with hidden values.
 * @param {object | undefined} raw - loader config.
 * @returns {Readonly<object>} frozen config.
 */
export function resolveConfig(raw) {
  const value = raw ?? {}
  const fail = (/** @type {string} */ message) => {
    throw new TypeError(`dsh-translate: ${message}`)
  }
  const enabled = value.enabled ?? true
  if (typeof enabled !== 'boolean') fail('config.enabled must be a boolean')
  const systemModel = value.systemModel ?? false
  if (typeof systemModel !== 'boolean') fail('config.systemModel must be a boolean')
  const baseUrl = String(value.baseUrl ?? 'http://127.0.0.1:8080/v1').trim().replace(/\/+$/u, '')
  if (!systemModel && !/^https?:\/\/[^\s]+$/u.test(baseUrl)) fail('config.baseUrl must be an http(s) URL, e.g. http://127.0.0.1:8080/v1')
  const apiKey = value.apiKey ?? ''
  if (typeof apiKey !== 'string') fail('config.apiKey must be a string')
  const model = String(value.model ?? 'hy-mt1.5-1.8b').trim()
  if (!systemModel && model.length === 0) fail('config.model must name the served model')
  const targetLang = value.targetLang ?? ''
  if (typeof targetLang !== 'string') fail('config.targetLang must be a string')
  const promptTemplate = value.promptTemplate ?? 'auto'
  if (!PROMPT_TEMPLATE_IDS.includes(promptTemplate)) fail(`config.promptTemplate must be one of ${PROMPT_TEMPLATE_IDS.join(', ')}`)
  const customTemplate = value.customTemplate ?? ''
  if (typeof customTemplate !== 'string') fail('config.customTemplate must be a string')
  const promptHeader = value.promptHeader ?? '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释'
  if (typeof promptHeader !== 'string') fail('config.promptHeader must be a string')
  if (promptHeader.length > 2000) fail('config.promptHeader must be at most 2000 characters')
  const placeholderGuard = value.placeholderGuard ?? true
  if (typeof placeholderGuard !== 'boolean') fail('config.placeholderGuard must be a boolean')
  const placeholderHint = value.placeholderHint ?? ''
  if (typeof placeholderHint !== 'string') fail('config.placeholderHint must be a string')
  if (placeholderHint.length > 500) fail('config.placeholderHint must be at most 500 characters')
  const hoverRestore = value.hoverRestore ?? true
  if (typeof hoverRestore !== 'boolean') fail('config.hoverRestore must be a boolean')
  const hoverRestoreMs = value.hoverRestoreMs ?? 200
  if (!Number.isInteger(hoverRestoreMs) || hoverRestoreMs < 0 || hoverRestoreMs > 60000) {
    fail('config.hoverRestoreMs must be an integer between 0 and 60000')
  }
  if (promptTemplate === 'custom') {
    if (customTemplate.trim().length === 0) fail('config.customTemplate must be set when promptTemplate is custom')
    if (!customTemplate.includes('{source_text}')) fail('config.customTemplate must contain {source_text}')
  }
  const glossary = value.glossary ?? []
  if (!Array.isArray(glossary) || glossary.some((term) => typeof term !== 'string')) fail('config.glossary must be an array of strings')
  const number = (/** @type {string} */ key, /** @type {number} */ fallback, /** @type {number} */ min, /** @type {number} */ max, /** @type {boolean} */ integer) => {
    const rawValue = value[key] ?? fallback
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) fail(`config.${key} must be a number`)
    if (integer && !Number.isInteger(rawValue)) fail(`config.${key} must be an integer`)
    if (rawValue < min || rawValue > max) fail(`config.${key} must be between ${min} and ${max}`)
    return rawValue
  }
  const temperature = number('temperature', 0.7, 0, 2, false)
  const topP = number('topP', 0.6, 0, 1, false)
  const topK = number('topK', 20, 0, 200, true)
  const repetitionPenalty = number('repetitionPenalty', 1.05, 0, 2, false)
  const maxTokens = number('maxTokens', 2048, 16, 8192, true)
  const concurrency = (() => {
    try {
      return number('concurrency', 2, 1, 16, true)
    } catch (error) {
      if (systemModel) return 2
      throw error
    }
  })()
  const timeoutMs = number('timeoutMs', 60000, 1000, 600000, true)
  const retries = number('retries', 1, 0, 3, true)
  const batchReasoning = value.batchReasoning ?? false
  if (typeof batchReasoning !== 'boolean') fail('config.batchReasoning must be a boolean')
  return Object.freeze({
    enabled,
    baseUrl,
    apiKey,
    model,
    targetLang,
    promptTemplate,
    customTemplate,
    promptHeader,
    placeholderGuard,
    placeholderHint,
    systemModel,
    hoverRestore,
    hoverRestoreMs,
    glossary: Object.freeze(glossary.slice()),
    temperature,
    topP,
    topK,
    repetitionPenalty,
    maxTokens,
    concurrency,
    batchReasoning,
    timeoutMs,
    retries,
  })
}

/**
 * Whether a loader config field is a Schemastery volatile reference
 * (`{ get(): value }`), which settings writes update in place.
 * @param {unknown} value - raw config field.
 * @returns {boolean} true for a volatile reference.
 */
export function isVolatileRef(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function'
}

/**
 * Read the current plain values of every config field, unwrapping volatile
 * references so a settings write is visible to the next call without a remount.
 * @param {object | undefined} raw - loader config.
 * @returns {object} plain config values.
 */
export function readConfigValues(raw) {
  const source = raw ?? {}
  const values = {}
  for (const key of CONFIG_KEYS) {
    const field = source[key]
    values[key] = isVolatileRef(field) ? field.get() : field
  }
  return values
}

/**
 * Build a live config source for the service: validation happens first at mount
 * and again on every read, so a bad settings write can never reach a call.
 * @param {object | undefined} raw - loader config (plain or volatile fields).
 * @returns {{ read: () => Readonly<object> }} config source.
 */
export function createConfigSource(raw) {
  const read = () => resolveConfig(readConfigValues(raw))
  read()
  return Object.freeze({ read })
}

/**
 * Mount the service when enabled.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {object} [config] - raw loader config.
 */
/** The host sessions service resolves the system-model route. */
export const inject = ['sessions']

export function apply(ctx, config) {
  const source = createConfigSource(config)
  if (!source.read().enabled) return
  ctx.plugin(TranslateService, {
    config: source,
    sessions: ctx.get('sessions'),
    getLlm: () => ctx.get('llm'),
  })
}

export { TranslateService } from './lib/service.mjs'
