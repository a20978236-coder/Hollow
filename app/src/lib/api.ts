/** Client for the app's own backend (Cloudflare Pages Functions under /api). No secrets live here. */

export interface Health {
  ok: boolean
  ai: { configured: boolean; model: string; pricing: { inputPerMTok: number; outputPerMTok: number } }
  assets: { configured: boolean }
  version: string
}

export async function health(): Promise<Health | null> {
  try {
    const r = await fetch('/api/health')
    if (!r.ok) return null
    return (await r.json()) as Health
  } catch {
    return null
  }
}

export interface AiReply {
  text: string
  usage: { input_tokens: number; output_tokens: number }
  costUsd: number
  model: string
  stopReason: string | null
}

export class AiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function askModder(payload: {
  adapterId: string
  gameVersion?: string
  loader?: string
  projectName?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}): Promise<AiReply> {
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await r.json().catch(() => ({}))) as Partial<AiReply> & { error?: string }
  if (!r.ok) throw new AiError(data.error ?? `AI request failed (${r.status})`, r.status)
  return data as AiReply
}
