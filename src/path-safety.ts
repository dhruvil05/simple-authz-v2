import { sep } from 'node:path'
import { PathSafetyError } from './errors.js'

/**
 * Asserts that `resolvedPath` is inside `root` (or equal to it).
 *
 * A naive `resolved.startsWith(root)` check is unsafe: it also matches
 * sibling paths that merely share a string prefix, e.g. root `/app` would
 * wrongly accept `/app-secret/file.toon`. This checks the segment boundary
 * too, so only `root` itself or a real descendant of `root` passes.
 */
export function assertPathWithinRoot(resolvedPath: string, root: string, attemptedPath: string): void {
  const withBoundary = root.endsWith(sep) ? root : root + sep
  if (resolvedPath !== root && !resolvedPath.startsWith(withBoundary)) {
    throw new PathSafetyError(attemptedPath)
  }
}