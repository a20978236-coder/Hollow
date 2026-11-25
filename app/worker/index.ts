/**
 * Cloudflare Worker: serves the PWA (static files embedded at build time by scripts/embed-assets.mjs)
 * and the secure API. Secrets (ANTHROPIC_API_KEY, FAL_KEY) are Worker secrets and never reach the client.
 */
import { handleAi, type Env } from './ai'
import { handleHealth } from './health'
import { ASSETS } from './assets.gen'

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob: https://cdn.modrinth.com https:; connect-src 'self' https://api.modrinth.com; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'",
}

function decode(b64: string) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function serve(path: string): Response | null {
  const a = ASSETS[path]
  if (!a) return null
  const body = a.b64 ? decode(a.body) : a.body
  const cache = path.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : path === '/sw.js' || path === '/index.html' || path.endsWith('.webmanifest')
      ? 'no-cache'
      : 'public, max-age=3600'
  return new Response(body, { headers: { 'Content-Type': a.type, 'Cache-Control': cache, ...SECURITY_HEADERS } })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/health') return handleHealth(env)
    if (url.pathname === '/api/ai') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
      const origin = request.headers.get('Origin')
      if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 })
      return handleAi(request, env)
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 })
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })
    const direct = serve(url.pathname === '/' ? '/index.html' : url.pathname)
    if (direct) return direct
    // SPA fallback for client routes (paths without a file extension)
    if (!/\.[a-z0-9]+$/i.test(url.pathname)) return serve('/index.html')!
    return new Response('Not found', { status: 404 })
  },
}
