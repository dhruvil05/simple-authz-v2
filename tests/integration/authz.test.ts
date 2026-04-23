import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'
import { Authz } from '../../src/authz.js'
import { ParseError, PathSafetyError } from '../../src/errors.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fixture = (name: string) =>
  resolve(process.cwd(), 'tests/fixtures', name)

function make(fixtureName: string): Authz {
  const authz = new Authz()
  authz.load(fixture(fixtureName))
  return authz
}

// ─── Basic RBAC ───────────────────────────────────────────────────────────────

describe('Integration: basic RBAC (basic-rbac.toon)', () => {
  let authz: Authz

  beforeAll(() => { authz = make('basic-rbac.toon') })

  const admin  = { id: 1, roles: ['admin'] }
  const broker = { id: 2, roles: ['broker'] }
  const user   = { id: 3, roles: ['user'] }
  const nobody = { id: 4, roles: ['ghost'] }

  it('admin can perform any action on any resource (wildcard)', () => {
    expect(authz.can(admin, 'delete', 'listing')).toBe(true)
    expect(authz.can(admin, 'publish', 'listing')).toBe(true)
    expect(authz.can(admin, 'nuke', 'everything')).toBe(true)
  })
  it('broker can publish listing', () => {
    expect(authz.can(broker, 'publish', 'listing')).toBe(true)
  })
  it('broker can view listing', () => {
    expect(authz.can(broker, 'view', 'listing')).toBe(true)
  })
  it('broker cannot delete listing (no rule)', () => {
    expect(authz.can(broker, 'delete', 'listing')).toBe(false)
  })
  it('user can view listing', () => {
    expect(authz.can(user, 'view', 'listing')).toBe(true)
  })
  it('user cannot publish listing', () => {
    expect(authz.can(user, 'publish', 'listing')).toBe(false)
  })
  it('unknown role returns false for all checks', () => {
    expect(authz.can(nobody, 'view', 'listing')).toBe(false)
    expect(authz.can(nobody, 'edit', 'anything')).toBe(false)
  })
  it('no policy loaded → returns false', () => {
    const empty = new Authz()
    expect(empty.can(admin, 'edit', 'listing')).toBe(false)
  })
})

// ─── Ownership conditions ─────────────────────────────────────────────────────

describe('Integration: ownership conditions (ownership.toon)', () => {
  let authz: Authz

  beforeAll(() => { authz = make('ownership.toon') })

  const owner   = { id: 10, roles: ['broker'] }
  const other   = { id: 99, roles: ['broker'] }
  const ownedDraft   = { owner_id: 10, status: 'draft' }
  const ownedPublic  = { owner_id: 10, status: 'public' }
  const foreignDraft = { owner_id: 10, status: 'draft' }  // owned by id:10, not id:99

  it('broker can edit listing they own', () => {
    expect(authz.can(owner, 'edit', 'listing', ownedDraft)).toBe(true)
  })
  it('broker cannot edit listing they do not own', () => {
    expect(authz.can(other, 'edit', 'listing', ownedDraft)).toBe(false)
  })
  it('broker can delete own draft listing', () => {
    expect(authz.can(owner, 'delete', 'listing', ownedDraft)).toBe(true)
  })
  it('broker cannot delete own public listing (status != draft)', () => {
    expect(authz.can(owner, 'delete', 'listing', ownedPublic)).toBe(false)
  })
  it('broker cannot delete foreign draft listing', () => {
    expect(authz.can(other, 'delete', 'listing', foreignDraft)).toBe(false)
  })
  it('user can view public listing they do not own', () => {
    const viewer = { id: 55, roles: ['user'] }
    expect(authz.can(viewer, 'view', 'listing', { owner_id: 10, status: 'public' })).toBe(true)
  })
  it('user cannot view non-public listing they do not own', () => {
    const viewer = { id: 55, roles: ['user'] }
    expect(authz.can(viewer, 'view', 'listing', { owner_id: 10, status: 'draft' })).toBe(false)
  })
  it('user can view their own listing regardless of status', () => {
    const viewer = { id: 10, roles: ['user'] }
    expect(authz.can(viewer, 'view', 'listing', { owner_id: 10, status: 'draft' })).toBe(true)
  })
  it('can() returns false when resourceObject not provided and condition exists', () => {
    expect(authz.can(owner, 'edit', 'listing')).toBe(false)
  })
})

// ─── Deny rules ───────────────────────────────────────────────────────────────

describe('Integration: deny rules (deny-rules.toon)', () => {
  let authz: Authz

  beforeAll(() => { authz = make('deny-rules.toon') })

  const admin  = { id: 1, roles: ['admin'] }
  const broker = { id: 2, roles: ['broker'] }

  it('admin can delete regular listings', () => {
    expect(authz.can(admin, 'delete', 'listing')).toBe(true)
  })
  it('deny rule blocks admin from deleting archived listings', () => {
    expect(authz.can(admin, 'delete', 'archived_listing')).toBe(false)
  })
  it('deny rule for archived_listing does not block other resources', () => {
    expect(authz.can(admin, 'delete', 'profile')).toBe(true)
  })
  it('broker can edit their own non-suspended listing', () => {
    expect(authz.can(broker, 'edit', 'listing', { owner_id: 2, suspended: false })).toBe(true)
  })
  it('deny rule blocks broker from editing suspended listing even if they own it', () => {
    expect(authz.can(broker, 'edit', 'listing', { owner_id: 2, suspended: true })).toBe(false)
  })
  it('explain() reason is "deny-rule-matched" when deny overrides allow', () => {
    const result = authz.explain(admin, 'delete', 'archived_listing')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('deny-rule-matched')
  })
})

// ─── Role hierarchy ───────────────────────────────────────────────────────────

describe('Integration: role hierarchy (role-hierarchy.toon)', () => {
  let authz: Authz

  beforeAll(() => { authz = make('role-hierarchy.toon') })

  const viewer     = { id: 1, roles: ['viewer'] }
  const editor     = { id: 2, roles: ['editor'] }
  const admin      = { id: 3, roles: ['admin'] }
  const superAdmin = { id: 4, roles: ['super_admin'] }

  it('viewer can view listing', () => {
    expect(authz.can(viewer, 'view', 'listing')).toBe(true)
  })
  it('viewer cannot edit listing', () => {
    expect(authz.can(viewer, 'edit', 'listing')).toBe(false)
  })
  it('editor can edit listing (own rule)', () => {
    expect(authz.can(editor, 'edit', 'listing')).toBe(true)
  })
  it('editor inherits view from viewer', () => {
    expect(authz.can(editor, 'view', 'listing')).toBe(true)
  })
  it('editor cannot delete listing', () => {
    expect(authz.can(editor, 'delete', 'listing')).toBe(false)
  })
  it('admin can delete listing (own rule)', () => {
    expect(authz.can(admin, 'delete', 'listing')).toBe(true)
  })
  it('admin inherits edit from editor', () => {
    expect(authz.can(admin, 'edit', 'listing')).toBe(true)
  })
  it('admin inherits view from viewer (transitive)', () => {
    expect(authz.can(admin, 'view', 'listing')).toBe(true)
  })
  it('super_admin can purge listing (own rule)', () => {
    expect(authz.can(superAdmin, 'purge', 'listing')).toBe(true)
  })
  it('super_admin inherits delete from admin', () => {
    expect(authz.can(superAdmin, 'delete', 'listing')).toBe(true)
  })
  it('super_admin inherits edit from editor (transitive)', () => {
    expect(authz.can(superAdmin, 'edit', 'listing')).toBe(true)
  })
  it('super_admin inherits view from viewer (fully transitive)', () => {
    expect(authz.can(superAdmin, 'view', 'listing')).toBe(true)
  })
})

// ─── Wildcard rules ───────────────────────────────────────────────────────────

describe('Integration: wildcard rules (wildcard.toon)', () => {
  let authz: Authz

  beforeAll(() => { authz = make('wildcard.toon') })

  const admin     = { id: 1, roles: ['admin'] }
  const moderator = { id: 2, roles: ['moderator'] }

  it('wildcard action * matches any action string', () => {
    expect(authz.can(admin, 'destroy', 'listing')).toBe(true)
    expect(authz.can(admin, 'fly',     'listing')).toBe(true)
  })
  it('wildcard resource * matches any resource string', () => {
    expect(authz.can(admin, 'edit', 'profile')).toBe(true)
    expect(authz.can(admin, 'edit', 'invoice')).toBe(true)
  })
  it('wildcard action + wildcard resource matches everything', () => {
    expect(authz.can(admin, 'anything', 'anywhere')).toBe(true)
  })
  it('moderator wildcard action matches any action on listing', () => {
    expect(authz.can(moderator, 'approve', 'listing')).toBe(true)
    expect(authz.can(moderator, 'reject',  'listing')).toBe(true)
  })
  it('moderator wildcard does not cover other resources', () => {
    expect(authz.can(moderator, 'edit', 'profile')).toBe(false)
  })
  it('explain() reason is "wildcard-matched" for wildcard rules', () => {
    const result = authz.explain(admin, 'anything', 'anywhere')
    expect(result.reason).toBe('wildcard-matched')
  })
})

// ─── Multi-role user ──────────────────────────────────────────────────────────

describe('Integration: multi-role user (multi-role-user.toon)', () => {
  let authz: Authz

  beforeAll(() => { authz = make('multi-role-user.toon') })

  const viewerEditor = { id: 1, roles: ['viewer', 'editor'] }
  const editorAdmin  = { id: 2, roles: ['editor', 'admin'] }

  it('viewer+editor user can view listing', () => {
    expect(authz.can(viewerEditor, 'view', 'listing')).toBe(true)
  })
  it('viewer+editor user can edit listing', () => {
    expect(authz.can(viewerEditor, 'edit', 'listing')).toBe(true)
  })
  it('viewer+editor user can publish listing', () => {
    expect(authz.can(viewerEditor, 'publish', 'listing')).toBe(true)
  })
  it('viewer+editor user cannot delete listing (no rule for either role)', () => {
    expect(authz.can(viewerEditor, 'delete', 'listing')).toBe(false)
  })
  it('editor+admin user can delete listing', () => {
    expect(authz.can(editorAdmin, 'delete', 'listing')).toBe(true)
  })
  it('editor+admin user can edit listing', () => {
    expect(authz.can(editorAdmin, 'edit', 'listing')).toBe(true)
  })
})

// ─── explain() output ─────────────────────────────────────────────────────────

describe('Integration: explain() output', () => {
  let authz: Authz

  beforeAll(() => { authz = make('basic-rbac.toon') })

  const admin  = { id: 1, roles: ['admin'] }
  const broker = { id: 2, roles: ['broker'] }

  it('returns allowed:true with reason "allow-rule-matched" or "wildcard-matched"', () => {
    const result = authz.explain(broker, 'publish', 'listing')
    expect(result.allowed).toBe(true)
    expect(['allow-rule-matched', 'wildcard-matched']).toContain(result.reason)
  })
  it('returns allowed:false with reason "no-matching-rule"', () => {
    const result = authz.explain(broker, 'delete', 'listing')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('no-matching-rule')
  })
  it('returns allowed:false with reason "condition-failed"', () => {
    const ownershipAuthz = make('ownership.toon')
    const result = ownershipAuthz.explain(
      { id: 99, roles: ['broker'] },
      'edit', 'listing',
      { owner_id: 10 },
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('condition-failed')
  })
  it('returns allowed:false with reason "deny-rule-matched"', () => {
    const denyAuthz = make('deny-rules.toon')
    const result = denyAuthz.explain(
      { id: 1, roles: ['admin'] },
      'delete', 'archived_listing',
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('deny-rule-matched')
  })
  it('explain() result includes matchedRole on allow', () => {
    const result = authz.explain(broker, 'publish', 'listing')
    expect(result.matchedRole).toBe('broker')
  })
  it('explain() result includes durationMs as a number >= 0', () => {
    const result = authz.explain(admin, 'edit', 'listing')
    expect(typeof result.durationMs).toBe('number')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })
})

// ─── validate() ───────────────────────────────────────────────────────────────

describe('Integration: validate()', () => {
  it('returns { valid: true } for a well-formed policy file', () => {
    const authz = new Authz()
    const result = authz.validate(fixture('basic-rbac.toon'))
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
  it('returns { valid: false } for an invalid syntax file', () => {
    const authz = new Authz()
    const result = authz.validate(fixture('invalid-syntax.toon'))
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
  it('error object has a message string', () => {
    const authz = new Authz()
    const result = authz.validate(fixture('invalid-syntax.toon'))
    expect(typeof result.errors[0].message).toBe('string')
    expect(result.errors[0].message.length).toBeGreaterThan(0)
  })
  it('never throws — always returns a result object', () => {
    const authz = new Authz()
    expect(() => authz.validate(fixture('invalid-syntax.toon'))).not.toThrow()
  })
  it('throws PathSafetyError for traversal paths', () => {
    const authz = new Authz()
    expect(() => authz.validate('../../../etc/passwd')).toThrow(PathSafetyError)
  })
})

// ─── Audit callback ───────────────────────────────────────────────────────────

describe('Integration: audit callback', () => {
  it('audit callback receives correct userId', () => {
    let captured: unknown = null
    const authz = new Authz({ audit: (r) => { captured = r } })
    authz.load(fixture('basic-rbac.toon'))
    authz.can({ id: 42, roles: ['broker'] }, 'publish', 'listing')
    expect((captured as { userId: number }).userId).toBe(42)
  })
  it('audit callback receives correct action and resource', () => {
    let captured: unknown = null
    const authz = new Authz({ audit: (r) => { captured = r } })
    authz.load(fixture('basic-rbac.toon'))
    authz.can({ id: 1, roles: ['admin'] }, 'delete', 'profile')
    expect((captured as { action: string }).action).toBe('delete')
    expect((captured as { resource: string }).resource).toBe('profile')
  })
  it('audit callback receives allowed: true for permitted action', () => {
    let allowed: unknown = null
    const authz = new Authz({ audit: (r) => { allowed = r.allowed } })
    authz.load(fixture('basic-rbac.toon'))
    authz.can({ id: 1, roles: ['admin'] }, 'edit', 'listing')
    expect(allowed).toBe(true)
  })
  it('audit callback receives allowed: false for denied action', () => {
    let allowed: unknown = null
    const authz = new Authz({ audit: (r) => { allowed = r.allowed } })
    authz.load(fixture('basic-rbac.toon'))
    authz.can({ id: 1, roles: ['user'] }, 'delete', 'listing')
    expect(allowed).toBe(false)
  })
  it('audit callback receives timestamp as unix ms', () => {
    let ts: unknown = null
    const authz = new Authz({ audit: (r) => { ts = r.timestamp } })
    authz.load(fixture('basic-rbac.toon'))
    const before = Date.now()
    authz.can({ id: 1, roles: ['admin'] }, 'edit', 'listing')
    const after = Date.now()
    expect(typeof ts).toBe('number')
    expect(ts as number).toBeGreaterThanOrEqual(before)
    expect(ts as number).toBeLessThanOrEqual(after)
  })
  it('audit callback receives durationMs > 0', () => {
    let dur: unknown = null
    const authz = new Authz({ audit: (r) => { dur = r.durationMs } })
    authz.load(fixture('basic-rbac.toon'))
    authz.can({ id: 1, roles: ['admin'] }, 'edit', 'listing')
    expect(typeof dur).toBe('number')
    expect(dur as number).toBeGreaterThanOrEqual(0)
  })
  it('exception in audit callback does not propagate to can()', () => {
    const authz = new Authz({ audit: () => { throw new Error('audit boom') } })
    authz.load(fixture('basic-rbac.toon'))
    expect(() => authz.can({ id: 1, roles: ['admin'] }, 'edit', 'listing')).not.toThrow()
  })
})

// ─── loadAsync ────────────────────────────────────────────────────────────────

describe('Integration: loadAsync()', () => {
  it('loads and compiles a policy file asynchronously', async () => {
    const authz = new Authz()
    await authz.loadAsync(fixture('basic-rbac.toon'))
    expect(authz.can({ id: 1, roles: ['admin'] }, 'edit', 'listing')).toBe(true)
  })
  it('loadAsync throws PathSafetyError for traversal paths', async () => {
    const authz = new Authz()
    await expect(authz.loadAsync('../../../etc/passwd')).rejects.toThrow(PathSafetyError)
  })
  it('loadAsync throws ParseError for invalid policy', async () => {
    const authz = new Authz()
    await expect(authz.loadAsync(fixture('invalid-syntax.toon'))).rejects.toThrow(ParseError)
  })
})
