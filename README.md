# ALL-STAR: Roblox Superhero Kit

**Alan Murry / All-Star**, a hero in helmetless black-and-white *Lunar Prime* armor with a white star chest emblem and dark curly hair. He flies, charges white-and-cyan energy blasts, and does a superhero landing that cracks the ground.

The code is Roblox Luau for R15 rigs. Abilities are server-authoritative, mobile touch controls are built in, and the source is laid out for [Rojo](https://rojo.space).

> **Testing status:** this project has **not** been run in Roblox Studio yet.
> The code was written against the current Roblox API and is linted and built in CI (GitHub Actions: Selene + `rojo build`). It has not been playtested. Before you rely on it, go through [`docs/TESTING.md`](docs/TESTING.md) in Studio.

---

## Abilities

| Ability | Touch | Keyboard / Mouse | Gamepad | Cooldown (Config) |
|---|---|---|---|---|
| Flight toggle | **FLY / STOP** button | `F` | `Y` | `FlightToggle` 1.25 s |
| Steer flight | Thumbstick + camera drag | `WASD` + camera | Left stick | n/a |
| Up / Down | **▲ / ▼** buttons (shown while flying) | `Space` / `Ctrl` or `C` | `A` / `X` | n/a |
| Energy blast (tap) | Tap **BLAST** | Tap `E` or left mouse button | Tap `R2` | `Blast` 0.45 s |
| Charged explosive blast | Hold **BLAST**, release | Hold `E` / LMB, release | Hold `R2` | `ChargedBlast` 3 s |
| Superhero landing | **DIVE** while flying, or fall from height | `G` while flying | `B` | `Landing` 4 s |

All numbers live in [`Config.luau`](src/ReplicatedStorage/AllStar/Config.luau).

## Project layout

```
default.project.json            Rojo project: maps src/ to Roblox services
selene.toml                     Luau linter config (Roblox std)
.github/workflows/build.yml     CI: lint + build AllStar.rbxlx (downloadable artifact)

src/
├─ ReplicatedStorage/AllStar/            (Folder, shared by server + client)
│  ├─ Config.luau            ModuleScript: every tunable value (frozen)
│  ├─ Remotes.luau           ModuleScript: creates/finds the 3 RemoteEvents
│  ├─ Validation.luau        ModuleScript: NaN/inf/type/unit-vector checks
│  ├─ CooldownTracker.luau   ModuleScript: reusable keyed cooldown class
│  ├─ StarShape.luau         ModuleScript: star emblem built from WedgeParts
│  ├─ Poses.luau             ModuleScript: procedural R15 poses (client)
│  └─ VFX.luau               ModuleScript: blast, explosion, charge, landing FX (client)
│
├─ ServerScriptService/AllStarServer/    (Script + child ModuleScripts, server only)
│  ├─ init.server.luau       Script: bootstrap + single validated request router
│  ├─ PlayerState.luau       authoritative per-player state
│  ├─ RateLimiter.luau       token-bucket anti-spam
│  ├─ ServerNet.luau         feedback / VFX broadcast helpers
│  ├─ FlightService.luau     flight toggle + velocity anti-exploit monitor
│  ├─ BlastService.luau      charge timing, projectile sim (Spherecast), hits
│  ├─ LandingService.luau    landing validation + shockwave
│  ├─ DamageService.luau     all damage: PvP/team rules, AoE falloff, LOS
│  ├─ CharacterOutfitter.luau  armor, emblem, curly hair, helmetless look
│  └─ TestArena.luau         dummies, cover wall, jump tower (testing only)
│
└─ StarterPlayer/StarterPlayerScripts/AllStarClient/  (LocalScript + modules)
   ├─ init.client.luau       LocalScript: bootstrap, routes all input to actions
   ├─ FlightController.luau  LinearVelocity/AlignOrientation flight
   ├─ BlastController.luau   hold-to-charge, aim, fire request
   ├─ EffectsController.luau renders FX for every player
   ├─ InputController.luau   keyboard / mouse / gamepad mapping
   └─ HUD.luau               mobile buttons, cooldowns, charge meter, crosshair

docs/
├─ INSTALL.md            Getting the project into Roblox Studio (iPhone-first)
├─ ARCHITECTURE.md       Data flow, security model, performance notes
├─ CHARACTER_SPEC.md     Character asset specification + mesh pipeline
├─ UI_DESIGN.md          HUD layouts for touch and desktop
├─ TESTING.md            Studio testing checklist
└─ reference/            The original character sheet
```

## Quick start

See **[docs/INSTALL.md](docs/INSTALL.md)**. In short:

1. Open this repo's **Actions** tab on GitHub (Safari on iPhone works). Open the latest green **Build All-Star place** run and download the **AllStar-place** artifact.
2. On a Windows PC or Mac with Roblox Studio, open `AllStar.rbxlx`.
3. Set **Game Settings → Avatar → R15**, press **Play**, and work through [`docs/TESTING.md`](docs/TESTING.md).

Roblox Studio does not run on iPhone or iPad. You can write, edit and organize everything on GitHub from your phone, but you need a computer for the Studio steps (building and playtesting).
