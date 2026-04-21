# Changelog

All notable changes to simple-authz will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [2.0.0-alpha.0] — 2025-07-xx

Complete ground-up rewrite. Not backwards compatible with v1.

### Added

- **TOON v2 policy language** with formal EBNF grammar specification
- `AND`, `OR`, `NOT` condition operators with correct precedence
- Explicit `effect: allow | deny` on every rule
- `role_hierarchy` block for role inheritance (fully expanded at compile time)
- `include` directive for modular policy files
- Sandboxed AST-walk condition evaluator — zero `eval()`, ever
- Prototype pollution protection on all user/resource inputs (`__proto__`, `constructor`, `prototype` keys rejected)
- Path traversal protection on `load()`, `loadAsync()`, and `validate()`
- Deep-clone and `Object.freeze()` on all context objects before evaluation
- `maxContextDepth` option to protect against DoS via deeply nested objects
- `explain()` method returning typed `AuthzResult` with `DecisionReason`
- `validate()` method returning structured `ValidationResult` — never throws
- `loadAsync()` for non-blocking policy loading
- Audit callback (`options.audit`) receiving typed `AuditRecord` on every decision
- Dual ESM + CJS output via tsup
- Full TypeScript types — zero `any` in public API
- Typed error classes: `ParseError` (with line+col), `CompileError`, `EvaluationError`, `PathSafetyError`, `ContextError`
- GitHub Actions CI across Node 18, 20, 22
- 298 tests with ≥90% branch coverage enforcement
- EBNF grammar spec (`docs/TOON_GRAMMAR.ebnf`)
- Condition context spec (`docs/CONDITION_CONTEXT.md`)
- Migration guide from v1 (`docs/MIGRATION_v1_v2.md`)

### Changed

- Condition variables: `listing.x` → `resource.x` (breaking change from v1)
- `effect` is now a first-class keyword (previously implicit allow-only)

### Security

- Removed all use of `eval()` and `new Function()` (present in v1)
- Added path traversal validation on all file loading methods
- Added prototype pollution rejection in context builder

---

## [1.x] — Legacy

The original v1 codebase. End of life — no further security patches.
Upgrade using the [migration guide](./docs/MIGRATION_v1_v2.md).
