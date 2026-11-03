import './styles.css';
import { HologramScene, type Quality } from './scene/HologramScene';
import { sfx, unlockAudio, setSfxEnabled } from './audio/sfx';
import { setStatus } from './ui/status';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// ---- settings (saved on this phone only) ----
const store = {
  get(key: string, fallback: string) { try { return localStorage.getItem(`hollow.${key}`) ?? fallback; } catch { return fallback; } },
  set(key: string, value: string) { try { localStorage.setItem(`hollow.${key}`, value); } catch { /* private mode */ } },
};

// ---- 3D hologram ----
let holo: HologramScene | null = null;
if (import.meta.env.DEV) setTimeout(() => ((window as unknown as { holo: unknown }).holo = holo));
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

const quality = $<HTMLSelectElement>('#set-quality');
quality.value = store.get('quality', 'high');
holo?.setQuality(quality.value as Quality);
quality.addEventListener('change', () => { store.set('quality', quality.value); holo?.setQuality(quality.value as Quality); });

const sfxToggle = $<HTMLInputElement>('#set-sfx');
sfxToggle.checked = store.get('sfx', '1') === '1';
setSfxEnabled(sfxToggle.checked);
sfxToggle.addEventListener('change', () => { store.set('sfx', sfxToggle.checked ? '1' : '0'); setSfxEnabled(sfxToggle.checked); });

// ---- tabs ----
document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((btn) =>
  btn.addEventListener('click', () => {
    unlockAudio(); sfx.tap();
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${btn.dataset.tab}`));
  }),
);

// ---- CONNECT: boot sequence + real backend check ----
const connectBtn = $<HTMLButtonElement>('#connect');
const centerMsg = $('#center-msg');

async function checkBackend() {
  setStatus('server', 'busy', 'CHECKING');
  setStatus('ai', 'busy', 'CHECKING');
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { ok: boolean; ai: boolean };
    setStatus('server', 'ok', 'ONLINE');
    $('#info-server').textContent = 'online';
    // The key may exist, but the AI brain itself is built in Step 2 — report that honestly.
    setStatus('ai', data.ai ? 'warn' : 'off', data.ai ? 'KEY FOUND' : 'NO KEY');
    $('#info-ai').textContent = data.ai ? 'yes (brain arrives in Step 2)' : 'not set';
    return true;
  } catch (err) {
    console.error(err);
    setStatus('server', 'warn', 'OFFLINE');
    setStatus('ai', 'off', 'UNREACHABLE');
    $('#info-server').textContent = 'unreachable';
    $('#info-ai').textContent = 'unknown';
    return false;
  }
}

let connected = false;
connectBtn.addEventListener('click', async () => {
  unlockAudio();
  if (connected) {
    sfx.tap();
    connected = false;
    holo?.dematerialize();
    connectBtn.classList.remove('online');
    connectBtn.querySelector('span')!.textContent = 'CONNECT';
    centerMsg.textContent = 'TAP CONNECT TO INITIALIZE';
    return;
  }
  connectBtn.disabled = true;
  sfx.boot();
  centerMsg.textContent = 'INITIALIZING HOLOGRAPHIC MATRIX…';
  holo?.materialize();
  holo?.setActivity(0.6);
  const ok = await checkBackend();
  await new Promise((r) => setTimeout(r, 1600));
  holo?.setActivity(0);
  connectBtn.disabled = false;
  connected = true;
  connectBtn.classList.add('online');
  connectBtn.querySelector('span')!.textContent = 'ONLINE';
  if (ok) { sfx.online(); centerMsg.textContent = 'HOLLOW ONLINE · AI BRAIN: STEP 2'; }
  else { sfx.error(); centerMsg.textContent = 'HOLOGRAM ONLINE · SERVER UNREACHABLE'; }
});

// ---- HUD clock + live readouts ----
setInterval(() => {
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString([], { hour12: false });
  const fps = holo ? Math.round(holo.fps) : 0;
  $('#info-fps').textContent = holo ? `${fps} fps` : '–';
  $('#readout-left').textContent = `FPS\n${fps}\nSYNC\n${connected ? '100%' : '---'}`;
  $('#readout-right').textContent = `NET\n${navigator.onLine ? 'UP' : 'DOWN'}\nT+\n${Math.floor(performance.now() / 1000)}`;
}, 500);
