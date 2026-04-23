import { ContextError } from './errors.js'

// ─── Evaluation context ───────────────────────────────────────────────────────

export interface EvalContext {
  readonly user: Readonly<Record<string, unknown>>
  readonly resource: Readonly<Record<string, unknown>>
  readonly ctx: Readonly<Record<string, unknown>>
}

// ─── Dangerous prototype keys ─────────────────────────────────────────────────

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Deep-clones, sanitises, and freezes all three context objects.
 * Throws ContextError on prototype pollution or depth violations.
 */
export function buildContext(
  user: unknown,
  resource: unknown,
  ctx: unknown,
  maxDepth: number,
): EvalContext {
  return {
    user: sanitiseObject(user, maxDepth, 'user'),
    resource: sanitiseObject(resource ?? {}, maxDepth, 'resource'),
    ctx: sanitiseObject(ctx ?? {}, maxDepth, 'ctx'),
  }
}

// ─── Sanitiser ────────────────────────────────────────────────────────────────

function sanitiseObject(
  value: unknown,
  maxDepth: number,
  rootName: string,
): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContextError(
      `"${rootName}" must be a plain object, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`,
    )
  }
  const cloned = deepClone(value as Record<string, unknown>, 1, maxDepth, rootName)
  return deepFreeze(cloned) as Readonly<Record<string, unknown>>
}

function deepClone(
  obj: Record<string, unknown>,
  depth: number,
  maxDepth: number,
  path: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const key of Object.keys(obj)) {
    // SE: Reject dangerous prototype keys
    if (DANGEROUS_KEYS.has(key)) {
      throw new ContextError(
        `dangerous key "${key}" found at "${path}.${key}" — prototype pollution attempt rejected`,
      )
    }

    const val = obj[key]

    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      if (depth >= maxDepth) {
        // At max depth — stop cloning, store as empty frozen object
        result[key] = Object.freeze({})
      } else {
        result[key] = deepClone(val as Record<string, unknown>, depth + 1, maxDepth, `${path}.${key}`)
      }
    } else if (Array.isArray(val)) {
      // Shallow clone arrays — elements are treated as primitives
      result[key] = deepCloneArray(val, depth, maxDepth, `${path}.${key}`)
    } else {
      // Primitives: string, number, boolean, null, undefined — copy as-is
      result[key] = val
    }
  }

  return result
}

function deepCloneArray(
  arr: unknown[],
  depth: number,
  maxDepth: number,
  path: string,
): unknown[] {
  return arr.map((item, i) => {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      if (depth >= maxDepth) return Object.freeze({})
      return deepClone(item as Record<string, unknown>, depth + 1, maxDepth, `${path}[${i}]`)
    }
    return item
  })
}

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj)
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key]
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  }
  return obj
}

// ─── Exported helpers (for tests) ────────────────────────────────────────────

export function _sanitise(
  value: unknown,
  depth: number,
  maxDepth: number,
  path: string,
): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return deepClone(value as Record<string, unknown>, depth, maxDepth, path)
  }
  return value
}

export function _containsDangerousKey(obj: unknown): boolean {
  if (obj === null || typeof obj !== 'object') return false
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) return true
  }
  return false
}
