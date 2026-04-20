# simple-authz

> A lightweight, secure authorization engine for Node.js using TOON policy files.

![CI](https://github.com/dhruvil05/simple-authz/actions/workflows/ci.yml/badge.svg)
![npm](https://img.shields.io/npm/v/simple-authz)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

---

## Status

**v2.0.0 is under active development.** The package is not yet published.
See the [roadmap](#roadmap) for the current phase.

| Phase | Status | Description |
|-------|--------|-------------|
| P0 — Scaffold | ✅ Complete | Repo, tooling, CI, stubs |
| P1 — Grammar spec | 🔲 Pending | TOON v2 formal grammar |
| P2 — Lexer + Parser | 🔲 Pending | Tokeniser and AST builder |
| P3 — Compiler | 🔲 Pending | AST → lookup index |
| P4 — Evaluator | 🔲 Pending | Safe condition evaluation |
| P5 — Authz engine | 🔲 Pending | Public API |
| P6 — DX + docs | 🔲 Pending | README, publish, release |

---

## Quick start (preview)

```ts
import { Authz } from 'simple-authz'

const authz = new Authz()
await authz.loadAsync('./policies/authz.toon')

const allowed = authz.can(user, 'edit', 'listing', listing)
```

Full documentation will be published alongside v2.0.0.

---

## Contributing

See [SECURITY.md](./SECURITY.md) before reporting vulnerabilities.
