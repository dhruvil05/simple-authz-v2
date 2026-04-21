# Condition context specification

This document defines the exact shape of the evaluation context available
inside TOON v2 `condition` expressions.

It is the authoritative reference for the evaluator (Phase 4) and the
context builder (Phase 4). Any ambiguity in evaluator source code is resolved
by this document.

---

## The three root variables

When a condition expression is evaluated, exactly three root variables are
in scope. No other identifiers, globals, or built-in functions are accessible.

| Variable   | Source                                    | Default if omitted |
|------------|-------------------------------------------|--------------------|
| `user`     | 1st argument to `can()` / `explain()`    | Required — no default |
| `resource` | 4th argument to `can()` / `explain()`    | `{}` (empty object) |
| `ctx`      | 5th argument to `can()` / `explain()`    | `{}` (empty object) |

---

## The `user` variable

The `user` object represents the authenticated subject performing the action.

### Required fields

```ts
interface User {
  id: string | number   // unique identifier for the user
  roles: string[]       // non-empty array of role names
}
```

### Optional fields

Any additional application-specific fields may be present and are accessible
in conditions:

```toon
condition user.plan == "premium"
condition user.tenant_id == resource.tenant_id
condition user.verified == true
```

---

## The `resource` variable

The `resource` object represents the thing being acted upon — the 4th argument
passed to `can()`.

There is no required shape. Any plain object is valid.

```toon
condition resource.owner_id == user.id
condition resource.status == "draft"
condition resource.count > 0
condition resource.meta.published == true
```

If `can()` is called without a 4th argument, `resource` defaults to `{}`.
Accessing any path on `{}` returns `undefined`.

---

## The `ctx` variable

The `ctx` object carries optional extra context — the 5th argument to `can()`.
Use it for request-scoped data that is not part of the user or resource:

```ts
authz.can(user, 'view', 'report', report, {
  ipAddress: req.ip,
  tenantId: req.headers['x-tenant-id'],
  requestTime: Date.now(),
})
```

```toon
condition ctx.tenantId == resource.tenantId
```

---

## Safety guarantees

Before the evaluator receives the context, the context builder applies the
following transformations to ALL THREE objects:

### 1. Deep clone

All three objects are deep-cloned via `JSON.parse(JSON.stringify(obj))` before
any processing. This ensures that:

- Mutating the original user/resource after calling `can()` has no effect
  on the condition evaluation
- Two concurrent `can()` calls cannot interfere with each other

**Limitation:** Values that are not JSON-serialisable (`undefined`, `Function`,
`Symbol`, `BigInt`, circular references) are silently dropped by the clone step.
Do not rely on non-serialisable values being accessible in conditions.

### 2. Prototype pollution check

Before cloning, the context builder scans the top-level keys of each object
for the following dangerous key names:

- `__proto__`
- `constructor`
- `prototype`

If any are found at any nesting level, a `ContextError` is thrown immediately.
The check is applied recursively up to `maxContextDepth`.

### 3. Object.freeze (deep)

After cloning, all three objects and all nested objects within them are
recursively frozen via `Object.freeze()`. This prevents the evaluator from
accidentally mutating context values.

### 4. Depth limit

The context builder enforces a maximum nesting depth (default: `10`,
configurable via `AuthzOptions.maxContextDepth`). Objects nested beyond this
depth are not cloned — the nesting stops at the limit. This prevents DoS via
deeply nested input objects.

---

## Path resolution rules

A `path_expr` in a condition resolves a value from the context:

```
user.id            ->  context.user.id
resource.owner_id  ->  context.resource.owner_id
ctx.tenant_id      ->  context.ctx.tenant_id
resource.meta.tag  ->  context.resource.meta.tag
```

### Resolution algorithm

```
resolve(segments, context):
  current = context[segments[0]]   // "user", "resource", or "ctx"
  for each remaining segment:
    if current is null or not an object:
      return undefined
    current = current[segment]
  return current
```

### Key rules

1. If any segment in the path does not exist, resolution returns `undefined`.
   It NEVER throws.
2. `undefined` values compare as follows under strict equality:
   - `undefined == undefined` → `true`
   - `undefined == null`      → `false` (strict — no JS loose coercion)
   - `undefined == ""` → `false`
3. Traversing through a non-object (string, number, boolean, null) returns
   `undefined` for all further segments.

### Examples

Given context:
```json
{
  "user":     { "id": 10, "roles": ["broker"], "plan": "premium" },
  "resource": { "owner_id": 10, "status": "draft", "meta": { "tag": "featured" } },
  "ctx":      {}
}
```

| Path expression          | Resolved value  |
|--------------------------|-----------------|
| `user.id`                | `10`            |
| `user.plan`              | `"premium"`     |
| `user.missing`           | `undefined`     |
| `resource.owner_id`      | `10`            |
| `resource.status`        | `"draft"`       |
| `resource.meta.tag`      | `"featured"`    |
| `resource.meta.missing`  | `undefined`     |
| `resource.status.length` | `undefined`     |
| `ctx.tenantId`           | `undefined`     |

---

## Comparison semantics

All comparisons use **strict equality** — no JavaScript type coercion.

| Operator | Semantics                                         |
|----------|---------------------------------------------------|
| `==`     | `left === right` (strict)                         |
| `!=`     | `left !== right` (strict)                         |
| `>`      | `left > right` (numeric or lexicographic)         |
| `>=`     | `left >= right`                                   |
| `<`      | `left < right`                                    |
| `<=`     | `left <= right`                                   |

For `>`, `>=`, `<`, `<=`: if either operand is not a number or string,
the result is `false` (not an error).

---

## What is NOT accessible in conditions

The following are intentionally inaccessible:

- `global`, `globalThis`, `window`, `process`, `require`, `import`
- `Math`, `JSON`, `Date`, `Array`, `Object`, `Function`
- Any function call: `user.isAdmin()` is a parse error
- `eval`, `Function` constructor — never used
- Any variable not named `user`, `resource`, or `ctx`

Attempting to use an undefined root variable (e.g. `request.id`) is caught
at compile time (SE-06) and throws a `CompileError` before any evaluation
occurs.
