import type { AssistantState } from './scene/HologramScene';
import { Memory } from './brain/memory';
import { streamChat } from './brain/chat';
import { Speaker } from './voice/speaker';
import { Listener } from './voice/listener';
import { sfx } from './audio/sfx';

export type AssistantHooks = {
  onState: (s: AssistantState) => void;
  onLevel: (level: number) => void;
  onCaption: (who: 'user' | 'hollow' | 'system', text: string) => void;
  onTurns: () => void;
  onError: (msg: string) => void;
  onStatus: (msg: string) => void;
};

/** Splits streamed text into speakable chunks at sentence boundaries. */
class SentenceChunker {
  private buf = '';
  private first = true;
  push(delta: string): string[] {
    this.buf += delta;
    const out: string[] = [];
    const re = /[.!?…:;]["')\]]?\s+|\n+/g;
    let cut = -1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buf))) {
      const end = m.index + m[0].length;
      // Speak the first sentence ASAP; batch later ones into slightly longer chunks.
      if (this.first ? end >= 2 : end - (cut < 0 ? 0 : cut) >= 60) {
        out.push(this.buf.slice(cut < 0 ? 0 : cut, end).trim());
        cut = end;
        this.first = false;
      }
    }
    if (cut > 0) this.buf = this.buf.slice(cut);
    return out.filter(Boolean);
  }
  flush(): string { const r = this.buf.trim(); this.buf = ''; return r; }
}

export class Assistant {
  readonly memory = new Memory();
  readonly speaker = new Speaker();
  readonly listener = new Listener();
  state: AssistantState = 'idle';
  handsFree = true;
  voiceReplies = true;
  userName = '';
  private abort: AbortController | null = null;
  private session = 0;

  constructor(private hooks: AssistantHooks) {
    this.speaker.onLevel = (l) => { if (this.state === 'speaking') hooks.onLevel(l); };
    this.speaker.onStart = () => this.setState('speaking');
    this.speaker.onWarning = (m) => hooks.onStatus(m);
  }

  private setState(s: AssistantState) {
    this.state = s;
    this.hooks.onState(s);
    if (s === 'idle' || s === 'thinking') this.hooks.onLevel(0);
  }

  /** Mic button: start listening, finish listening, or interrupt HOLLOW and listen. */
  micTap() {
    this.speaker.unlock();
    if (this.state === 'listening') { this.listener.finishNow(); return; }
    this.interrupt();
    void this.listenAndAnswer();
  }

  /** Stop whatever HOLLOW is doing. */
  interrupt() {
    this.session++;
    this.abort?.abort();
    this.abort = null;
    this.speaker.stop();
    if (this.listener.active) this.listener.cancel();
    this.memory.dropLastIfEmpty();
    this.setState('idle');
  }

  async listenAndAnswer() {
    const session = ++this.session;
    this.setState('listening');
    sfx.listen();
    this.hooks.onCaption('system', '');
    let text = '';
    try {
      text = await this.listener.listen({
        onLevel: (l) => { if (this.state === 'listening') this.hooks.onLevel(l); },
        onInterim: (t) => this.hooks.onCaption('user', t),
      });
    } catch (err) {
      if (session !== this.session) return;
      this.setState('idle');
      sfx.error();
      this.hooks.onError((err as Error).message);
      return;
    }
    if (session !== this.session) return;
    if (!text) { this.setState('idle'); this.hooks.onCaption('system', "I didn't catch that. Tap the mic to try again."); return; }
    sfx.heard();
    await this.ask(text, true);
  }

  /** Speak a fixed system line (not an AI reply, not stored in memory). */
  async say(text: string) {
    if (!this.voiceReplies) return;
    const session = ++this.session;
    this.speaker.begin();
    this.speaker.enqueue(text);
    await this.speaker.finish();
    if (session === this.session) this.setState('idle');
  }

  /** Send a message (typed or spoken) and stream HOLLOW's answer, speaking it aloud. */
  async ask(text: string, spoken = false) {
    text = text.trim();
    if (!text) return;
    this.speaker.unlock();
    if (this.state !== 'idle' && this.state !== 'listening') this.interrupt();
    const session = ++this.session;

    this.memory.add('user', text);
    this.hooks.onCaption('user', text);
    this.hooks.onTurns();
    this.setState('thinking');

    const history = this.memory.forAI();
    this.memory.add('assistant', '');
    this.hooks.onTurns();

    const speak = this.voiceReplies;
    if (speak) this.speaker.begin();
    const chunker = new SentenceChunker();
    let reply = '';
    this.abort = new AbortController();

    try {
      for await (const ev of streamChat(history, { userName: this.userName, signal: this.abort.signal })) {
        if (session !== this.session) return;
        if (ev.t === 'status' && ev.v === 'searching') this.hooks.onCaption('system', 'Searching the web…');
        if (ev.t === 'text' && ev.v) {
          reply += ev.v;
          this.memory.updateLast(reply);
          this.hooks.onCaption('hollow', reply);
          this.hooks.onTurns();
          if (speak) chunker.push(ev.v).forEach((c) => this.speaker.enqueue(c));
        }
        if (ev.t === 'error') throw new Error(ev.v);
      }
    } catch (err) {
      if (session !== this.session || (err as Error).name === 'AbortError') return;
      this.memory.dropLastIfEmpty();
      this.hooks.onTurns();
      this.speaker.stop();
      this.setState('idle');
      sfx.error();
      this.hooks.onError((err as Error).message);
      return;
    }
    this.abort = null;

    if (speak) {
      this.speaker.enqueue(chunker.flush());
      await this.speaker.finish();
    }
    if (session !== this.session) return;
    this.setState('idle');

    // Natural back-and-forth: after a spoken exchange, listen again automatically.
    if (spoken && this.handsFree && reply) void this.listenAndAnswer();
  }
}
