// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 PerryLink
//
// typert.host.mjs — hand-written Typert HOST manifest (exported as `./typert`;
// the typert loader registers the invocations when this package mounts).
//
// Namespace: translatePage. Methods: status, translate, loadCache, saveCache.
// Only the cache methods write, and only under the host-private
// ~/.dsh/cache/dsh-translate/ directory; session logs and workspaces stay
// untouched.

import { INVOCATIONS } from './lib/wire.mjs'

/** Host Typert manifest (validated by @deepseek-ai/dsh-typert-loader). */
export const TYPERT = Object.freeze({
  package: 'dsh-translate',
  face: 'host',
  schemas: Object.freeze([]),
  invocations: INVOCATIONS,
  model: Object.freeze({
    services: Object.freeze([]),
    events: Object.freeze([]),
    objects: Object.freeze([]),
  }),
})
