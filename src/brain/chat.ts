import { authHeaders, readError, ApiError } from './api';

export type ChatEvent = { t: 'text' | 'status' | 'error' | 'done'; v?: string };

/** Sends the conversation to /api/chat and yields streamed events as they arrive. */
export async function* streamChat(
  messages: { role: string; content: string }[],
  opts: { userName?: string; signal?: AbortSignal },
): AsyncGenerator<ChatEvent> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      messages,
      userName: opts.userName,
      localTime: new Date().toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }),
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new ApiError(await readError(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield JSON.parse(line) as ChatEvent;
    }
  }
}
