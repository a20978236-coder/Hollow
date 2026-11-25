# Architecture, security and performance

## Request flow

```
 CLIENT (LocalScript)                         SERVER (Script)
 ───────────────────                          ───────────────
 HUD button / key / gamepad
        │
        ▼
 actions.* (init.client)  ── Request:FireServer(action, payload) ──►  router (init.server)
                                                                       1 action whitelisted?
                                                                       2 rate limit (token bucket)
                                                                       3 is hero? (Config.Access)
                                                                       4 alive character?
                                                                       5 handler validates payload
                                                                       6 pcall(handler)
                                                                              │
         ◄── Feedback:FireClient("Cooldown"/"Denied") ────────────────────────┤
         ◄── character attributes AllStarFlying / AllStarCharging (replicated)┤
         ◄── Vfx:FireAllClients("BlastFired"/"BlastEnd"/"Landing") ───────────┘
        │
        ▼
 EffectsController renders FX + poses for every player
```

## Who decides what

| Thing | Authority | Why |
|---|---|---|
| Flight on/off, cooldowns | **Server** (`PlayerState`) | the client can only *ask* |
| Flight movement | Client (it physically owns its character) | needed for responsive controls; the server **polices** it |
| Flight speed | **Server** monitor: samples `AssemblyLinearVelocity` every 0.1 s; strikes; force-stop + 6 s cooldown | stops speed exploits |
| Blast charge level | **Server** clock (`ChargeStart` → `Fire` time) | clients can't claim a full charge instantly |
| Blast origin | **Server** (its own HumanoidRootPart position) | clients can't fire from across the map |
| Blast direction | Client (validated: finite unit vector) | aiming is a client input |
| Projectile travel and hits | **Server** `workspace:Spherecast` each step | no client hit claims are accepted |
| Damage, PvP/team rules, LOS | **Server** `DamageService` only | one place to audit |
| Landing validity | **Server**: ground raycast + its own recent fall-speed samples + cooldown | clients can't spam shockwaves |
| VFX, poses, HUD | Client | cosmetic only |

## Security checklist (implemented)

- Only **3 RemoteEvents**, with a single entry point and a whitelisted action table.
- `typeof` checks on every client value. Vectors are rejected if they contain NaN or ±inf or exceed coordinate limits. Directions must be unit length (±0.05).
- A per-player **token bucket** (12/s, burst 20) drops spam before any work happens.
- Handlers run in `pcall`, so a malformed request can't break the listener.
- Character attributes are written **only by the server**. The server never reads them back as truth: its own `PlayerState` table is authoritative.
- Projectile caps are per player (6) and global (80). The charge housekeeping timer clears abandoned charges.
- Damage goes through `Humanoid:TakeDamage` (respects ForceField). There's no self-damage, and a `creator` tag records kill credit.
- Explosions check line of sight, so you can't damage through walls.
- The server only applies knockback to **server-owned** assemblies (NPCs). It can't legitimately push another player's client-owned character.

**Known limits** (normal for Roblox):

- A client that physically owns its character can still teleport or fly *when not flagged as flying*. General anti-teleport/anti-fly for non-hero movement is out of scope. Add a game-wide movement validator if you need one.
- The server speed check relies on replicated velocity. Very laggy legit players could collect strikes. Tune `SpeedTolerance` and `StrikesBeforeRevoke` if that happens.

## Performance notes

- **There are no projectile parts on the server.** Projectiles are Lua tables stepped in `PostSimulation`, and clients render them from `(origin, direction, speed, serverStartTime)`.
- One shared `PostSimulation` loop per service, plus a throttled 10 Hz velocity sampler.
- All armor, hair, emblem and VFX parts are `Massless`, `CanCollide=false`, `CanQuery=false` and `CanTouch=false`. Most have `CastShadow=false`. Armor is about 35 parts and hair about 70 small spheres per hero. For many simultaneous heroes, lower `Appearance.HairCurlCount` or switch to one MeshPart (see `CHARACTER_SPEC.md`).
- VFX use the built-in `rbxasset://` particle textures, so nothing needs to download. Every effect cleans itself up with `task.delay`, and visual projectiles are capped at 120 per client.
- Poses use one `PreSimulation` connection for all characters and only touch joints with an active pose.

## Avoided / modern APIs

`task.*` instead of `wait/spawn/delay`. `RaycastParams` / `OverlapParams` with `Enum.RaycastFilterType.Exclude` (not Blacklist). `workspace:Spherecast` and `GetPartBoundsInRadius` (not `FindPartsInRegion3`). `LinearVelocity` and `AlignOrientation` (not BodyVelocity/BodyGyro). `RunService.PreSimulation/PostSimulation/PreRender` (not Stepped/Heartbeat/RenderStepped). `Font.fromName` / `FontFace`. `CFrame.lookAlong`. `AssemblyLinearVelocity` (not `Velocity`). No `Debris`, no `Instance.new(class, parent)`.
