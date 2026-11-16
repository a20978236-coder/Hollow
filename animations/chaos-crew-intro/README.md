# CHAOS CREW: 15-second YouTube intro

Deliverable: `out/chaos-crew-intro.mp4` (1920x1080, H.264 + AAC, 30 fps, 15 s, -14 LUFS).

Rebuild from scratch (needs the skills from `claude-skills/`, installed with `claude-skills/install.sh`):

```bash
PY=~/.claude/skills/animate/.venv/bin/python
$PY cutout.py && $PY logo_cut.py && $PY upscale.py   # layers from refs/
./voices.sh                                # dialogue (espeak-ng + mbrola)
$PY sound.py                               # music + SFX + mix -> out/mix.wav, lipsync.js
$PY ~/.claude/skills/animate/scripts/render.py piece.html --audio out/mix.wav
$PY ~/.claude/skills/animate/scripts/qc.py out/chaos-crew-intro.mp4
~/.claude/skills/youtube-intro-outro/scripts/probe-mp4.sh out/chaos-crew-intro.mp4 1920x1080 30
```

