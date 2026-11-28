// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// client/index.js — harness-lingo-translator browser half: a page-level translator.
//
// Hand-written client bundle (no build step), same loader shape as
// dsh-checkpoint-rewind. It walks the rendered DOM, masks everything that must
// stay verbatim (code, paths, commands, identifiers, numbers, product names)
// into placeholder tokens (default `[n]`), asks the host `translatePage` Remote to translate the
// prose, restores the placeholders and writes the result back into the same
// text nodes. A floating control switches between the translation and the
// original; the originals stay in memory, the session log is never touched.
//
// It also contributes the row's configuration page to the Plugins page:
// `plugins.row.config` keyed by `harness-lingo-translator#harness-lingo-translator`, with the service
// address and model name, saved through the page owner's settings form.
//
// Host side: lib/service.mjs. The Remote descriptors below must match
// lib/wire.mjs exactly; test/descriptors.test.mjs enforces that.

window.__ModuleLoader__.load({
  id: 'harness-lingo-translator',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement

    // ---------------------------------------------------------------------
    // Wire contract (keep in sync with lib/wire.mjs).
    // ---------------------------------------------------------------------
    var PACKAGE = 'harness-lingo-translator'
    var SERVICE = 'translatePage'
    var SOURCE_LOCATION = Object.freeze({ file: 'lib/wire.mjs', line: 1, column: 1 })

    function strictCodec(typeSymbol, parse) {
      return Object.freeze({
        mode: 'strict',
        typeSymbol: typeSymbol,
        create: function () { return { parse: parse } },
      })
    }

    function assertObject(value, field) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('harness-lingo-translator: unexpected ' + field + ' value')
      }
      return value
    }

    function parseStatus(value) {
      var v = assertObject(value, 'status')
      if (typeof v.ready !== 'boolean') throw new Error('status.ready')
      if (typeof v.targetLang !== 'string') throw new Error('status.targetLang')
      if (typeof v.baseUrl !== 'string') throw new Error('status.baseUrl')
      if (v.model !== null && typeof v.model !== 'string') throw new Error('status.model')
      if (!Array.isArray(v.glossary)) throw new Error('status.glossary')
      for (var i = 0; i < v.glossary.length; i += 1) {
        if (typeof v.glossary[i] !== 'string') throw new Error('status.glossary[' + i + ']')
      }
      if (v.batchReasoning !== undefined && typeof v.batchReasoning !== 'boolean') throw new Error('status.batchReasoning')
      if (v.placeholderGuard !== undefined && typeof v.placeholderGuard !== 'boolean') throw new Error('status.placeholderGuard')
      if (v.placeholderFormat !== undefined && (typeof v.placeholderFormat !== 'string' || v.placeholderFormat.length > 24)) throw new Error('status.placeholderFormat')
      if (v.hoverRestore !== undefined && typeof v.hoverRestore !== 'boolean') throw new Error('status.hoverRestore')
      if (v.hoverRestoreMs !== undefined && !Number.isInteger(v.hoverRestoreMs)) throw new Error('status.hoverRestoreMs')
      if (typeof v.configHash !== 'string') throw new Error('status.configHash')
      if (v.reason !== null && typeof v.reason !== 'string') throw new Error('status.reason')
      return v
    }

    function parseTranslateRequest(value) {
      var v = assertObject(value, 'translateRequest')
      if (typeof v.targetLang !== 'string') throw new Error('translateRequest.targetLang')
      if (!Array.isArray(v.segments)) throw new Error('translateRequest.segments')
      for (var i = 0; i < v.segments.length; i += 1) {
        if (typeof v.segments[i] !== 'string') throw new Error('translateRequest.segments[' + i + ']')
      }
      if (v.batch !== undefined && typeof v.batch !== 'boolean') throw new Error('translateRequest.batch')
      return v
    }

    function parseTranslateResult(value) {
      var v = assertObject(value, 'translateResult')
      if (!Array.isArray(v.translations)) throw new Error('translateResult.translations')
      if (!Array.isArray(v.failed)) throw new Error('translateResult.failed')
      for (var i = 0; i < v.translations.length; i += 1) {
        if (typeof v.translations[i] !== 'string') throw new Error('translateResult.translations[' + i + ']')
      }
      if (typeof v.baseUrl !== 'string') throw new Error('translateResult.baseUrl')
      if (v.model !== null && typeof v.model !== 'string') throw new Error('translateResult.model')
      if (v.error !== null && typeof v.error !== 'string') throw new Error('translateResult.error')
      return v
    }

    var STATUS_DESCRIPTOR = Object.freeze({
      id: PACKAGE + '#' + SERVICE + '/status',
      service: SERVICE,
      namespace: SERVICE,
      method: 'status',
      invocation: Object.freeze({ kind: 'direct' }),
      parameters: Object.freeze([]),
      result: strictCodec(PACKAGE + '/types#TranslateStatus', parseStatus),
      sourceLocation: SOURCE_LOCATION,
    })

    var TRANSLATE_DESCRIPTOR = Object.freeze({
      id: PACKAGE + '#' + SERVICE + '/translate',
      service: SERVICE,
      namespace: SERVICE,
      method: 'translate',
      invocation: Object.freeze({ kind: 'direct' }),
      parameters: Object.freeze([Object.freeze({
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: strictCodec(PACKAGE + '/types#TranslateRequest', parseTranslateRequest),
      })]),
      result: strictCodec(PACKAGE + '/types#TranslateResult', parseTranslateResult),
      sourceLocation: SOURCE_LOCATION,
    })

    function parseCacheLoad(value) {
      var v = assertObject(value, 'cacheLoadRequest')
      if (typeof v.workspace !== 'string') throw new Error('cacheLoadRequest.workspace')
      if (typeof v.configHash !== 'string') throw new Error('cacheLoadRequest.configHash')
      return v
    }

    function parseCacheLoadResult(value) {
      var v = assertObject(value, 'cacheLoadResult')
      var entries = assertObject(v.entries, 'cacheLoadResult.entries')
      for (var key in entries) {
        if (Object.prototype.hasOwnProperty.call(entries, key) && typeof entries[key] !== 'string') throw new Error('cacheLoadResult.entries')
      }
      return v
    }

    function parseCacheSave(value) {
      var v = assertObject(value, 'cacheSaveRequest')
      if (typeof v.workspace !== 'string') throw new Error('cacheSaveRequest.workspace')
      if (typeof v.configHash !== 'string') throw new Error('cacheSaveRequest.configHash')
      if (!Array.isArray(v.entries)) throw new Error('cacheSaveRequest.entries')
      for (var i = 0; i < v.entries.length; i += 1) {
        var item = assertObject(v.entries[i], 'cacheSaveRequest.entries[' + i + ']')
        if (typeof item.source !== 'string' || typeof item.translation !== 'string') throw new Error('cacheSaveRequest.entries[' + i + ']')
      }
      return v
    }

    function parseCacheSaveResult(value) {
      var v = assertObject(value, 'cacheSaveResult')
      if (!Number.isInteger(v.saved) || !Number.isInteger(v.total)) throw new Error('cacheSaveResult')
      return v
    }

    var CACHE_LOAD_DESCRIPTOR = Object.freeze({
      id: PACKAGE + '#' + SERVICE + '/loadCache',
      service: SERVICE,
      namespace: SERVICE,
      method: 'loadCache',
      invocation: Object.freeze({ kind: 'direct' }),
      parameters: Object.freeze([Object.freeze({
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: strictCodec(PACKAGE + '/types#CacheLoadRequest', parseCacheLoad),
      })]),
      result: strictCodec(PACKAGE + '/types#CacheLoadResult', parseCacheLoadResult),
      sourceLocation: SOURCE_LOCATION,
    })

    var CACHE_SAVE_DESCRIPTOR = Object.freeze({
      id: PACKAGE + '#' + SERVICE + '/saveCache',
      service: SERVICE,
      namespace: SERVICE,
      method: 'saveCache',
      invocation: Object.freeze({ kind: 'direct' }),
      parameters: Object.freeze([Object.freeze({
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: strictCodec(PACKAGE + '/types#CacheSaveRequest', parseCacheSave),
      })]),
      result: strictCodec(PACKAGE + '/types#CacheSaveResult', parseCacheSaveResult),
      sourceLocation: SOURCE_LOCATION,
    })

    function parsePruneCacheResult(value) {
      var v = assertObject(value, 'pruneCacheResult')
      if (!Number.isInteger(v.removed) || !Number.isInteger(v.files)) throw new Error('pruneCacheResult')
      return v
    }

    function parseWorkspace(value) {
      var v = assertObject(value, 'workspaceRequest')
      if (typeof v.sessionId !== 'string') throw new Error('workspaceRequest.sessionId')
      return v
    }

    function parseWorkspaceResult(value) {
      var v = assertObject(value, 'workspaceResult')
      if (v.path !== null && typeof v.path !== 'string') throw new Error('workspaceResult.path')
      return v
    }

    var WORKSPACE_DESCRIPTOR = Object.freeze({
      id: PACKAGE + '#' + SERVICE + '/workspace',
      service: SERVICE,
      namespace: SERVICE,
      method: 'workspace',
      invocation: Object.freeze({ kind: 'direct' }),
      parameters: Object.freeze([Object.freeze({
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: strictCodec(PACKAGE + '/types#WorkspaceRequest', parseWorkspace),
      })]),
      result: strictCodec(PACKAGE + '/types#WorkspaceResult', parseWorkspaceResult),
      sourceLocation: SOURCE_LOCATION,
    })

    var PRUNE_CACHE_DESCRIPTOR = Object.freeze({
      id: PACKAGE + '#' + SERVICE + '/pruneCache',
      service: SERVICE,
      namespace: SERVICE,
      method: 'pruneCache',
      invocation: Object.freeze({ kind: 'direct' }),
      parameters: Object.freeze([]),
      result: strictCodec(PACKAGE + '/types#PruneCacheResult', parsePruneCacheResult),
      sourceLocation: SOURCE_LOCATION,
    })

    var INVOCATIONS = Object.freeze([STATUS_DESCRIPTOR, TRANSLATE_DESCRIPTOR, CACHE_LOAD_DESCRIPTOR, CACHE_SAVE_DESCRIPTOR, WORKSPACE_DESCRIPTOR, PRUNE_CACHE_DESCRIPTOR])

    // ---------------------------------------------------------------------
    // Protection: everything that must survive translation verbatim.
    // ---------------------------------------------------------------------
    var DEFAULT_PLACEHOLDER_FORMAT = '[n]'
    var HAS_LETTERS = /[A-Za-z]/

    /** Canonicalise a mask template; `n` is the slot number. */
    function normalizePlaceholderFormat(format) {
      var text = typeof format === 'string' ? format.trim() : ''
      if (text.length === 0 || text.length > 24) return DEFAULT_PLACEHOLDER_FORMAT
      if (text.indexOf('n') === -1 || text.replace(/n/g, '').length === 0) return DEFAULT_PLACEHOLDER_FORMAT
      return text
    }

    /** One token such as `[0]` (default) or `⟦0⟧`. */
    function placeholderToken(format, index) {
      var resolved = normalizePlaceholderFormat(format)
      var at = resolved.indexOf('n')
      return resolved.slice(0, at) + String(index) + resolved.slice(at + 1)
    }

    /** Regex for the configured token format; the number is group 1. */
    function placeholderRegExp(format, flags) {
      var resolved = normalizePlaceholderFormat(format)
      var at = resolved.indexOf('n')
      return new RegExp(escapeRegExp(resolved.slice(0, at)) + '(\\d+)' + escapeRegExp(resolved.slice(at + 1)), flags || 'g')
    }

    // Product names are ordinary words to a model, so they are matched as literal
    // alternatives before the generic rules.
    var PRODUCT_TERMS = [
      'DeepSeek Harness', 'DeepSeek', 'Cordis', 'npm', 'pnpm', 'yarn', 'bun', 'npx',
      'node', 'git', 'docker', 'kubectl', 'curl', 'GitHub', 'Gitee',
      'GitCode', 'Phocinae', 'PerryLink', 'DSH', 'MCP', 'JSON', 'OTLP', 'SQLite',
    ]

    var FIXED_PROTECTED = [
      '`[^`]+`',
      '\\b(?:https?|mailto):[^\\s<>"\'）)】]+',
      '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b',
      '(?:[A-Za-z]:\\\\[^\\s<>"\'）)，。；;]+)',
      // A bare path must not start inside a word: `lost/duplicated/invented`
      // is prose, `/etc/hosts` is a path.
      '(?<![\\w.@-])(?:\\/(?:[\\w.@-]+\\/)+[\\w.@-]*)',
      '(?:\\.{1,2}\\/[\\w.@-]+(?:\\/[\\w.@-]+)*)',
      '@[a-z0-9][\\w.-]*\\/[\\w.-]+',
      '\\bdsh-[a-z0-9][a-z0-9-]*\\b',
      // A relative path with a known extension is one token. Masking only its
      // basename leaves `client/⟦0⟧`, which HY-MT then drops or rewrites.
      '\\b(?:[\\w.@-]+\\/)+[\\w.@-]+\\.(?:mjs|js|ts|tsx|jsx|json|md|ya?ml|toml|lock|log|txt|png|jpe?g|gif|webp|svg|pdf|docx?|xlsx?|csv|zip|tgz|tar|gz|sh|ps1|bat|exe)\\b',
      '\\b[\\w.-]+\\.(?:mjs|js|ts|tsx|jsx|json|md|ya?ml|toml|lock|log|txt|png|jpe?g|gif|webp|svg|pdf|docx?|xlsx?|csv|zip|tgz|tar|gz|sh|ps1|bat|exe)\\b',
      // A hyphenated/dotted all-caps name such as HY-MT1.5-1.8B-GGUF is one
      // product token; masking its pieces separately created four placeholders.
      '\\b[A-Z][A-Z0-9]*(?:[.-][A-Za-z0-9]+)+\\b',
      '\\b[0-9a-f]{7,40}\\b',
      '\\bv?\\d+(?:\\.\\d+){1,3}(?:[-+][0-9A-Za-z.]+|[A-Za-z]+)?\\b',
      '\\b\\d+(?:\\.\\d+)?(?:%|ms|s|m|h|kb|mb|gb|tb|px|k|m|b|d)?\\b',
      '\\b[A-Z][A-Z0-9_]{2,}\\b',
      // snake_case is an identifier; a hyphenated word is only code-like when
      // it carries a digit (gpt-4o, x86-64). Plain prose such as
      // `fail-closed` or `state-of-the-art` must stay translatable.
      '\\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\\b',
      '\\b(?=[a-z0-9-]*\\d)[a-z][a-z0-9]*(?:-[a-z0-9]+)+\\b',
      '\\b[a-z]+[A-Z][A-Za-z0-9]*\\b',
    ]

    function escapeRegExp(text) {
      return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    // A command with a known subcommand must win over the bare product term
    // (e.g. `npm` would otherwise mask only the binary and leave `test`
    // translatable). Arguments are limited to flags and path/version-like
    // tokens so ordinary prose after the command is not swallowed.
    var COMMAND_WITH_ARGS = [
      '\\b(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?(?:test|build|install|ci|add|remove|exec|start|dev|lint|publish|pack|version|audit|update|why|link|unlink)\\b(?:\\s+(?:-{1,2}[\\w-]+|[\\w.-]*[/:.][\\w./:-]+))*',
      '\\bgit\\s+(?:status|log|diff|add|commit|push|pull|checkout|switch|branch|merge|rebase|clone|fetch|show|tag|stash|remote|reset|restore)\\b(?:\\s+(?:-{1,2}[\\w-]+|[\\w.-]*[/:.][\\w./:-]+))*',
      '\\bdocker\\s+(?:run|build|ps|exec|logs|pull|push|compose)\\b(?:\\s+(?:-{1,2}[\\w-]+|[\\w.-]*[/:.][\\w./:-]+))*',
      '\\bkubectl\\s+(?:get|apply|describe|logs|exec|delete|port-forward)\\b(?:\\s+(?:-{1,2}[\\w-]+|[\\w.-]*[/:.][\\w./:-]+))*',
      '\\bcurl\\s+(?:-{1,2}[\\w-]+\\s+)*(?:https?://[^\\s]+)',
    ].join('|')

    function buildProtectRegex(glossary) {
      var terms = PRODUCT_TERMS.slice()
      if (Array.isArray(glossary)) {
        for (var i = 0; i < glossary.length; i += 1) {
          if (typeof glossary[i] === 'string' && glossary[i].trim().length > 0) terms.push(glossary[i])
        }
      }
      terms = terms
        .filter(function (term, index, all) { return all.indexOf(term) === index })
        .sort(function (a, b) { return b.length - a.length })
        .map(escapeRegExp)
      // Word-boundary the terms: without this `bun` matched inside `bundle` and
      // `git` inside `digit`, turning ordinary words into placeholders.
      var bounded = terms.map(function (term) {
        var before = /^[A-Za-z0-9_]/u.test(term) ? '(?<![A-Za-z0-9_])' : ''
        var after = /[A-Za-z0-9_]$/u.test(term) ? '(?![A-Za-z0-9_])' : ''
        return before + term + after
      })
      var parts = ['(?:' + COMMAND_WITH_ARGS + ')', '(?:' + bounded.join('|') + ')'].concat(FIXED_PROTECTED)
      return new RegExp(parts.join('|'), 'g')
    }

    /**
     * Mask protected spans. Returns null when the text has no translatable prose.
     */
    function protectText(text, glossary, format) {
      if (typeof text !== 'string' || text.length === 0) return null
      var regex = buildProtectRegex(glossary)
      var slots = []
      var masked = ''
      var last = 0
      var match
      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) { regex.lastIndex += 1; continue }
        masked += text.slice(last, match.index) + placeholderToken(format, slots.length)
        slots.push(match[0])
        last = match.index + match[0].length
      }
      masked += text.slice(last)
      if (!HAS_LETTERS.test(masked)) return null
      if (masked.trim().length < 2) return null
      return { masked: masked, slots: slots }
    }

    /** Put the protected spans back. Returns null when the model altered a token. */
    function restoreText(text, slots, format) {
      if (typeof text !== 'string') return null
      var expected = []
      for (var i = 0; i < slots.length; i += 1) expected.push(placeholderToken(format, i))
      expected.sort()
      var pattern = placeholderRegExp(format, 'g')
      var actual = (text.match(pattern) || []).slice().sort()
      if (actual.length !== expected.length) return null
      for (var j = 0; j < expected.length; j += 1) if (actual[j] !== expected[j]) return null
      return text.replace(pattern, function (token, index) {
        var slot = slots[Number(index)]
        return slot === undefined ? token : slot
      })
    }

    // ---------------------------------------------------------------------
    // Cache: display-only, bounded, never sent anywhere.
    // ---------------------------------------------------------------------
    var CACHE_KEY = 'harness-lingo-translator:cache:v2'
    var LEGACY_CACHE_KEY = 'dsh-translate:cache:v2'
    var CACHE_MAX = 600

    function hashText(text) {
      var hash = 5381
      for (var i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
      return (hash >>> 0).toString(36)
    }

    function loadCache() {
      var store = {}
      try {
        var raw = window.localStorage.getItem(CACHE_KEY)
        if (!raw) {
          // One-time upgrade path for a profile created before the rename.
          var legacy = window.localStorage.getItem(LEGACY_CACHE_KEY)
          if (legacy) {
            raw = legacy
            try { window.localStorage.setItem(CACHE_KEY, legacy) } catch (error) { /* keep memory copy */ }
          }
        }
        if (raw) store = JSON.parse(raw)
      } catch (error) { /* storage disabled: memory-only */ }
      return store
    }

    function saveCache(store) {
      try {
        var keys = Object.keys(store)
        for (var i = 0; i < keys.length - CACHE_MAX; i += 1) delete store[keys[i]]
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(store))
      } catch (error) { /* quota or disabled: keep memory copy */ }
    }

    // ---------------------------------------------------------------------
    // DOM walk.
    // ---------------------------------------------------------------------
    // Code-like surfaces the app renders outside <pre>/<code>: terminal cards
    // (command + output), read cards, diff blocks, JSON blocks and highlighted
    // code blocks. Their text must never be translated.
    var SKIP_SELECTOR = [
      'script', 'style', 'noscript', 'template', 'textarea', 'input', 'select', 'option',
      'code', 'pre', 'kbd', 'samp', 'var', 'svg', 'math', 'canvas', 'iframe', 'object', 'audio', 'video',
      '[data-harness-lingo-translator-ui]', '[contenteditable="true"]', '[translate="no"]', '[data-no-translate]',
      '[data-terminal]', '[data-command-text]', '[data-read]', '[data-diff]', '[data-json]', '[data-code]',
      // User-authored messages are input, never translated.
      '[data-chat-flow-kind="user"]', '[data-chat-flow-kind="steering"]',
    ].join(',')

    // Streaming blocks and busy containers keep their text out of translation
    // until the Host marks them done (`data-streaming` disappears).
    var STREAMING_SELECTOR = '[data-streaming], [aria-busy="true"]'

    // The translator is strictly scoped to the conversation flow column. The
    // chat view renders its messages into `<div class="EvIC1a_column"
    // data-chat-flow>`; the sidebar, settings page, file viewer, composer and
    // this plugin's own control are outside it and must never be walked. The
    // selector is deliberately exact: translating anything else is a bug.
    var FLOW_SELECTOR = '.EvIC1a_column[data-chat-flow]'

    function nodeText(node) {
      var value = node && node.nodeValue
      return typeof value === 'string' ? value : ''
    }

    /**
     * Whether an element is actually rendered: no hidden/aria-hidden ancestor,
     * no ancestor with display:none or visibility:hidden, and not the body of a
     * closed <details>. Results are memoized for one collection pass.
     */
    function isVisible(element, cache) {
      if (element === null) return false
      var memo = cache.get(element)
      if (memo !== undefined) return memo
      var visible = true
      if (element.closest('[hidden], [aria-hidden="true"]') !== null) {
        visible = false
      } else {
        var view = element.ownerDocument && element.ownerDocument.defaultView
        var style = view && typeof view.getComputedStyle === 'function' ? view.getComputedStyle(element) : null
        if (style !== null && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse')) {
          visible = false
        } else {
          var details = element.closest('details:not([open])')
          if (details !== null) {
            var summary = details.querySelector('summary')
            if (summary === null || !summary.contains(element)) visible = false
          }
        }
      }
      if (visible && element.parentElement !== null) visible = isVisible(element.parentElement, cache)
      cache.set(element, visible)
      return visible
    }

    /**
     * Quoted citations do not count towards the Chinese test, so an English
     * sentence quoting a Chinese phrase still gets translated.
     */
    var QUOTED_SPAN = /“[^”]*”|「[^」]*」|『[^』]*』|‘[^’]*’|"[^"]*"/gu

    /**
     * Whether a text block is already Chinese. Two consecutive non-quoted CJK
     * ideographs mark Chinese content; kana or Hangul keep Japanese/Korean
     * translatable.
     */
    function isChineseText(text) {
      if (/[\u3040-\u30FF\uAC00-\uD7AF]/u.test(text)) return false
      var outsideQuotes = String(text).replace(QUOTED_SPAN, '')
      return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]{2}/u.test(outsideQuotes)
    }

    function isEligible(node, cache) {
      var text = nodeText(node)
      if (text.trim().length < 2) return false
      if (!HAS_LETTERS.test(text)) return false
      if (isChineseText(text)) return false
      var parent = node.parentElement
      if (parent === null) return false
      if (parent.closest(SKIP_SELECTOR) !== null) return false
      if (!isVisible(parent, cache)) return false
      if (parent.closest(STREAMING_SELECTOR) !== null) return false
      return true
    }

    function collectNodes(root) {
      var nodes = []
      if (typeof document === 'undefined' || root === null || root === undefined) return nodes
      var cache = new Map()
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          return isEligible(node, cache) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        },
      })
      var current = walker.nextNode()
      while (current !== null) {
        nodes.push(current)
        current = walker.nextNode()
      }
      return nodes
    }

    /** The conversation flow columns currently rendered on the page. */
    function flowRoots() {
      if (typeof document === 'undefined') return []
      return Array.prototype.slice.call(document.querySelectorAll(FLOW_SELECTOR))
    }

    /**
     * Eligible text nodes inside the conversation flow, never elsewhere. When
     * the chat view is not rendered (no conversation open) this is empty, so
     * the sidebar, settings page and file viewer are left alone.
     */
    function collectFlowNodes() {
      var roots = flowRoots()
      var seen = new Set()
      var nodes = []
      for (var root = 0; root < roots.length; root += 1) {
        var found = collectNodes(roots[root])
        for (var index = 0; index < found.length; index += 1) {
          if (seen.has(found[index])) continue
          seen.add(found[index])
          nodes.push(found[index])
        }
      }
      return nodes
    }

    function splitWhitespace(text) {
      var lead = (text.match(/^\s*/) || [''])[0]
      var trail = (text.match(/\s*$/) || [''])[0]
      return { lead: lead, trail: trail, core: text.slice(lead.length, text.length - trail.length) }
    }

    // ---------------------------------------------------------------------
    // Engine.
    // ---------------------------------------------------------------------
    function createEngine(options) {
      var api = options.api
      var onState = options.onState
      var getWorkspace = typeof options.getWorkspace === 'function' ? options.getWorkspace : null
      var glossary = Array.isArray(options.glossary) ? options.glossary.slice() : []
      var targetLang = options.targetLang || ''
      var batchReasoning = false
      // When the user turns keyword retention off, the source is sent as plain
      // text: no masks, no inline-code unit assembly and no guard clause.
      var placeholderGuard = true
      // Token template from status(); `n` is the slot number, default `[n]`.
      var placeholderFormat = DEFAULT_PLACEHOLDER_FORMAT
      var hoverRestore = true
      var hoverRestoreMs = 200
      var previewing = new Set()
      var previewScope = null
      var hoverTimer = null
      var hoverListening = false
      var state = { enabled: false, working: false, generation: 0, error: null }
      var originals = new Map()
      var displayed = new Map()
      // Cache keys translated during this page session. Re-enabling restores
      // only these; a first start must leave already-visible text untouched.
      var translatedKeys = new Set()
      // Blocks whose height was pinned to max(original, translated). The record
      // keeps the inline `min-height` to put back when translation stops.
      var pinnedHeights = new Map()
      // Text that was already on screen (and rendered) when the switch was
      // turned on. It stays in the original language; only new or newly
      // revealed text is translated.
      var baseline = new WeakMap()
      // React may replace the whole message subtree when a reasoning row
      // expands. Remember baseline strings per chat-flow key as well, so the
      // already-visible parent layer is not treated as new content.
      var baselineTexts = new Map()
      // Per-segment request protection: a segment that keeps failing is retried
      // a bounded number of times (with backoff), never once per mutation.
      var failures = new Map()
      var inFlight = new Set()
      var scanning = false
      var rescan = false
      var FAILURE_LIMIT = 3
      var FAILURE_DELAYS = [5000, 20000, 60000]
      var cache = loadCache()
      var observer = null
      var timer = null
      var configHash = ''
      var workspace = ''
      var pendingCache = new Map()
      var cacheTimer = null
      var flushing = false

      function report() {
        if (typeof onState === 'function') onState({ enabled: state.enabled, working: state.working, error: state.error })
      }

      // The host merges the configured glossary into status(), so terms that
      // must stay verbatim are masked by this half too.
      function setGlossary(terms) {
        glossary = Array.isArray(terms) ? terms.slice() : []
      }

      /**
       * Mask one text node. With keyword retention disabled the original text
       * is returned verbatim with no slots, so the request body stays plain
       * text (no mask tokens and no inline-code placeholders).
       */
      function protect(text) {
        if (!placeholderGuard) {
          if (typeof text !== 'string' || text.length === 0) return null
          if (text.trim().length < 2) return null
          if (!HAS_LETTERS.test(text)) return null
          return { masked: text, slots: [] }
        }
        return protectText(text, glossary, placeholderFormat)
      }

      /**
       * Restore placeholders. With masking off there are no structural
       * placeholders: any mask-like token in the source was ordinary prose,
       * so the translation is accepted as-is instead of being rejected.
       */
      function restoreTranslation(text, slots) {
        if (!placeholderGuard) return typeof text === 'string' ? text : null
        return restoreText(text, slots, placeholderFormat)
      }

      function cacheKey(masked) {
        return configHash + '\u0000' + targetLang + '\u0000' + masked
      }

      /** Remember a segment translated in this page session for re-enable. */
      function rememberTranslated(key) {
        if (typeof key === 'string' && key.length > 0) translatedKeys.add(key)
      }

      function currentSessionId() {
        if (typeof document === 'undefined') return ''
        var el = document.querySelector('[data-conversation-session]')
        return el === null ? '' : String(el.getAttribute('data-conversation-session') || '')
      }

      function messageKeyOf(node) {
        var el = node !== null && node !== undefined && node.parentElement !== null ? node.parentElement.closest('[data-chat-flow-key]') : null
        return el === null ? '' : String(el.getAttribute('data-chat-flow-key') || '')
      }

      /** Schedule the debounced cache write; one timer owns every pending entry. */
      function scheduleCacheFlush(delay) {
        if (cacheTimer !== null) clearTimeout(cacheTimer)
        cacheTimer = setTimeout(function () {
          cacheTimer = null
          flushCache()
        }, delay)
      }

      /** Queue one successful translation for the per-workspace cache document. */
      function queueCache(source, translation, node) {
        if (workspace === '' || configHash === '') return
        if (pendingCache.has(source)) return
        pendingCache.set(source, {
          source: source,
          translation: translation,
          sessionId: currentSessionId(),
          messageKey: messageKeyOf(node),
        })
        if (cacheTimer !== null) return
        scheduleCacheFlush(800)
      }

      function flushCache() {
        if (flushing || workspace === '' || configHash === '' || pendingCache.size === 0) return
        if (typeof api.cacheSave !== 'function') return
        var entries = []
        pendingCache.forEach(function (entry) { entries.push(entry) })
        pendingCache.clear()
        var chunk = entries.slice(0, 500)
        var rest = entries.slice(500)
        for (var r = 0; r < rest.length; r += 1) {
          if (!pendingCache.has(rest[r].source)) pendingCache.set(rest[r].source, rest[r])
        }
        if (chunk.length === 0) return
        flushing = true
        var request = { workspace: workspace, configHash: configHash, entries: chunk }
        // Run the call inside the promise chain: a host that predates the cache
        // invocations throws synchronously from `api.cacheSave`, and that must
        // neither escape the timer nor lose the pending entries.
        Promise.resolve()
          .then(function () { return api.cacheSave(request) })
          .then(function () {
            flushing = false
            // More than 500 pending entries: flush the remainder promptly.
            if (pendingCache.size > 0) scheduleCacheFlush(50)
          }, function () {
            flushing = false
            for (var i = 0; i < chunk.length && pendingCache.size < 500; i += 1) {
              if (!pendingCache.has(chunk[i].source)) pendingCache.set(chunk[i].source, chunk[i])
            }
            // Do not retry in a tight loop: an unavailable cache must not be
            // hammered. The next translation or stop() retries the entries.
          })
      }

      var THINK_SUMMARY_MAX = 160

      /** A collapsed reasoning row: its visible summary is the first paragraph excerpt. */
      function collapsedThinkRow(node) {
        var parent = node.parentElement
        if (parent === null || typeof parent.closest !== 'function') return null
        var row = parent.closest('[data-variant="think"]')
        if (row === null) return null
        return row.hasAttribute('data-expanded') ? null : row
      }

      function applyValue(node, original, translation) {
        var parts = splitWhitespace(original)
        var text = translation
        if (collapsedThinkRow(node) !== null && text.length > THINK_SUMMARY_MAX) {
          text = text.slice(0, THINK_SUMMARY_MAX).trim() + '…'
        }
        var value = parts.lead + text + parts.trail
        originals.set(node, original)
        displayed.set(node, value)
        if (node.nodeValue !== value) node.nodeValue = value
      }

      function rememberFailure(key) {
        var current = failures.get(key)
        var count = current === undefined ? 1 : current.count + 1
        var delay = FAILURE_DELAYS[Math.min(count - 1, FAILURE_DELAYS.length - 1)]
        failures.set(key, { count: count, nextAt: Date.now() + delay })
      }

      var GROUP_BLOCK_SELECTOR = 'p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, figcaption'

      /** The paragraph-like block that owns a text node. */
      function groupBlockOf(node) {
        var parent = node.parentElement
        if (parent === null || typeof parent.closest !== 'function') return null
        return parent.closest(GROUP_BLOCK_SELECTOR)
      }

      // Height pinning only needs the nearest block-level ancestor of a
      // translated text node: the paragraph/div whose wrapping changes when the
      // text length changes. Falls back to these tags when the layout style is
      // unavailable (detached nodes and non-browser DOM implementations).
      var HEIGHT_BLOCK_SELECTOR = GROUP_BLOCK_SELECTOR + ', div, section, article, aside, header, footer, main, nav, figure, form, fieldset, button, label, summary'

      /** The nearest rendered block ancestor of a text node, or null. */
      function heightBlockOf(node) {
        var element = node !== null && node !== undefined ? node.parentElement : null
        if (element === null) return null
        var doc = element.ownerDocument
        var view = doc !== null && doc !== undefined ? doc.defaultView : null
        while (element !== null && element !== doc.body && element !== doc.documentElement) {
          var display = ''
          if (view !== null && view !== undefined && typeof view.getComputedStyle === 'function') {
            try {
              display = view.getComputedStyle(element).display
            } catch (error) {
              display = ''
            }
          }
          if (display === 'none') return null
          // An inline box has no usable height of its own; keep walking up to
          // the paragraph/div that actually wraps the line.
          if (display !== '' && display !== 'inline' && display !== 'contents') return element
          if (display === '' && typeof element.matches === 'function' && element.matches(HEIGHT_BLOCK_SELECTOR)) return element
          element = element.parentElement
        }
        return null
      }

      /** Rendered content-box height of one block, in CSS pixels. */
      function blockHeight(element) {
        if (element === null || element === undefined || element.isConnected === false) return 0
        // Prefer the layout height over the transformed rect: `min-height`
        // participates in layout, not in a CSS transform.
        var height = typeof element.offsetHeight === 'number' && element.offsetHeight > 0 ? element.offsetHeight : 0
        if (!(height > 0) && typeof element.getBoundingClientRect === 'function') {
          try {
            var rect = element.getBoundingClientRect()
            if (rect !== null && rect !== undefined && typeof rect.height === 'number' && rect.height > 0) height = rect.height
          } catch (error) {
            height = 0
          }
        }
        if (!(height > 0)) return 0
        var doc = element.ownerDocument
        var view = doc !== null && doc !== undefined ? doc.defaultView : null
        if (view !== null && view !== undefined && typeof view.getComputedStyle === 'function') {
          var style = null
          try {
            style = view.getComputedStyle(element)
          } catch (error) {
            style = null
          }
          // `min-height` is a content-box value unless the page uses
          // border-box; subtract padding and borders from the border-box rect
          // so pinning does not add the same padding twice.
          if (style !== null && style.boxSizing !== 'border-box') {
            var vertical = 0
            var names = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
            for (var index = 0; index < names.length; index += 1) {
              var value = parseFloat(style[names[index]])
              if (value > 0) vertical += value
            }
            height = Math.max(0, height - vertical)
          }
        }
        return height
      }

      /** Put the page's own inline `min-height` back for one pinned block. */
      function restoreBlockHeight(element, record) {
        if (element.style === null || element.style === undefined) return
        if (record.value === '') element.style.removeProperty('min-height')
        else element.style.setProperty('min-height', record.value, record.priority)
      }

      /** Set one pinned block to `height`; 0 restores the page's own value. */
      function setBlockHeight(element, record, height) {
        record.height = height > 0 ? height : 0
        if (element.style === null || element.style === undefined) return
        if (height > 0) element.style.setProperty('min-height', height + 'px', record.priority || '')
        else restoreBlockHeight(element, record)
      }

      /**
       * Run one text change and pin its block to the larger of the original and
       * the current rendered height. A block with several translated text nodes
       * is measured with its previous pin removed, so a tall intermediate
       * translation cannot leave the final block taller than either the
       * original or the finished translation.
       */
      function withBlockHeight(node, mutate) {
        var block = heightBlockOf(node)
        if (block === null) {
          mutate()
          return
        }
        var record = pinnedHeights.get(block)
        if (record === undefined) {
          record = {
            value: block.style !== null && block.style !== undefined ? block.style.getPropertyValue('min-height') : '',
            priority: block.style !== null && block.style !== undefined ? block.style.getPropertyPriority('min-height') : '',
            original: blockHeight(block),
            height: 0,
          }
          pinnedHeights.set(block, record)
        } else {
          restoreBlockHeight(block, record)
        }
        mutate()
        setBlockHeight(block, record, Math.max(record.original, blockHeight(block)))
      }

      /** Apply one translated value while keeping the owning block's height. */
      function applyValueWithHeight(node, original, translation) {
        withBlockHeight(node, function () {
          applyValue(node, original, translation)
        })
      }

      function offsetPlaceholders(masked, offset, format) {
        if (offset === 0) return masked
        return masked.replace(placeholderRegExp(format, 'g'), function (token, index) {
          return placeholderToken(format, Number(index) + offset)
        })
      }

      /**
       * Build one translation unit for a block with inline code: prose text
       * nodes become parts, each inline code becomes a placeholder. Returns null
       * when the block has no inline code or any part is not translatable.
       */
      function buildUnit(block) {
        // Without placeholders there is no way to split the prose back around
        // inline code; the paragraph's text nodes are translated separately.
        if (!placeholderGuard) return null
        var items = []
        var cache = new Map()
        var rejected = false
        function visit(node) {
          if (rejected) return
          if (node.nodeType === 3) {
            if (node.nodeValue.trim().length === 0) return
            if (!isEligible(node, cache)) { rejected = true; return }
            var protectedText = protect(node.nodeValue)
            if (protectedText === null) { rejected = true; return }
            items.push({ kind: 'text', node: node, original: node.nodeValue, masked: protectedText.masked, slots: protectedText.slots })
            return
          }
          if (node.nodeType !== 1) return
          if (node.matches('code, kbd, samp') && (node.closest('pre') === null)) {
            var codeText = node.textContent || ''
            if (codeText.trim().length > 0) items.push({ kind: 'code', text: codeText })
            return
          }
          if (node.closest(SKIP_SELECTOR) !== null) return
          for (var child = node.firstChild; child !== null; child = child.nextSibling) visit(child)
        }
        for (var child = block.firstChild; child !== null; child = child.nextSibling) visit(child)
        if (rejected) return null
        var parts = []
        var codes = []
        var slots = []
        var combined = ''
        for (var index = 0; index < items.length; index += 1) {
          var item = items[index]
          if (item.kind === 'text') {
            combined += offsetPlaceholders(item.masked, slots.length, placeholderFormat)
            parts.push({ node: item.node, original: item.original, slotStart: slots.length, slotCount: item.slots.length })
            for (var slot = 0; slot < item.slots.length; slot += 1) slots.push(item.slots[slot])
          } else {
            codes.push(slots.length)
            combined += placeholderToken(placeholderFormat, slots.length)
            slots.push(item.text)
          }
        }
        if (parts.length < 2 || codes.length < 1) return null
        return { block: block, masked: combined, slots: slots, codeIndices: codes, parts: parts }
      }

      /** Split a unit translation at the inline-code placeholders (order checked). */
      function splitUnitTranslation(translated, codeIndices, format) {
        var fragments = []
        var last = 0
        var seen = 0
        var pattern = placeholderRegExp(format, 'g')
        var match
        while ((match = pattern.exec(translated)) !== null) {
          var index = Number(match[1])
          if (codeIndices.indexOf(index) === -1) continue
          if (codeIndices[seen] !== index) return null
          fragments.push(translated.slice(last, match.index))
          last = match.index + match[0].length
          seen += 1
        }
        if (seen !== codeIndices.length) return null
        fragments.push(translated.slice(last))
        return fragments
      }

      /** Restore one part's own placeholders (inline-code placeholders were split out). */
      function restorePart(text, slots, slotStart, slotCount, format) {
        if (typeof text !== 'string') return null
        var expected = []
        for (var index = 0; index < slotCount; index += 1) expected.push(placeholderToken(format, slotStart + index))
        expected.sort()
        var pattern = placeholderRegExp(format, 'g')
        var actual = (text.match(pattern) || []).slice().sort()
        if (actual.length !== expected.length) return null
        for (var check = 0; check < expected.length; check += 1) if (actual[check] !== expected[check]) return null
        return text.replace(pattern, function (token, index) {
          var slot = slots[Number(index)]
          return slot === undefined ? token : slot
        })
      }

      /** Apply one translated unit to its prose text nodes. */
      function applyUnit(unit, translated) {
        if (unit.parts.length === 0) return false
        var fragments = splitUnitTranslation(translated, unit.codeIndices, placeholderFormat)
        if (fragments === null || fragments.length !== unit.parts.length) return false
        var values = []
        for (var index = 0; index < unit.parts.length; index += 1) {
          var part = unit.parts[index]
          if (!part.node.isConnected || nodeText(part.node) !== part.original) return false
          var restored = restorePart(fragments[index], unit.slots, part.slotStart, part.slotCount, placeholderFormat)
          if (restored === null || (part.original.trim().length > 0 && restored.trim().length === 0)) return false
          values.push(restored)
        }
        withBlockHeight(unit.parts[0].node, function () {
          for (var apply = 0; apply < unit.parts.length; apply += 1) {
            applyValue(unit.parts[apply].node, unit.parts[apply].original, values[apply])
          }
        })
        rememberTranslated(cacheKey(unit.masked))
        return true
      }

      /** Units that can be translated as one paragraph (inline code placeholders). */
      function collectUnits(nodes, ignoreState) {
        var cache = new Map()
        var grouped = new Set()
        var units = []
        var blocks = new Map()
        for (var index = 0; index < nodes.length; index += 1) {
          var node = nodes[index]
          var block = groupBlockOf(node)
          if (block === null) continue
          var unit = blocks.get(block)
          if (unit === undefined) {
            unit = buildUnit(block)
            blocks.set(block, unit)
          }
          if (unit === null || grouped.has(node)) continue
          if (ignoreState !== true) {
            var eligible = true
            for (var part = 0; part < unit.parts.length; part += 1) {
              var partNode = unit.parts[part].node
              var original = nodeText(partNode)
              if (displayed.get(partNode) === original || previewing.has(partNode)) { eligible = false; break }
              if (isBaselineText(partNode, original)) { eligible = false; break }
            }
            if (!eligible) continue
          }
          units.push(unit)
          for (var mark = 0; mark < unit.parts.length; mark += 1) grouped.add(unit.parts[mark].node)
        }
        return { units: units, grouped: grouped }
      }

      function collectPending() {
        var pending = []
        var byKey = new Map()
        var now = Date.now()
        var nodes = collectFlowNodes()
        var unitInfo = collectUnits(nodes)
        var grouped = unitInfo.grouped
        for (var u = 0; u < unitInfo.units.length; u += 1) {
          var unit = unitInfo.units[u]
          var unitKey = cacheKey(unit.masked)
          if (inFlight.has(unitKey)) continue
          var unitFailure = failures.get(unitKey)
          if (unitFailure !== undefined && (unitFailure.count >= FAILURE_LIMIT || unitFailure.nextAt > now)) continue
          var unitHit = cache[unitKey]
          if (typeof unitHit === 'string') {
            if (applyUnit(unit, unitHit)) {
              failures.delete(unitKey)
              continue
            }
          }
          var unitEntry = { key: unitKey, masked: unit.masked, slots: unit.slots, unit: unit, nodes: unit.parts.map(function (part) { return { node: part.node, original: part.original } }) }
          byKey.set(unitKey, unitEntry)
          pending.push(unitEntry)
          if (pending.length >= 240) break
        }
        for (var i = 0; i < nodes.length; i += 1) {
          var node = nodes[i]
          if (grouped.has(node)) continue
          var original = nodeText(node)
          var applied = displayed.get(node)
          if (applied !== undefined && applied === original) continue
          if (previewing.has(node)) continue
          // React re-renders a text node it controls (expanding a reasoning row
          // does this), writing the original back. Re-apply our translation
          // without a request instead of trusting the baseline.
          var storedOriginal = originals.get(node)
          if (storedOriginal !== undefined && storedOriginal === original) {
            if (applied !== undefined && applied !== original) {
              withBlockHeight(node, function () { node.nodeValue = applied })
            }
            continue
          }
          if (isBaselineText(node, original)) continue
          var protectedText = protect(original)
          if (protectedText === null) continue
          var key = cacheKey(protectedText.masked)
          if (inFlight.has(key)) continue
          var failure = failures.get(key)
          if (failure !== undefined && (failure.count >= FAILURE_LIMIT || failure.nextAt > now)) continue
          var hit = cache[key]
          if (typeof hit === 'string') {
            var restored = restoreTranslation(hit, protectedText.slots)
            if (restored !== null) {
              failures.delete(key)
              rememberTranslated(key)
              applyValueWithHeight(node, original, restored)
              continue
            }
          }
          var existing = byKey.get(key)
          if (existing !== undefined) {
            existing.nodes.push({ node: node, original: original })
            continue
          }
          var entry = { key: key, masked: protectedText.masked, slots: protectedText.slots, nodes: [{ node: node, original: original }] }
          byKey.set(key, entry)
          pending.push(entry)
          if (pending.length >= 240) break
        }
        return pending
      }

      /** The reasoning block a node belongs to, when the app marks one. */
      function thinkingContainer(node) {
        var element = node.parentElement
        return element !== null && typeof element.closest === 'function' ? element.closest('[data-variant="think"]') : null
      }

      /**
       * One unit per reasoning block when batching is on, one unit per segment
       * otherwise. Units keep the order of their first entry.
       */
      function pendingUnits(pending) {
        if (!batchReasoning) return pending.map(function (entry) { return [entry] })
        var groups = new Map()
        var units = []
        for (var i = 0; i < pending.length; i += 1) {
          var entry = pending[i]
          var container = null
          for (var n = 0; n < entry.nodes.length; n += 1) {
            container = thinkingContainer(entry.nodes[n].node)
            if (container !== null) break
          }
          if (container === null) {
            units.push([entry])
            continue
          }
          var list = groups.get(container)
          if (list === undefined) {
            list = []
            groups.set(container, list)
            units.push(list)
          }
          list.push(entry)
        }
        return units
      }

      async function translatePending(pending, generation) {
        if (pending.length === 0) return
        state.working = true
        state.error = null
        report()
        var chunkSize = 40
        var chunks = []
        var units = pendingUnits(pending)
        for (var u = 0; u < units.length; u += 1) {
          var unit = units[u]
          var batchUnit = batchReasoning && unit.length > 1
          for (var offset = 0; offset < unit.length; offset += chunkSize) {
            chunks.push({ entries: unit.slice(offset, offset + chunkSize), batch: batchUnit })
          }
        }
        try {
          for (var c = 0; c < chunks.length; c += 1) {
            if (generation !== state.generation) return
            var chunk = chunks[c].entries
            var batch = chunks[c].batch && chunk.length > 1
            for (var mark = 0; mark < chunk.length; mark += 1) inFlight.add(chunk[mark].key)
            var segments = chunk.map(function (entry) { return entry.masked })
            var result
            try {
              result = await api.translate(targetLang, segments, batch)
            } catch (error) {
              for (var failedKey = 0; failedKey < chunk.length; failedKey += 1) rememberFailure(chunk[failedKey].key)
              state.error = error instanceof Error ? error.message : String(error)
              break
            } finally {
              for (var release = 0; release < chunk.length; release += 1) inFlight.delete(chunk[release].key)
            }
            if (generation !== state.generation) return
            var translations = result.translations || []
            var failed = new Set(result.failed || [])
            for (var index = 0; index < chunk.length; index += 1) {
              var entry = chunk[index]
              if (entry.unit) {
                if (failed.has(index) || !applyUnit(entry.unit, translations[index])) {
                  rememberFailure(entry.key)
                  continue
                }
                failures.delete(entry.key)
                cache[entry.key] = translations[index]
                queueCache(entry.masked, translations[index], entry.unit.parts.length > 0 ? entry.unit.parts[0].node : null)
                continue
              }
              var restored = failed.has(index) ? null : restoreTranslation(translations[index], entry.slots)
              if (restored === null) {
                rememberFailure(entry.key)
                continue
              }
              failures.delete(entry.key)
              rememberTranslated(entry.key)
              cache[entry.key] = translations[index]
              queueCache(entry.masked, translations[index], entry.nodes.length > 0 ? entry.nodes[0].node : null)
              for (var n = 0; n < entry.nodes.length; n += 1) {
                var target = entry.nodes[n]
                if (target.node.isConnected && nodeText(target.node) === target.original) {
                  applyValueWithHeight(target.node, target.original, restored)
                }
              }
            }
            if (typeof result.error === 'string' && result.error.length > 0) state.error = result.error
          }
        } finally {
          saveCache(cache)
          state.working = false
          report()
        }
      }

      async function scan() {
        if (!state.enabled) return
        if (scanning) {
          // A scan is already running; fold this trigger into one follow-up scan
          // instead of starting a second, duplicate request batch.
          rescan = true
          return
        }
        scanning = true
        var generation = state.generation
        try {
          var pending = collectPending()
          if (pending.length > 0) await translatePending(pending, generation)
        } catch (error) {
          state.error = error instanceof Error ? error.message : String(error)
          state.working = false
          report()
        } finally {
          scanning = false
          if (rescan) {
            rescan = false
            schedule()
          }
        }
      }

      function schedule() {
        if (!state.enabled) return
        var wait = 350
        if (timer !== null) clearTimeout(timer)
        timer = setTimeout(function () {
          timer = null
          scan().catch(function () { /* reported inside scan */ })
        }, wait)
      }

      // The block that owns a hovered element: a leading icon and its text share
      // this ancestor, while an outer message container is never chosen because
      // the closest block is the paragraph itself.
      var HOVER_BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, dt, dd, figcaption, pre, div'

      /** Translated text nodes inside a scope, optionally only its direct children. */
      function nodesInside(scope, directOnly) {
        var nodes = []
        originals.forEach(function (original, node) {
          if (!node.isConnected) return
          if (directOnly ? node.parentElement === scope : scope.contains(node)) nodes.push(node)
        })
        return nodes
      }

      /** One text block: every node in it shares the same direct parent element. */
      function singleParent(nodes) {
        if (nodes.length === 0) return false
        var parent = nodes[0].parentElement
        for (var i = 1; i < nodes.length; i += 1) if (nodes[i].parentElement !== parent) return false
        return true
      }

      /**
       * The block to preview for a hovered element: its closest block ancestor
       * when that block holds exactly one translated text block, otherwise only
       * the hovered element's own text nodes. This includes a leading icon but
       * never pulls in a neighbouring paragraph.
       */
      function previewBlock(element) {
        if (element === null || element === undefined) return null
        var block = typeof element.closest === 'function' ? element.closest(HOVER_BLOCK_SELECTOR) : null
        if (block !== null) {
          var blockNodes = nodesInside(block, false)
          if (singleParent(blockNodes)) return { scope: block, nodes: blockNodes }
        }
        var direct = nodesInside(element, true)
        if (direct.length > 0) return { scope: element, nodes: direct }
        return null
      }

      function clearHoverPreview() {
        if (previewing.size === 0) {
          previewScope = null
          return
        }
        previewing.forEach(function (node) {
          var value = displayed.get(node)
          if (value !== undefined && originals.has(node) && node.isConnected) node.nodeValue = value
        })
        previewing.clear()
        previewScope = null
      }

      function showHoverOriginal(element) {
        if (!state.enabled || !hoverRestore || element === null || element === undefined || !element.isConnected) return
        var block = previewBlock(element)
        if (block === null) return
        previewScope = block.scope
        for (var i = 0; i < block.nodes.length; i += 1) {
          var node = block.nodes[i]
          var original = originals.get(node)
          if (original === undefined) continue
          if (node.nodeValue !== original) node.nodeValue = original
          previewing.add(node)
        }
      }

      function onHoverMove(event) {
        if (!state.enabled || !hoverRestore) return
        var target = event.target
        // Moving inside the block that is currently previewed keeps the
        // original text; only leaving the block restores the translation.
        if (previewScope !== null && target !== null && target !== undefined && previewScope.contains(target)) return
        clearHoverPreview()
        if (hoverTimer !== null) clearTimeout(hoverTimer)
        if (target === null || target === undefined) return
        if (hoverRestoreMs <= 0) {
          hoverTimer = null
          showHoverOriginal(target)
          return
        }
        hoverTimer = setTimeout(function () {
          hoverTimer = null
          showHoverOriginal(target !== null && target !== undefined && target.isConnected ? target : null)
        }, hoverRestoreMs)
      }

      function clearHoverTimer() {
        if (hoverTimer !== null) clearTimeout(hoverTimer)
        hoverTimer = null
      }

      function onHoverLeave() {
        clearHoverTimer()
        clearHoverPreview()
      }

      function startHover() {
        if (hoverListening || typeof document === 'undefined') return
        hoverListening = true
        document.addEventListener('mousemove', onHoverMove, { passive: true })
        document.addEventListener('mouseleave', onHoverLeave)
        document.addEventListener('scroll', onHoverLeave, true)
      }

      function stopHover() {
        if (hoverListening) {
          hoverListening = false
          document.removeEventListener('mousemove', onHoverMove)
          document.removeEventListener('mouseleave', onHoverLeave)
          document.removeEventListener('scroll', onHoverLeave, true)
        }
        clearHoverTimer()
        clearHoverPreview()
      }

      function startObserver() {
        if (observer !== null || typeof MutationObserver === 'undefined') return
        observer = new MutationObserver(function () { schedule() })
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'open', 'hidden', 'aria-hidden', 'aria-busy', 'data-streaming', 'data-expanded'],
        })
      }

      function stopObserver() {
        if (observer !== null) observer.disconnect()
        observer = null
        if (timer !== null) clearTimeout(timer)
        timer = null
      }

      function restoreAll() {
        originals.forEach(function (original, node) {
          if (node.isConnected && nodeText(node) !== original) node.nodeValue = original
        })
        originals.clear()
        displayed.clear()
        pinnedHeights.forEach(function (record, element) {
          restoreBlockHeight(element, record)
        })
        pinnedHeights.clear()
      }

      /** Stable baseline group: the chat-flow key, else the prose block. */
      function baselineGroupOf(node) {
        var element = node !== null && node !== undefined ? node.parentElement : null
        if (element === null) return null
        var flow = typeof element.closest === 'function' ? element.closest('[data-chat-flow-key]') : null
        if (flow !== null) return 'flow:' + String(flow.getAttribute('data-chat-flow-key') || '')
        return groupBlockOf(node) || element
      }

      function rememberBaselineText(node, text) {
        var group = baselineGroupOf(node)
        if (group === null) return
        var texts = baselineTexts.get(group)
        if (texts === undefined) {
          texts = new Set()
          baselineTexts.set(group, texts)
        }
        texts.add(text)
      }

      /**
       * Baseline by node identity, or by identical text inside the same chat
       * flow after React replaced the original node.
       */
      function isBaselineText(node, original) {
        if (baseline.get(node) === original) return true
        var group = baselineGroupOf(node)
        if (group === null) return false
        var texts = baselineTexts.get(group)
        if (texts === undefined || !texts.has(original)) return false
        baseline.set(node, original)
        return true
      }

      function markBaseline() {
        baseline = new WeakMap()
        baselineTexts = new Map()
        var nodes = collectFlowNodes()
        for (var i = 0; i < nodes.length; i += 1) {
          var text = nodeText(nodes[i])
          baseline.set(nodes[i], text)
          rememberBaselineText(nodes[i], text)
        }
      }

      /** Re-apply cached translations so a re-enabled switch shows them again. */
      function reapplyCached() {
        if (translatedKeys.size === 0) return
        var nodes = collectFlowNodes()
        var unitInfo = collectUnits(nodes, true)
        for (var u = 0; u < unitInfo.units.length; u += 1) {
          var unit = unitInfo.units[u]
          var unitKey = cacheKey(unit.masked)
          if (!translatedKeys.has(unitKey)) continue
          var unitHit = cache[unitKey]
          if (typeof unitHit === 'string') applyUnit(unit, unitHit)
        }
        for (var i = 0; i < nodes.length; i += 1) {
          var node = nodes[i]
          if (unitInfo.grouped.has(node)) continue
          if (displayed.has(node)) continue
          var original = nodeText(node)
          var protectedText = protect(original)
          if (protectedText === null) continue
          var key = cacheKey(protectedText.masked)
          if (!translatedKeys.has(key)) continue
          var hit = cache[key]
          if (typeof hit !== 'string') continue
          var restored = restoreTranslation(hit, protectedText.slots)
          if (restored === null) continue
          applyValueWithHeight(node, original, restored)
        }
      }

      var starting = false

      async function start() {
        if (state.enabled || starting) return
        starting = true
        try {
          state.generation += 1
          state.error = null
          state.working = false
          failures = new Map()
          inFlight = new Set()
          scanning = false
          rescan = false
          // Snapshot before the status probe: text rendered during that await is
          // already "after the switch", so it must be translated.
          markBaseline()
          var status
          try {
            status = await api.status()
          } catch (error) {
            baseline = new WeakMap()
            state.error = error instanceof Error ? error.message : String(error)
            report()
            return
          }
          if (!status.ready) {
            baseline = new WeakMap()
            state.error = status.reason || 'the local translation service is unavailable'
            report()
            return
          }
          setGlossary(status.glossary)
          batchReasoning = status.batchReasoning === true
          placeholderGuard = status.placeholderGuard !== false
          placeholderFormat = normalizePlaceholderFormat(status.placeholderFormat)
          hoverRestore = status.hoverRestore === true
          hoverRestoreMs = Number.isInteger(status.hoverRestoreMs) ? status.hoverRestoreMs : 200
          if (targetLang === '') targetLang = status.targetLang || ''
          if (targetLang === '') {
            baseline = new WeakMap()
            state.error = 'target language is empty; set targetLang in the plugin config'
            report()
            return
          }
          configHash = typeof status.configHash === 'string' ? status.configHash : ''
          workspace = getWorkspace === null ? '' : String(getWorkspace() || '')
          if (workspace === '' && typeof api.sessionWorkspace === 'function') {
            var sessionId = currentSessionId()
            if (sessionId !== '') {
              try {
                var resolved = await api.sessionWorkspace({ sessionId: sessionId })
                if (resolved !== null && resolved !== undefined && typeof resolved.path === 'string' && resolved.path.startsWith('/')) {
                  workspace = resolved.path
                }
              } catch (error) {
                // The host session header is optional; the session store fallback may have failed.
              }
            }
          }
          state.enabled = true
          report()
          if (workspace !== '' && configHash !== '' && typeof api.cacheLoad === 'function') {
            try {
              var loaded = await api.cacheLoad({ workspace: workspace, configHash: configHash })
              if (loaded !== null && loaded !== undefined && loaded.entries !== null && typeof loaded.entries === 'object') {
                for (var source in loaded.entries) {
                  if (Object.prototype.hasOwnProperty.call(loaded.entries, source) && typeof loaded.entries[source] === 'string') {
                    cache[cacheKey(source)] = loaded.entries[source]
                  }
                }
              }
            } catch (error) {
              // Cache is an optimization; translation still works without it.
            }
          }
          reapplyCached()
          startObserver()
          startHover()
          // Catch anything that appeared while the status probe was in flight.
          schedule()
        } finally {
          starting = false
        }
      }

      function stop() {
        if (cacheTimer !== null) clearTimeout(cacheTimer)
        cacheTimer = null
        flushCache()
        state.generation += 1
        state.enabled = false
        state.working = false
        stopObserver()
        stopHover()
        restoreAll()
        baseline = new WeakMap()
        failures = new Map()
        inFlight = new Set()
        scanning = false
        rescan = false
        report()
      }

      async function toggle() {
        if (state.enabled) stop()
        else await start()
      }

      return {
        toggle: toggle,
        start: start,
        stop: stop,
        setGlossary: setGlossary,
        dispose: function () { stop() },
        state: function () { return { enabled: state.enabled, working: state.working, error: state.error } },
      }
    }

    // ---------------------------------------------------------------------
    // UI: one floating control, excluded from translation by its attribute.
    // ---------------------------------------------------------------------
    var NS = 'translate'
    var DICTS = {
      zh: {
        idle: '自动翻译：关',
        on: '自动翻译：开',
        working: '翻译中…（点击关闭）',
        title: '开启后，新生成的内容在该语块生成完成后自动翻译；折叠的内容不翻译，展开时才翻译；开启前已显示的内容保持原文',
        'settings.summary': '本地服务或系统模型的翻译设置',
        'settings.tab.connection': '连接',
        'settings.tab.translation': '翻译',
        'settings.tab.hover': '悬停',
        'settings.tab.cache': '翻译缓存',
        'settings.customService': '自定义服务',
        'settings.customServiceHint': '使用本地 OpenAI 兼容翻译服务（HY-MT 等）。',
        'settings.systemModel': '系统模型',
        'settings.systemModelHint': '使用当前会话最近一次请求的 provider/model（DSH 模型）翻译，不访问本地服务；没有路由时请先在会话里发一条消息。',
        'settings.systemPromptHint': '系统模型使用内置 JSON 翻译提示词；并发数、翻译提示词头和关键词保留仅自定义服务生效。',
        'settings.cacheDir': '默认保存目录',
        'settings.cacheDirHint': '每个工作区一份 JSON 文档，按配置哈希 + 遮罩原文存放译文；不写工作区。',
        'settings.cacheCopy': '复制路径',
        'settings.cachePrune': '清理已删除对话的缓存',
        'settings.cachePruneHint': '只删除会话 ID 已不在 DSH 会话列表中的缓存条目；仍存在的对话不受影响。',
        'settings.cachePruned': '已清理 {removed} 条缓存（{files} 个文件）。',
        'settings.cacheNoSessions': '未读取到 DSH 会话列表，已取消清理。',
        'settings.cacheCopied': '路径已复制。',
        'settings.cacheFailed': '清理失败：',
        'settings.address': '服务地址',
        'settings.addressHint': '局域网内可访问的 OpenAI 兼容地址，需带 /v1 版本段，例如 http://192.168.1.10:8080/v1。',
        'settings.model': '模型名',
        'settings.modelHint': 'llama.cpp 可填任意值；vLLM 需与 --served-model-name 一致。',
        'settings.concurrency': '并发数',
        'settings.concurrencyHint': '同时向本地服务发起的请求数（1–16）；单实例 / JIT 加载建议 1–2。',
        'settings.batchReasoning': '长思考合并请求',
        'settings.batchReasoningHint': '把同一段思考/推理里的多个语块合并成一次请求，减少长思考的请求数；保存后重新开关一次「自动翻译」生效。',
        'settings.promptHeader': '翻译提示词头',
        'settings.promptHeaderPlaceholder': '留空使用内置模板',
        'settings.promptHeaderHint': '作为每次翻译的指令句（逐段与合并请求都生效），可用 {target_language}、{target_lang}；默认值只用于中文目标，翻其它语言请改成对应语言的指令，留空使用内置模板。保存后下一次翻译立即生效。',
        'settings.placeholderGuard': '关键词保留',
        'settings.placeholderGuardHint': '勾选后遮罩原文中的特殊引用内容，翻译完成后替换回原内容以保证准确；取消勾选则直接发送纯文本原文、不使用遮罩。关键词保留对模型能力要求较高，可能需要更高的模型智商；保存后重新开关一次「自动翻译」生效。',
        'settings.placeholderFormat': '遮罩格式',
        'settings.placeholderFormatPlaceholder': '[n]',
        'settings.placeholderFormatHint': '用 n 代表编号，例如 [n]、{{n}}、⟦n⟧；默认 [n]。保存后重新开关一次「自动翻译」生效。',
        'settings.placeholderHint': '自定义关键词保留提示词',
        'settings.placeholderHintPlaceholder': '留空使用内置句子',
        'settings.placeholderHintHint': '填写后替换内置提示词；留空使用内置句子。',
        'settings.hoverRestore': '悬停显示原文',
        'settings.hoverRestoreHint': '自动翻译开启时，鼠标在译文上静止悬停一段时间后显示该语块原文；鼠标一动就恢复译文。保存后重新开关一次「自动翻译」生效。',
        'settings.hoverRestoreMs': '悬停时长（毫秒）',
        'settings.hoverRestoreMsHint': '0–60000 毫秒；0 = 鼠标移到文字上立即显示原文；默认 200。',
        'settings.token': 'API 令牌',
        'settings.tokenHint': '服务要求鉴权时填写（Bearer）。留空表示保持当前令牌不变；已保存的令牌不会回显。',
        'settings.tokenPlaceholder': '留空 = 不修改',
        'settings.save': '保存',
        'settings.saving': '保存中…',
        'settings.saved': '已保存，立即生效。',
        'settings.rejected': '保存被拒绝：宿主没有接受这次配置写入（该字段可能已不再可写，或宿主仍是旧版本）；请刷新页面，必要时重启 DSH 后重试。',
        'settings.invalid': '请检查：地址需 http(s):// 开头，模型名不能为空，并发数需为 1–16 的整数，遮罩格式需包含 n（例如 [n]）。',
        'settings.unchanged': '没有改动。',
        'settings.failed': '保存失败：',
        'settings.loading': '正在读取配置…',
        'settings.unavailable': '当前部署没有为本插件提供可修改的配置表单，请改 profile 的 cordis.patch.yml。',
        'settings.notWritable': '当前 profile 不接受配置写入。',
        'error.cannotReach': '无法连接翻译服务：{detail}',
        'error.unavailable': '本地翻译服务不可用。',
        'error.noLlm': '当前部署没有挂载 llm 服务。',
        'error.noRoute': '没有可用的模型路由：请先在会话里发一条消息。',
        'error.noTargetLanguage': '目标语言为空：请在插件配置里设置 targetLang。',
        'error.emptyEndpoint': '翻译服务没有返回内容。',
        'error.notJson': '翻译服务返回的不是有效 JSON。',
        'error.emptyTranslation': '翻译结果为空，已保留原文。',
        'error.placeholder': '译文丢失、重复或新增了占位符，已保留原文。',
        'error.timeout': '翻译请求超时。',
        'error.cancelled': '翻译已取消。',
        'error.http': '翻译服务返回错误：{detail}',
        'error.generic': '翻译失败：{detail}',
        'stopWhileWorking': '翻译中…点击可关闭自动翻译',
      },
      en: {
        idle: 'Auto-translate: off',
        on: 'Auto-translate: on',
        working: 'Translating… (click to turn off)',
        title: 'When on, new text is translated after its block finishes generating; collapsed text stays original until expanded; content already shown when enabled stays original',
        'settings.summary': 'Local endpoint or system-model translation settings',
        'settings.tab.connection': 'Connection',
        'settings.tab.translation': 'Translation',
        'settings.tab.hover': 'Hover',
        'settings.tab.cache': 'Translation cache',
        'settings.customService': 'Custom service',
        'settings.customServiceHint': 'Use a local OpenAI-compatible translation service (HY-MT etc.).',
        'settings.systemModel': 'System model',
        'settings.systemModelHint': 'Use the newest request/header provider/model from the current session (the DSH model) and never call the local service; send one message first when no route exists.',
        'settings.systemPromptHint': 'The system model uses the built-in JSON translation prompt; concurrency, prompt header and keyword retention apply to the custom service only.',
        'settings.cacheDir': 'Default directory',
        'settings.cacheDirHint': 'One JSON document per workspace, keyed by config hash + masked source; the workspace itself is never written.',
        'settings.cacheCopy': 'Copy path',
        'settings.cachePrune': 'Remove caches of deleted conversations',
        'settings.cachePruneHint': 'Removes only entries whose session id is no longer in the DSH session list; existing conversations are untouched.',
        'settings.cachePruned': 'Removed {removed} cached entries ({files} files).',
        'settings.cacheNoSessions': 'The DSH session list is unavailable; cleanup cancelled.',
        'settings.cacheCopied': 'Path copied.',
        'settings.cacheFailed': 'Cleanup failed: ',
        'settings.address': 'Service address',
        'settings.addressHint': 'OpenAI-compatible URL reachable on your LAN, including the /v1 segment, e.g. http://192.168.1.10:8080/v1.',
        'settings.model': 'Model name',
        'settings.modelHint': 'Any id for llama.cpp; the --served-model-name for vLLM.',
        'settings.concurrency': 'Concurrency',
        'settings.concurrencyHint': 'Requests sent to the service at once (1–16); 1–2 for a single-instance / JIT-loaded model.',
        'settings.batchReasoning': 'Batch reasoning segments',
        'settings.batchReasoningHint': 'Send the paragraphs of one reasoning block in a single request to cut the request count; toggle Auto-translate off and on again after saving.',
        'settings.promptHeader': 'Translation prompt header',
        'settings.promptHeaderPlaceholder': 'Leave blank to use the built-in template',
        'settings.promptHeaderHint': 'The instruction line for every translation (per-segment and batched); {target_language} and {target_lang} are substituted. The default is Chinese-specific: change it for other targets, or leave it blank for the built-in template. Takes effect on the next translation after saving.',
        'settings.placeholderGuard': 'Keyword retention',
        'settings.placeholderGuardHint': 'When on, special quoted content is masked and restored after translation so it stays exact; when off, the plain source text is sent without masks. Keyword retention needs a capable model and may require a smarter model. Toggle Auto-translate off and on after saving.',
        'settings.placeholderFormat': 'Mask format',
        'settings.placeholderFormatPlaceholder': '[n]',
        'settings.placeholderFormatHint': 'Use n for the slot number, e.g. [n], {{n}} or ⟦n⟧; the default is [n]. Toggle Auto-translate off and on after saving.',
        'settings.placeholderHint': 'Custom keyword-retention prompt',
        'settings.placeholderHintPlaceholder': 'Leave blank to use the built-in sentence',
        'settings.placeholderHintHint': 'Replaces the built-in sentence; leave it blank to keep the built-in one.',
        'settings.hoverRestore': 'Show original on hover',
        'settings.hoverRestoreHint': 'With Auto-translate on, rest the pointer on a translated block for a while to show its original text; moving the pointer restores the translation. Toggle Auto-translate off and on after saving.',
        'settings.hoverRestoreMs': 'Hover delay (ms)',
        'settings.hoverRestoreMsHint': '0–60000 ms; 0 shows the original immediately on hover; default 200.',
        'settings.token': 'API token',
        'settings.tokenHint': 'Fill this when the service requires a Bearer token. Leave it blank to keep the current token; a saved token is never echoed back.',
        'settings.tokenPlaceholder': 'Blank = keep current',
        'settings.save': 'Save',
        'settings.saving': 'Saving…',
        'settings.saved': 'Saved and applied.',
        'settings.rejected': 'Save was rejected: the host did not accept this configuration write (the field may no longer be writable, or the host is still an older version); refresh the page, and restart DSH if needed, then try again.',
        'settings.invalid': 'Check the fields: the address needs http(s)://, the model name cannot be empty, concurrency must be an integer from 1 to 16, and the mask format must contain n (for example [n]).',
        'settings.unchanged': 'No changes.',
        'settings.failed': 'Save failed: ',
        'settings.loading': 'Reading configuration…',
        'settings.unavailable': 'This deployment offers no editable form for this plugin; edit cordis.patch.yml in the profile instead.',
        'settings.notWritable': 'This profile does not accept configuration writes.',
        'error.cannotReach': 'Cannot reach the translation service: {detail}',
        'error.unavailable': 'The local translation service is unavailable.',
        'error.noLlm': 'The llm service is not mounted in this profile.',
        'error.noRoute': 'No model route: send one message first so the session records a request route.',
        'error.noTargetLanguage': 'Target language is empty: set targetLang in the plugin config.',
        'error.emptyEndpoint': 'The translation service returned no content.',
        'error.notJson': 'The translation service did not return valid JSON.',
        'error.emptyTranslation': 'The translation was empty; the original text was kept.',
        'error.placeholder': 'The translation lost, duplicated or invented a placeholder; the original text was kept.',
        'error.timeout': 'The translation request timed out.',
        'error.cancelled': 'Translation was cancelled.',
        'error.http': 'The translation service returned an error: {detail}',
        'error.generic': 'Translation failed: {detail}',
        'stopWhileWorking': 'Translating… click to turn off auto-translation',
      },
    }

    /**
     * Translate the known host/engine errors into the active locale. Unknown
     * errors keep their detail after a localized prefix; the technical detail
     * is still useful for the report and never contains the apiKey.
     */
    function localizeError(message, t) {
      var text = typeof message === 'string' ? message.trim() : ''
      if (text === '') return ''
      var lower = text.toLowerCase()
      if (lower.indexOf('cannot reach') === 0) {
        var detail = text.slice('cannot reach'.length)
          .replace(/^[:\s—–-]+/u, '')
          .replace(/\s*[—–-]\s*is the local translation server running\?+\s*$/iu, '')
          .trim()
        return t('error.cannotReach').replace('{detail}', detail)
      }
      if (lower.indexOf('the local translation endpoint is unavailable') !== -1 || lower.indexOf('the local translation service is unavailable') !== -1) return t('error.unavailable')
      if (lower.indexOf('the llm service is not mounted') !== -1) return t('error.noLlm')
      if (lower.indexOf('no model route') !== -1) return t('error.noRoute')
      if (lower.indexOf('no target language') !== -1 || lower.indexOf('target language is empty') !== -1) return t('error.noTargetLanguage')
      if (lower.indexOf('the endpoint returned no message content') !== -1) return t('error.emptyEndpoint')
      if (lower.indexOf('the endpoint answered with something that is not json') !== -1) return t('error.notJson')
      if (lower.indexOf('the translation is empty') !== -1) return t('error.emptyTranslation')
      if (lower.indexOf('placeholder') !== -1) return t('error.placeholder')
      if (lower.indexOf('timed out') !== -1 || lower.indexOf('timeout') !== -1) return t('error.timeout')
      if (lower.indexOf('cancelled') !== -1 || lower.indexOf('canceled') !== -1) return t('error.cancelled')
      if (/^http\s+\d{3}/iu.test(text)) return t('error.http').replace('{detail}', text)
      return t('error.generic').replace('{detail}', text)
    }

    function createUi(t, engine) {
      var host = document.createElement('div')
      host.setAttribute('data-harness-lingo-translator-ui', '')
      host.setAttribute('translate', 'no')
      host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font:12px/1.4 system-ui,sans-serif'
      var errorBadge = document.createElement('span')
      errorBadge.setAttribute('role', 'status')
      errorBadge.setAttribute('aria-live', 'polite')
      errorBadge.style.cssText = 'max-width:320px;color:#ffb4a8;font-size:11px;line-height:1.4;text-align:right;overflow-wrap:anywhere;white-space:normal;background:rgba(30,30,30,.82);padding:6px 8px;border-radius:8px'
      host.appendChild(errorBadge)
      var button = document.createElement('button')
      button.type = 'button'
      button.style.cssText = 'cursor:pointer;border:1px solid rgba(125,125,125,.45);border-radius:999px;padding:7px 12px;background:rgba(30,30,30,.82);color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.25)'
      host.appendChild(button)
      document.body.appendChild(host)

      function render(state) {
        var message = state.error ? localizeError(state.error, t) : ''
        if (state.working) button.textContent = t('working')
        else if (state.enabled) button.textContent = t('on')
        else button.textContent = t('idle')
        button.title = message || (state.working ? t('stopWhileWorking') : t('title'))
        errorBadge.textContent = message
        errorBadge.style.display = message ? 'block' : 'none'
        button.setAttribute('aria-pressed', state.enabled ? 'true' : 'false')
        button.setAttribute('aria-label', state.working ? t('stopWhileWorking') : state.enabled ? t('on') : t('idle'))
        // The switch stays clickable while a translation is in flight; clicking
        // it stops the run, restores the originals and cancels the generation.
        button.disabled = false
        button.style.opacity = '1'
      }

      button.addEventListener('click', function () { engine.toggle() })
      render({ enabled: false, working: false, error: null })

      return {
        render: render,
        dispose: function () {
          if (host.parentNode) host.parentNode.removeChild(host)
        },
      }
    }

    // ---------------------------------------------------------------------
    // Settings page: the row's configuration in the Plugins page.
    // ---------------------------------------------------------------------
    var SETTINGS_SLOT_KEY = 'harness-lingo-translator#harness-lingo-translator'
    var SETTINGS_FIELDS = ['systemModel', 'baseUrl', 'model', 'concurrency', 'batchReasoning', 'promptHeader', 'placeholderGuard', 'placeholderFormat', 'placeholderHint', 'hoverRestore', 'hoverRestoreMs']
    var SETTINGS_LABEL_STYLE = { display: 'grid', gap: '5px', fontSize: '14px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' }
    var SETTINGS_INPUT_STYLE = {
      width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: '8px',
      border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-base)',
      color: 'var(--dsw-alias-label-primary)', font: '13px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace',
    }
    var SETTINGS_BUTTON_STYLE = {
      cursor: 'pointer', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px',
      padding: '7px 14px', background: 'var(--dsw-alias-bg-layer-2)',
      color: 'var(--dsw-alias-label-primary)', font: '13px/1.4 system-ui,sans-serif',
    }
    var pluginApi = null
    /**
     * Diff the edited drafts against the values the Host accepted.
     * Returns the settings ops to write; an empty op list means "nothing to do".
     */
    function diffConfigDraft(drafts, values) {
      var ops = []
      for (var i = 0; i < SETTINGS_FIELDS.length; i += 1) {
        var field = SETTINGS_FIELDS[i]
        if (!Object.prototype.hasOwnProperty.call(drafts, field)) continue
        if (field === 'batchReasoning' || field === 'systemModel') {
          var flag = drafts[field] === true
          if (flag === (values !== undefined && values !== null && values[field] === true)) continue
          ops.push({ op: 'set', path: [field], value: flag })
          continue
        }
        if (field === 'promptHeader') {
          var header = String(drafts[field]).trim()
          var currentHeader = String(values !== undefined && values !== null && values[field] !== undefined ? values[field] : '').trim()
          if (header === currentHeader) continue
          if (header.length > 2000) return { ops: [], error: 'invalid', field: field }
          ops.push(header.length === 0 ? { op: 'unset', path: [field] } : { op: 'set', path: [field], value: header })
          continue
        }
        if (field === 'placeholderGuard') {
          var guardFlag = drafts[field] === true
          if (guardFlag === (values !== undefined && values !== null && values[field] !== false)) continue
          ops.push({ op: 'set', path: [field], value: guardFlag })
          continue
        }
        if (field === 'placeholderFormat') {
          var maskFormat = String(drafts[field]).trim()
          var currentFormat = String(values !== undefined && values !== null && values[field] !== undefined ? values[field] : '[n]').trim()
          var resolvedFormat = maskFormat.length === 0 ? '[n]' : maskFormat
          if (!resolvedFormat.includes('n') || resolvedFormat.replace(/n/g, '').length === 0 || resolvedFormat.length > 24) {
            return { ops: [], error: 'invalid', field: field }
          }
          if (resolvedFormat === currentFormat) continue
          ops.push(maskFormat.length === 0 ? { op: 'unset', path: [field] } : { op: 'set', path: [field], value: maskFormat })
          continue
        }
        if (field === 'placeholderHint') {
          var hint = String(drafts[field]).trim()
          var currentHint = String(values !== undefined && values !== null && values[field] !== undefined ? values[field] : '').trim()
          if (hint === currentHint) continue
          if (hint.length > 500) return { ops: [], error: 'invalid', field: field }
          ops.push(hint.length === 0 ? { op: 'unset', path: [field] } : { op: 'set', path: [field], value: hint })
          continue
        }
        if (field === 'hoverRestore') {
          var hoverFlag = drafts[field] === true
          if (hoverFlag === (values !== undefined && values !== null && values[field] !== false)) continue
          ops.push({ op: 'set', path: [field], value: hoverFlag })
          continue
        }
        if (field === 'hoverRestoreMs') {
          var hoverMs = Number(String(drafts[field]).trim())
          var currentMs = Number(values !== undefined && values !== null ? values[field] : NaN)
          if (!Number.isInteger(hoverMs) || hoverMs < 0 || hoverMs > 60000) return { ops: [], error: 'invalid', field: field }
          if (hoverMs === currentMs) continue
          ops.push({ op: 'set', path: [field], value: hoverMs })
          continue
        }
        var next = String(drafts[field]).trim()
        var current = String((values && values[field]) || '').trim()
        if (next === current) continue
        if (next.length === 0) return { ops: [], error: 'empty', field: field }
        if (field === 'baseUrl' && !/^https?:\/\/[^\s]+$/i.test(next)) return { ops: [], error: 'invalid', field: field }
        if (field === 'concurrency') {
          var limit = Number(next)
          if (!Number.isInteger(limit) || limit < 1 || limit > 16) return { ops: [], error: 'invalid', field: field }
          ops.push({ op: 'set', path: [field], value: limit })
          continue
        }
        ops.push({ op: 'set', path: [field], value: next })
      }
      // The token is write-only: the stored value is never echoed back, so an
      // empty draft means "keep the current token".
      if (drafts.apiKey !== undefined) {
        var token = String(drafts.apiKey).trim()
        if (token.length > 0) ops.push({ op: 'set', path: ['apiKey'], value: token })
      }
      return { ops: ops, error: null }
    }

    /**
     * Write the difference between the drafts and the accepted values through
     * the page owner's settings form. Resolves with the diff and the acceptance
     * (null when there was nothing to write).
     */
    function commitConfig(form, drafts, values) {
      var diff = diffConfigDraft(drafts, values)
      if (diff.error !== null || diff.ops.length === 0) return Promise.resolve({ diff: diff, accepted: null })
      return Promise.resolve()
        .then(function () { return form.mutate(diff.ops) })
        .then(function (accepted) {
          return { diff: diff, accepted: accepted }
        })
    }

    /** The row configuration page rendered by the Plugins page. */
    function ConfigPanel(props) {
      var t = props.t
      var view = props.view
      var form = props.form
      var state = form && form.state ? form.state : { status: 'unavailable', value: undefined, writable: false }
      var values = state.value || {}
      var drafts = React.useState(typeof props.initialDraft === 'object' && props.initialDraft !== null ? props.initialDraft : {})
      var draft = drafts[0]
      var setDraft = drafts[1]
      var notes = React.useState(null)
      var note = notes[0]
      var setNote = notes[1]
      var savingState = React.useState(false)
      var saving = savingState[0]
      var setSaving = savingState[1]
      var tabState = React.useState(typeof props.initialTab === 'string' ? props.initialTab : 'connection')
      var tab = tabState[0]
      var setTab = tabState[1]

      if (view === 'summary') return h('span', null, t('settings.summary'))
      if (state.status !== 'ready') {
        return h('p', { style: { margin: 0, fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' } },
          t(state.status === 'loading' ? 'settings.loading' : 'settings.unavailable'))
      }
      var disabled = saving || state.writable === false
      var baseUrl = Object.prototype.hasOwnProperty.call(draft, 'baseUrl') ? draft.baseUrl : String(values.baseUrl || '')
      var model = Object.prototype.hasOwnProperty.call(draft, 'model') ? draft.model : String(values.model || '')

      function edit(field) {
        return function (event) {
          var next = Object.assign({}, draft)
          next[field] = event.target.value
          setDraft(next)
          setNote(null)
        }
      }

      function save() {
        var diff = diffConfigDraft(draft, values)
        if (diff.error !== null) {
          setNote({ kind: 'error', text: t('settings.invalid') })
          return
        }
        if (diff.ops.length === 0) {
          setNote({ kind: 'idle', text: t('settings.unchanged') })
          return
        }
        setSaving(true)
        setNote(null)
        commitConfig(form, draft, values)
          .then(function (result) {
            setSaving(false)
            if (result.accepted) {
              setDraft({})
              setNote({ kind: 'ok', text: t('settings.saved') })
            } else {
              setNote({ kind: 'error', text: t('settings.rejected') })
            }
          })
          .catch(function (error) {
            setSaving(false)
            setNote({ kind: 'error', text: t('settings.failed') + (error && error.message ? error.message : String(error)) })
          })
      }

      var noteColor = note && note.kind === 'ok'
        ? 'var(--dsw-alias-state-success-primary)'
        : note && note.kind === 'error'
          ? 'var(--dsw-alias-state-error-primary)'
          : 'var(--dsw-alias-label-secondary)'

      var guardOn = draft.placeholderGuard === undefined ? values.placeholderGuard !== false : draft.placeholderGuard === true
      var hoverOn = draft.hoverRestore === undefined ? values.hoverRestore !== false : draft.hoverRestore === true
      var systemOn = draft.systemModel === undefined ? values.systemModel === true : draft.systemModel === true
      var hintStyle = { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' }
      var sectionStyle = { display: 'grid', gap: '10px' }
      var checkboxStyle = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' }
      var tabs = [['connection', 'settings.tab.connection'], ['translation', 'settings.tab.translation'], ['hover', 'settings.tab.hover'], ['cache', 'settings.tab.cache']]
      function chooseBackend(system) {
        var next = Object.assign({}, draft)
        next.systemModel = system
        setDraft(next)
        setNote(null)
      }
      function pruneCache() {
        if (pluginApi === null || typeof pluginApi.pruneCache !== 'function') return
        pluginApi.pruneCache().then(function (result) {
          setNote({ kind: 'ok', text: t('settings.cachePruned').replace('{removed}', String(result.removed)).replace('{files}', String(result.files)) })
        }).catch(function (error) {
          setNote({ kind: 'error', text: t('settings.cacheFailed') + (error && error.message ? error.message : String(error)) })
        })
      }
      var customFields = !systemOn ? h('div', { style: sectionStyle },
        h('label', { style: SETTINGS_LABEL_STYLE },
          h('span', null, t('settings.address')),
          h('input', {
            type: 'text', value: baseUrl, onChange: edit('baseUrl'),
            placeholder: 'http://192.168.1.10:8080/v1', style: SETTINGS_INPUT_STYLE, spellCheck: false, disabled: disabled,
          })),
        h('span', { style: hintStyle }, t('settings.addressHint')),
        h('label', { style: SETTINGS_LABEL_STYLE },
          h('span', null, t('settings.model')),
          h('input', {
            type: 'text', value: model, onChange: edit('model'),
            placeholder: 'hy-mt1.5-1.8b', style: SETTINGS_INPUT_STYLE, spellCheck: false, disabled: disabled,
          })),
        h('span', { style: hintStyle }, t('settings.modelHint')),
        h('label', { style: SETTINGS_LABEL_STYLE },
          h('span', null, t('settings.token')),
          h('input', {
            type: 'password', value: draft.apiKey === undefined ? '' : draft.apiKey, onChange: edit('apiKey'),
            placeholder: t('settings.tokenPlaceholder'), style: SETTINGS_INPUT_STYLE, spellCheck: false, autoComplete: 'off', disabled: disabled,
          })),
        h('span', { style: hintStyle }, t('settings.tokenHint'))) : null
      var guardFields = guardOn ? h('div', { style: sectionStyle },
        h('label', { style: SETTINGS_LABEL_STYLE },
          h('span', null, t('settings.placeholderFormat')),
          h('input', {
            type: 'text',
            value: draft.placeholderFormat === undefined ? String(values.placeholderFormat === undefined ? '[n]' : values.placeholderFormat) : draft.placeholderFormat,
            onChange: edit('placeholderFormat'), placeholder: t('settings.placeholderFormatPlaceholder'),
            style: SETTINGS_INPUT_STYLE, spellCheck: false, disabled: disabled,
          })),
        h('span', { style: hintStyle }, t('settings.placeholderFormatHint')),
        h('label', { style: SETTINGS_LABEL_STYLE },
          h('span', null, t('settings.placeholderHint')),
          h('textarea', {
            rows: 2,
            value: draft.placeholderHint === undefined ? String(values.placeholderHint === undefined ? '' : values.placeholderHint) : draft.placeholderHint,
            onChange: edit('placeholderHint'), placeholder: t('settings.placeholderHintPlaceholder'),
            style: Object.assign({}, SETTINGS_INPUT_STYLE, { fontFamily: 'inherit', resize: 'vertical', minHeight: '48px' }), disabled: disabled,
          }))) : null
      var hoverFields = hoverOn ? h('label', { style: SETTINGS_LABEL_STYLE },
        h('span', null, t('settings.hoverRestoreMs')),
        h('input', {
          type: 'number', min: 0, max: 60000, step: 100,
          value: draft.hoverRestoreMs === undefined ? String(values.hoverRestoreMs === undefined ? 200 : values.hoverRestoreMs) : draft.hoverRestoreMs,
          onChange: edit('hoverRestoreMs'), style: SETTINGS_INPUT_STYLE, disabled: disabled,
        })) : null

      return h('div', {
        style: { display: 'grid', gap: '16px', maxWidth: '680px', font: '13px/1.5 system-ui,sans-serif', color: 'var(--dsw-alias-label-primary)' },
      },
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
        tabs.map(function (entry) {
          var active = tab === entry[0]
          return h('button', {
            key: entry[0],
            type: 'button',
            onClick: function () { setTab(entry[0]) },
            style: {
              appearance: 'none', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: active ? '2px solid var(--dsw-alias-state-info-primary)' : '2px solid transparent',
              padding: '8px 14px', marginBottom: '-1px', fontSize: '15px',
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
            },
          }, t(entry[1]))
        })),
      tab === 'connection' ? h('div', { style: sectionStyle },
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center' } },
          h('label', { style: checkboxStyle },
            h('input', { type: 'checkbox', checked: !systemOn, onChange: function () { chooseBackend(false) }, disabled: disabled }),
            h('span', null, t('settings.customService'))),
          h('label', { style: checkboxStyle },
            h('input', { type: 'checkbox', checked: systemOn, onChange: function () { chooseBackend(true) }, disabled: disabled }),
            h('span', null, t('settings.systemModel')))),
        h('span', { style: hintStyle }, systemOn ? t('settings.systemModelHint') : t('settings.customServiceHint')),
        customFields) : null,
      tab === 'translation' ? h('div', { style: sectionStyle },
        !systemOn ? h('label', { style: SETTINGS_LABEL_STYLE },
          h('span', null, t('settings.concurrency')),
          h('input', {
            type: 'number', min: 1, max: 16, step: 1,
            value: draft.concurrency === undefined ? String(values.concurrency === undefined ? 2 : values.concurrency) : draft.concurrency,
            onChange: edit('concurrency'), style: SETTINGS_INPUT_STYLE, disabled: disabled,
          })) : null,
        !systemOn ? h('span', { style: hintStyle }, t('settings.concurrencyHint')) : null,
        h('label', { style: checkboxStyle },
          h('input', {
            type: 'checkbox', checked: draft.batchReasoning === undefined ? values.batchReasoning === true : draft.batchReasoning === true,
            onChange: function (event) { var next = Object.assign({}, draft); next.batchReasoning = event.target.checked; setDraft(next); setNote(null) },
            disabled: disabled,
          }),
          h('span', null, t('settings.batchReasoning'))),
        h('span', { style: hintStyle }, t('settings.batchReasoningHint')),
        systemOn ? h('span', { style: hintStyle }, t('settings.systemPromptHint')) : null,
        !systemOn ? h('label', { style: SETTINGS_LABEL_STYLE },
          h('span', null, t('settings.promptHeader')),
          h('textarea', {
            rows: 3,
            value: draft.promptHeader === undefined ? String(values.promptHeader === undefined ? '' : values.promptHeader) : draft.promptHeader,
            onChange: edit('promptHeader'), placeholder: t('settings.promptHeaderPlaceholder'),
            style: Object.assign({}, SETTINGS_INPUT_STYLE, { fontFamily: 'inherit', resize: 'vertical', minHeight: '60px' }), disabled: disabled,
          })) : null,
        !systemOn ? h('span', { style: hintStyle }, t('settings.promptHeaderHint')) : null,
        !systemOn ? h('label', { style: checkboxStyle },
          h('input', {
            type: 'checkbox', checked: draft.placeholderGuard === undefined ? values.placeholderGuard !== false : draft.placeholderGuard === true,
            onChange: function (event) { var next = Object.assign({}, draft); next.placeholderGuard = event.target.checked; setDraft(next); setNote(null) },
            disabled: disabled,
          }),
          h('span', null, t('settings.placeholderGuard'))) : null,
        !systemOn ? h('span', { style: hintStyle }, t('settings.placeholderGuardHint')) : null,
        !systemOn ? guardFields : null,
        !systemOn && guardOn ? h('span', { style: hintStyle }, t('settings.placeholderHintHint')) : null) : null,
      tab === 'hover' ? h('div', { style: sectionStyle },
        h('label', { style: checkboxStyle },
          h('input', {
            type: 'checkbox', checked: draft.hoverRestore === undefined ? values.hoverRestore !== false : draft.hoverRestore === true,
            onChange: function (event) { var next = Object.assign({}, draft); next.hoverRestore = event.target.checked; setDraft(next); setNote(null) },
            disabled: disabled,
          }),
          h('span', null, t('settings.hoverRestore'))),
        h('span', { style: hintStyle }, t('settings.hoverRestoreHint')),
        hoverFields,
        hoverOn ? h('span', { style: hintStyle }, t('settings.hoverRestoreMsHint')) : null) : null,
      tab === 'cache' ? h('div', { style: sectionStyle },
        h('span', { style: SETTINGS_LABEL_STYLE }, t('settings.cacheDir')),
        h('span', { style: { fontSize: '13px', fontFamily: 'ui-monospace,SFMono-Regular,Consolas,monospace', color: 'var(--dsw-alias-label-primary)' } }, '~/.dsh/cache/harness-lingo-translator/'),
        h('span', { style: hintStyle }, t('settings.cacheDirHint')),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
          h('button', { type: 'button', style: SETTINGS_BUTTON_STYLE, onClick: function () {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText('~/.dsh/cache/harness-lingo-translator/').then(function () {
                setNote({ kind: 'ok', text: t('settings.cacheCopied') })
              }).catch(function (error) {
                setNote({ kind: 'error', text: t('settings.cacheFailed') + (error && error.message ? error.message : String(error)) })
              })
            }
          } }, t('settings.cacheCopy')),
          h('button', { type: 'button', style: SETTINGS_BUTTON_STYLE, onClick: pruneCache }, t('settings.cachePrune'))),
        h('span', { style: hintStyle }, t('settings.cachePruneHint'))) : null,
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' } },
        h('button', { type: 'button', onClick: save, disabled: disabled, style: SETTINGS_BUTTON_STYLE },
          saving ? t('settings.saving') : t('settings.save')),
        note ? h('span', { style: { fontSize: '12px', color: noteColor } }, note.text) : null),
      state.writable === false
        ? h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-state-warn-primary)' } }, t('settings.notWritable'))
        : null)
    }

    // ---------------------------------------------------------------------
    // Plugin entry.
    // ---------------------------------------------------------------------
    function unwrap(result) {
      if (result !== null && typeof result === 'object' && result.ok === true) return result.value
      var error = result && result.error ? result.error : { code: 'remote', message: 'remote call failed' }
      throw new Error((error.code ? error.code + ': ' : '') + (error.message || 'remote call failed'))
    }

    var name = 'harness-lingo-translator-client'
    var inject = ['locale', 'remote', 'slots', 'sessions']

    async function apply(ctx) {
      ctx.effect(function () { return ctx.locale.register(NS, DICTS) }, 'harness-lingo-translator: dictionaries')
      await ctx.remote.$mount({ package: PACKAGE, descriptors: INVOCATIONS })
      ctx.effect(function () {
        return ctx.slots.inject('plugins.row.config', function () {
          return ctx.slots.register({
            name: 'plugins.row.config',
            key: SETTINGS_SLOT_KEY,
            locale: NS,
          }, ConfigPanel)
        })
      }, 'harness-lingo-translator: settings page')
      ctx.inject(['remote.translatePage'], function (scope) {
        var t = scope.locale.bind(NS)
        var api = {
          status: function () { return Promise.resolve(scope.remote.translatePage.status()).then(unwrap) },
          translate: function (targetLang, segments, batch) {
            return Promise.resolve(scope.remote.translatePage.translate({
              targetLang: targetLang,
              segments: segments,
              batch: batch === true,
            })).then(unwrap)
          },
          cacheLoad: function (request) {
            return Promise.resolve(scope.remote.translatePage.loadCache(request)).then(unwrap)
          },
          cacheSave: function (request) {
            return Promise.resolve(scope.remote.translatePage.saveCache(request)).then(unwrap)
          },
          sessionWorkspace: function (request) {
            return Promise.resolve(scope.remote.translatePage.workspace(request)).then(unwrap)
          },
          pruneCache: function () {
            return Promise.resolve(scope.remote.translatePage.pruneCache()).then(unwrap)
          },
        }
        pluginApi = api
        function currentWorkspace() {
          try {
            if (typeof document === 'undefined') return ''
            var el = document.querySelector('[data-conversation-session]')
            var id = el === null ? '' : String(el.getAttribute('data-conversation-session') || '')
            if (id === '') return ''
            var sessions = typeof scope.get === 'function' ? scope.get('sessions') : null
            var snapshot = sessions !== null && sessions !== undefined && sessions.list !== undefined && typeof sessions.list.getSnapshot === 'function'
              ? sessions.list.getSnapshot()
              : null
            var entry = snapshot !== null && snapshot !== undefined && snapshot.byId !== undefined ? snapshot.byId[id] : null
            return entry !== null && entry !== undefined && typeof entry.cwd === 'string' ? entry.cwd : ''
          } catch (error) {
            return ''
          }
        }
        var navigatorLang = (typeof navigator !== 'undefined' && navigator.language) ? String(navigator.language).split('-')[0] : ''
        var active = scope.locale.getLocale ? scope.locale.getLocale().active : 'en'
        var targetLang = active && active !== 'en' ? active : navigatorLang
        if (targetLang === 'en') targetLang = ''
        var ui = null
        var engine = createEngine({
          api: api,
          glossary: [],
          targetLang: targetLang,
          getWorkspace: currentWorkspace,
          onState: function (state) { if (ui !== null) ui.render(state) },
        })
        scope.effect(function () {
          if (typeof document === 'undefined') return function () {}
          var mount = function () {
            ui = createUi(t, engine)
            ui.render(engine.state())
          }
          if (document.body) mount()
          else document.addEventListener('DOMContentLoaded', mount, { once: true })
          return function () {
            if (ui !== null) ui.dispose()
            engine.dispose()
          }
        }, 'harness-lingo-translator: page control')
      })
    }

    exports.name = name
    exports.inject = inject
    exports.apply = apply
    exports.__test = {
      protectText: protectText,
      restoreText: restoreText,
      DEFAULT_PLACEHOLDER_FORMAT: DEFAULT_PLACEHOLDER_FORMAT,
      placeholderToken: placeholderToken,
      normalizePlaceholderFormat: normalizePlaceholderFormat,
      buildProtectRegex: buildProtectRegex,
      hashText: hashText,
      INVOCATIONS: INVOCATIONS,
      createEngine: createEngine,
      isChineseText: isChineseText,
      DICTS: DICTS,
      collectNodes: collectNodes,
      ConfigPanel: ConfigPanel,
      createUi: createUi,
      localizeError: localizeError,
      diffConfigDraft: diffConfigDraft,
      commitConfig: commitConfig,
      SETTINGS_SLOT_KEY: SETTINGS_SLOT_KEY,
      SETTINGS_FIELDS: SETTINGS_FIELDS,
    }
    return module.exports
  },
})
