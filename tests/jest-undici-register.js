// Force a deterministic undici-backed Fetch runtime for tests.
// Clear any NODE_OPTIONS preloads to avoid ambiguous dual injection.
try {
  process.env.NODE_OPTIONS = ''
} catch (e) {}

try {
  // If the runtime already provides WHATWG fetch + constructors, skip polyfills.
  const haveGlobalFetch = (typeof globalThis.fetch === 'function' && typeof globalThis.Request !== 'undefined' && typeof globalThis.Response !== 'undefined' && typeof globalThis.Headers !== 'undefined')
  if (!haveGlobalFetch) {
    // Prefer the lightweight index-fetch entry (avoids undici webidl requiring extra globals on older Node)
    let u = null
    try { u = require('undici/index-fetch') } catch (_) {
      try { u = require('undici') } catch (_) {
        try { u = require('node-fetch') } catch (_) { u = null }
      }
    }
    if (!u) {
    // Minimal, conservative shims to satisfy import-time checks for libraries
    // that only verify existence of WHATWG globals (e.g., @mswjs/interceptors).
    if (typeof globalThis.fetch !== 'function') {
      globalThis.fetch = function () {
        return Promise.reject(new Error('fetch is not polyfilled in this environment'))
      }
    }
    if (typeof globalThis.Headers === 'undefined') {
      globalThis.Headers = class Headers {
        constructor(init) {
          this.map = {}
          if (init && typeof init === 'object') {
            for (const [k, v] of Object.entries(init)) this.map[k.toLowerCase()] = String(v)
          }
        }
        get(k) { return this.map[k.toLowerCase()] }
        append(k, v) { this.map[k.toLowerCase()] = (this.map[k.toLowerCase()] || '') + String(v) }
      }
    }
    if (typeof globalThis.Request === 'undefined') {
      globalThis.Request = class Request {
        constructor(input, init = {}) {
          this.url = input && input.url ? input.url : String(input)
          this.method = init.method || 'GET'
          this.headers = init.headers || new globalThis.Headers()
        }
        clone() {
          return new globalThis.Request(this.url, { method: this.method, headers: this.headers })
        }
      }
    }
    if (typeof globalThis.Response === 'undefined') {
      globalThis.Response = class Response {
        constructor(body = null, init = {}) {
          this.body = body
          this.status = init.status || 200
          this.headers = init.headers || new globalThis.Headers()
        }
      }
    }
    if (typeof globalThis.File === 'undefined') {
      globalThis.File = class File { constructor(parts, name, opts) { this.name = name; this.parts = parts; this.size = Array.isArray(parts) ? parts.reduce((s, p) => s + (p?.length || 0), 0) : 0; this.type = opts && opts.type ? opts.type : '' } }
    }
    } else {
    // Normalize exports: node-fetch may export the fetch function directly.
    const fetchImpl = u.fetch || u
    globalThis.fetch = fetchImpl
    if (u.Headers) globalThis.Headers = u.Headers
    if (u.Response) globalThis.Response = u.Response
    if (u.Request) globalThis.Request = u.Request
    }
  }

  // Ensure web streams are available (Node 18 has stream/web). Fallback to ponyfill if needed.
  try {
    const streams = require('stream/web')
    if (typeof globalThis.TransformStream === 'undefined' && typeof streams.TransformStream !== 'undefined') globalThis.TransformStream = streams.TransformStream
    if (typeof globalThis.ReadableStream === 'undefined' && typeof streams.ReadableStream !== 'undefined') globalThis.ReadableStream = streams.ReadableStream
    if (typeof globalThis.WritableStream === 'undefined' && typeof streams.WritableStream !== 'undefined') globalThis.WritableStream = streams.WritableStream
  } catch (e) {
    try {
      const ponyfill = require('web-streams-polyfill/ponyfill')
      if (typeof globalThis.TransformStream === 'undefined' && typeof ponyfill.TransformStream !== 'undefined') globalThis.TransformStream = ponyfill.TransformStream
      if (typeof globalThis.ReadableStream === 'undefined' && typeof ponyfill.ReadableStream !== 'undefined') globalThis.ReadableStream = ponyfill.ReadableStream
      if (typeof globalThis.WritableStream === 'undefined' && typeof ponyfill.WritableStream !== 'undefined') globalThis.WritableStream = ponyfill.WritableStream
    } catch (err) {
      // best-effort
    }
  }
} catch (e) {
  // Fail loudly so CI shows the root cause if undici is missing.
  throw e
}
