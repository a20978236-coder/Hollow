import Anthropic from '@anthropic-ai/sdk';
import { checkAccess, env, jsonError } from './_lib';

export const maxDuration = 60;

const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 60;
const MAX_CHARS = 8000;

// Frozen system prompt (kept byte-identical so prompt caching works).
const SYSTEM = `You are HOLLOW, a personal AI assistant who appears to the user as a blue holographic figure on their iPhone. Your manner is inspired by the composed, capable, dryly witty AI butlers of science fiction: calm, precise, loyal, quietly confident, occasionally understated humor. Never claim to be JARVIS or any existing character; you are HOLLOW.

How you communicate:
- Your replies are usually spoken aloud by a text-to-speech voice. Write natural spoken sentences. No markdown, no bullet symbols, no headings, no emoji, no code blocks unless the user explicitly asks for code or a list.
- Be concise by default: one to three sentences for simple questions. Give longer, structured explanations only when the user asks for detail or the task truly needs it.
- Spell things the way they should be pronounced when it matters (for example "about 20 degrees" rather than "~20°").

What you can and cannot do (be strictly honest about this):
- You can converse, answer questions, explain things, brainstorm, write, plan, do math and reasoning, and search the web for current information.
- You remember this conversation, including earlier sessions on this device, unless the user clears memory in Settings.
- You cannot control the phone, open apps, set alarms or reminders, send messages or emails, make calls, or see the screen or camera. If asked, say plainly that this isn't connected yet instead of pretending.
- Never invent results of actions you did not perform. If you are unsure of a fact, say so.`;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function sanitize(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input)) return null;
  const msgs = input
    .filter((m): m is ChatMessage =>
      !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  return msgs;
}

// POST /api/chat  body: { messages: [{role, content}], userName?, localTime? }
// Streams newline-delimited JSON events: {t:"text",v} {t:"status",v} {t:"error",v} {t:"done"}
export async function POST(req: Request): Promise<Response> {
  const denied = checkAccess(req);
  if (denied) return denied;
  if (!env.anthropicKey()) return jsonError('The AI brain has no API key yet. Add ANTHROPIC_API_KEY in Vercel.', 503);

  let body: { messages?: unknown; userName?: unknown; localTime?: unknown };
  try { body = await req.json(); } catch { return jsonError('Invalid JSON', 400); }
  const history = sanitize(body.messages);
  if (!history) return jsonError('Expected a conversation ending with a user message.', 400);

  const userName = typeof body.userName === 'string' ? body.userName.slice(0, 60).trim() : '';
  const localTime = typeof body.localTime === 'string' ? body.localTime.slice(0, 80) : '';
  // Per-request context goes in a trailing system message so the cached prefix stays stable.
  const context = [
    localTime && `The user's current local date and time: ${localTime}.`,
    userName && `The user's name is ${userName}; address them by it occasionally, naturally.`,
  ].filter(Boolean).join(' ');

  const client = new Anthropic({ apiKey: env.anthropicKey() });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
      if (context) messages.push({ role: 'system', content: context } as unknown as Anthropic.Beta.BetaMessageParam);

      try {
        // Web search is a server-side tool; long searches may return pause_turn, so continue a few times.
        for (let round = 0; round < 4; round++) {
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 4000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            output_config: { effort: 'low' }, // fast, conversational replies
            cache_control: { type: 'ephemeral' },
            system: SYSTEM,
            tools: process.env.HOLLOW_WEB_SEARCH === 'off' ? undefined : [
              { type: 'web_search_20260209', name: 'web_search', max_uses: 3 },
            ],
            messages,
          });
          for await (const ev of s) {
            if (ev.type === 'content_block_start' && ev.content_block.type === 'server_tool_use') send({ t: 'status', v: 'searching' });
            if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') send({ t: 'text', v: ev.delta.text });
          }
          const final = await s.finalMessage();
          if (final.stop_reason === 'refusal') { send({ t: 'text', v: "I'm afraid I can't help with that one." }); break; }
          if (final.stop_reason !== 'pause_turn') break;
          messages.push({ role: 'assistant', content: final.content });
        }
        send({ t: 'done' });
      } catch (err) {
        let msg = 'The AI brain had an unexpected error.';
        if (err instanceof Anthropic.AuthenticationError) msg = 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.';
        else if (err instanceof Anthropic.PermissionDeniedError) msg = 'The Anthropic account does not have permission for this request (check billing or web search settings).';
        else if (err instanceof Anthropic.RateLimitError) msg = 'Rate limited by Anthropic. Wait a moment and try again.';
        else if (err instanceof Anthropic.BadRequestError) msg = `Request rejected: ${err.message}`;
        else if (err instanceof Anthropic.APIError) msg = `Anthropic API error ${err.status ?? ''}: ${err.message}`;
        console.error(err);
        send({ t: 'error', v: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
