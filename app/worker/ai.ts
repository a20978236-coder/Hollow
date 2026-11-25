import Anthropic from '@anthropic-ai/sdk'
import { ADAPTERS, getAdapter } from '../src/adapters'

export interface Env {
  ANTHROPIC_API_KEY?: string
  FAL_KEY?: string
}

const MODEL = 'claude-opus-5-5'
// USD per million tokens (input, output), first-party API rates.
const PRICING: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-sonnet-5-5': [2, 10],
  'claude-sonnet-5': [2, 10],
}

/**
 * The orchestration prompt is a mobile adaptation of the `mod-any-game` and `game-recon` skills from
 * rehan-remade/universal-modder (MIT). PC-only steps (um scan, um win, local decompilers) are
 * replaced by: research → feasibility → plan → assets/code → validation → install handoff.
 */
const SYSTEM = `You are the AI Mod Engineer inside "Universal Modder Mobile", an iPhone-first PWA. The user works ONLY from an iPhone (Safari). They cannot run a terminal, decompiler or game on the phone. Heavy work happens on cloud workers or later on a PC they have access to.

Follow this loop (adapted from the Universal Modder "mod-any-game" skill) for every modding request:
1. Understand: restate the idea in one sentence and what "done" means.
2. Identify the target game, edition/platform and version. If unknown, ask — do not guess.
3. Recon: engine, managed vs native code, official mod APIs, community loaders (Fabric/NeoForge, BepInEx, UE4SS, tModLoader, SMAPI, Roblox Studio…), anti-cheat, and where mods are published.
4. Feasibility: say whether the idea is possible and via which route (data/assets only, loader API, managed patching, native hooks). Prefer the cheapest route that reaches the idea.
5. Plan: a numbered development plan with a first vertical slice.
6. Assets: list every asset needed with exact specs (sizes, formats, poly budgets, frame layouts). Write image-generation prompts the user can run in the Asset Generator.
7. Code: produce complete, compilable code/config for the chosen route (e.g. Fabric mod classes + fabric.mod.json + lang/model JSON; Luau ModuleScripts for Roblox; BepInEx plugin C#). Put each file in its own fenced block preceded by a line "File: <path>".
8. Validation: list concrete checks (build command, log lines, in-game test) and what result proves success.
9. Install: step-by-step instructions, flagging clearly which steps need a PC/Mac and which can be done on the iPhone.

Hard rules (from Universal Modder safety.md):
- NEVER claim a mod or file is compatible unless it was verified (e.g. version metadata checked). Say "unverified" otherwise.
- Only single-player/offline games, servers the user runs, or Roblox experiences the user owns or has permission to edit (use Roblox Studio / Open Cloud workflows).
- Refuse aimbots, ESP, speed hacks, executors/injectors for third-party online games, anti-cheat bypass (EAC, BattlEye, Vanguard, Hyperion…), DRM/ownership tampering and redistribution of game files or extracted assets. Offer a legitimate alternative instead.
- Do not invent APIs, class names, loader versions or URLs. If you are not sure of an exact current version, tell the user where to check (e.g. fabricmc.net/develop) rather than inventing one.
- Be concise on a phone screen: short headings, tight lists, code only when useful.

Known adapters in this app (id: name — engine): ${ADAPTERS.map((a) => `${a.id}: ${a.name} — ${a.engine}`).join('; ')}.`

function contextFor(body: Payload) {
  const a = getAdapter(body.adapterId)
  if (!a) return 'Selected game: not specified — ask the user which game.'
  return [
    `Selected adapter: ${a.name} (${a.engine}).`,
    body.projectName ? `Project: ${body.projectName}.` : '',
    body.gameVersion ? `Game version: ${body.gameVersion}.` : '',
    body.loader ? `Loader: ${body.loader}.` : '',
    `Supported formats: ${a.formats.join('; ')}.`,
    `Loaders: ${a.loaders.map((l) => l.name).join(', ')}.`,
    `Asset requirements: ${a.assetRequirements.join('; ')}.`,
    `Compatibility rules: ${a.compatibilityRules.join('; ')}.`,
    `Boundaries: ${a.boundaries.join('; ')}.`,
    `Desktop requirement: ${a.requiresDesktop}`,
  ]
    .filter(Boolean)
    .join('\n')
}

interface Payload {
  adapterId: string
  gameVersion?: string
  loader?: string
  projectName?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export async function handleAi(request: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'AI is not configured on the server yet. Add ANTHROPIC_API_KEY as an encrypted secret on the Cloudflare Worker (Settings → Variables and Secrets).' }, 503)
  }
  let body: Payload
  try {
    body = (await request.json()) as Payload
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const msgs = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 20000) }))
  if (!msgs.length || msgs[0].role !== 'user') return json({ error: 'Conversation must start with a user message' }, 400)

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contextFor(body) },
      ],
      messages: msgs,
    })
    if (res.stop_reason === 'refusal') {
      return json({ text: 'The AI declined this request. Legitimate modding routes only — try rephrasing toward single-player content or an experience you own.', usage: res.usage, costUsd: cost(res.model, res.usage), model: res.model, stopReason: res.stop_reason })
    }
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n\n')
    return json({ text, usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens }, costUsd: cost(res.model, res.usage), model: res.model, stopReason: res.stop_reason })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The server API key was rejected.' }, 502)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Rate limited — try again in a minute.' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: `AI provider error ${e.status ?? ''}` }, 502)
    return json({ error: 'AI request failed' }, 500)
  }
}

function cost(model: string, u: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  const [i, o] = PRICING[model] ?? PRICING[MODEL]
  const input = u.input_tokens * i + (u.cache_creation_input_tokens ?? 0) * i * 1.25 + (u.cache_read_input_tokens ?? 0) * i * 0.1
  return +((input + u.output_tokens * o) / 1e6).toFixed(5)
}
