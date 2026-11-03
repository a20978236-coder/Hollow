import { store } from '../settings';

export function authHeaders(): Record<string, string> {
  const code = store.get('accessCode', '');
  return code ? { 'x-hollow-code': code } : {};
}

export class ApiError extends Error {}

export async function readError(res: Response): Promise<string> {
  try { const j = await res.json(); return j.error ?? `HTTP ${res.status}`; } catch { return `HTTP ${res.status}`; }
}

export type Health = { ok: boolean; ai: boolean; voice: boolean; locked: boolean; authorized: boolean };

export async function getHealth(): Promise<Health> {
  const res = await fetch('/api/health', { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) throw new ApiError(await readError(res));
  return res.json();
}
