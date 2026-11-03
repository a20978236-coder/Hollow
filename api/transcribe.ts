import { checkAccess, env, jsonError } from './_lib';

// POST /api/transcribe  body: raw recorded audio (audio/mp4 on iPhone)  ->  { text }
export async function POST(req: Request): Promise<Response> {
  const denied = checkAccess(req);
  if (denied) return denied;
  const key = env.elevenKey();
  if (!key) return jsonError('No ELEVENLABS_API_KEY set; the app will use iPhone speech recognition instead.', 503);

  const type = req.headers.get('content-type') || 'audio/mp4';
  const audio = await req.arrayBuffer();
  if (audio.byteLength < 1000) return Response.json({ text: '' });
  if (audio.byteLength > 4_000_000) return jsonError('Recording too long', 413);

  const ext = type.includes('webm') ? 'webm' : type.includes('wav') ? 'wav' : type.includes('mpeg') ? 'mp3' : 'm4a';
  const form = new FormData();
  form.append('model_id', env.sttModel());
  form.append('file', new Blob([audio], { type }), `speech.${ext}`);
  form.append('tag_audio_events', 'false');

  const upstream = await fetch(`${env.elevenBase()}/v1/speech-to-text`, {
    method: 'POST', headers: { 'xi-api-key': key }, body: form,
  });
  const data = (await upstream.json().catch(() => ({}))) as { text?: string; detail?: unknown };
  if (!upstream.ok) {
    console.error('ElevenLabs STT error', upstream.status, data);
    return jsonError(`Speech recognition error ${upstream.status}: ${JSON.stringify(data.detail ?? data).slice(0, 300)}`, 502);
  }
  return Response.json({ text: (data.text ?? '').trim() });
}
