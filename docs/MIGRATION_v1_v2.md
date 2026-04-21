# Migration guide — v1 to v2

This guide covers breaking changes when upgrading from simple-authz v1
to v2. The v2 rewrite is a full ground-up rebuild; there are meaningful
changes to both the policy language and the JavaScript API.

---

## Policy language changes (TOON v1 → TOON v2)

### `effect` statement is now explicit

**v1** — effect was always `allow` with no keyword:

```toon
rule
  role admin
  action *
  resource *
end
```

**v2** — `effect` is optional but explicit when present:

```toon
rule
  role admin
  action *
  resource *
  effect allow    # still defaults to allow if omitted
end
```

**Action required:** No change needed for existing `allow` rules.
To add `deny` rules (new in v2), use `effect deny`.

---

### Condition variable naming

**v1** — the resource object inside conditions was referenced by its type name:

```toon
condition listing.owner_id == user.id
```

**v2** — the resource object is always referenced as `resource`:

```toon
condition resource.owner_id == user.id
```

**Action required:** Replace all bare resource-type names in conditions
with `resource`. For example:

```diff
- condition listing.owner_id == user.id
+ condition resource.owner_id == user.id

- condition profile.id == user.id
+ condition resource.id == user.id
```

---

### AND / OR / NOT operators

**v1** — only `OR` was supported between conditions:

```toon
condition listing.status == "public" OR listing.owner_id == user.id
```

**v2** — `AND`, `OR`, `NOT` are all supported with correct precedence:

```toon
condition resource.status == "public" OR resource.owner_id == user.id
condition resource.owner_id == user.id AND resource.status == "draft"
condition NOT resource.archived == true
condition (resource.status == "public" OR resource.owner_id == user.id) AND NOT resource.suspended == true
```

**Action required:** Existing `OR` conditions work unchanged (after renaming
the resource variable above). Add `AND` / `NOT` where needed.

---

### Role hierarchy (new in v2)

**v1** — no inheritance. Every role needed its own complete set of rules.

**v2** — use `role_hierarchy` to inherit permissions:

```toon
role_hierarchy
  super_admin extends admin
  admin extends editor
  editor extends viewer
end
```

**Action required:** Optional. Existing flat rule sets still work.
Use `role_hierarchy` to reduce duplication.

---

### Include directive (new in v2)

**v1** — all rules had to be in a single file.

**v2** — split policies across multiple files:

```toon
include "./policies/listings.toon"
include "./policies/users.toon"
```

**Action required:** Optional. Single-file policies still work.

---

## JavaScript API changes

### `load()` path safety

**v1** — `authz.load()` accepted any path string with no validation.

**v2** — paths are validated against `process.cwd()`. Any path that resolves
outside the working directory throws `PathSafetyError`.

```ts
// This now throws PathSafetyError
authz.load('../../../etc/passwd')

// This is fine — resolves inside cwd
authz.load('./policies/authz.toon')
```

**Action required:** Ensure all policy file paths are inside your project
directory. Absolute paths outside `cwd` are rejected.

---

### `loadAsync()` is new

**v1** — `load()` was synchronous only, blocking the event loop.

**v2** — `loadAsync()` returns a Promise:

```ts
// v1
authz.load('./authz.toon')

// v2 — async preferred in production
await authz.loadAsync('./policies/authz.toon')
```

**Action required:** Migrate to `loadAsync()` in server startup code.
`load()` still works for scripts and tests.

---

### `can()` signature change

**v1:**
```ts
authz.can(user, action, resource, object)
// 4th param: the resource object
```

**v2:**
```ts
authz.can(user, action, resource, resourceObject?, extraCtx?)
// 4th param: resource object (same)
// 5th param: extra context (new)
```

**Action required:** No change needed for existing calls. The 5th param
is optional.

---

### `explain()` return type

**v1** — returned a loosely typed object.

**v2** — returns a fully typed `AuthzResult`:

```ts
interface AuthzResult {
  allowed: boolean
  reason: DecisionReason   // 'allow-rule-matched' | 'deny-rule-matched' | ...
  matchedRole?: string
  matchedAction?: string
  matchedResource?: string
  conditionResult?: boolean
  durationMs: number
}
```

**Action required:** Update any code that reads specific fields from the
`explain()` result — field names have changed.

---

### Typed errors

**v2** exports typed error classes. Use `instanceof` to handle specific errors:

```ts
import { Authz, ParseError, PathSafetyError, CompileError } from 'simple-authz'

try {
  authz.load('./policies/authz.toon')
} catch (err) {
  if (err instanceof ParseError) {
    console.error(`Syntax error at line ${err.line}, col ${err.column}`)
  } else if (err instanceof PathSafetyError) {
    console.error('Path traversal attempt blocked')
  }
}
```

---

### Audit callback (new)

**v2** adds an audit callback for decision logging:

```ts
const authz = new Authz({
  audit: (record) => {
    logger.info(record)
    // { allowed, userId, roles, action, resource, reason, durationMs, timestamp }
  }
})
```

**Action required:** Optional — add where compliance logging is needed.

---

## Summary checklist

- [ ] Replace `listing.x`, `profile.x` etc. in conditions with `resource.x`
- [ ] Review paths passed to `load()` — must be inside `cwd`
- [ ] Migrate `load()` → `loadAsync()` in server startup
- [ ] Update `explain()` result field references
- [ ] Add `effect allow` / `effect deny` where explicit effect is desired
- [ ] (Optional) Add `role_hierarchy` to reduce duplicated rules
- [ ] (Optional) Split large policy files using `include`
- [ ] (Optional) Add `options.audit` for decision logging
