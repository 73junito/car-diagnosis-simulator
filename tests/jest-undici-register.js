// Force a deterministic undici-backed Fetch runtime for tests.
// Clear any NODE_OPTIONS preloads to avoid ambiguous dual injection.
try {
  process.env.NODE_OPTIONS = ''
} catch (e) {}

try {
  // If the runtime already provides WHATWG fetch + constructors, use it.
  if (typeof globalThis.fetch === 'function' && typeof globalThis.Request !== 'undefined' && typeof globalThis.Response !== 'undefined' && typeof globalThis.Headers !== 'undefined') {
    // Node >=18/22 may already provide a compatible fetch implementation.
    return
  }
  // Prefer the lightweight index-fetch entry (avoids undici webidl requiring extra globals on older Node)
  let u = null
  try { u = require('undici/index-fetch') } catch (_) {
    try { u = require('undici') } catch (_) {
      try { u = require('node-fetch') } catch (_) { u = null }
    }
  }
  if (!u) throw new Error('No fetch implementation available (undici/index-fetch, undici, node-fetch)')

  // Normalize exports: node-fetch may export the fetch function directly.
  const fetchImpl = u.fetch || u
  globalThis.fetch = fetchImpl
  if (u.Headers) globalThis.Headers = u.Headers
  if (u.Response) globalThis.Response = u.Response
  if (u.Request) globalThis.Request = u.Request

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
