import { store } from '../settings';

export type Turn = { role: 'user' | 'assistant'; content: string; at: number };

const KEY = 'conversation';
const MAX_STORED = 300; // kept on the phone
const MAX_SENT = 40;    // most recent turns sent to the AI each time

/** HOLLOW's conversational memory: persisted on this iPhone across app launches. */
export class Memory {
  turns: Turn[] = [];

  constructor() {
    try { this.turns = JSON.parse(store.get(KEY, '[]')); } catch { this.turns = []; }
    if (!Array.isArray(this.turns)) this.turns = [];
  }

  add(role: Turn['role'], content: string) {
    this.turns.push({ role, content, at: Date.now() });
    if (this.turns.length > MAX_STORED) this.turns = this.turns.slice(-MAX_STORED);
    this.save();
  }

  /** Replace the text of the last assistant turn (used while a reply streams in). */
  updateLast(content: string) {
    const last = this.turns[this.turns.length - 1];
    if (last?.role === 'assistant') { last.content = content; this.save(); }
  }

  /** Remove a trailing empty or failed assistant turn. */
  dropLastIfEmpty() {
    const last = this.turns[this.turns.length - 1];
    if (last?.role === 'assistant' && !last.content.trim()) { this.turns.pop(); this.save(); }
  }

  forAI() {
    return this.turns.slice(-MAX_SENT).filter((t) => t.content.trim()).map(({ role, content }) => ({ role, content }));
  }

  clear() { this.turns = []; this.save(); }

  private save() { store.set(KEY, JSON.stringify(this.turns)); }
}
