# simple-authz

> A lightweight, secure authorization engine for Node.js using TOON policy files.

![CI](https://github.com/dhruvil05/simple-authz/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/tests-298%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-%E2%89%A590%25-brightgreen)
![npm](https://img.shields.io/npm/v/simple-authz)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

---

## Why simple-authz?

Authorization logic scattered across application code looks like this:

```ts
if (user.role === 'admin') { ... }
if (user.id === listing.owner_id) { ... }
if (user.permissions.includes('edit_listing')) { ... }
```

Over time this becomes unmaintainable. **simple-authz moves all authorization
rules into a single policy file** so your application only ever asks one question:

```ts
authz.can(user, 'edit', 'listing', listing)
```

---

## Features

- **TOON v2 policy language** — readable, human-auditable `.toon` files
- **Role hierarchy** — `super_admin extends admin extends editor`
- **Deny rules** — explicit `effect: deny` always overrides any `allow`
- **Conditions** — `AND`, `OR`, `NOT` with full precedence rules
- **Zero `eval()`** — conditions evaluated by pure AST tree-walk
- **Prototype pollution protection** — user/resource inputs are deep-cloned and frozen
- **Path traversal protection** — `load()` validates paths against `process.cwd()`
- **TypeScript-first** — full `.d.ts`, zero `any` in public API
- **Dual ESM + CJS** — works with `import` and `require`
- **Audit callback** — structured decision logging for compliance
- **Deny by default** — if no rule matches, access is denied

---

## Installation

```bash
npm install simple-authz
```

**Requirements:** Node.js 18 or later.

---

## Quick start

### 1. Create a policy file

```toon
# policies/authz.toon

role_hierarchy
  super_admin extends admin
  admin extends editor
  editor extends viewer
end

rule
  role admin
  action *
  resource *
  effect allow
end

rule
  role broker
  action edit
  resource listing
  effect allow
  condition resource.owner_id == user.id AND resource.status == "draft"
end

rule
  role user
  action view
  resource listing
  effect allow
  condition resource.status == "public" OR resource.owner_id == user.id
end
```

### 2. Load and check permissions

```ts
import { Authz } from 'simple-authz'

const authz = new Authz()
await authz.loadAsync('./policies/authz.toon')

// Simple check
const allowed = authz.can(user, 'edit', 'listing', listing)

// Detailed explanation (for debugging)
const result = authz.explain(user, 'edit', 'listing', listing)
// {
//   allowed: true,
//   reason: 'allow-rule-matched',
//   matchedRole: 'broker',
//   matchedAction: 'edit',
//   matchedResource: 'listing',
//   conditionResult: true,
//   durationMs: 0.12
// }
```

### 3. Protect Express routes

```ts
app.put('/listings/:id', async (req, res) => {
  if (!authz.can(req.user, 'edit', 'listing', req.listing)) {
    return res.status(403).json({ error: 'Access denied' })
  }
  // proceed
})
```

---

## API reference

### `new Authz(options?)`

```ts
const authz = new Authz({
  // Called after every authorization decision. Errors are swallowed.
  audit: (record: AuditRecord) => logger.info(record),

  // Maximum nesting depth for user/resource objects (default: 10)
  maxContextDepth: 10,
})
```

---

### `authz.load(filePath)`

Synchronously load and compile a `.toon` policy file.

```ts
authz.load('./policies/authz.toon')
```

Throws `PathSafetyError` if the path resolves outside `process.cwd()`.
Throws `ParseError` or `CompileError` on invalid policy content.

---

### `authz.loadAsync(filePath)`

Asynchronous version of `load()`. Preferred in production server code.

```ts
await authz.loadAsync('./policies/authz.toon')
```

---

### `authz.can(user, action, resource, resourceObject?, extraCtx?)`

Returns `true` if the user is permitted to perform the action. Deny rules
always override allow rules. Returns `false` if no policy is loaded.

```ts
authz.can(user, 'edit', 'listing', listing)
authz.can(user, 'view', 'report', report, { tenantId: req.tenantId })
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `user` | `User` | Yes | Authenticated subject — must have `id` and `roles` |
| `action` | `string` | Yes | The action being performed |
| `resource` | `string` | Yes | The resource type name |
| `resourceObject` | `object` | No | The actual resource (used in conditions) |
| `extraCtx` | `object` | No | Extra context — available as `ctx.*` in conditions |

---

### `authz.explain(user, action, resource, resourceObject?, extraCtx?)`

Returns a detailed `AuthzResult` explaining the decision. Use for debugging
and audit logging. Use `can()` in hot paths.

```ts
const result = authz.explain(user, 'edit', 'listing', listing)
// AuthzResult:
// {
//   allowed: boolean
//   reason: 'allow-rule-matched' | 'deny-rule-matched' | 'condition-failed'
//         | 'no-matching-rule' | 'wildcard-matched'
//   matchedRole?: string
//   matchedAction?: string
//   matchedResource?: string
//   conditionResult?: boolean
//   durationMs: number
// }
```

---

### `authz.validate(filePath)`

Validates a `.toon` file without loading it into the engine. Never throws
(except for `PathSafetyError` — path safety violations are always re-thrown).

```ts
const result = authz.validate('./policies/authz.toon')
// { valid: true, errors: [] }
// { valid: false, errors: [{ message, line, column }] }
```

---

## Policy language (TOON v2)

### Rule syntax

```toon
rule
  role    <role-name>
  action  <action-name | *>
  resource <resource-name | *>
  effect  <allow | deny>          # optional — defaults to allow
  condition <expr>                 # optional
end
```

All four fields (`role`, `action`, `resource`) are required. `effect` and
`condition` are optional.

---

### Effects

```toon
# Allow rule (default when effect is omitted)
rule
  role admin
  action *
  resource *
  effect allow
end

# Deny rule — overrides any matching allow rule
rule
  role admin
  action delete
  resource archived_listing
  effect deny
end
```

**Deny always wins.** If a deny rule matches, access is denied regardless of
any allow rules that also match.

---

### Conditions

Conditions reference three root variables:

| Variable | Source |
|---|---|
| `user` | The `User` object passed to `can()` |
| `resource` | The `resourceObject` (4th argument to `can()`) |
| `ctx` | The `extraCtx` (5th argument to `can()`) |

```toon
# Ownership check
condition resource.owner_id == user.id

# Combined with AND
condition resource.owner_id == user.id AND resource.status == "draft"

# Combined with OR
condition resource.status == "public" OR resource.owner_id == user.id

# Negation
condition NOT resource.archived == true

# Parentheses for grouping
condition (resource.status == "public" OR resource.owner_id == user.id) AND NOT resource.suspended == true
```

**Operator precedence** (tightest to loosest):
1. `( )` — grouping
2. `== != > >= < <=` — comparison
3. `NOT` — unary negation
4. `AND` — logical and
5. `OR` — logical or

**Comparison operators:** `==` `!=` `>` `>=` `<` `<=`
All use strict equality — no JavaScript type coercion.

---

### Role hierarchy

```toon
role_hierarchy
  super_admin extends admin
  admin extends editor
  editor extends viewer
end
```

`super_admin` inherits all rules of `admin`, `editor`, and `viewer`.
Inheritance is fully expanded at compile time — zero runtime cost.
Cycles are detected and throw a `CompileError`.

---

### Include directive

Split large policies across multiple files:

```toon
include "./policies/listings.toon"
include "./policies/users.toon"
```

Paths are resolved relative to the file containing the `include`.
Circular includes are detected and throw a `CompileError`.

---

### Comments

```toon
# This is a comment
rule
  role admin   # inline comment
  action *
  resource *
end
```

---

## TypeScript types

```ts
import type {
  User,
  AuthzOptions,
  AuthzResult,
  AuditRecord,
  ValidationResult,
  PolicyError,
  DecisionReason,
} from 'simple-authz'

// User shape
interface User {
  id: string | number
  roles: readonly string[]
  [key: string]: unknown  // any additional fields accessible in conditions
}

// Decision reasons
type DecisionReason =
  | 'allow-rule-matched'
  | 'deny-rule-matched'
  | 'condition-failed'
  | 'no-matching-rule'
  | 'wildcard-matched'
```

---

## Error types

```ts
import {
  AuthzError,      // base class
  ParseError,      // invalid .toon syntax  — has .line, .column, .sourcePath
  CompileError,    // semantic error        — has .sourcePath
  EvaluationError, // condition eval error
  PathSafetyError, // path traversal attempt
  ContextError,    // prototype pollution or bad input shape
} from 'simple-authz'
```

---

## Audit logging

```ts
const authz = new Authz({
  audit: (record) => {
    // AuditRecord shape:
    // {
    //   allowed: boolean
    //   userId: string | number
    //   roles: readonly string[]
    //   action: string
    //   resource: string
    //   reason: DecisionReason
    //   durationMs: number
    //   timestamp: number   // unix ms
    // }
    logger.info({ event: 'authz_decision', ...record })
  },
})
```

Errors thrown inside the audit callback are silently swallowed and will never
propagate to the caller.

---

## Security model

| Property | Behaviour |
|---|---|
| **Deny by default** | No rule match → access denied |
| **Deny overrides allow** | Explicit `effect: deny` always wins |
| **No `eval()`** | Conditions evaluated by AST tree-walk |
| **Input isolation** | user/resource deep-cloned and frozen before evaluation |
| **Prototype pollution** | `__proto__`, `constructor`, `prototype` keys rejected |
| **Path safety** | `load()` paths validated against `process.cwd()` |
| **Depth limit** | Nested objects truncated at `maxContextDepth` (default: 10) |

See [SECURITY.md](./SECURITY.md) for the vulnerability disclosure process.

---

## Migration from v1

See [MIGRATION_v1_v2.md](./docs/MIGRATION_v1_v2.md) for a complete upgrade guide.

The most important change: condition variables now use `resource.x` instead
of the resource type name (e.g. `listing.x`).

```diff
- condition listing.owner_id == user.id
+ condition resource.owner_id == user.id
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Ensure `pnpm ci` passes (typecheck + lint + tests + build)
4. Open a pull request

See [SECURITY.md](./SECURITY.md) before reporting vulnerabilities.

---

## License

[Apache 2.0](./LICENSE) — © 2025 Dhruvil
