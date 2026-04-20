// ─── Base error ──────────────────────────────────────────────────────────────

export class AuthzError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthzError'
    // Restore prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Parse error ─────────────────────────────────────────────────────────────

export class ParseError extends AuthzError {
  readonly line: number
  readonly column: number
  readonly sourcePath: string

  constructor(opts: {
    message: string
    line: number
    column: number
    sourcePath: string
  }) {
    super(
      `[ParseError] ${opts.sourcePath}:${opts.line}:${opts.column} — ${opts.message}`,
    )
    this.name = 'ParseError'
    this.line = opts.line
    this.column = opts.column
    this.sourcePath = opts.sourcePath
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Compile error ───────────────────────────────────────────────────────────

export class CompileError extends AuthzError {
  readonly sourcePath: string

  constructor(opts: { message: string; sourcePath: string }) {
    super(`[CompileError] ${opts.sourcePath} — ${opts.message}`)
    this.name = 'CompileError'
    this.sourcePath = opts.sourcePath
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Evaluation error ────────────────────────────────────────────────────────

export class EvaluationError extends AuthzError {
  constructor(message: string) {
    super(`[EvaluationError] ${message}`)
    this.name = 'EvaluationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Path safety error ───────────────────────────────────────────────────────

export class PathSafetyError extends AuthzError {
  readonly attemptedPath: string

  constructor(attemptedPath: string) {
    super(
      `[PathSafetyError] Policy path "${attemptedPath}" is outside the allowed directory`,
    )
    this.name = 'PathSafetyError'
    this.attemptedPath = attemptedPath
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Context error ───────────────────────────────────────────────────────────

export class ContextError extends AuthzError {
  constructor(message: string) {
    super(`[ContextError] ${message}`)
    this.name = 'ContextError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
