import type { Env } from './ai'

/** Reports which server-side integrations are configured. Never returns secret values. */
export function handleHealth(env: Env): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      version: '0.1.0',
      ai: { configured: Boolean(env.ANTHROPIC_API_KEY), model: 'claude-opus-5-5', pricing: { inputPerMTok: 4, outputPerMTok: 20 } },
      assets: { configured: Boolean(env.FAL_KEY) },
    }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  )
}
