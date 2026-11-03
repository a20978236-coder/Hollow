import './styles.css';
import { HologramScene, type Quality, type AssistantState } from './scene/HologramScene';
import { sfx, unlockAudio, setSfxEnabled } from './audio/sfx';
import { setStatus } from './ui/status';
import { store } from './settings';
import { getHealth, type Health } from './brain/api';
import { Assistant } from './assistant';
import { hasNativeRecognition, hasRecorder } from './voice/listener';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

let connected = false;
let health: Health | null = null;

// ---------------------------------------------------------------- 3D hologram
let holo: HologramScene | null = null;
try {
  holo = new HologramScene($('#stage'));
  holo.loadCharacter('/models/hollow.glb').then(
    () => setStatus('render', 'ok', 'ONLINE'),
    (err) => { console.error(err); setStatus('render', 'warn', 'MODEL ERROR'); },
  );
} catch (err) {
  console.error(err);
  setStatus('render', 'warn', 'NO WEBGL');
}
if (import.meta.env.DEV) (window as unknown as { holo: unknown }).holo = holo;

// ---------------------------------------------------------------- UI elements
const connectBtn = $<HTMLButtonElement>('#connect');
const micBtn = $<HTMLButtonElement>('#mic');
const centerMsg = $('#center-msg');
const caption = $('#caption');
const captionWho = $('#caption-who');
const captionText = $('#caption-text');
const messagesEl = $('#messages');
const chatState = $('#chat-state');
const composer = $<HTMLFormElement>('#composer');
const chatInput = $<HTMLInputElement>('#chat-input');

const STATE_LABEL: Record<AssistantState, string> = {
  idle: 'READY', listening: 'LISTENING…', thinking: 'THINKING…', speaking: 'SPEAKING…',
};

function showCaption(kind: 'user' | 'hollow' | 'system' | 'error', text: string) {
  caption.hidden = !text;
  caption.className = `caption ${kind}`;
  captionWho.textContent = kind === 'user' ? 'YOU' : kind === 'hollow' ? 'HOLLOW' : kind === 'error' ? 'ERROR' : '';
  captionText.textContent = text;
  caption.scrollTop = caption.scrollHeight;
}

// ---------------------------------------------------------------- assistant
const assistant = new Assistant({
  onState: (s) => {
    holo?.setState(s);
    micBtn.dataset.state = s;
    chatState.textContent = STATE_LABEL[s];
    if (connected) centerMsg.textContent = STATE_LABEL[s];
    renderMessages();
  },
  onLevel: (l) => { holo?.setLevel(l); micBtn.style.setProperty('--lvl', l.toFixed(3)); },
  onCaption: (who, text) => showCaption(who, text),
  onTurns: () => renderMessages(),
  onError: (msg) => { showCaption('error', msg); appendNotice(msg); },
  onStatus: (msg) => appendNotice(msg),
});

// ---------------------------------------------------------------- settings
const quality = $<HTMLSelectElement>('#set-quality');
quality.value = store.get('quality', 'high');
holo?.setQuality(quality.value as Quality);
quality.addEventListener('change', () => { store.set('quality', quality.value); holo?.setQuality(quality.value as Quality); });

function bindCheckbox(id: string, key: string, def: boolean, apply: (v: boolean) => void) {
  const el = $<HTMLInputElement>(id);
  el.checked = store.get(key, def ? '1' : '0') === '1';
  apply(el.checked);
  el.addEventListener('change', () => { store.set(key, el.checked ? '1' : '0'); apply(el.checked); });
}
bindCheckbox('#set-sfx', 'sfx', true, setSfxEnabled);
bindCheckbox('#set-voice-replies', 'voiceReplies', true, (v) => (assistant.voiceReplies = v));
bindCheckbox('#set-handsfree', 'handsFree', true, (v) => (assistant.handsFree = v));

function bindText(id: string, key: string, apply: (v: string) => void) {
  const el = $<HTMLInputElement>(id);
  el.value = store.get(key, '');
  apply(el.value);
  el.addEventListener('change', () => { store.set(key, el.value.trim()); apply(el.value.trim()); });
}
bindText('#set-name', 'userName', (v) => (assistant.userName = v));
bindText('#set-code', 'accessCode', () => { if (connected) void checkBackend(); });

const voiceSel = $<HTMLSelectElement>('#set-voice');
voiceSel.value = store.get('voice', 'auto');
voiceSel.addEventListener('change', () => { store.set('voice', voiceSel.value); configureVoice(); });

$('#clear-memory').addEventListener('click', () => {
  if (!confirm('Erase everything HOLLOW remembers from your conversations on this iPhone?')) return;
  assistant.interrupt();
  assistant.memory.clear();
  renderMessages();
  showCaption('system', 'Memory cleared.');
});

// ---------------------------------------------------------------- tabs
document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((btn) =>
  btn.addEventListener('click', () => {
    unlockAudio(); sfx.tap();
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${btn.dataset.tab}`));
    if (btn.dataset.tab === 'chat') messagesEl.scrollTop = messagesEl.scrollHeight;
  }),
);

// ---------------------------------------------------------------- conversation screen
const notices: string[] = [];
function appendNotice(msg: string) { notices.push(msg); renderMessages(); }

function renderMessages() {
  const turns = assistant.memory.turns;
  const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
  messagesEl.replaceChildren();
  if (!turns.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = health?.ai
      ? 'No conversation yet. Tap the mic or type below.'
      : 'Tap CONNECT on the HOLO screen first. The AI brain needs its key on the server.';
    messagesEl.append(p);
  }
  turns.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = `msg ${t.role}`;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${t.role === 'user' ? 'YOU' : 'HOLLOW'} · ${new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    div.append(meta, document.createTextNode(t.content));
    if (i === turns.length - 1 && t.role === 'assistant' && assistant.state === 'thinking') div.classList.add('pending');
    messagesEl.append(div);
  });
  for (const n of notices.slice(-3)) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = `⚠ ${n}`;
    messagesEl.append(p);
  }
  if (atBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  $('#info-memory').textContent = `${turns.length} messages on this iPhone`;
}

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  if (!health?.ai || !health.authorized) { appendNotice('Connect first (HOLO screen). The AI brain is not ready.'); return; }
  unlockAudio();
  chatInput.value = '';
  void assistant.ask(text, false);
});

// ---------------------------------------------------------------- voice capabilities
function configureVoice() {
  const pref = voiceSel.value;
  const serverVoice = !!health?.voice && !!health.authorized;
  const realistic = serverVoice && pref !== 'device';
  assistant.speaker.mode = realistic ? 'realistic' : 'device';
  assistant.listener.engine = realistic && hasRecorder() ? 'cloud' : hasNativeRecognition() ? 'device' : hasRecorder() && serverVoice ? 'cloud' : 'none';

  const tts = realistic ? 'Realistic (ElevenLabs)' : 'iPhone built-in voice';
  const stt = { cloud: 'ElevenLabs transcription', device: 'iPhone speech recognition', none: 'not available' }[assistant.listener.engine];
  $('#info-tts').textContent = pref === 'realistic' && !serverVoice ? 'iPhone voice (no ElevenLabs key)' : tts;
  $('#info-stt').textContent = stt;
  if (!connected) return;
  if (assistant.listener.engine === 'none') setStatus('voice', 'warn', 'TEXT ONLY');
  else setStatus('voice', realistic ? 'ok' : 'warn', realistic ? 'REALISTIC' : 'IPHONE');
}

async function checkBackend(): Promise<boolean> {
  setStatus('server', 'busy', 'CHECKING');
  setStatus('ai', 'busy', 'CHECKING');
  try {
    health = await getHealth();
    setStatus('server', 'ok', 'ONLINE');
    $('#info-server').textContent = 'online';
    if (!health.ai) setStatus('ai', 'off', 'NO KEY');
    else if (!health.authorized) setStatus('ai', 'warn', 'LOCKED');
    else setStatus('ai', 'ok', 'ONLINE');
    $('#info-ai').textContent = !health.ai ? 'not set' : health.authorized ? 'yes' : 'yes — enter access code';
    configureVoice();
    return true;
  } catch (err) {
    console.error(err);
    health = null;
    setStatus('server', 'warn', 'OFFLINE');
    setStatus('ai', 'off', 'UNREACHABLE');
    setStatus('voice', 'off', 'STANDBY');
    $('#info-server').textContent = 'unreachable';
    $('#info-ai').textContent = 'unknown';
    return false;
  } finally {
    const ready = !!health?.ai && !!health.authorized && assistant.listener.engine !== 'none';
    micBtn.disabled = !(connected && ready);
    renderMessages();
  }
}

// ---------------------------------------------------------------- CONNECT
connectBtn.addEventListener('click', async () => {
  unlockAudio();
  assistant.speaker.unlock();
  if (connected) {
    sfx.tap();
    connected = false;
    assistant.interrupt();
    holo?.dematerialize();
    micBtn.disabled = true;
    caption.hidden = true;
    connectBtn.classList.remove('online');
    connectBtn.querySelector('span')!.textContent = 'CONNECT';
    centerMsg.textContent = 'TAP CONNECT TO INITIALIZE';
    setStatus('voice', 'off', 'STANDBY');
    return;
  }
  connectBtn.disabled = true;
  sfx.boot();
  centerMsg.textContent = 'INITIALIZING HOLOGRAPHIC MATRIX…';
  holo?.materialize();
  holo?.setActivity(0.6);
  connected = true;
  const ok = await checkBackend();
  await new Promise((r) => setTimeout(r, 1600));
  holo?.setActivity(0);
  connectBtn.disabled = false;
  connectBtn.classList.add('online');
  connectBtn.querySelector('span')!.textContent = 'ONLINE';
  configureVoice();

  if (!ok) { sfx.error(); centerMsg.textContent = 'SERVER UNREACHABLE'; return; }
  if (!health!.ai) { sfx.error(); centerMsg.textContent = 'AI BRAIN: NO API KEY'; showCaption('system', 'Add ANTHROPIC_API_KEY in Vercel to activate my brain.'); return; }
  if (!health!.authorized) { sfx.error(); centerMsg.textContent = 'ACCESS CODE REQUIRED'; showCaption('system', 'Enter your access code in Settings.'); return; }

  sfx.online();
  centerMsg.textContent = STATE_LABEL.idle;
  const greeting = `HOLLOW online${assistant.userName ? `. Good to see you, ${assistant.userName}` : ''}. Tap the microphone and talk to me.`;
  showCaption('hollow', greeting);
  await assistant.say(greeting.replace('microphone', 'mic'));
});

micBtn.addEventListener('click', () => {
  unlockAudio();
  if (!connected) return;
  assistant.micTap();
});

// ---------------------------------------------------------------- HUD clock + readouts
setInterval(() => {
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString([], { hour12: false });
  const fps = holo ? Math.round(holo.fps) : 0;
  $('#info-fps').textContent = holo ? `${fps} fps` : '–';
  $('#readout-left').textContent = `FPS\n${fps}\nSYNC\n${connected ? '100%' : '---'}`;
  $('#readout-right').textContent = `NET\n${navigator.onLine ? 'UP' : 'DOWN'}\nMEM\n${assistant.memory.turns.length}`;
}, 500);

configureVoice();
renderMessages();
