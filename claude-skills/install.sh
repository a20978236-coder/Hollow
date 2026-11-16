#!/usr/bin/env bash
# Install the vendored animation skills into ~/.claude/skills (never overwrites an existing skill) and their dependencies.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"; mkdir -p "$DEST" "$HOME/.claude/skill-packs"
for d in "$HERE"/skills/*/; do n=$(basename "$d")
  if [ -e "$DEST/$n" ]; then echo "preserved existing: $DEST/$n"; else cp -R "$d" "$DEST/$n"; echo "installed $n"; fi; done
cp -Rn "$HERE"/packs/* "$HOME/.claude/skill-packs/" 2>/dev/null || true
chmod +x "$DEST"/youtube-intro-outro/scripts/*.sh "$DEST"/audiogram/scripts/*.sh 2>/dev/null || true
# animate: Python venv (numpy, pillow, playwright) + OpenCV/SciPy for image cutouts
if [ ! -x "$DEST/animate/.venv/bin/python" ]; then python3 -m venv "$DEST/animate/.venv"; fi
"$DEST/animate/.venv/bin/pip" install -q -r "$DEST/animate/requirements.txt" opencv-python-headless scipy
# system tools: ffmpeg (render), espeak-ng + mbrola voices + sox (dialogue)
if command -v apt-get >/dev/null; then (apt-get install -y -q ffmpeg espeak-ng mbrola mbrola-us1 mbrola-us2 mbrola-us3 sox >/dev/null || sudo apt-get install -y -q ffmpeg espeak-ng mbrola mbrola-us1 mbrola-us2 mbrola-us3 sox >/dev/null) || echo "WARN: install ffmpeg espeak-ng mbrola sox manually"; fi
echo "Done. Remotion and HyperFrames are fetched per project with npx when a skill needs them."
