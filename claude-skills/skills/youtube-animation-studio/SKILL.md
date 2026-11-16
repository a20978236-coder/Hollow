---
name: youtube-animation-studio
description: >-
  Master director for animated YouTube work. Picks and combines the installed animation skill packs (animate,
  the motion-graphics pack incl. title-sequence-3d and motion-effects, and youtube-intro-outro / audiogram) to make
  channel intros and outros, animated original characters from supplied reference art, cinematic 2D/3D scenes,
  animated logos and titles, sound effects and original music, rendered to MP4 and inspected before delivery.
  Use when the user asks for a YouTube intro/outro, a channel bumper, a character animation from their artwork,
  a logo or title reveal, a cartoon scene, or any animated video "for my channel", even if no skill is named.
---

# YouTube Animation Studio

You are the director. The installed skills are your departments. For every project, choose the departments that
fit, run them in order, and tell the user which skill handled which stage.

`$SKILLS` below means the Claude Code skills folder this file lives in (normally `~/.claude/skills`).
Full source packs (prompts, plugin manifests, validators) are kept in `~/.claude/skill-packs/`.

## The departments

| Skill | Pack | Best at | Use it for |
| --- | --- | --- | --- |
| `animate` | animate-skill | Every frame drawn in code; cutting a still image into layers and moving them; synthesized score (`synth.py`), voice/score mix (`mix.py`), render to MP4 at -14 LUFS (`render.py`), QC (`qc.py`), side-by-side compare (`compare.py`) | **Character animation from reference art**, 2D scenes, transitions, original music and SFX, final render and QC |
| `title-sequence-3d` | motion-graphics | Three.js camera moves through a lit 3D world, bloom, title lands at the end | **Cinematic 3D openers** and 3D title worlds |
| `motion-effects` | motion-graphics | 16 premium effects incl. masked type, elastic type, particle logo | **Animated logos and title slams**, kinetic type |
| `brand-intake` | motion-graphics | Writes `brand.md` + `MOTION.md` from the user's frames | First step on a new channel: palette, type, motion rules |
| `motion-brief-writer`, `motion-prompt-writer`, `reference-to-motion` | motion-graphics | Turning a rough idea or a reference into a precise build brief | Planning when the brief is vague |
| `reel-export` | motion-graphics | 9:16 safe-zone export, H.264/yuv420p/bt709 checks | Shorts/Reels/TikTok cut-downs of a 16:9 intro |
| `vox-explainer`, `launch-video`, `milestone-reveal`, `animated-chart`, `loop-cover`, `newsletter-promo`, `apple-launch-film`, `model-showdown` | motion-graphics | Specialist formats | Use only when the project is that format (explainer, sub-count milestone, chart, etc.) |
| `youtube-intro-outro` | youtube-video-skills | YouTube platform rules: intro length, sting impact frame, end-screen safe zones, reusable brand template; `scripts/probe-mp4.sh`, `contact-sheet.sh`, `seek-shot.sh` | **Every intro and outro**: timing rules, impact sync, outro layout, final spec check |
| `audiogram` | youtube-video-skills | Waveform/caption videos from audio | Podcast clips, voice-led promos |

## Routing: which skills for which job

| Request | Lead skill | Supporting skills |
| --- | --- | --- |
| Character intro from user artwork | `animate` (Move-the-artwork job) | `youtube-intro-outro` (timing, impact frame, spec), `motion-effects` (title slam recipe) |
| Logo sting / channel bumper (3-5 s) | `youtube-intro-outro` | `motion-effects` (particle logo / masked / elastic type), `animate` (score + render) |
| Cinematic 3D opener | `title-sequence-3d` | `youtube-intro-outro`, `animate` `synth.py` for score |
| Outro / end screen | `youtube-intro-outro` | `animate` for character motion in the left third |
| Original cartoon scene / short | `animate` (New film job) | `motion-effects` for titles |
| Vertical cut-down | `reel-export` | `youtube-intro-outro/scripts/probe-mp4.sh` |
| Podcast / voice clip | `audiogram` | `animate` `mix.py` |

Combine skills freely; a typical character intro uses three. Before starting, state the plan as
"Stage → skill" in one short list. The user's explicit timing beats a skill's default (for example
`youtube-intro-outro` recommends 3-5 s intros; if the user asks for 15 s, make 15 s and mention the trade-off once).

## Production pipeline

Work in `animations/<slug>/` (the `animate` layout): `refs/ study/ style.md beats.md layers/ score.json out/`.

1. **Lock the references.** Copy every user image into `refs/` untouched. Write `refs/README.md` listing each
   character: name, label colour, hair, outfit, accessories, exactly as visible. Never invent hidden details;
   if something is not visible, keep it hidden (behind props, smoke, frame edges) instead of drawing it.
2. **Study** with `animate/scripts/study.py` and write `style.md` (palette hexes from the art, type, one device).
3. **Beats** (`beats.md`): one table of time / picture / sound / dialogue speaker. Preserve the user's script,
   order and line-to-character mapping exactly. If time is tight, speed up delivery; never drop a line.
4. **Characters from art.** If the art is one flattened image, separate each character into its own RGBA layer
   (OpenCV GrabCut with hand-placed foreground/background guides, or a matting model if one is available), clean
   the edges, remove overlapping labels/props, and save `layers/<name>.png`. Compare each cutout against the
   reference with `compare.py` before animating. Animate by transforming the cutouts (squash/stretch, rotation,
   perspective scale, motion blur, mouth-region warp for talking); do not repaint faces or outfits.
5. **Titles and logos.** Follow `motion-effects` recipes (masked / elastic type, particle logo) and the
   `youtube-intro-outro` impact rule: the title lands on the exact audio impact frame with a flash and settle.
   Spell titles exactly as given.
6. **Sound.** Score and SFX with `animate/scripts/synth.py` (ticks, impacts, whooshes, kicks, plucks, pads) plus
   numpy for anything extra (accelerating ticks, footsteps, glass thump). Original music only, never copyrighted
   songs. Dialogue: a TTS engine if available (espeak-ng/mbrola locally), one distinct voice per character, then
   `mix.py` so music ducks under dialogue. Drive mouth movement from each line's amplitude envelope.
7. **Render** to MP4: 1920x1080, H.264, yuv420p, AAC, at the requested fps and duration, -14 LUFS.
8. **Inspect and fix** before delivery: `animate/scripts/qc.py` (dead stretches, glitches, loudness, contact sheet),
   `youtube-intro-outro/scripts/probe-mp4.sh out.mp4 1920x1080 30` (spec), stills at every beat boundary viewed at
   full size, and side-by-side comparisons of characters against `refs/`. Check: every character recognisable in
   every shot, correct speaker per line, title spelling, title readable on a phone, no clipped text. Fix and
   re-render until clean.

## Hand-over report

Always include: the MP4 path; a "Stage → skill used" table; what was checked and how; what could not be checked
(you cannot hear audio or watch at speed, so say so); any compromise made (e.g. poses limited to those in the
reference art, synthetic voices); and 3-4 easy tweaks the user can ask for next.

## Rules that never bend

- Use only the characters supplied. No redesigns, replacements, duplicates or extra characters.
- Preserve faces, hair, outfits, colours, proportions and accessories from the reference.
- Keep the user's references and project instructions in the project folder; never overwrite them.
- Comedy violence stays cartoonish and non-graphic; characters are never shown hurt.
