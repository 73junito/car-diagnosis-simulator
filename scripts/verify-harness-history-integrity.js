#!/usr/bin/env node
'use strict'

/**
 * Scheduled harness history integrity guard.
 *
 * `scripts/append-harness-history.js` appends unconditionally and nothing else
 * inspects the file, so a pull request can replace an existing historical record
 * by touching the same trailing line. PR #1140 did exactly that: the
 * 2026-10-28 run was replaced by 2026-10-27 and the file stayed valid, unique and
 * ascending, so no structural check could have objected.
 *
 * This guard therefore enforces two layers:
 *  - intrinsic integrity: canonical header, exact field count per row, parseable
 *    `generatedAt` values, unique timestamps, strictly ascending chronology;
 *  - historical preservation (baseline mode): every record present on the target
 *    branch must still be present, byte-identical, in the same relative order.
 *  - A chronological backfill that inserts an older run in the correct position
 *    is allowed; deleting or rewriting an existing record is not.
 *
 * Records are never rewritten automatically. A violation fails the run and the
 * author decides how to reconcile.
 *
 * Usage:
 *   node scripts/verify-harness-history-integrity.js
 *   node scripts/verify-harness-history-integrity.js --baseline-ref origin/main
 *   node scripts/verify-harness-history-integrity.js --baseline-file /tmp/head.csv
 *
 * Exit codes: 0 pass, 1 violation, 2 usage or IO failure.
 */

const fs = require('fs')
const { execFileSync } = require('child_process')

const HEADER = [
  'accepted',
  'denied',
  'acceptRate',
  'completed',
  'avgDuration',
  'p50',
  'p90',
  'p99',
  'notificationAttempts',
  'totalLogs',
  'generatedAt',
  'source'
]
const TIMESTAMP_INDEX = 10
const FIELD_COUNT = HEADER.length
const DEFAULT_FILE = 'runs/history.csv'

function usage(message) {
  if (message) console.error(`ERROR: ${message}`)
  console.error(
    'Usage: node scripts/verify-harness-history-integrity.js [--file <path>] ' +
      '[--baseline-ref <git-ref> | --baseline-file <path>]'
  )
  process.exit(2)
}

function parseArgs(argv) {
  const options = { file: DEFAULT_FILE, baselineRef: null, baselineFile: null }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (flag === '--file') {
      if (!value) usage('--file requires a path')
      options.file = value
      index += 1
    } else if (flag === '--baseline-ref') {
      if (!value) usage('--baseline-ref requires a git ref')
      options.baselineRef = value
      index += 1
    } else if (flag === '--baseline-file') {
      if (!value) usage('--baseline-file requires a path')
      options.baselineFile = value
      index += 1
    } else if (flag === '--help' || flag === '-h') {
      usage()
    } else {
      usage(`unknown argument: ${flag}`)
    }
  }
  if (options.baselineRef && options.baselineFile) {
    usage('--baseline-ref and --baseline-file are mutually exclusive')
  }
  return options
}

function parseCsv(text, origin) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  if (!lines.length) return { header: null, rows: [], errors: [`${origin}: file is empty`] }

  const header = lines[0].trim()
  const errors = []
  if (header !== HEADER.join(',')) {
    errors.push(`${origin}: header does not match the canonical column order`)
  }

  const rows = []
  for (let index = 1; index < lines.length; index += 1) {
    const raw = lines[index]
    if (raw.trim() === '') continue
    const fields = raw.split(',')
    if (fields.length !== FIELD_COUNT) {
      errors.push(`${origin}: row ${index + 1} has ${fields.length} fields, expected ${FIELD_COUNT}`)
      continue
    }
    const generatedAt = fields[TIMESTAMP_INDEX].trim()
    const parsed = Date.parse(generatedAt)
    if (!Number.isFinite(parsed)) {
      errors.push(`${origin}: row ${index + 1} has an unparseable generatedAt: ${generatedAt}`)
      continue
    }
    rows.push({ line: index + 1, raw, generatedAt, time: parsed })
  }

  return { header, rows, errors }
}

function validateIntrinsic(csv, origin) {
  const errors = [...csv.errors]

  const firstLineByTimestamp = new Map()
  for (const row of csv.rows) {
    if (firstLineByTimestamp.has(row.generatedAt)) {
      errors.push(
        `${origin}: duplicate generatedAt ${row.generatedAt} ` +
          `(rows ${firstLineByTimestamp.get(row.generatedAt)} and ${row.line})`
      )
    } else {
      firstLineByTimestamp.set(row.generatedAt, row.line)
    }
  }

  for (let index = 1; index < csv.rows.length; index += 1) {
    const previous = csv.rows[index - 1]
    const current = csv.rows[index]
    if (current.time <= previous.time) {
      errors.push(
        `${origin}: rows are not strictly ascending at row ${current.line} ` +
          `(${previous.generatedAt} -> ${current.generatedAt})`
      )
    }
  }

  return errors
}

function readBaselineFromGit(ref, filePath) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${filePath}`], { stdio: 'ignore' })
  } catch (error) {
    return { missing: true, text: null }
  }
  try {
    return { missing: false, text: execFileSync('git', ['show', `${ref}:${filePath}`], { encoding: 'utf8' }) }
  } catch (error) {
    usage(`unable to read ${filePath} at ${ref}: ${error.message}`)
  }
}

function validateBaseline(baseline, proposed, origin) {
  const errors = []
  const proposedByTimestamp = new Map(proposed.rows.map((row) => [row.generatedAt, row]))
  const missing = []
  const modified = []

  for (const row of baseline.rows) {
    const current = proposedByTimestamp.get(row.generatedAt)
    if (!current) {
      missing.push(row)
    } else if (current.raw.trim() !== row.raw.trim()) {
      modified.push({ baseline: row, current })
    }
  }

  for (const row of missing) {
    errors.push(`${origin}: would delete historical record ${row.generatedAt} (baseline row ${row.line})`)
  }
  for (const item of modified) {
    errors.push(`${origin}: would rewrite historical record ${item.baseline.generatedAt}`)
    errors.push(`    baseline: ${item.baseline.raw.trim()}`)
    errors.push(`    proposed: ${item.current.raw.trim()}`)
  }

  // Relative order can only be judged when every baseline record is still present.
  if (!missing.length && !modified.length) {
    const baselineOrder = baseline.rows.map((row) => row.generatedAt)
    const baselineSet = new Set(baselineOrder)
    const proposedOrder = proposed.rows
      .map((row) => row.generatedAt)
      .filter((timestamp) => baselineSet.has(timestamp))
    for (let index = 0; index < baselineOrder.length; index += 1) {
      if (proposedOrder[index] !== baselineOrder[index]) {
        errors.push(
          `${origin}: historical records were reordered at position ${index + 1} ` +
            `(expected ${baselineOrder[index]}, found ${proposedOrder[index] || 'nothing'})`
        )
        break
      }
    }
  }

  return errors
}

function main() {
  const options = parseArgs(process.argv.slice(2))

  let proposedText
  try {
    proposedText = fs.readFileSync(options.file, 'utf8')
  } catch (error) {
    console.error(`ERROR: unable to read ${options.file}: ${error.message}`)
    process.exit(2)
  }

  const proposed = parseCsv(proposedText, options.file)
  const errors = validateIntrinsic(proposed, options.file)

  let baseline = null
  if (options.baselineRef) {
    // The baseline is always the tracked history file on the target branch, so the
    // path inside the ref is fixed even when --file points somewhere else.
    const result = readBaselineFromGit(options.baselineRef, DEFAULT_FILE)
    if (result.missing) {
      console.warn(`NOTE: ${DEFAULT_FILE} does not exist at ${options.baselineRef}; nothing to preserve.`)
    } else {
      baseline = parseCsv(result.text, `${options.baselineRef}:${DEFAULT_FILE}`)
      errors.push(...validateIntrinsic(baseline, `${options.baselineRef}:${DEFAULT_FILE}`))
    }
  } else if (options.baselineFile) {
    let baselineText
    try {
      baselineText = fs.readFileSync(options.baselineFile, 'utf8')
    } catch (error) {
      console.error(`ERROR: unable to read ${options.baselineFile}: ${error.message}`)
      process.exit(2)
    }
    baseline = parseCsv(baselineText, options.baselineFile)
    errors.push(...validateIntrinsic(baseline, options.baselineFile))
  }

  if (baseline && baseline.rows.length) {
    errors.push(...validateBaseline(baseline, proposed, options.file))
  }

  if (errors.length) {
    console.error('FAIL: scheduled harness history integrity violated.')
    for (const error of errors) console.error(`  ${error}`)
    process.exitCode = 1
    return
  }

  console.log(`Rows: ${proposed.rows.length} (baseline records preserved: ${baseline ? baseline.rows.length : 0})`)
  if (baseline && baseline.rows.length) {
    console.log('Baseline records: present, byte-identical, in original order')
  }
  console.log('PASS: harness history is unique, strictly ascending and preserves historical records.')
}

main()
