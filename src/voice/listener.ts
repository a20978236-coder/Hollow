import { audioContext } from '../audio/sfx';
import { authHeaders, readError } from '../brain/api';

export type ListenEngine = 'cloud' | 'device' | 'none';

type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function nativeRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

export const hasNativeRecognition = () => nativeRecognition() !== null;
export const hasRecorder = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export type ListenOptions = {
  onLevel?: (level: number) => void;
  onInterim?: (text: string) => void;
  onSpeechStart?: () => void;
};

/**
 * Listens to one spoken request through the iPhone microphone and returns the text.
 * cloud: records audio, detects when you stop talking, transcribes with ElevenLabs (/api/transcribe).
 * device: uses the browser's built-in speech recognition (no key needed).
 */
export class Listener {
  engine: ListenEngine = 'none';
  private cancelFn: (() => void) | null = null;
  private finishFn: (() => void) | null = null;

  get active() { return this.cancelFn !== null; }

  /** Stop listening and use what was heard so far. */
  finishNow() { this.finishFn?.(); }

  /** Stop listening and discard. */
  cancel() { this.cancelFn?.(); }

  listen(opts: ListenOptions = {}): Promise<string> {
    if (this.engine === 'cloud') return this.listenCloud(opts);
    if (this.engine === 'device') return this.listenDevice(opts);
    return Promise.reject(new Error('Voice input is not available on this device.'));
  }

  private async listenCloud(opts: ListenOptions): Promise<string> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      throw new Error('Microphone permission was denied. Allow it for this site in iPhone Settings › Safari › Microphone.');
    }
    const ctx = audioContext();
    const srcNode = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    srcNode.connect(analyser);

    const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    let raf = 0;
    let cancelled = false;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      srcNode.disconnect();
      stream.getTracks().forEach((t) => t.stop()); // release the mic so playback is full volume
      opts.onLevel?.(0);
      this.cancelFn = this.finishFn = null;
    };

    const recorded = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mime || 'audio/mp4' }));
    });
    const stop = () => { if (recorder.state !== 'inactive') recorder.stop(); };
    this.finishFn = stop;
    this.cancelFn = () => { cancelled = true; stop(); };
    recorder.start(250);

    // Voice activity detection: wait for speech, then stop after ~1.2 s of silence.
    const data = new Float32Array(analyser.fftSize);
    const t0 = performance.now();
    let noiseFloor = 0.01;
    let speechAt = 0;
    let lastLoud = 0;
    const loop = () => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (const x of data) sum += x * x;
      const rms = Math.sqrt(sum / data.length);
      const now = performance.now();
      if (now - t0 < 350) noiseFloor = Math.max(noiseFloor, rms);
      opts.onLevel?.(Math.min(1, rms * 8));
      const loud = rms > Math.max(0.02, noiseFloor * 2.2);
      if (loud) {
        lastLoud = now;
        if (!speechAt) { speechAt = now; opts.onSpeechStart?.(); }
      }
      if (speechAt && now - lastLoud > 1200) return stop();
      if (!speechAt && now - t0 > 8000) { cancelled = true; return stop(); } // heard nothing
      if (now - t0 > 30000) return stop();
      raf = requestAnimationFrame(loop);
    };
    loop();

    const blob = await recorded;
    cleanup();
    if (cancelled || blob.size < 1000) return '';

    opts.onInterim?.('…');
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': blob.type, ...authHeaders() },
      body: blob,
    });
    if (!res.ok) throw new Error(await readError(res));
    return ((await res.json()) as { text: string }).text.trim();
  }

  private listenDevice(opts: ListenOptions): Promise<string> {
    const Rec = nativeRecognition();
    if (!Rec) return Promise.reject(new Error('Speech recognition is not available in this browser.'));
    return new Promise((resolve, reject) => {
      const rec = new Rec();
      rec.lang = navigator.language || 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      let finalText = '';
      let interim = '';
      let cancelled = false;
      let errored = false;
      // No raw audio is available in this mode, so animate a gentle "listening" level.
      let raf = 0;
      const pulse = () => {
        const t = performance.now() / 1000;
        opts.onLevel?.(interim ? 0.35 + 0.2 * Math.abs(Math.sin(t * 9)) : 0.12 + 0.05 * Math.sin(t * 3));
        raf = requestAnimationFrame(pulse);
      };
      pulse();
      rec.onresult = (e) => {
        interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (finalText || interim) opts.onSpeechStart?.();
        opts.onInterim?.((finalText + ' ' + interim).trim());
      };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        errored = true;
        const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Speech recognition was blocked. Allow Microphone and Speech Recognition for Safari in iPhone Settings, and make sure Siri/Dictation is enabled.'
          : `Speech recognition error: ${e.error}`;
        reject(new Error(msg));
      };
      rec.onend = () => {
        cancelAnimationFrame(raf);
        opts.onLevel?.(0);
        this.cancelFn = this.finishFn = null;
        if (!errored) resolve(cancelled ? '' : (finalText || interim).trim());
      };
      this.finishFn = () => rec.stop();
      this.cancelFn = () => { cancelled = true; rec.abort(); };
      try { rec.start(); } catch (err) { cancelAnimationFrame(raf); this.cancelFn = this.finishFn = null; reject(err); }
    });
  }
}
