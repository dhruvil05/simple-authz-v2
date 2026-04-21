import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import type {
  PolicyDocument,
  TopLevelNode,
  RuleNode,
  RoleHierarchyNode,
  IncludeNode,
  ConditionExpr,
} from './types/ast.js'
import { CompileError } from './errors.js'
import { tokenize } from './lexer.js'
import { parse } from './parser.js'

// ─── Compiled structures ──────────────────────────────────────────────────────

/**
 * A single rule after compilation.
 * Condition stored as a pre-parsed AST node — never a string.
 */
export interface CompiledRule {
  readonly role: string
  readonly action: string | '*'
  readonly resource: string | '*'
  readonly effect: 'allow' | 'deny'
  readonly condition: ConditionExpr | null
  readonly sourceLine: number
}

/**
 * The compiled policy index.
 * Structure: role → action → resource → CompiledRule[]
 * Wildcard '*' entries stored under the literal key '*'.
 * Role hierarchies fully expanded at compile time — zero runtime traversal.
 */
export type PolicyIndex = Map<string, Map<string, Map<string, CompiledRule[]>>>

export interface CompiledPolicy {
  readonly index: PolicyIndex
  readonly sourcePath: string
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compiles a PolicyDocument AST into a CompiledPolicy.
 * Resolves includes, expands role hierarchies, builds lookup index.
 * Throws CompileError on cycles, bad paths, or semantic violations.
 */
export function compile(
  doc: PolicyDocument,
  _seenPaths: ReadonlySet<string> = new Set(),
): CompiledPolicy {
  // Track included files to detect circular includes
  const seenPaths = new Set(_seenPaths)
  seenPaths.add(doc.sourcePath)

  // ── Step 1: Resolve includes ───────────────────────────────────────────────
  const allNodes: TopLevelNode[] = []
  for (const node of doc.nodes) {
    if (node.kind === 'IncludeNode') {
      const includedNodes = resolveInclude(node, doc.sourcePath, seenPaths)
      allNodes.push(...includedNodes)
    } else {
      allNodes.push(node)
    }
  }

  // ── Step 2: Separate rules from hierarchy declarations ─────────────────────
  const ruleNodes: RuleNode[] = []
  const hierarchyNodes: RoleHierarchyNode[] = []

  for (const node of allNodes) {
    if (node.kind === 'RuleNode') ruleNodes.push(node)
    else if (node.kind === 'RoleHierarchyNode') hierarchyNodes.push(node)
  }

  // ── Step 3: Build role inheritance graph ───────────────────────────────────
  // Merge all hierarchy blocks (from main file + includes)
  const inheritanceGraph = buildInheritanceGraph(hierarchyNodes, doc.sourcePath)

  // Detect cycles before expansion
  detectCycles(inheritanceGraph, doc.sourcePath)

  // ── Step 4: Expand rules for inherited roles ───────────────────────────────
  const expandedRules = expandHierarchy(ruleNodes, inheritanceGraph, doc.sourcePath)

  // ── Step 5: Build lookup index ─────────────────────────────────────────────
  const index: PolicyIndex = new Map()

  for (const rule of expandedRules) {
    indexRule(index, rule)
  }

  return { index, sourcePath: doc.sourcePath }
}

// ─── Include resolution ───────────────────────────────────────────────────────

function resolveInclude(
  node: IncludeNode,
  parentPath: string,
  seenPaths: Set<string>,
): TopLevelNode[] {
  const baseDir = dirname(parentPath)
  const resolvedPath = resolve(baseDir, node.path)

  if (seenPaths.has(resolvedPath)) {
    throw new CompileError({
      message: `circular include detected: "${resolvedPath}" is already being processed`,
      sourcePath: parentPath,
    })
  }

  let source: string
  try {
    source = readFileSync(resolvedPath, 'utf-8')
  } catch {
    throw new CompileError({
      message: `cannot read included file "${resolvedPath}"`,
      sourcePath: parentPath,
    })
  }

  const tokens = tokenize(source, resolvedPath)
  const includedDoc = parse(tokens, resolvedPath)

  // Recursively compile the included doc (handles nested includes + cycles)
  const newSeen = new Set(seenPaths)
  newSeen.add(resolvedPath)

  // Collect all nodes from included doc (recursively resolving its includes)
  const resolvedNodes: TopLevelNode[] = []
  for (const n of includedDoc.nodes) {
    if (n.kind === 'IncludeNode') {
      resolvedNodes.push(...resolveInclude(n, resolvedPath, newSeen))
    } else {
      resolvedNodes.push(n)
    }
  }

  return resolvedNodes
}

// ─── Inheritance graph ────────────────────────────────────────────────────────

/**
 * Builds a Map<role, string[]> of direct parents.
 * Merges multiple role_hierarchy blocks from includes.
 */
function buildInheritanceGraph(
  hierarchyNodes: RoleHierarchyNode[],
  sourcePath: string,
): Map<string, string[]> {
  const graph = new Map<string, string[]>()

  for (const node of hierarchyNodes) {
    for (const entry of node.entries) {
      if (graph.has(entry.role)) {
        // Merge parents — allow splitting hierarchy across multiple blocks
        const existing = graph.get(entry.role)!
        for (const parent of entry.extends) {
          if (!existing.includes(parent)) existing.push(parent)
        }
      } else {
        graph.set(entry.role, [...entry.extends])
      }
    }
  }

  // SE-07: Self-extension check
  for (const [role, parents] of graph) {
    if (parents.includes(role)) {
      throw new CompileError({
        message: `role "${role}" cannot extend itself`,
        sourcePath,
      })
    }
  }

  return graph
}

// ─── Cycle detection (DFS) ───────────────────────────────────────────────────

export function detectCycles(
  graph: Map<string, string[]>,
  sourcePath: string,
): void {
  // Three-colour DFS: white=unvisited, grey=in-stack, black=done
  const WHITE = 0, GREY = 1, BLACK = 2
  const colour = new Map<string, 0 | 1 | 2>()

  // Collect all roles mentioned (as child or parent)
  const allRoles = new Set<string>()
  for (const [role, parents] of graph) {
    allRoles.add(role)
    for (const p of parents) allRoles.add(p)
  }

  for (const role of allRoles) colour.set(role, WHITE)

  function dfs(role: string, path: string[]): void {
    colour.set(role, GREY)
    const parents = graph.get(role) ?? []
    for (const parent of parents) {
      const c = colour.get(parent) ?? WHITE
      if (c === GREY) {
        // Back-edge found — cycle
        const cycleStart = path.indexOf(parent)
        const cycle = [...path.slice(cycleStart), parent]
        throw new CompileError({
          message: `cycle detected in role hierarchy: ${cycle.join(' → ')}`,
          sourcePath,
        })
      }
      if (c === WHITE) dfs(parent, [...path, parent])
    }
    colour.set(role, BLACK)
  }

  for (const role of allRoles) {
    if ((colour.get(role) ?? WHITE) === WHITE) {
      dfs(role, [role])
    }
  }
}

// ─── Hierarchy expansion ──────────────────────────────────────────────────────

/**
 * For every role that has parents in the inheritance graph,
 * copies the parent's rules (and the parent's parent's rules, etc.)
 * into the child role's rule set.
 *
 * Expansion is done in topological order so that transitive inheritance works.
 * Expanded rules keep the original CompiledRule shape but with the child's role.
 */
export function expandHierarchy(
  rules: RuleNode[],
  graph: Map<string, string[]>,
  sourcePath: string,
): CompiledRule[] {
  if (graph.size === 0) {
    // No hierarchy — just convert rules directly
    return rules.map(ruleNodeToCompiled)
  }

  // Build a map of role → its own rules (before expansion)
  const ownRules = new Map<string, CompiledRule[]>()
  for (const rule of rules) {
    const compiled = ruleNodeToCompiled(rule)
    const existing = ownRules.get(rule.role) ?? []
    existing.push(compiled)
    ownRules.set(rule.role, existing)
  }

  // Compute full rule set for a role via memoised recursion
  const memo = new Map<string, CompiledRule[]>()

  function allRulesFor(role: string): CompiledRule[] {
    if (memo.has(role)) return memo.get(role)!

    const own = ownRules.get(role) ?? []
    const parents = graph.get(role) ?? []

    // Inherit from all parents
    const inherited: CompiledRule[] = []
    for (const parent of parents) {
      const parentRules = allRulesFor(parent)
      // Re-stamp the role on inherited rules so index lookup works correctly
      for (const pr of parentRules) {
        inherited.push({ ...pr, role })
      }
    }

    const combined = [...own, ...inherited]
    memo.set(role, combined)
    return combined
  }

  // Collect all unique roles across rules and graph
  const allRoles = new Set<string>()
  for (const rule of rules) allRoles.add(rule.role)
  for (const [role, parents] of graph) {
    allRoles.add(role)
    for (const p of parents) allRoles.add(p)
  }

  const result: CompiledRule[] = []
  for (const role of allRoles) {
    result.push(...allRulesFor(role))
  }

  return result
}

// ─── Index builder ────────────────────────────────────────────────────────────

function indexRule(index: PolicyIndex, rule: CompiledRule): void {
  if (!index.has(rule.role)) index.set(rule.role, new Map())
  const actionMap = index.get(rule.role)!

  if (!actionMap.has(rule.action)) actionMap.set(rule.action, new Map())
  const resourceMap = actionMap.get(rule.action)!

  if (!resourceMap.has(rule.resource)) resourceMap.set(rule.resource, [])
  resourceMap.get(rule.resource)!.push(rule)
}

// ─── RuleNode → CompiledRule ──────────────────────────────────────────────────

function ruleNodeToCompiled(node: RuleNode): CompiledRule {
  return {
    role: node.role,
    action: node.action,
    resource: node.resource,
    effect: node.effect,
    condition: node.condition,
    sourceLine: node.line,
  }
}

// ─── Exported helpers (for tests) ────────────────────────────────────────────

export function _expandHierarchy(
  nodes: PolicyDocument['nodes'],
  rules: RuleNode[],
  sourcePath: string,
): RuleNode[] {
  void nodes
  void sourcePath
  return rules
}

export function _detectCycles(
  graph: Map<string, string[]>,
  sourcePath: string,
): void {
  detectCycles(graph, sourcePath)
}
