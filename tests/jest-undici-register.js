// Force a deterministic undici-backed Fetch runtime for tests.
// Clear any NODE_OPTIONS preloads to avoid ambiguous dual injection.
try {
  process.env.NODE_OPTIONS = ''
} catch (e) {}

try {
  const u = require('undici')

  // Overwrite globals unconditionally so all workers see the same runtime.
  globalThis.fetch = u.fetch
  globalThis.Headers = u.Headers
  globalThis.Response = u.Response
  globalThis.Request = u.Request

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
