import { checkAccess, env, jsonError } from './_lib';

// POST /api/speak  body: { text }  ->  audio/mpeg (ElevenLabs realistic voice)
export async function POST(req: Request): Promise<Response> {
  const denied = checkAccess(req);
  if (denied) return denied;
  const key = env.elevenKey();
  if (!key) return jsonError('No ELEVENLABS_API_KEY set; the app will use the iPhone voice instead.', 503);

  let text = '';
  try { text = String((await req.json()).text ?? '').trim().slice(0, 1500); } catch { /* handled below */ }
  if (!text) return jsonError('Missing text', 400);

  const upstream = await fetch(
    `${env.elevenBase()}/v1/text-to-speech/${encodeURIComponent(env.voiceId())}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: env.ttsModel(),
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
      }),
    },
  );
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('ElevenLabs TTS error', upstream.status, detail);
    return jsonError(`Voice service error ${upstream.status}: ${detail.slice(0, 300)}`, 502);
  }
  return new Response(upstream.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
}
