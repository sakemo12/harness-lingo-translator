// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// lib/engine.mjs — the model-facing half of the translator: HY-MT prompt
// templates, glossary parsing, the OpenAI-compatible HTTP call, concurrency
// and fail-closed output checks. Deliberately free of cordis and DOM so it can
// be tested against a fake `fetch`.
//
// The default transport is `lib/transport.mjs` (node:http), not global fetch:
// fetch refuses ports on the WHATWG bad-port list, including 123, which a LAN
// translation server may use.
//
// The client masks every protected span (code, paths, commands, identifiers,
// numbers, product names) into placeholder tokens (default `[n]`) before it sends a segment. This module
// treats those placeholders as the trust boundary: a translation that loses,
// renumbers or invents a placeholder is discarded and the segment keeps its
// original text. Nothing here writes to a session, a file or the network; the
// only side effect is the caller-provided HTTP request.
//
// The prompt strings are the official templates published on the
// tencent/HY-MT1.5-1.8B-GGUF model card:
//   ZH<=>XX: "将以下文本翻译为{target_language}，注意只需要输出翻译后的结果，不要额外解释：\n\n{source_text}"
//   XX<=>XX: "Translate the following segment into {target_language}, without additional explanation.\n\n{source_text}"
// plus the terminology-intervention variant. No system prompt is sent: the
// model card states the model has no default system prompt.

import { nodeFetch } from './transport.mjs'

/** Default mask template: `n` is replaced by the slot number. */
export const DEFAULT_PLACEHOLDER_FORMAT = '[n]'

/** The mask template used before 1.15.0; kept to migrate saved hints. */
export const LEGACY_PLACEHOLDER_FORMAT = '⟦n⟧'

/**
 * Canonicalise a user-supplied mask template. A template must contain an `n`
 * (the slot number) and at least one literal character around it, so a token
 * can never collapse to a bare number. Invalid input falls back to `[n]`.
 * @param {string} format - template such as `[n]`, `{{n}}` or `⟦n⟧`.
 * @returns {string} usable template.
 */
export function normalizePlaceholderFormat(format) {
  const text = typeof format === 'string' ? format.trim() : ''
  if (text.length === 0 || text.length > 24) return DEFAULT_PLACEHOLDER_FORMAT
  const at = text.indexOf('n')
  if (at === -1 || text.replace(/n/gu, '').length === 0) return DEFAULT_PLACEHOLDER_FORMAT
  return text
}

/**
 * One concrete placeholder token, e.g. `[0]` for `[n]` or `⟦0⟧` for `⟦n⟧`.
 * @param {string} format - mask template.
 * @param {number} index - slot number.
 * @returns {string} token.
 */
export function placeholderToken(format, index) {
  const resolved = normalizePlaceholderFormat(format)
  const at = resolved.indexOf('n')
  return resolved.slice(0, at) + String(index) + resolved.slice(at + 1)
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * Regex matching one placeholder token of the configured format.
 * @param {string} format - mask template.
 * @param {string} flags - regex flags.
 * @returns {RegExp} token regex with the number in group 1.
 */
export function placeholderRegExp(format = DEFAULT_PLACEHOLDER_FORMAT, flags = 'g') {
  const resolved = normalizePlaceholderFormat(format)
  const at = resolved.indexOf('n')
  return new RegExp(escapeRegExp(resolved.slice(0, at)) + '(\\d+)' + escapeRegExp(resolved.slice(at + 1)), flags)
}

/** Default token regex, kept for callers that import `PLACEHOLDER`. */
export const PLACEHOLDER = placeholderRegExp(DEFAULT_PLACEHOLDER_FORMAT)

/** Cheap non-global test for the guard decision. */
function hasPlaceholder(text, format = DEFAULT_PLACEHOLDER_FORMAT) {
  return placeholderRegExp(format, 'u').test(String(text))
}

/**
 * Placeholder clauses. The model card says nothing about our masking tokens,
 * and the 1.8B model otherwise rewrites a token or drops it (measured on the
 * reference deployment). They are added only to segments that actually carry a
 * placeholder: on a plain segment the clause leaks into the answer on its own
 * (also measured), so such segments keep the pristine card template.
 */
function builtinGuardZh(format) {
  const first = placeholderToken(format, 0)
  const second = placeholderToken(format, 1)
  const third = placeholderToken(format, 2)
  return `，原文中的${first}、${second}、${third}这类占位符必须原样保留，你可以把占位符当做未知内容（一般是专有名词、数值、代码块）插入翻译好的句子，但不要把占位符里的编号当做数字翻译进内容里：`
}

function builtinGuardEn(format) {
  const first = placeholderToken(format, 0)
  const second = placeholderToken(format, 1)
  const third = placeholderToken(format, 2)
  return ` Keep placeholders such as ${first}, ${second} and ${third} exactly as they appear. Treat them as unknown content (usually a proper noun, number or code block) to insert into the translated sentence, but never translate the number inside the placeholder as content.`
}

/** Map a saved hint that still uses the legacy `⟦n⟧` tokens onto the active format. */
function adaptGuardHint(hint, format) {
  return String(hint).replace(/⟦(\d+)⟧/gu, (_, index) => placeholderToken(format, Number(index)))
}

/**
 * Language names supported by HY-MT1.5, from the model card's language table.
 * `zh` is the Chinese prompt name, `en` the English prompt name.
 */
export const LANGUAGES = Object.freeze({
  zh: { zh: '中文', en: 'Chinese' },
  en: { zh: '英语', en: 'English' },
  fr: { zh: '法语', en: 'French' },
  pt: { zh: '葡萄牙语', en: 'Portuguese' },
  es: { zh: '西班牙语', en: 'Spanish' },
  ja: { zh: '日语', en: 'Japanese' },
  tr: { zh: '土耳其语', en: 'Turkish' },
  ru: { zh: '俄语', en: 'Russian' },
  ar: { zh: '阿拉伯语', en: 'Arabic' },
  ko: { zh: '韩语', en: 'Korean' },
  th: { zh: '泰语', en: 'Thai' },
  it: { zh: '意大利语', en: 'Italian' },
  de: { zh: '德语', en: 'German' },
  vi: { zh: '越南语', en: 'Vietnamese' },
  ms: { zh: '马来语', en: 'Malay' },
  id: { zh: '印尼语', en: 'Indonesian' },
  tl: { zh: '菲律宾语', en: 'Filipino' },
  hi: { zh: '印地语', en: 'Hindi' },
  'zh-Hant': { zh: '繁体中文', en: 'Traditional Chinese' },
  pl: { zh: '波兰语', en: 'Polish' },
  cs: { zh: '捷克语', en: 'Czech' },
  nl: { zh: '荷兰语', en: 'Dutch' },
  km: { zh: '高棉语', en: 'Khmer' },
  my: { zh: '缅甸语', en: 'Burmese' },
  fa: { zh: '波斯语', en: 'Persian' },
  gu: { zh: '古吉拉特语', en: 'Gujarati' },
  ur: { zh: '乌尔都语', en: 'Urdu' },
  te: { zh: '泰卢固语', en: 'Telugu' },
  mr: { zh: '马拉地语', en: 'Marathi' },
  he: { zh: '希伯来语', en: 'Hebrew' },
  bn: { zh: '孟加拉语', en: 'Bengali' },
  ta: { zh: '泰米尔语', en: 'Tamil' },
  uk: { zh: '乌克兰语', en: 'Ukrainian' },
  bo: { zh: '藏语', en: 'Tibetan' },
  kk: { zh: '哈萨克语', en: 'Kazakh' },
  mn: { zh: '蒙古语', en: 'Mongolian' },
  ug: { zh: '维吾尔语', en: 'Uyghur' },
  yue: { zh: '粤语', en: 'Cantonese' },
})

/** Prompt template ids accepted by the `promptTemplate` config field. */
export const PROMPT_STYLES = Object.freeze(['auto', 'zh', 'en', 'custom'])

/**
 * Canonicalise a BCP 47 tag onto the model card's abbreviations.
 * @param {string} tag - raw language id, e.g. `zh-TW`, `pt_BR`, `en`.
 * @returns {string} canonical tag such as `zh`, `zh-Hant`, `pt`; unknown tags pass through.
 */
export function normalizeLangTag(tag) {
  const raw = String(tag ?? '').trim().replace(/_/gu, '-')
  if (raw.length === 0) return ''
  const parts = raw.split('-').filter(Boolean)
  const language = parts[0].toLowerCase()
  const script = parts.find((part) => /^[A-Za-z]{4}$/u.test(part))
  const region = parts.find((part, index) => index > 0 && /^([A-Za-z]{2}|\d{3})$/u.test(part))
  if (language === 'zh') {
    const traditional = (script !== undefined && script.toLowerCase() === 'hant') ||
      (region !== undefined && ['tw', 'hk', 'mo'].includes(region.toLowerCase()))
    return traditional ? 'zh-Hant' : 'zh'
  }
  if (language === 'fil') return 'tl'
  if (script !== undefined) return language + '-' + script[0].toUpperCase() + script.slice(1).toLowerCase()
  return language
}

/**
 * Whether the model card routes this language through its Chinese template.
 * @param {string} tag - language id.
 * @returns {boolean} true for Chinese variants.
 */
export function isChinese(tag) {
  const normalized = normalizeLangTag(tag)
  return normalized === 'zh' || normalized === 'zh-Hant' || normalized === 'yue'
}

/**
 * Human language name as written in the prompt.
 * @param {string} tag - language id.
 * @param {'zh' | 'en'} style - prompt language.
 * @returns {string} name, or the canonical tag when the table has no entry.
 */
export function languageName(tag, style) {
  const normalized = normalizeLangTag(tag)
  const entry = LANGUAGES[normalized] ?? LANGUAGES[normalized.split('-')[0]]
  return entry === undefined ? normalized : entry[style === 'zh' ? 'zh' : 'en']
}

/**
 * Resolve the concrete prompt style.
 * @param {string} setting - `auto`, `zh`, `en` or `custom`.
 * @param {string} targetLang - target language id.
 * @returns {'zh' | 'en' | 'custom'} concrete style.
 */
export function resolvePromptStyle(setting, targetLang) {
  if (setting === 'custom' || setting === 'zh' || setting === 'en') return setting
  return isChinese(targetLang) ? 'zh' : 'en'
}

/**
 * Split the glossary config into masked terms and terminology pairs.
 * A plain entry is kept verbatim by the client's mask; an `source=target` entry
 * becomes a terminology-intervention pair for the model.
 * @param {readonly string[] | undefined} entries - glossary config.
 * @returns {{ terms: string[], pairs: Array<{ source: string, target: string }> }} parsed glossary.
 */
export function parseGlossary(entries) {
  const terms = []
  const pairs = []
  for (const raw of Array.isArray(entries) ? entries : []) {
    const entry = String(raw).trim()
    if (entry.length === 0) continue
    const at = entry.indexOf('=')
    if (at > 0) {
      const source = entry.slice(0, at).trim()
      const target = entry.slice(at + 1).trim()
      if (source.length > 0 && target.length > 0) {
        pairs.push({ source, target })
        continue
      }
    }
    terms.push(entry)
  }
  return { terms: [...new Set(terms)], pairs }
}

/**
 * Build the terminology-intervention header of the official template.
 * @param {Array<{ source: string, target: string }>} pairs - terminology pairs.
 * @param {'zh' | 'en'} style - prompt language.
 * @returns {string} header block, or an empty string without pairs.
 */
function terminologyBlock(pairs, style) {
  if (pairs.length === 0) return ''
  const lines = style === 'zh'
    ? pairs.map((pair) => `${pair.source} 翻译成 ${pair.target}`)
    : pairs.map((pair) => `${pair.source} is translated as ${pair.target}`)
  const title = style === 'zh' ? '参考下面的翻译：' : 'Refer to the following translations:'
  return title + '\n' + lines.join('\n') + '\n\n'
}

/**
 * Build the prompt for one masked segment.
 * @param {object} options - prompt inputs.
 * @param {string} options.targetLang - target language id.
 * @param {string} options.style - resolved prompt style.
 * @param {string} [options.customTemplate] - template used by the `custom` style.
 * @param {Array<{ source: string, target: string }>} [options.pairs] - terminology pairs.
 * @param {string} options.text - masked source segment.
 * @returns {string} user-message prompt.
 */
/** Default instruction header; it is Chinese-specific, so non-Chinese targets ignore it. */
export const DEFAULT_PROMPT_HEADER = '将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释'

/** Inline Chinese retention clause; custom text gets a colon unless it ends with punctuation. */
function guardClauseZh(custom, format) {
  if (custom.length === 0) return builtinGuardZh(format)
  const hint = adaptGuardHint(custom, format)
  return '，' + hint + (/[：:。.]\s*$/u.test(custom) ? '' : '：')
}

/**
 * The source text as it is sent to the model. Leading blank lines, leading
 * whitespace and literal `\n` / `\"` escape sequences are removed: the request
 * body carries the prose itself, never a blank line in front of it and never a
 * backslash-escaped quote.
 * @param {string} text - source segment (masked or plain).
 * @returns {string} prompt-ready source text.
 */
function promptSource(text) {
  return String(text ?? '')
    .replace(/^(?:\\[rn])+/u, '')
    .replace(/^\s+/u, '')
    .replace(/\\"/gu, '"')
}

/** The separator after a Chinese instruction: a colon needs no extra space. */
function zhGap(rule) {
  return /[：:]\s*$/u.test(rule) ? '' : ' '
}

/** Substitute the placeholders understood inside a translation prompt header. */
function renderHeader(header, targetLang, style) {
  const text = typeof header === 'string' ? header.trim() : ''
  if (text.length === 0) return ''
  if (style !== 'zh' && text === DEFAULT_PROMPT_HEADER) return ''
  const langName = languageName(targetLang, style)
  return text
    .replace(/\{target_language\}/gu, () => langName)
    .replace(/\{target_lang\}/gu, () => targetLang)
}

export function buildPrompt({ targetLang, style, customTemplate = '', pairs = [], text, header = '', guard = true, guardHint = '', format = DEFAULT_PLACEHOLDER_FORMAT }) {
  const resolved = resolvePromptStyle(style, targetLang)
  const langName = languageName(targetLang, resolved === 'zh' ? 'zh' : 'en')
  const source = promptSource(text)
  const maskFormat = normalizePlaceholderFormat(format)
  if (resolved === 'custom') {
    return customTemplate
      .replace(/\{glossary\}/gu, () => terminologyBlock(pairs, isChinese(targetLang) ? 'zh' : 'en'))
      .replace(/\{target_language\}/gu, () => langName)
      .replace(/\{target_lang\}/gu, () => targetLang)
      .replace(/\{source_text\}/gu, () => source)
  }
  const customGuard = typeof guardHint === 'string' ? guardHint.trim() : ''
  const needsGuard = guard === true && hasPlaceholder(source, maskFormat)
  const headerText = renderHeader(header, targetLang, resolved === 'zh' ? 'zh' : 'en')
  if (resolved === 'zh') {
    const full = headerText.length > 0 ? headerText : `将以下文本翻译为${langName}，注意只需要输出翻译后的结果，不要额外解释`
    const base = needsGuard ? full.replace(/[：:]\s*$/u, '') : full
    const rule = needsGuard ? guardClauseZh(customGuard, maskFormat) : /[：:。.]\s*$/u.test(base) ? '' : '：'
    return terminologyBlock(pairs, 'zh') + base + rule + zhGap(rule) + source
  }
  const rule = !needsGuard ? '' : customGuard.length > 0 ? ' ' + adaptGuardHint(customGuard, maskFormat) : builtinGuardEn(maskFormat)
  const base = headerText.length > 0 ? headerText : `Translate the following segment into ${langName}, without additional explanation.`
  return terminologyBlock(pairs, 'en') + base + rule + ' ' + source
}

/** Maximum segments joined into one batched request (measured reliably at 8). */
export const BATCH_LIMIT = 8

/**
 * Build the numbered-format prompt used to translate several segments in one
 * request. Numbered lines survive the model far more reliably than JSON or
 * delimiter formats (measured against the reference deployment).
 * @param {object} options - prompt inputs.
 * @param {string} options.targetLang - target language id.
 * @param {Array<{ source: string, target: string }>} [options.pairs] - terminology pairs.
 * @param {readonly string[]} options.segments - masked segments (single-line).
 * @returns {string} prompt.
 */
export function buildBatchPrompt({ targetLang, pairs = [], segments, header = '', guard = true, guardHint = '', format = DEFAULT_PLACEHOLDER_FORMAT }) {
  const style = isChinese(targetLang) ? 'zh' : 'en'
  const langName = languageName(targetLang, style)
  const maskFormat = normalizePlaceholderFormat(format)
  const sources = segments.map((text) => promptSource(text))
  const numbered = sources.map((text, index) => `${index + 1}. ${text}`).join('\n')
  const customGuard = typeof guardHint === 'string' ? guardHint.trim() : ''
  const carriesPlaceholder = sources.some((text) => hasPlaceholder(text, maskFormat))
  const needsGuard = guard === true && carriesPlaceholder
  const headerText = renderHeader(header, targetLang, style)
  if (style === 'zh') {
    const base = headerText.length > 0 ? headerText.replace(/[：:。.]\s*$/u, '') : `将以下文本翻译为${langName}，注意只需要输出翻译后的结果，不要额外解释`
    const tail = !needsGuard ? '：' : guardClauseZh(customGuard, maskFormat)
    return terminologyBlock(pairs, 'zh') +
      base + '。每行一段，保持行数、顺序和编号，不要合并或拆分段落' + tail + zhGap(tail) + numbered
  }
  const base = headerText.length > 0 ? headerText.replace(/[.]\s*$/u, '') : `Translate the following numbered lines into ${langName}, without additional explanation`
  const tail = !needsGuard ? '' : customGuard.length > 0 ? ' ' + adaptGuardHint(customGuard, maskFormat) : builtinGuardEn(maskFormat)
  return terminologyBlock(pairs, 'en') +
    base + '. Each numbered line is one segment: keep the same number of lines, the same numbering and order; do not merge or split segments.' + tail + ' ' + numbered
}

/**
 * Split a numbered answer back into segments. Continuation lines are appended
 * to the previous segment, so wrapped translations still round-trip.
 * @param {string} raw - model answer.
 * @param {number} expected - number of segments requested.
 * @returns {string[] | undefined} one entry per segment, or undefined when the numbering is unusable.
 */
export function parseNumberedAnswer(raw, expected) {
  const text = String(raw ?? '').replace(/^```[A-Za-z0-9_-]*\s*/u, '').replace(/\s*```$/u, '').trim()
  if (text.length === 0) return undefined
  const parts = []
  let current = -1
  for (const line of text.split('\n')) {
    const match = /^\s*(\d+)\s*[.、)]\s?(.*)$/u.exec(line)
    if (match !== null) {
      if (Number(match[1]) !== parts.length + 1) return undefined
      parts.push(match[2])
      current = parts.length - 1
      continue
    }
    if (current >= 0) {
      parts[current] += '\n' + line
      continue
    }
    if (line.trim().length > 0) return undefined
  }
  if (parts.length !== expected) return undefined
  return parts.map((part) => part.trim())
}

/**
 * Placeholder tokens of one string, sorted for multiset comparison.
 * @param {string} text - masked or translated text.
 * @param {string} [format] - mask template.
 * @returns {string[]} placeholder tokens in stable order.
 */
export function placeholdersOf(text, format = DEFAULT_PLACEHOLDER_FORMAT) {
  return [...String(text).matchAll(placeholderRegExp(format))].map((match) => match[0]).sort()
}

/**
 * True when both strings carry exactly the same placeholder multiset.
 * @param {string} input - masked source segment.
 * @param {string} output - model translation.
 * @param {string} [format] - mask template.
 * @returns {boolean} whether the translation is structurally safe to merge.
 */
export function placeholdersIntact(input, output, format = DEFAULT_PLACEHOLDER_FORMAT) {
  const a = placeholdersOf(input, format)
  const b = placeholdersOf(output, format)
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false
  return true
}

/**
 * Remove the artefacts a translation model occasionally adds: code fences, an
 * echoed prompt, a leading label and wrapping quotes.
 * @param {string} raw - model answer.
 * @param {object} options - cleaning context.
 * @param {string} [options.prompt] - prompt that must not be echoed back.
 * @param {string} [options.source] - masked source segment.
 * @returns {string} cleaned translation, possibly empty.
 */
export function cleanOutput(raw, { prompt = '', source = '' } = {}) {
  let text = String(raw ?? '').trim()
  if (text.length === 0) return ''
  text = text.replace(/^```[A-Za-z0-9_-]*\s*/u, '').replace(/\s*```$/u, '').trim()
  if (prompt.length > 0 && text.startsWith(prompt)) text = text.slice(prompt.length).trim()
  text = text.replace(/^(?:译文|翻译结果|翻译|Translation|Translated text|Output)\s*[:：]\s*/iu, '').trim()
  if (text.length >= 2) {
    const quotes = { '"': '"', '“': '”', '「': '」', '『': '』', "'": "'", '《': '》' }
    const first = text[0]
    const last = text[text.length - 1]
    const sourceKeepsQuote = source.length > 0 && (source[0] === first || source[source.length - 1] === last)
    if (quotes[first] === last && !sourceKeepsQuote) text = text.slice(1, -1).trim()
  }
  return text
}

/**
 * Join an API root and a path without doubling or dropping the slash.
 * @param {string} baseUrl - API root, e.g. `http://127.0.0.1:8080/v1`.
 * @param {string} path - endpoint path, e.g. `/chat/completions`.
 * @returns {string} absolute URL.
 */
export function endpointUrl(baseUrl, path) {
  return String(baseUrl).replace(/\/+$/u, '') + path
}

/**
 * Abort-aware delay used between retries.
 * @param {number} ms - delay in milliseconds.
 * @param {AbortSignal | undefined} signal - caller cancellation.
 * @returns {Promise<void>} resolves after the delay or on abort.
 */
function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(); return }
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })
}

/**
 * One HTTP attempt, including timeout and response decoding.
 * @param {object} options - attempt options.
 * @param {object} options.config - resolved plugin config.
 * @param {object} options.body - JSON request body.
 * @param {AbortSignal} [options.signal] - caller cancellation.
 * @param {typeof fetch} options.fetchImpl - fetch implementation.
 * @returns {Promise<{ ok: boolean, text?: string, error?: string, status?: number, retriable?: boolean }>} attempt result.
 */
async function postOnce({ config, body, signal, fetchImpl }) {
  const controller = new AbortController()
  const forward = () => controller.abort()
  if (signal !== undefined) {
    if (signal.aborted) return { ok: false, error: 'cancelled', retriable: false }
    signal.addEventListener('abort', forward, { once: true })
  }
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, config.timeoutMs)
  try {
    const headers = { 'content-type': 'application/json' }
    if (config.apiKey.length > 0) headers.authorization = `Bearer ${config.apiKey}`
    const response = await fetchImpl(endpointUrl(config.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const raw = await response.text()
    if (!response.ok) {
      const detail = raw.trim().slice(0, 400)
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}${detail.length > 0 ? `: ${detail}` : ''}`,
        retriable: response.status === 429 || response.status >= 500,
      }
    }
    let data
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'the endpoint answered with something that is not JSON', retriable: false }
    }
    const choice = data?.choices?.[0]
    const content = choice?.message?.content
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, error: 'the endpoint returned no message content', retriable: false }
    }
    if (choice?.finish_reason === 'length') {
      return { ok: false, error: `the translation was cut off at maxTokens=${config.maxTokens}`, retriable: false }
    }
    return { ok: true, text: content }
  } catch (error) {
    if (timedOut) return { ok: false, error: `timeout after ${config.timeoutMs} ms`, retriable: true }
    if (controller.signal.aborted) return { ok: false, error: 'cancelled', retriable: false }
    return { ok: false, error: error instanceof Error ? error.message : String(error), retriable: true }
  } finally {
    clearTimeout(timer)
    if (signal !== undefined) signal.removeEventListener('abort', forward)
  }
}

/**
 * POST one OpenAI-compatible chat completion and return the message text.
 * @param {object} options - request options.
 * @param {object} options.config - resolved plugin config.
 * @param {string} options.prompt - user-message content.
 * @param {AbortSignal} [options.signal] - caller cancellation.
 * @param {typeof fetch} [options.fetchImpl] - fetch implementation.
 * @returns {Promise<{ ok: boolean, text?: string, error?: string, status?: number, retriable?: boolean }>} call result.
 */
export async function requestCompletion(options) {
  const { config, prompt, signal, fetchImpl = nodeFetch } = options
  const standard = {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: config.temperature,
    top_p: config.topP,
    max_tokens: config.maxTokens,
    stream: false,
  }
  const extended = {
    ...standard,
    ...(config.topK > 0 ? { top_k: config.topK } : {}),
    ...(config.repetitionPenalty > 0 ? { repetition_penalty: config.repetitionPenalty } : {}),
  }
  const first = await postOnce({ config, body: extended, signal, fetchImpl })
  if (first.ok || first.status !== 400) return first
  if (!/unknown|unsupported|unrecognized|unexpected|extra/iu.test(first.error ?? '')) return first
  // A strict OpenAI server may reject the llama.cpp sampling extensions; retry
  // once with the standard parameters only.
  const second = await postOnce({ config, body: standard, signal, fetchImpl })
  return second.ok ? second : { ...second, error: `${second.error} (retried without top_k/repetition_penalty)` }
}

/**
 * Probe `GET {baseUrl}/models` so the toggle can explain a missing server.
 * @param {object} options - probe options.
 * @param {object} options.config - resolved plugin config.
 * @param {AbortSignal} [options.signal] - caller cancellation.
 * @param {typeof fetch} [options.fetchImpl] - fetch implementation.
 * @returns {Promise<{ ok: boolean, model?: string | null, models?: string[], error?: string }>} probe result.
 */
export async function probeEndpoint({ config, signal, fetchImpl = nodeFetch }) {
  const controller = new AbortController()
  const forward = () => controller.abort()
  if (signal !== undefined) {
    if (signal.aborted) return { ok: false, error: 'cancelled' }
    signal.addEventListener('abort', forward, { once: true })
  }
  const timer = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 8000))
  try {
    const headers = {}
    if (config.apiKey.length > 0) headers.authorization = `Bearer ${config.apiKey}`
    const response = await fetchImpl(endpointUrl(config.baseUrl, '/models'), { method: 'GET', headers, signal: controller.signal })
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: `${config.baseUrl} rejected the credentials (HTTP ${response.status}); check config.apiKey` }
    }
    if (response.status === 404 || response.status === 405) {
      // An OpenAI-compatible server is not required to list models; the
      // translation call is the real test.
      return { ok: true, model: config.model || null, models: [] }
    }
    if (!response.ok) {
      return { ok: false, error: `${config.baseUrl} answered HTTP ${response.status}` }
    }
    let data
    try {
      data = await response.json()
    } catch {
      return { ok: true, model: config.model || null, models: [] }
    }
    const models = Array.isArray(data?.data)
      ? data.data.map((entry) => entry?.id).filter((id) => typeof id === 'string' && id.length > 0)
      : []
    return { ok: true, model: config.model || models[0] || null, models }
  } catch (error) {
    return {
      ok: false,
      error: `cannot reach ${config.baseUrl}/models: ${error instanceof Error ? error.message : String(error)} — is the local translation server running?`,
    }
  } finally {
    clearTimeout(timer)
    if (signal !== undefined) signal.removeEventListener('abort', forward)
  }
}

/**
 * Run a worker pool over the items, preserving input order.
 * @template T, R
 * @param {readonly T[]} items - inputs.
 * @param {number} limit - maximum concurrency.
 * @param {(item: T, index: number) => Promise<R>} worker - async worker.
 * @returns {Promise<R[]>} results in input order.
 */
async function runPool(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  const width = Math.max(1, Math.min(limit, items.length))
  const runners = Array.from({ length: width }, async () => {
    for (;;) {
      const index = next
      next += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

/**
 * Translate every segment one request at a time, bounded by `concurrency`.
 * @param {object} options - whole-call options.
 * @param {object} options.config - resolved plugin config.
 * @param {string} options.targetLang - target language id.
 * @param {readonly string[]} options.segments - masked segments.
 * @param {AbortSignal} [options.signal] - caller cancellation.
 * @param {typeof fetch} [options.fetchImpl] - fetch implementation.
 * @returns {Promise<{ translations: string[], failed: number[], error: string | null, baseUrl: string, model: string | null }>} result.
 */
async function translateEach(options) {
  const { config, targetLang, segments, signal, fetchImpl = nodeFetch } = options
  const { pairs } = parseGlossary(config.glossary)
  const style = resolvePromptStyle(config.promptTemplate, targetLang)
  const translations = segments.slice()
  const failed = []
  let error = null
  const results = await runPool(segments, config.concurrency, async (segment) => {
    if (signal?.aborted) return { ok: false, error: 'cancelled' }
    const prompt = buildPrompt({
      targetLang,
      style,
      customTemplate: config.customTemplate,
      pairs,
      text: segment,
      header: config.promptHeader,
      guard: config.placeholderGuard,
      guardHint: config.placeholderHint,
      format: config.placeholderFormat,
    })
    for (let attempt = 0; ; attempt += 1) {
      const response = await requestCompletion({ config, prompt, signal, fetchImpl })
      if (response.ok) {
        const value = cleanOutput(response.text, { prompt, source: segment })
        if (value.length === 0) return { ok: false, error: 'the translation is empty' }
        // With masking off, a token in the source is ordinary prose, not a
        // token this side generated; it must not fail the translation.
        if (config.placeholderGuard && !placeholdersIntact(segment, value, config.placeholderFormat)) {
          return { ok: false, error: 'the translation lost, duplicated or invented a placeholder' }
        }
        return { ok: true, value }
      }
      if (attempt >= config.retries || response.retriable !== true || signal?.aborted) {
        return { ok: false, error: response.error ?? 'translation failed' }
      }
      await sleep(250 * (attempt + 1), signal)
    }
  })
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]
    if (result.ok && typeof result.value === 'string') {
      translations[index] = result.value
      continue
    }
    failed.push(index)
    if (error === null) error = `segment ${index}: ${result.error ?? 'translation failed'}`
  }
  return {
    translations,
    failed,
    error,
    baseUrl: config.baseUrl,
    model: config.model || null,
  }
}

/**
 * Translate one unit of segments with a single numbered-format request.
 * @param {object} options - unit options.
 * @param {object} options.config - resolved plugin config.
 * @param {string} options.targetLang - target language id.
 * @param {readonly string[]} options.items - single-line masked segments.
 * @param {AbortSignal} [options.signal] - caller cancellation.
 * @param {typeof fetch} [options.fetchImpl] - fetch implementation.
 * @returns {Promise<{ ok: true, values: string[] } | { ok: false, error: string }>} unit result.
 */
async function translateUnit({ config, targetLang, items, signal, fetchImpl }) {
  const { pairs } = parseGlossary(config.glossary)
  const prompt = buildBatchPrompt({
    targetLang,
    pairs,
    segments: items,
    header: config.promptHeader,
    guard: config.placeholderGuard,
    guardHint: config.placeholderHint,
    format: config.placeholderFormat,
  })
  const response = await requestCompletion({ config, prompt, signal, fetchImpl })
  if (!response.ok) return { ok: false, error: response.error ?? 'batch request failed' }
  const parts = parseNumberedAnswer(response.text, items.length)
  if (parts === undefined) return { ok: false, error: 'batched answer was not a usable numbered list' }
  const values = []
  for (let index = 0; index < items.length; index += 1) {
    const value = cleanOutput(parts[index], { prompt, source: items[index] })
    if (value.length === 0) return { ok: false, error: `batch segment ${index} is empty` }
    if (config.placeholderGuard && !placeholdersIntact(items[index], value, config.placeholderFormat)) {
      return { ok: false, error: `batch segment ${index} lost or changed a placeholder` }
    }
    values.push(value)
  }
  return { ok: true, values }
}

/**
 * Translate a thinking block's segments with as few requests as possible,
 * falling back to per-segment translation when a batch is unusable.
 * @param {object} options - whole-call options.
 * @param {object} options.config - resolved plugin config.
 * @param {string} options.targetLang - target language id.
 * @param {readonly string[]} options.segments - masked segments.
 * @param {AbortSignal} [options.signal] - caller cancellation.
 * @param {typeof fetch} [options.fetchImpl] - fetch implementation.
 * @returns {Promise<{ translations: string[], failed: number[], error: string | null, baseUrl: string, model: string | null }>} result.
 */
async function translateBatched(options) {
  const { config, targetLang, segments, signal, fetchImpl = nodeFetch } = options
  const translations = segments.slice()
  const failed = []
  let error = null
  const markFailed = (index, reason) => {
    failed.push(index)
    if (error === null) error = `segment ${index}: ${reason}`
  }

  // A numbered batch needs one line per segment.
  const units = []
  for (let start = 0; start < segments.length; start += BATCH_LIMIT) {
    const items = segments.slice(start, start + BATCH_LIMIT)
    if (items.some((text) => text.includes('\n'))) {
      for (let offset = 0; offset < items.length; offset += 1) units.push({ start: start + offset, items: [items[offset]] })
    } else {
      units.push({ start, items })
    }
  }

  for (const unit of units) {
    if (signal?.aborted) {
      for (let offset = 0; offset < unit.items.length; offset += 1) markFailed(unit.start + offset, 'cancelled')
      continue
    }
    if (unit.items.length === 1) {
      const single = await translateEach({ ...options, segments: unit.items })
      if (single.failed.length > 0) markFailed(unit.start, single.error ?? 'translation failed')
      else translations[unit.start] = single.translations[0]
      continue
    }
    const unitResult = await translateUnit({ config, targetLang, items: unit.items, signal, fetchImpl })
    if (unitResult.ok) {
      for (let offset = 0; offset < unit.items.length; offset += 1) translations[unit.start + offset] = unitResult.values[offset]
      continue
    }
    // A malformed batch is retried per segment so one odd answer never drops a
    // whole thinking block.
    const fallback = await translateEach({ ...options, segments: unit.items })
    for (let offset = 0; offset < unit.items.length; offset += 1) {
      if (fallback.failed.includes(offset)) markFailed(unit.start + offset, fallback.error ?? 'translation failed')
      else translations[unit.start + offset] = fallback.translations[offset]
    }
    if (fallback.error !== null && error === null) error = fallback.error
  }

  return {
    translations,
    failed,
    error,
    baseUrl: config.baseUrl,
    model: config.model || null,
  }
}

/**
 * Translate every segment with the local HY-MT service, keeping originals for
 * failed ones. `batch: true` groups the segments into numbered requests when
 * `config.batchReasoning` is on.
 * @param {object} options - whole-call options.
 * @param {object} options.config - resolved plugin config.
 * @param {string} options.targetLang - target language id.
 * @param {readonly string[]} options.segments - masked segments.
 * @param {boolean} [options.batch] - the caller grouped a thinking block; only honored with `config.batchReasoning`.
 * @param {AbortSignal} [options.signal] - caller cancellation.
 * @param {typeof fetch} [options.fetchImpl] - fetch implementation.
 * @returns {Promise<{ translations: string[], failed: number[], error: string | null, baseUrl: string, model: string | null }>} result.
 */
export async function translateSegments(options) {
  const { config, segments, batch = false } = options
  if (batch && config.batchReasoning && config.promptTemplate !== 'custom' && segments.length > 1) {
    return translateBatched(options)
  }
  return translateEach(options)
}
