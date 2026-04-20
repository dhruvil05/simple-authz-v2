# Security policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | No — end of life |

---

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report them privately so we can coordinate a fix before public disclosure.

### How to report

Email: **security@simple-authz** *(replace with real address before publishing)*

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional but appreciated)

### Response timeline

| Milestone | Target |
|-----------|--------|
| Acknowledgement | Within 48 hours |
| Severity assessment | Within 5 business days |
| Fix + patch release | Within 30 days for critical, 90 days for others |
| Public disclosure | Coordinated with reporter |

### Scope

The following are in scope:

- Remote code execution via policy files or inputs
- Authorization bypass (false `allow` when should be `deny`)
- Prototype pollution via user/resource objects
- Path traversal in `load()` / `loadAsync()`
- Denial of service via crafted policy files or inputs
- Information disclosure via error messages

### Out of scope

- Vulnerabilities in example policy files (these are illustrative only)
- Issues in devDependencies that don't affect the published package

---

## Security design principles

1. **No `eval()`** — condition expressions are evaluated by walking a pre-compiled AST. The CI pipeline enforces this with a grep check on every build.
2. **Deny by default** — if no rule matches, access is denied.
3. **Deny overrides allow** — explicit `effect: deny` always wins.
4. **Frozen inputs** — user and resource objects are deep-cloned and frozen before condition evaluation.
5. **Path safety** — policy file paths are validated against `process.cwd()` before any file read.
6. **Prototype pollution protection** — `__proto__`, `constructor`, and `prototype` keys are rejected.
