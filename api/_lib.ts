// Shared server-side helpers. Files starting with "_" are not exposed as endpoints by Vercel.

/**
 * Optional access code. If HOLLOW_ACCESS_CODE is set in Vercel, every request must send it,
 * so strangers who find your URL can't spend your API credits.
 */
export function checkAccess(req: Request): Response | null {
  const code = process.env.HOLLOW_ACCESS_CODE;
  if (!code) return null;
  if (req.headers.get('x-hollow-code') === code) return null;
  return Response.json({ error: 'Access code required or incorrect. Enter it in Settings.' }, { status: 401 });
}

export const env = {
  anthropicKey: () => process.env.ANTHROPIC_API_KEY,
  elevenKey: () => process.env.ELEVENLABS_API_KEY,
  // "Daniel" — a deep, composed British male voice from ElevenLabs' default library.
  voiceId: () => process.env.ELEVENLABS_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9',
  ttsModel: () => process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
  sttModel: () => process.env.ELEVENLABS_STT_MODEL || 'scribe_v1',
  elevenBase: () => process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io',
};

export function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}
