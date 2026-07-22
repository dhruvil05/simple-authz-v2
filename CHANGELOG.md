# Changelog

All notable changes to advance-authz will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [1.0.0] — 2026-07-22

Initial public release.

### Added

- **TOON policy language** with formal EBNF grammar specification
- `AND`, `OR`, `NOT` condition operators with correct precedence
- Explicit `effect: allow | deny` on every rule — deny always overrides allow
- `role_hierarchy` block for role inheritance (fully expanded at compile time)
- `include` directive for modular policy files, with path-safety validation on every resolved include (including nested includes)
- Sandboxed AST-walk condition evaluator — zero `eval()`, ever
- Prototype pollution protection on all user/resource inputs (`__proto__`, `constructor`, `prototype` keys rejected)
- Path traversal protection on `load()`, `loadAsync()`, `validate()`, and `include`
- Deep-clone and `Object.freeze()` on all context objects before evaluation
- `maxContextDepth` option to protect against DoS via deeply nested objects
- `explain()` method returning typed `AuthzResult` with `DecisionReason`
- `validate()` method returning structured `ValidationResult` — never throws
- `loadAsync()` for non-blocking policy loading
- Audit callback (`options.audit`) receiving typed `AuditRecord` on every decision
- Dual ESM + CJS output via tsup, verified against a real installed package (not just source)
- Full TypeScript types — zero `any` in public API
- Typed error classes: `ParseError` (with line+col), `CompileError`, `EvaluationError`, `PathSafetyError`, `ContextError`
- GitHub Actions CI across Node 18, 20, 22, including a package-install smoke test
- 303 tests with ≥90% real branch/line coverage
- EBNF grammar spec (`docs/TOON_GRAMMAR.ebnf`)
- Condition context spec (`docs/CONDITION_CONTEXT.md`)

### Security

- No use of `eval()` or `new Function()` anywhere in the codebase
- Path traversal validation on every file-loading code path, including `include`
- Prototype pollution rejection in the context builder
- Segment-boundary path checks (not naive string-prefix checks) to prevent sibling-directory bypass