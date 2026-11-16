# Vendored Claude Code animation skills

Copies of the skills installed in `~/.claude/skills`, kept here because cloud sessions start from a fresh container.
Run `./install.sh` to (re)install them plus dependencies. Sources (unmodified, except youtube-video-skills' repo-level
`scripts/` copied into each of its two skills so the paths in their SKILL.md resolve):

- https://github.com/JAYANTCH1797/animate-skill -> `skills/animate` (MIT)
- https://github.com/charlie947/motion-graphics-skills -> 15 skills incl. `title-sequence-3d` (see its LICENSE)
- https://github.com/iart-ai/youtube-video-skills -> `youtube-intro-outro`, `audiogram` (MIT)
- `skills/youtube-animation-studio` -> master director skill written for this repo

`packs/` holds the non-skill files of the motion-graphics and youtube packs (prompts, downloads, validator, plugin manifest).
