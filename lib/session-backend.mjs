// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// lib/session-backend.mjs — the host integration: translate with the host's
// own model route (`ctx.llm.stream`) instead of a local endpoint.
//
// No conversation context and no model-side cache hints are sent: each batch is
// a standalone JSON-array request with a stable system prompt.

import { DEFAULT_PLACEHOLDER_FORMAT, placeholdersIntact, placeholderToken } from './engine.mjs'

const MAX_SEGMENTS = 20
const MAX_CHARS = 6000

/** Session event snapshot across harness lines. */
export function sessionEvents(session) {
  if (session === null || session === undefined) return []
  const probe = session
  if (typeof probe.snapshotEvents === 'function') return probe.snapshotEvents()
  return probe.events ?? []
}

/** Resolve the provider/model route from the newest `request/header`. */
export function latestRoute(sessions) {
  const list = typeof sessions?.list === 'function' ? sessions.list() : []
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const events = sessionEvents(list[index])
    for (let cursor = events.length - 1; cursor >= 0; cursor -= 1) {
      const event = events[cursor]
      if (event === null || typeof event !== 'object' || event.type !== 'request/header') continue
      const header = event.data?.header
      const provider = header?.config?.provider
      const model = header?.config?.model
      if (typeof provider === 'string' && provider.length > 0 && typeof model === 'string' && model.length > 0) {
        return { provider, model }
      }
    }
  }
  return undefined
}

/** Build the JSON-array translation system prompt. */
export function buildSessionSystemPrompt(targetLang, glossary = [], guard = true, format = DEFAULT_PLACEHOLDER_FORMAT) {
  const terms = [...new Set(glossary.filter((term) => typeof term === 'string' && term.trim().length > 0))]
  const rules = []
  if (guard) {
    const first = placeholderToken(format, 0)
    const second = placeholderToken(format, 12)
    rules.push(`Tokens like ${first} or ${second} are opaque placeholders. Reproduce every placeholder exactly once, unchanged, and keep it near the same words. Never add, drop, renumber, translate or reorder a placeholder.`)
  }
  rules.push('Never translate or alter: code, shell commands and flags, file paths, URLs, email addresses, package names, identifiers, environment variables, hashes, version numbers, plain numbers, or the protected terms below.')
  rules.push(terms.length > 0 ? `Protected terms, keep verbatim: ${terms.join(', ')}.` : 'Keep product names and identifiers verbatim.')
  rules.push('Preserve leading and trailing whitespace, punctuation and markdown emphasis exactly.')
  rules.push(`If a string is already in ${targetLang}, or contains no translatable prose, return it unchanged.`)
  rules.push('Output only the JSON array: no code fences, no commentary, no extra keys.')
  return [
    `You translate visible text from a developer tool's web interface into ${targetLang}.`,
    'The user message is a JSON array of strings. Return ONLY a JSON array of strings with exactly the same length and order.',
    '',
    'Rules:',
    ...rules.map((rule, index) => `${index + 1}. ${rule}`),
  ].join('\n')
}

function batchSegments(segments) {
  const batches = []
  let current = []
  let chars = 0
  let start = 0
  for (const segment of segments) {
    if (current.length > 0 && (current.length >= MAX_SEGMENTS || chars + segment.length > MAX_CHARS)) {
      batches.push({ start, items: current })
      start += current.length
      current = []
      chars = 0
    }
    current.push(segment)
    chars += segment.length
  }
  if (current.length > 0) batches.push({ start, items: current })
  return batches
}

function parseArrayAnswer(text) {
  const trimmed = text.trim()
  const candidates = [trimmed]
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/u)
  if (fenced !== null) candidates.push(fenced[1].trim())
  const first = trimmed.indexOf('[')
  const last = trimmed.lastIndexOf(']')
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1))
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate)
      if (Array.isArray(value)) return value
    } catch {
      // next candidate
    }
  }
  return undefined
}

async function streamBatch(llm, request) {
  let text = ''
  let finish
  for await (const chunk of llm.stream(request)) {
    if (chunk === null || typeof chunk !== 'object') continue
    if (chunk.type === 'text-delta') text += chunk.text
    else if (chunk.type === 'block-end' && chunk.block?.type === 'text' && text.length === 0) text = chunk.block.text ?? ''
    else if (chunk.type === 'finish') {
      finish = chunk.reason
      break
    }
  }
  return { text, finish }
}

/**
 * Translate masked segments through the host model route.
 * @param {{ llm: object, route: { provider: string, model: string }, targetLang: string, segments: string[], glossary?: string[], guard?: boolean, format?: string, timeoutMs?: number, signal?: AbortSignal }} options - call inputs.
 * @returns {Promise<{ translations: string[], failed: number[], error: string | null }>} result.
 */
export async function translateViaSession(options) {
  const { llm, route, targetLang, segments, glossary = [], timeoutMs = 60000, guard = true, format = DEFAULT_PLACEHOLDER_FORMAT } = options
  const system = buildSessionSystemPrompt(targetLang, glossary, guard, format)
  const translations = segments.slice()
  const failed = []
  let error = null
  for (const batch of batchSegments(segments)) {
    const controller = new AbortController()
    const forward = () => controller.abort()
    if (options.signal !== undefined) {
      if (options.signal.aborted) {
        for (let index = 0; index < batch.items.length; index += 1) failed.push(batch.start + index)
        error = 'cancelled'
        break
      }
      options.signal.addEventListener('abort', forward, { once: true })
    }
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    try {
      const { text, finish } = await streamBatch(llm, {
        provider: route.provider,
        model: route.model,
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify(batch.items) }] }],
        reasoningEffort: 'off',
        signal: controller.signal,
      })
      if (timedOut) throw new Error(`timeout after ${timeoutMs} ms`)
      if (finish?.kind !== 'stop') throw new Error(`model ended with ${String(finish?.kind ?? 'no finish')}`)
      const parsed = parseArrayAnswer(text)
      if (!Array.isArray(parsed) || parsed.length !== batch.items.length) throw new Error('model answer is not a JSON array of the expected length')
      for (let index = 0; index < batch.items.length; index += 1) {
        const value = parsed[index]
        if (typeof value !== 'string' || (guard && !placeholdersIntact(batch.items[index], value, format))) {
          failed.push(batch.start + index)
          if (error === null) error = `segment ${batch.start + index} lost or changed a placeholder`
          continue
        }
        translations[batch.start + index] = value
      }
    } catch (failure) {
      if (error === null) error = failure instanceof Error ? failure.message : String(failure)
      for (let index = 0; index < batch.items.length; index += 1) {
        if (!failed.includes(batch.start + index)) failed.push(batch.start + index)
      }
    } finally {
      clearTimeout(timer)
      if (options.signal !== undefined) options.signal.removeEventListener('abort', forward)
    }
    if (options.signal?.aborted) break
  }
  return { translations, failed, error }
}
