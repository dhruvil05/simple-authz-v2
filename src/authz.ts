import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, isAbsolute } from 'node:path'
import { tokenize } from './lexer.js'
import { parse } from './parser.js'
import { compile } from './compiler.js'
import type { CompiledPolicy, PolicyIndex, CompiledRule } from './compiler.js'
import { buildContext } from './context.js'
import { evaluate } from './evaluator.js'
import { PathSafetyError, AuthzError } from './errors.js'
import type {
  User, AuthzOptions, AuthzResult, ValidationResult, AuditRecord, DecisionReason,
} from './types/public.js'

// ─── Authz ────────────────────────────────────────────────────────────────────

export class Authz {
  readonly #options: Required<AuthzOptions>
  #policy: CompiledPolicy | null = null

  constructor(options: AuthzOptions = {}) {
    this.#options = {
      audit: options.audit ?? (() => undefined),
      maxContextDepth: options.maxContextDepth ?? 10,
    }
  }

  // ─── Policy loading ──────────────────────────────────────────────────────

  load(filePath: string): void {
    const safePath = this.#resolveSafe(filePath)
    const source = readFileSync(safePath, 'utf-8')
    this.#policy = this.#compileSource(source, safePath)
  }

  async loadAsync(filePath: string): Promise<void> {
    const safePath = this.#resolveSafe(filePath)
    const source = await readFile(safePath, 'utf-8')
    this.#policy = this.#compileSource(source, safePath)
  }

  // ─── Authorization ───────────────────────────────────────────────────────

  can(
    user: User,
    action: string,
    resource: string,
    resourceObject?: Record<string, unknown>,
    extraCtx?: Record<string, unknown>,
  ): boolean {
    return this.explain(user, action, resource, resourceObject, extraCtx).allowed
  }

  explain(
    user: User,
    action: string,
    resource: string,
    resourceObject?: Record<string, unknown>,
    extraCtx?: Record<string, unknown>,
  ): AuthzResult {
    const start = performance.now()
    const result = this.#decide(user, action, resource, resourceObject, extraCtx)
    const durationMs = Math.round((performance.now() - start) * 1000) / 1000
    const final: AuthzResult = { ...result, durationMs }
    this.#fireAudit(user, action, resource, final)
    return final
  }

  validate(filePath: string): ValidationResult {
    try {
      const safePath = this.#resolveSafe(filePath)
      const source = readFileSync(safePath, 'utf-8')
      this.#compileSource(source, safePath)
      return { valid: true, errors: [] }
    } catch (err) {
      // PathSafetyError is a security violation — rethrow, never swallow
      if (err instanceof PathSafetyError) throw err
      if (err instanceof AuthzError) {
        return {
          valid: false,
          errors: [{
            message: err.message,
            line: 'line' in err ? (err.line as number) : 0,
            column: 'column' in err ? (err.column as number) : 0,
          }],
        }
      }
      return { valid: false, errors: [{ message: String(err), line: 0, column: 0 }] }
    }
  }

  // ─── Decision engine ─────────────────────────────────────────────────────

  #decide(
    user: User,
    action: string,
    resource: string,
    resourceObject?: Record<string, unknown>,
    extraCtx?: Record<string, unknown>,
  ): Omit<AuthzResult, 'durationMs'> {
    if (this.#policy === null) {
      return { allowed: false, reason: 'no-matching-rule' }
    }

    // Build safe, frozen evaluation context
    let evalCtx
    try {
      evalCtx = buildContext(
        user,
        resourceObject ?? {},
        extraCtx ?? {},
        this.#options.maxContextDepth,
      )
    } catch {
      return { allowed: false, reason: 'no-matching-rule' }
    }

    const candidates = this.#gatherCandidates(
      this.#policy.index, user.roles, action, resource,
    )

    // Deny rules checked first — deny always beats allow
    for (const rule of candidates) {
      if (rule.effect === 'deny') {
        const condPassed = rule.condition === null || evaluate(rule.condition, evalCtx)
        if (condPassed) {
          return {
            allowed: false,
            reason: 'deny-rule-matched',
            matchedRole: rule.role,
            matchedAction: rule.action,
            matchedResource: rule.resource,
            conditionResult: rule.condition !== null ? true : undefined,
          }
        }
      }
    }

    // Then allow rules
    for (const rule of candidates) {
      if (rule.effect === 'allow') {
        if (rule.condition === null) {
          const isWildcard = rule.action === '*' || rule.resource === '*'
          return {
            allowed: true,
            reason: isWildcard ? 'wildcard-matched' : 'allow-rule-matched',
            matchedRole: rule.role,
            matchedAction: rule.action,
            matchedResource: rule.resource,
          }
        }
        const condPassed = evaluate(rule.condition, evalCtx)
        if (condPassed) {
          const isWildcard = rule.action === '*' || rule.resource === '*'
          return {
            allowed: true,
            reason: isWildcard ? 'wildcard-matched' : 'allow-rule-matched',
            matchedRole: rule.role,
            matchedAction: rule.action,
            matchedResource: rule.resource,
            conditionResult: true,
          }
        }
        return {
          allowed: false,
          reason: 'condition-failed',
          matchedRole: rule.role,
          conditionResult: false,
        }
      }
    }

    return { allowed: false, reason: 'no-matching-rule' }
  }

  #gatherCandidates(
    index: PolicyIndex,
    roles: readonly string[],
    action: string,
    resource: string,
  ): CompiledRule[] {
    const candidates: CompiledRule[] = []
    for (const role of roles) {
      const actionMap = index.get(role)
      if (actionMap === undefined) continue
      for (const actionKey of [action, '*']) {
        const resourceMap = actionMap.get(actionKey)
        if (resourceMap === undefined) continue
        for (const resourceKey of [resource, '*']) {
          const rules = resourceMap.get(resourceKey)
          if (rules !== undefined) candidates.push(...rules)
        }
      }
    }
    return candidates
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  #resolveSafe(filePath: string): string {
    const cwd = process.cwd()
    const resolved = isAbsolute(filePath) ? filePath : resolve(cwd, filePath)
    if (!resolved.startsWith(cwd)) throw new PathSafetyError(filePath)
    return resolved
  }

  #compileSource(source: string, sourcePath: string): CompiledPolicy {
    const tokens = tokenize(source, sourcePath)
    const ast = parse(tokens, sourcePath)
    return compile(ast)
  }

  #fireAudit(user: User, action: string, resource: string, result: AuthzResult): void {
    const record: AuditRecord = {
      allowed: result.allowed,
      userId: user.id,
      roles: user.roles,
      action,
      resource,
      reason: result.reason,
      durationMs: result.durationMs,
      timestamp: Date.now(),
    }
    try {
      const maybePromise = this.#options.audit(record)
      if (maybePromise instanceof Promise) {
        maybePromise.catch(() => undefined)
      }
    } catch {
      // Audit errors must never surface to the caller
    }
  }
}
