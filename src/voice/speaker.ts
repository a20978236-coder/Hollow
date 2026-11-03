import { audioContext } from '../audio/sfx';
import { authHeaders, readError } from '../brain/api';

type Item = { text: string; audio?: Promise<AudioBuffer> };

export type VoiceMode = 'realistic' | 'device';

/** Removes formatting that shouldn't be read aloud. */
export function speakable(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' (code shown in chat) ')
    .replace(/https?:\/\/\S+/g, 'the link in chat')
    .replace(/[*_#`>|~]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Male voices that ship with iOS, best first (used when the realistic voice isn't set up).
const DEVICE_VOICE_PREFS = ['Daniel', 'Arthur', 'Oliver', 'Aaron', 'Gordon', 'Rishi', 'Fred', 'Alex'];

/**
 * HOLLOW's voice. Sentences are queued as the AI reply streams in, so speech starts
 * before the whole answer is finished. Uses ElevenLabs (via /api/speak) when available,
 * otherwise the iPhone's built-in male voice.
 */
export class Speaker {
  mode: VoiceMode = 'device';
  onLevel: (level: number) => void = () => {};
  onStart: () => void = () => {};
  onWarning: (msg: string) => void = () => {};

  private queue: Item[] = [];
  private playing = false;
  private ended = false;
  private generation = 0;
  private source: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private levelRaf = 0;
  private drainResolvers: (() => void)[] = [];
  private deviceSpeaking = false;

  /** Must be called from a tap so iOS allows audio and speech later. */
  unlock() {
    audioContext();
    if ('speechSynthesis' in window && !this.unlocked) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
      this.unlocked = true;
    }
  }
  private unlocked = false;

  get busy() { return this.playing || this.queue.length > 0; }

  /** Start a new spoken reply. */
  begin() { this.stop(); this.ended = false; }

  enqueue(text: string) {
    const clean = speakable(text);
    if (!clean) return;
    this.queue.push({ text: clean });
    this.prefetch();
    if (!this.playing) void this.playLoop(this.generation);
  }

  /** No more text is coming for this reply. Resolves when everything has been spoken. */
  finish(): Promise<void> {
    this.ended = true;
    if (!this.busy) return Promise.resolve();
    return new Promise((r) => this.drainResolvers.push(r));
  }

  stop() {
    this.generation++;
    this.queue = [];
    this.playing = false;
    try { this.source?.stop(); } catch { /* already stopped */ }
    this.source = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.deviceSpeaking = false;
    cancelAnimationFrame(this.levelRaf);
    this.onLevel(0);
    this.resolveDrain();
  }

  private resolveDrain() {
    const rs = this.drainResolvers;
    this.drainResolvers = [];
    rs.forEach((r) => r());
  }

  private prefetch() {
    if (this.mode !== 'realistic') return;
    for (const item of this.queue.slice(0, 2)) item.audio ??= this.fetchAudio(item.text);
  }

  private async fetchAudio(text: string): Promise<AudioBuffer> {
    const res = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.arrayBuffer();
    return audioContext().decodeAudioData(data);
  }

  private async playLoop(gen: number) {
    this.playing = true;
    this.startLevelLoop();
    let started = false;
    while (gen === this.generation && this.queue.length) {
      const item = this.queue[0];
      this.prefetch();
      if (!started) { started = true; this.onStart(); }
      if (this.mode === 'realistic') {
        try {
          const buf = await (item.audio ??= this.fetchAudio(item.text));
          if (gen !== this.generation) return;
          this.queue.shift();
          this.prefetch();
          await this.playBuffer(buf);
        } catch (err) {
          if (gen !== this.generation) return;
          // Realistic voice failed: say so once, then use the iPhone voice for the rest.
          this.onWarning(`Realistic voice failed (${(err as Error).message}). Using iPhone voice.`);
          this.mode = 'device';
        }
      } else {
        this.queue.shift();
        await this.speakDevice(item.text);
      }
    }
    if (gen !== this.generation) return;
    this.playing = false;
    if (this.ended || !this.queue.length) {
      cancelAnimationFrame(this.levelRaf);
      this.onLevel(0);
      if (this.ended) this.resolveDrain();
    }
  }

  private playBuffer(buf: AudioBuffer): Promise<void> {
    const ctx = audioContext();
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.connect(ctx.destination);
    }
    return new Promise((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.analyser!);
      src.onended = () => { if (this.source === src) this.source = null; resolve(); };
      this.source = src;
      src.start();
    });
  }

  private pickDeviceVoice(): SpeechSynthesisVoice | undefined {
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    for (const name of DEVICE_VOICE_PREFS) {
      const v = voices.find((x) => x.name.startsWith(name));
      if (v) return v;
    }
    return voices.find((v) => v.lang === 'en-GB') ?? voices[0];
  }

  private speakDevice(text: string): Promise<void> {
    if (!('speechSynthesis' in window)) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = this.pickDeviceVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = 1.0;
      u.pitch = 0.85; // a touch deeper
      this.deviceSpeaking = true;
      const done = () => { this.deviceSpeaking = false; resolve(); };
      u.onend = done;
      u.onerror = done;
      speechSynthesis.speak(u);
    });
  }

  private startLevelLoop() {
    cancelAnimationFrame(this.levelRaf);
    const data = new Uint8Array(256);
    const tick = () => {
      let level = 0;
      if (this.source && this.analyser) {
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const x of data) { const d = (x - 128) / 128; sum += d * d; }
        level = Math.min(1, Math.sqrt(sum / data.length) * 4);
      } else if (this.deviceSpeaking) {
        // The iPhone voice gives no audio data, so approximate speech rhythm.
        const t = performance.now() / 1000;
        level = 0.3 + 0.25 * Math.abs(Math.sin(t * 11)) * Math.abs(Math.sin(t * 2.3));
      }
      this.onLevel(level);
      this.levelRaf = requestAnimationFrame(tick);
    };
    tick();
  }
}
