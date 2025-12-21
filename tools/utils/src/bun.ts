import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { once } from 'lodash-es';

import { Logger } from './logger';
import type { BunWorkspaceItem } from './types';
import type { PackageName } from './workspace.gen';

async function loadPackageList() {
  try {
    const packageList = await import('./workspace.gen');
    return packageList.PackageList;
  } catch (e) {
    console.log(e);
    new Logger('bun').error('Failed to load package list');
    return [];
  }
}

export const PackageList = await loadPackageList();
export type { PackageName };

/**
 * Simple glob-like matcher for workspace patterns.
 * Supports basic '*' and '**' patterns.
 */
function matchPattern(path: string, pattern: string): boolean {
  if (pattern === '.') return path === '.';

  const pathParts = path.split('/');
  const patternParts = pattern.split('/');

  let pathIdx = 0;
  let patternIdx = 0;

  while (patternIdx < patternParts.length) {
    const p = patternParts[patternIdx];
    if (p === '**') {
      if (patternIdx === patternParts.length - 1) return true;
      const nextP = patternParts[patternIdx + 1];
      while (pathIdx < pathParts.length) {
        if (
          matchPattern(
            pathParts.slice(pathIdx).join('/'),
            patternParts.slice(patternIdx + 1).join('/')
          )
        ) {
          return true;
        }
        pathIdx++;
      }
      return false;
    } else if (p === '*') {
      if (pathIdx >= pathParts.length) return false;
      pathIdx++;
      patternIdx++;
    } else {
      if (pathIdx >= pathParts.length || pathParts[pathIdx] !== p) return false;
      pathIdx++;
      patternIdx++;
    }
  }

  return pathIdx === pathParts.length;
}

/**
 * Recursively find all package.json files in directories matching workspace patterns.
 */
function findPackages(
  dir: string,
  patterns: string[],
  baseDir: string
): string[] {
  const results: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch (e) {
    return [];
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist')
      continue;
    const fullPath = join(dir, entry);
    const relativePath = fullPath
      .slice(baseDir.length + 1)
      .replaceAll(sep, '/');

    try {
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        // Simple recursion to find all package.json files
        results.push(...findPackages(fullPath, patterns, baseDir));
      } else if (entry === 'package.json') {
        const pkgDir = relativePath.slice(0, -13) || '.';
        if (patterns.some(p => matchPattern(pkgDir, p))) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // Skip if stat fails
    }
  }
  return results;
}

/**
 * Bun-compatible replacement for `yarn workspaces list`.
 * Reads the root package.json for workspace patterns and resolves them manually.
 */
export const bunList = once(() => {
  const rootDir = resolve(process.cwd());
  const rootPkgPath = join(rootDir, 'package.json');

  if (!existsSync(rootPkgPath)) {
    throw new Error(`Could not find root package.json at ${rootPkgPath}`);
  }

  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
  const workspacePatterns: string[] = Array.isArray(rootPkg.workspaces)
    ? rootPkg.workspaces
    : rootPkg.workspaces?.packages || [];

  const allPackages: BunWorkspaceItem[] = [];
  const packageMap = new Map<
    string,
    { name: string; location: string; deps: string[] }
  >();
  const nameToLocation = new Map<string, string>();

  // 1. Find all package.json files matching the patterns
  const pkgJsonFiles = findPackages(rootDir, workspacePatterns, rootDir);

  for (const fullPath of pkgJsonFiles) {
    const relativePath = fullPath
      .slice(rootDir.length + 1)
      .replaceAll(sep, '/');
    const pkgDir = relativePath.slice(0, -13) || '.';

    try {
      const content = JSON.parse(readFileSync(fullPath, 'utf-8'));
      if (content.name) {
        // Yarn workspaces list -v typically only includes dependencies and devDependencies
        // for the purpose of workspace dependency resolution in this project's tools.
        // Including peerDependencies can cause circular references (e.g. @affine/error <-> @affine/graphql).
        const deps = [
          ...Object.keys(content.dependencies || {}),
          ...Object.keys(content.devDependencies || {}),
        ];

        packageMap.set(pkgDir, {
          name: content.name,
          location: pkgDir,
          deps,
        });
        nameToLocation.set(content.name, pkgDir);
      }
    } catch (e) {
      // Skip invalid package.json
    }
  }

  // 2. Build the YarnWorkspaceItem list with filtered workspace dependencies (using locations)
  for (const pkg of packageMap.values()) {
    const workspaceDeps: string[] = [];
    for (const depName of pkg.deps) {
      const depLocation = nameToLocation.get(depName);
      if (depLocation) {
        workspaceDeps.push(depLocation);
      }
    }

    allPackages.push({
      name: pkg.name,
      location: pkg.location,
      workspaceDependencies: workspaceDeps,
    });
  }

  // ignore root package (usually location is ".")
  return allPackages.filter(p => p.location !== '.');
});
