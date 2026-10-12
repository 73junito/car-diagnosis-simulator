#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const workerIndexPath = path.join(root, 'worker', 'index.js')
const buildScriptPath = path.join(root, 'scripts', 'build-static-site.js')
const inventoryPath = path.join(root, 'config', 'production-api-route-inventory.json')

function extractQuotedArray(source, variableName) {
  const match = source.match(new RegExp(`const\\s+${variableName}\\s*=\\s*\\[([\\s\\S]*?)\\];`))
  if (!match) throw new Error(`Unable to locate ${variableName} in build-static-site.js`)
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1])
}

function productionBrowserFiles() {
  const buildSource = fs.readFileSync(buildScriptPath, 'utf8')
  const directories = extractQuotedArray(buildSource, 'runtimeDirectories')
  const rootFiles = extractQuotedArray(buildSource, 'runtimeRootFiles')
  const files = []

  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(?:js|html)$/i.test(entry.name)) files.push(full)
    }
  }

  for (const dir of directories) walk(path.join(root, dir))
  for (const file of rootFiles) {
    if (!/\.(?:js|html)$/i.test(file)) continue
    const full = path.join(root, file)
    if (fs.existsSync(full)) files.push(full)
  }
  return [...new Set(files)].sort()
}

function normalizePath(value) {
  let route = value
    .replace(/^https?:\/\/app\.autolearnpro\.com/i, '')
    .replace(/\$\{[^}]+\}/g, ':param')
    .split(/[?#]/)[0]
    .replace(/\/+$/, '/')

  if (!route.startsWith('/api/')) return null
  if (route.endsWith('/')) route += ':param'
  if (route.endsWith('.')) route += ':param'
  return route
}

function extractBrowserApiReferences() {
  const references = new Map()
  const routeRegex = /(?:https?:\/\/app\.autolearnpro\.com)?\/api\/[A-Za-z0-9_./:${}-]*/g

  for (const file of productionBrowserFiles()) {
    let source = fs.readFileSync(file, 'utf8')
    source = source.replace(/\$\{[^}]+\}/g, ':param')
    source = source.replace(/(["'`])([^"'`]*\/api\/[^"'`]*)\1\s*\+\s*encodeURIComponent\([^)]*\)\s*\+\s*(["'`])([^"'`]*)\3/g, (_match, _q1, prefix, _q2, suffix) => `"${prefix}:param${suffix}"`)
    for (const match of source.matchAll(routeRegex)) {
      if (match.index > 0 && source[match.index - 1] === '.') continue
      const route = normalizePath(match[0])
      if (!route) continue
      if (!references.has(route)) references.set(route, new Set())
      references.get(route).add(path.relative(root, file).replaceAll('\\', '/'))
    }
  }

  return new Map([...references.entries()].map(([route, sources]) => [route, [...sources].sort()]).sort())
}

function extractWorkerRoutes() {
  const source = fs.readFileSync(workerIndexPath, 'utf8')
  const routes = []
  const methodRegex = /app\.(get|post|put|patch|delete|all)\(\s*["'](\/api\/[^"']+)["']/g
  const routeRegex = /app\.route\(\s*["'](\/api\/[^"']+)["']/g
  let match
  while ((match = methodRegex.exec(source))) routes.push({ method: match[1].toUpperCase(), pattern: match[2] })
  while ((match = routeRegex.exec(source))) routes.push({ method: 'ROUTE', pattern: match[1] })
  return routes.sort((a, b) => a.pattern.localeCompare(b.pattern) || a.method.localeCompare(b.method))
}

function patternRegex(pattern) {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:[A-Za-z0-9_]+/g, '[^/]+')
    .replace(/:param/g, '[^/]+')
  return new RegExp(`^${escaped}$`)
}

function matchesPattern(route, pattern) {
  return patternRegex(pattern).test(route)
}

function auditInventory() {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))
  const workerRoutes = extractWorkerRoutes()
  const browserRefs = extractBrowserApiReferences()
  const known = inventory.knownUnregisteredRoutes || []
  const registered = []
  const gaps = []
  const unclassified = []

  for (const [route, sources] of browserRefs) {
    const worker = workerRoutes.find((entry) => matchesPattern(route, entry.pattern))
    if (worker) {
      registered.push({ route, sources, worker })
      continue
    }
    const gap = known.find((entry) => matchesPattern(route, entry.pattern))
    if (gap) gaps.push({ route, sources, gap })
    else unclassified.push({ route, sources })
  }

  const staleKnown = known.filter((entry) => !gaps.some((item) => item.gap.pattern === entry.pattern))
  return { workerRoutes, browserRefs, registered, gaps, unclassified, staleKnown }
}

function main() {
  const result = auditInventory()
  console.log(`Worker API registrations: ${result.workerRoutes.length}`)
  console.log(`Production browser API references: ${result.browserRefs.size}`)
  console.log(`Resolved to Worker: ${result.registered.length}`)
  console.log(`Known unregistered gaps: ${result.gaps.length}`)

  for (const item of result.gaps) {
    console.warn(`GAP ${item.gap.gap} ${item.route} <- ${item.sources.join(', ')}`)
  }
  if (result.staleKnown.length) {
    console.error(`Stale known-gap entries: ${result.staleKnown.map((item) => item.pattern).join(', ')}`)
  }
  if (result.unclassified.length) {
    console.error('Unclassified production API references:')
    for (const item of result.unclassified) console.error(`  ${item.route} <- ${item.sources.join(', ')}`)
  }

  if (result.unclassified.length || result.staleKnown.length) process.exitCode = 1
  else console.log('PASS: every production browser API reference is either Worker-registered or an explicit roadmap gap.')
}

if (require.main === module) main()

module.exports = {
  extractQuotedArray,
  productionBrowserFiles,
  normalizePath,
  extractBrowserApiReferences,
  extractWorkerRoutes,
  matchesPattern,
  auditInventory
}
