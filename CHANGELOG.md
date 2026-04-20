# Changelog

All notable changes to simple-authz will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Added
- TypeScript-first rewrite with strict mode and zero `any` in public API
- TOON v2 language with `AND`, `OR`, `NOT` condition operators
- Explicit `effect: allow | deny` on every rule
- `role_hierarchy` block for role inheritance
- `include` directive for modular policy files
- Sandboxed AST-walk condition evaluator — no `eval()` ever
- Prototype pollution protection on all user/resource inputs
- Path traversal protection on `load()` and `loadAsync()`
- `explain()` method returning detailed `AuthzResult`
- `validate()` method returning structured `ValidationResult`
- Audit callback (`options.audit`) for decision logging
- Dual ESM + CJS output
- GitHub Actions CI across Node 18, 20, 22
- 90%+ branch coverage enforcement

---

## [1.x] — Legacy

The original v1 codebase is archived. See `MIGRATION_v1_v2.md` for upgrade guidance.
