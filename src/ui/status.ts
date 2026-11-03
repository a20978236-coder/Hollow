export type StatusState = 'ok' | 'warn' | 'off' | 'busy';

export function setStatus(id: string, state: StatusState, text: string) {
  const el = document.querySelector<HTMLElement>(`[data-status="${id}"]`);
  if (!el) return;
  el.dataset.state = state;
  el.querySelector('.value')!.textContent = text;
}
