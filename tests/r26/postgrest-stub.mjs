/**
 * R26 runtime harness — local Supabase stub.
 *
 * Purpose: exercise the real Worker route handlers (their actual authorization
 * branch logic) over real HTTP without credentials, a database, or Docker.
 *
 * What is stubbed: only the two HTTP surfaces that Supabase provides —
 *   GET /auth/v1/user        (identity provider; what verifySupabaseToken calls)
 *   GET /rest/v1/<table>     (PostgREST; what the service-role client queries)
 *
 * What is NOT stubbed: token extraction, token verification error handling,
 * trusted-role resolution, membership/ownership checks, and every query filter in
 * the route. Those all run as production code.
 *
 * Two schema variants model the attribution question explicitly:
 *   'current'    — attempts has no class_id (matches the committed migrations)
 *   'attributed' — attempts exposes class_id (hypothetical; proves the filter
 *                  excludes foreign and null attribution if it ever exists)
 * The 'attributed' variant is a harness fixture only. It is not a migration and
 * makes no claim about the real schema.
 */

import http from 'node:http'

const SINGLE_OBJECT_ACCEPT = 'application/vnd.pgrst.object+json'

function columnError(table, column) {
  return {
    code: '42703',
    details: null,
    hint: null,
    message: `column ${table}.${column} does not exist`
  }
}

function effectiveColumns(schema, table, variant) {
  const columns = [...(schema[table] || [])]
  if (table === 'attempts' && variant === 'attributed' && !columns.includes('class_id')) {
    columns.push('class_id')
  }
  return columns
}

function parseListValue(raw) {
  const inner = raw.slice('in.('.length, -1)
  if (!inner) return []
  return inner.split(',').map((value) => value.trim().replace(/^"|"$/g, ''))
}

function matchesFilter(row, column, operator) {
  const value = row[column]
  if (operator === 'not.is.null') return value !== null && value !== undefined
  if (operator === 'is.null') return value === null || value === undefined
  if (operator.startsWith('eq.')) return String(value) === operator.slice(3)
  if (operator.startsWith('in.(')) return parseListValue(operator).includes(String(value))
  if (operator.startsWith('neq.')) return String(value) !== operator.slice(4)
  throw new Error(`unsupported operator: ${operator}`)
}

export function selectRows({ schema, table, rows, params, variant, select }) {
  const columns = effectiveColumns(schema, table, variant)
  const reserved = new Set(['select', 'limit', 'offset', 'order', 'apikey'])

  if (select && select !== '*') {
    for (const requested of select.split(',')) {
      const name = requested.trim().split(':')[0]
      if (name && !columns.includes(name)) throw columnError(table, name)
    }
  }

  let filtered = rows
  for (const [column, operator] of params.entries()) {
    if (reserved.has(column)) continue
    if (!columns.includes(column)) throw columnError(table, column)
    filtered = filtered.filter((row) => matchesFilter(row, column, operator))
  }

  const order = params.get('order')
  if (order) {
    const [field, direction] = order.split('.')
    if (!columns.includes(field)) throw columnError(table, field)
    filtered = [...filtered].sort((left, right) => {
      const a = String(left[field] ?? '')
      const b = String(right[field] ?? '')
      return direction === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
    })
  }

  const limitParam = params.get('limit')
  if (limitParam !== null && limitParam !== '') {
    const limit = Number(limitParam)
    if (Number.isFinite(limit) && limit >= 0) filtered = filtered.slice(0, limit)
  }

  if (select && select !== '*') {
    const fields = select.split(',').map((value) => value.trim().split(':')[0])
    filtered = filtered.map((row) => {
      const projected = {}
      for (const field of fields) projected[field] = row[field] ?? null
      return projected
    })
  }

  return filtered
}

// Diagnostics for the harness operator only. This is stderr in a test process, never
// an HTTP response body.
function logRejection(table, error) {
  const detail = error && error.message ? error.message : String(error)
  console.error(`[r26-stub] rejected query on ${table}: ${detail}`)
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload)
  })
  response.end(payload)
}

export async function startStub({ dataset, schema, tokens, variant = 'current', failingTables = [] }) {
  const log = []

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    log.push({ method: request.method, path: url.pathname, query: url.search })

    if (url.pathname === '/auth/v1/user') {
      const header = String(request.headers.authorization || '')
      const token = header.replace(/^Bearer\s+/i, '')
      const user = tokens[token]
      if (!user) {
        sendJson(response, 401, { code: 401, msg: 'invalid JWT: unable to parse or verify signature' })
        return
      }
      sendJson(response, 200, user)
      return
    }

    const restMatch = url.pathname.match(/^\/rest\/v1\/([A-Za-z0-9_]+)$/)
    if (!restMatch) {
      sendJson(response, 404, { code: '404', message: `no route for ${url.pathname}` })
      return
    }

    const table = restMatch[1]
    if (failingTables.includes(table)) {
      sendJson(response, 503, { code: 'XX000', message: `dependency unavailable: ${table}` })
      return
    }

    if (!Object.prototype.hasOwnProperty.call(dataset, table)) {
      sendJson(response, 404, { code: '42P01', message: `relation "public.${table}" does not exist` })
      return
    }

    const accept = String(request.headers.accept || '')
    const wantsSingle = accept.includes(SINGLE_OBJECT_ACCEPT)
    const select = url.searchParams.get('select')

    let rows
    try {
      rows = selectRows({ schema, table, rows: dataset[table], params: url.searchParams, variant, select })
    } catch (error) {
      // The response carries a stable envelope only. Exception text (and any stack a
      // thrown Error may carry) never reaches the client; diagnostics go to the
      // harness log, which is test-only output.
      logRejection(table, error)
      const code =
        error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : 'XX000'
      sendJson(response, 400, { code, message: 'query rejected' })
      return
    }

    if (wantsSingle) {
      if (rows.length === 1) {
        sendJson(response, 200, rows[0])
      } else {
        sendJson(response, 406, {
          code: 'PGRST116',
          details: `The result contains ${rows.length} rows`,
          hint: null,
          message: 'JSON object requested, multiple (or no) rows returned'
        })
      }
      return
    }

    sendJson(response, 200, rows)
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()

  return {
    url: `http://127.0.0.1:${address.port}`,
    log,
    queriesFor(table) {
      return log.filter((entry) => entry.path === `/rest/v1/${table}`)
    },
    async close() {
      await new Promise((resolve) => server.close(resolve))
    }
  }
}
