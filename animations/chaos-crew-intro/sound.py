#!/usr/bin/env python3
"""CHAOS CREW intro soundtrack: original music + SFX + dialogue, all synthesized/local.

Writes out/mix.wav (stereo 44.1k) and lipsync.js (per-frame mouth envelopes for piece.html).
Reuses the animate skill's synth.py voices (tick, kick, impact, swell, whoosh, pluck, room reverb).
Usage: python sound.py   (run from this folder)
"""
import json, os, sys, wave
import numpy as np

sys.path.insert(0, os.path.expanduser("~/.claude/skills/animate/scripts"))
import synth as S  # noqa: E402

RATE = S.RATE
DUR = 15.0
N = int(DUR * RATE)
TL = json.load(open("timeline.json"))
rng = np.random.default_rng(7)


def buf():
    return np.zeros((N, 2))


def put(track, sig, t, vel=1.0, pan=0.0):
    i = int(t * RATE)
    if i >= N:
        return
    sig = sig[: N - i] * vel
    track[i:i + len(sig), 0] += sig * np.sqrt((1 - pan) / 2) * 1.4142
    track[i:i + len(sig), 1] += sig * np.sqrt((1 + pan) / 2) * 1.4142


def env(n, a=0.002, d=0.1):
    t = np.arange(n) / RATE
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def tone(f, sec, kind="sq", duty=0.5):
    t = np.arange(int(sec * RATE)) / RATE
    ph = (f * t) % 1
    if kind == "sq":
        return np.where(ph < duty, 1.0, -1.0)
    if kind == "saw":
        return 2 * ph - 1
    if kind == "tri":
        return 4 * np.abs(ph - 0.5) - 1
    return np.sin(2 * np.pi * f * t)


def hp(sig, cutoff):
    return sig - S.lowpass(sig, cutoff)


def noise(sec):
    return rng.standard_normal(int(sec * RATE))


hz = S.hertz

# ---------------------------------------------------------------- SFX
sfx = buf()

# 1. Ticking that speeds up and gets louder: tick-tock pairs, interval 0.42 s -> 0.07 s, stops dead before the beat.
t, k = 0.15, 0
while t < TL["beat"] - 0.05:
    p = t / TL["beat"]
    f = 2600 if k % 2 == 0 else 1900
    click = np.sin(2 * np.pi * f * np.arange(int(0.03 * RATE)) / RATE) * env(int(0.03 * RATE), 0.0005, 0.006)
    wood = S.tick() * 0.8
    sig = np.concatenate([click, np.zeros(max(0, len(wood) - len(click)))])[: max(len(click), len(wood))]
    sig[: len(wood)] += wood
    put(sfx, sig, t, vel=0.35 + 0.55 * p ** 1.5, pan=0.1 if k % 2 else -0.1)
    t += 0.42 * (1 - 0.83 * p ** 1.2)
    k += 1

# 2. Comedic beat: a tiny "gulp" right in the silence
tt = np.arange(int(0.12 * RATE)) / RATE
gulp = np.sin(2 * np.pi * (300 - 900 * tt) * tt) * env(len(tt), 0.005, 0.05)
put(sfx, gulp, TL["beat"] + 0.12, 0.35)

# 3. Panic scramble: cartoon zip + rapid footsteps
put(sfx, S.whoosh(0.35), TL["sprint"] - 0.05, 0.9)
zz = np.arange(int(0.25 * RATE)) / RATE
zip_ = np.sin(2 * np.pi * (500 + 2600 * zz / 0.25) * zz) * env(len(zz), 0.01, 0.15)
put(sfx, zip_, TL["sprint"], 0.35)
t = TL["sprint"] + 0.05
i = 0
while t < TL["launch"]:
    step = S.kick()[: int(0.08 * RATE)] * 0.6 + hp(noise(0.08), 900) * env(int(0.08 * RATE), 0.001, 0.015) * 0.5
    put(sfx, step, t, 0.45, pan=[-0.5, 0.5, -0.2, 0.2][i % 4])
    t += 0.075
    i += 1

# 4. The explosion: flash crack, sub drop, rumbling noise cloud, debris crackle
B = TL["boom"]
crack = noise(0.08) * env(int(0.08 * RATE), 0.0005, 0.02)
put(sfx, crack, B, 1.0)
st = np.arange(int(1.6 * RATE)) / RATE
sub = np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-st / 0.18)) / RATE) * env(len(st), 0.003, 0.55)
put(sfx, np.tanh(sub * 2.2), B, 1.0)
rumble = S.lowpass(noise(2.4), 260) * env(int(2.4 * RATE), 0.01, 0.7) * 5
put(sfx, rumble, B, 0.9, -0.15)
put(sfx, S.lowpass(noise(2.0), 900) * env(int(2.0 * RATE), 0.005, 0.45) * 2.5, B + 0.01, 0.7, 0.2)
put(sfx, S.impact(), B, 1.0)
for j in range(26):
    d = hp(noise(0.03), 2500) * env(int(0.03 * RATE), 0.0005, 0.006)
    put(sfx, d, B + 0.15 + rng.random() * 1.4, 0.25 + 0.3 * rng.random(), rng.uniform(-0.9, 0.9))
# blast wave catches them: boing-yelp launch
lt = np.arange(int(0.5 * RATE)) / RATE
boing = np.sin(2 * np.pi * (180 + 500 * lt + 40 * np.sin(2 * np.pi * 18 * lt)) * lt) * env(len(lt), 0.005, 0.25)
put(sfx, boing, TL["launch"], 0.35)

# 5. Flying at the camera: long rising whoosh, filtered noise opening up + spin flutter
fl = TL["hit"] - TL["shot2"]
nf = noise(fl)
ft = np.arange(len(nf)) / RATE
rise = (ft / fl) ** 2.2
chunks = []
seg = int(0.05 * RATE)
for s0 in range(0, len(nf), seg):
    c = nf[s0:s0 + seg]
    chunks.append(S.lowpass(np.pad(c, (0, seg - len(c))), 300 + 6000 * rise[min(s0, len(rise) - 1)])[: len(c)])
woosh = np.concatenate(chunks) * (0.15 + 1.2 * rise) * (1 + 0.35 * np.sin(2 * np.pi * (3 + 9 * rise) * ft))
put(sfx, woosh * 1.6, TL["shot2"], 0.9)

# 6. SPLAT against the lens: glass-like thump (low body + glassy partials) and a little wobble
H = TL["hit"]
th = np.arange(int(1.2 * RATE)) / RATE
thump = np.sin(2 * np.pi * (95 * th + 40 * (1 - np.exp(-th / 0.05)))) * env(len(th), 0.001, 0.12)
glass = sum(np.sin(2 * np.pi * f * th) * np.exp(-th / dcy) * a for f, dcy, a in
            [(1870, 0.35, 0.3), (2930, 0.25, 0.22), (4410, 0.18, 0.15), (6120, 0.12, 0.1)])
put(sfx, thump * 1.2 + glass, H, 1.0)
put(sfx, S.kick(), H, 0.9)

# 7. Rubbery squeak as they slide down the glass (stick-slip squeaks, pitch falling)
t = TL["slide"] + 0.15
n_sq = 0
while t < TL["title"] - 0.25:
    sl = 0.16
    qt = np.arange(int(sl * RATE)) / RATE
    f0 = 1250 - 70 * n_sq
    sq = np.sin(2 * np.pi * np.cumsum(f0 + 120 * np.sin(2 * np.pi * 34 * qt)) / RATE)
    sq = np.tanh(2 * sq) * np.sin(np.pi * qt / sl) ** 2
    put(sfx, sq, t, 0.16, pan=0.3 * np.sin(n_sq))
    t += 0.24 - 0.012 * n_sq
    n_sq += 1

# 8. Title slam: reverse swell into a huge impact + crash, on the downbeat
T = TL["title"]
put(sfx, S.swell(0.45), T - 0.45, 0.8)
put(sfx, np.tanh(S.impact() * 1.8), T, 1.0)
put(sfx, S.kick(), T, 1.0)
crash = hp(noise(1.2), 4000) * env(int(1.2 * RATE), 0.001, 0.35)
put(sfx, crash, T, 0.55)
zt = np.arange(int(0.3 * RATE)) / RATE
zap = np.sin(2 * np.pi * np.cumsum(3000 * np.exp(-zt / 0.06) + 200) / RATE) * env(len(zt), 0.001, 0.1)
put(sfx, zap, T + 0.02, 0.3, 0.4)

# ---------------------------------------------------------------- MUSIC (original, E minor)
music = buf()
# Suspense bed under the dialogue: soft pulsing low E and a creeping tritone (quiet, ducked further under voices)
for bt in np.arange(0.0, TL["beat"] - 0.1, 0.42 * 2):
    put(music, np.sin(2 * np.pi * hz("E2") * np.arange(int(0.35 * RATE)) / RATE) * env(int(0.35 * RATE), 0.01, 0.15), bt, 0.35)
put(music, S.pad(["E3", "B3", "G4"], TL["beat"] - 0.2, fade=0.6), 0.0, 0.10)
put(music, S.pad(["E3", "A#3", "G4"], 1.8, fade=0.6), TL["hollow"] - 0.25, 0.10)

# Chaos theme: 150 BPM from the moment they run. Beat = 0.4 s. Title slam lands on bar 6 downbeat.
BPM = 150.0
beat = 60 / BPM
M0 = TL["music"]
bars_end = TL["title"]
prog = ["E", "C", "D", "B"]  # Em - C - D - B (chaotic but resolving)
roots = {"E": "E2", "C": "C2", "D": "D2", "B": "B1"}
arps = {"E": ["E4", "G4", "B4", "E5"], "C": ["C4", "E4", "G4", "C5"], "D": ["D4", "F#4", "A4", "D5"], "B": ["B3", "D#4", "F#4", "B4"]}
n_beats = int(round((bars_end - M0) / beat))
for b in range(n_beats):
    tb = M0 + b * beat
    chord = prog[(b // 4) % 4]
    # drums
    put(music, S.kick(), tb, 0.85)
    if b % 2 == 1:
        sn = hp(noise(0.18), 1200) * env(int(0.18 * RATE), 0.001, 0.05) + np.sin(2 * np.pi * 190 * np.arange(int(0.18 * RATE)) / RATE) * env(int(0.18 * RATE), 0.001, 0.04)
        put(music, sn, tb, 0.5)
    for h in range(2):
        put(music, hp(noise(0.04), 7000) * env(int(0.04 * RATE), 0.0005, 0.012), tb + h * beat / 2, 0.25, 0.3)
    # bass: octave-jumping square
    for e in range(2):
        f = hz(roots[chord]) * (2 if e else 1)
        bs = S.lowpass(tone(f, beat / 2 * 0.9, "sq", 0.25), 900) * env(int(beat / 2 * 0.9 * RATE), 0.003, 0.12)
        put(music, bs, tb + e * beat / 2, 0.30)
    # lead: 16th-note chiptune arpeggio
    for s16 in range(4):
        note = arps[chord][(s16 + b) % 4]
        ld = tone(hz(note), beat / 4 * 0.85, "sq", 0.125) * env(int(beat / 4 * 0.85 * RATE), 0.002, 0.06)
        put(music, ld, tb + s16 * beat / 4, 0.10, -0.25 if s16 % 2 else 0.25)
    # hooky saw melody on top every other bar
    if (b // 4) % 2 == 1 and b % 4 in (0, 2, 3):
        mel = {"E": "B5", "C": "G5", "D": "A5", "B": "F#5"}[chord]
        ml = tone(hz(mel), beat * 0.7, "saw") * env(int(beat * 0.7 * RATE), 0.01, 0.25)
        put(music, S.lowpass(ml, 3500), tb, 0.11)

# Pull music back while they fly (lets the whoosh own the space), then a riser into the slam
fly = (np.arange(N) / RATE)
duck_fly = np.ones(N)
m = (fly > TL["shot2"] + 0.3) & (fly < TL["hit"])
duck_fly[m] = 0.55
music *= duck_fly[:, None]
# Final stab: big E minor chord ringing out over the title
stab = sum(S.lowpass(tone(hz(n), 1.0, "saw"), 3000) for n in ["E3", "B3", "E4", "G4", "B4"]) * env(int(1.0 * RATE), 0.005, 0.45)
put(music, stab, T, 0.18)
put(music, S.kick(), T, 1.0)

# ---------------------------------------------------------------- DIALOGUE
def read_wav(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
        if w.getnchannels() == 2:
            a = a.reshape(-1, 2).mean(1)
        return a


dia = buf()
FPS = 30
lips = {}
lines = [("luck", TL["luck"], -0.25), ("hollow", TL["hollow"], 0.15), ("light", TL["light"], 0.45), ("echo", TL["echo"], -0.45)]
for name, t0, pan in lines:
    v = read_wav(f"audio/{name}.wav")
    put(dia, v, t0, 0.95, pan)
    # per-frame envelope for mouth movement
    hop = RATE // FPS
    frames = int(np.ceil(len(v) / hop))
    e = np.array([np.sqrt(np.mean(v[i * hop:(i + 1) * hop] ** 2)) for i in range(frames)])
    e = e / (e.max() + 1e-9)
    lips[name] = {"start": t0, "env": [round(float(x), 3) for x in e]}
    print(f"{name:7s} {t0:5.2f}-{t0 + len(v) / RATE:5.2f}s")

# Duck music + ticks under dialogue (sidechain from the dialogue envelope)
d_env = np.abs(dia).mean(1)
k = int(0.12 * RATE)
d_env = np.convolve(d_env, np.ones(k) / k, mode="same")
duck = 1 - 0.6 * np.clip(d_env / (d_env.max() + 1e-9) * 3, 0, 1)
music *= duck[:, None]
sfx_duck = 1 - 0.3 * np.clip(d_env / (d_env.max() + 1e-9) * 3, 0, 1)
sfx *= sfx_duck[:, None]

# Room reverb glue (light) on music+sfx
mix_ms = music * 0.9 + sfx * 0.85
irs = S.room(1.2)
wet = [S.convolve(mix_ms[:, ch], irs[ch]) for ch in range(2)]
for ch in range(2):
    mix_ms[:, ch] += wet[ch] / (np.abs(wet[ch]).max() + 1e-9) * np.abs(mix_ms[:, ch]).max() * 0.12
mix = mix_ms + dia * 1.25
# hard silence for the comedic beat (only the gulp survives)
ts = np.arange(N) / RATE
beat_gate = np.ones(N)
gate = (ts > TL["beat"] + 0.02) & (ts < TL["music"] - 0.02)
beat_gate[gate] = 0.25
mix *= beat_gate[:, None]
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.6) * 0.9
os.makedirs("out", exist_ok=True)
with wave.open("out/mix.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
open("lipsync.js", "w").write("window.LIPS = " + json.dumps(lips) + ";\n")
lv = [round(20 * np.log10(np.sqrt(np.mean(mix[int(i * RATE / 2):int((i + 1) * RATE / 2)] ** 2)) + 1e-9)) for i in range(30)]
print("level per half second dB:", lv)
