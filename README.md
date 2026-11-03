# HOLLOW

A holographic AI assistant built for the iPhone. It runs in Safari and can be added to the home screen so it opens like an app.
It is built and deployed without a Mac or PC: the code lives on GitHub, Vercel builds and hosts it, and you install it on your iPhone from Safari.

![Step 1 preview](docs/step1-preview.png)

## Architecture

| Part | Technology | Where it runs |
|---|---|---|
| 3D hologram + HUD | three.js (WebGL), TypeScript, Vite | iPhone Safari / home-screen app |
| Sound effects | Web Audio API (synthesized live) | iPhone |
| Backend (`/api/*`) | Vercel serverless functions | Vercel. **API keys live only here** |
| AI brain (Step 2) | Claude API via `/api/chat` | Vercel → Anthropic |
| Voice (Step 3) | Speech-to-text + text-to-speech via `/api/*` | iPhone mic → Vercel → provider |

## Roadmap (one feature at a time)

- [x] **Step 1:** 3D holographic character, HUD, CONNECT boot sequence, status lights, settings, sound effects, `/api/health`
- [ ] **Step 2:** AI brain: Claude via a secure server endpoint, chat screen, conversation memory
- [ ] **Step 3:** Voice: microphone input, a male cinematic voice output, a voice activity animation
- [ ] **Step 4:** Custom realistic male avatar (face, eyes, lip-sync to speech)
- [ ] **Step 5:** Polish: wake behavior, more animations, offline handling

## Honesty rules

Status lights report what is actually working. A feature that has not been built is labeled **NOT BUILT** and is never simulated.

## Development (optional; not needed from the phone)

```
npm install
npm run dev     # serves the app and the /api functions locally
npm run build
```

## Credits

The placeholder character (`public/models/hollow.glb`) is the "Soldier" sample model from the three.js examples (a Mixamo character). It will be replaced by a custom realistic avatar in Step 4.
