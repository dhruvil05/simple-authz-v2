import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, isAbsolute } from 'node:path'
import { tokenize } from './lexer.js'
import { parse } from './parser.js'
import { compile } from './compiler.js'
import type { CompiledPolicy } from './compiler.js'
import { PathSafetyError, AuthzError } from './errors.js'
import type {
  User,
  AuthzOptions,
  AuthzResult,
  ValidationResult,
  AuditRecord,
} from './types/public.js'

// ─── Authz ───────────────────────────────────────────────────────────────────
// Phase 5 implementation target.
// The single public class consumers interact with.
// All methods are safe to call concurrently — no shared mutable state after load.
// ─────────────────────────────────────────────────────────────────────────────

export class Authz {
  readonly #options: Required<AuthzOptions>
  #policy: CompiledPolicy | null = null

  constructor(options: AuthzOptions = {}) {
    this.#options = {
      audit: options.audit ?? (() => undefined),
      maxContextDepth: options.maxContextDepth ?? 10,
    }
  }

  // ─── Policy loading ────────────────────────────────────────────────────────

  /**
   * Synchronously load and compile a .toon policy file.
   * Throws PathSafetyError if the resolved path leaves the current working directory.
   * Throws ParseError or CompileError on invalid policy content.
   */
  load(filePath: string): void {
    const safePath = this.#resolveSafe(filePath)
    const source = readFileSync(safePath, 'utf-8')
    this.#policy = this.#compileSource(source, safePath)
  }

  /**
   * Asynchronously load and compile a .toon policy file.
   * Same safety guarantees as load().
   */
  async loadAsync(filePath: string): Promise<void> {
    const safePath = this.#resolveSafe(filePath)
    const source = await readFile(safePath, 'utf-8')
    this.#policy = this.#compileSource(source, safePath)
  }

  // ─── Authorization ─────────────────────────────────────────────────────────

  /**
   * Returns true if the user is permitted to perform action on resource.
   * Deny rules always override allow rules.
   * Returns false if no policy is loaded or no rule matches (deny-by-default).
   */
  can(
    user: User,
    action: string,
    resource: string,
    resourceObject?: Record<string, unknown>,
    extraCtx?: Record<string, unknown>,
  ): boolean {
    const result = this.explain(user, action, resource, resourceObject, extraCtx)
    return result.allowed
  }

  /**
   * Returns a detailed AuthzResult explaining the authorization decision.
   * Use for debugging and audit logging. Prefer can() in hot paths.
   */
  explain(
    _user: User,
    _action: string,
    _resource: string,
    _resourceObject?: Record<string, unknown>,
    _extraCtx?: Record<string, unknown>,
  ): AuthzResult {
    // Phase 5: implement full rule lookup + condition evaluation
    const start = performance.now()
    const result: AuthzResult = {
      allowed: false,
      reason: 'no-matching-rule',
      durationMs: Math.round((performance.now() - start) * 100) / 100,
    }
    this.#fireAudit(_user, _action, _resource, result)
    return result
  }

  /**
   * Validates a .toon file without loading it into the engine.
   * Returns a ValidationResult — never throws.
   */
  validate(filePath: string): ValidationResult {
    try {
      const safePath = this.#resolveSafe(filePath)
      const source = readFileSync(safePath, 'utf-8')
      this.#compileSource(source, safePath)
      return { valid: true, errors: [] }
    } catch (err) {
      if (err instanceof AuthzError) {
        return {
          valid: false,
          errors: [
            {
              message: err.message,
              line: 'line' in err ? (err.line as number) : 0,
              column: 'column' in err ? (err.column as number) : 0,
            },
          ],
        }
      }
      return {
        valid: false,
        errors: [{ message: String(err), line: 0, column: 0 }],
      }
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  #resolveSafe(filePath: string): string {
    const cwd = process.cwd()
    const resolved = isAbsolute(filePath)
      ? filePath
      : resolve(cwd, filePath)

    if (!resolved.startsWith(cwd)) {
      throw new PathSafetyError(filePath)
    }
    return resolved
  }

  #compileSource(source: string, sourcePath: string): CompiledPolicy {
    const tokens = tokenize(source, sourcePath)
    const ast = parse(tokens, sourcePath)
    return compile(ast)
  }

  #fireAudit(
    user: User,
    action: string,
    resource: string,
    result: AuthzResult,
  ): void {
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
