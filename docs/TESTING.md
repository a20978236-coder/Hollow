# Testing checklist

> **Status: not yet tested in Roblox Studio.** Tick these off as you go. CI only proves that the Luau lints and that Rojo builds the place. It says nothing about gameplay.

Setup: open the place (see `INSTALL.md`), **Game Settings → Avatar → R15**, keep `Config.Testing.BuildTestArena = true`, and open **View → Output**.

## 0. Boot

- [ ] Output shows `[All-Star] Server ready (v1.0.0)` with no red errors.
- [ ] `ReplicatedStorage.AllStar.Remotes` contains `Request`, `Feedback` and `Vfx` during Play.
- [ ] Test arena exists: 5 target dummies, a cover wall, and a jump tower with cyan steps.

## 1. Character appearance

- [ ] The body is a black suit with black gloves and a skin-tone head.
- [ ] No hats or helmet (**helmetless**). Dark curly hair covers the top and back of the head, and the face is visible.
- [ ] A white glowing **compass star** is centred on the chest and faces forward (not inside the torso).
- [ ] The chest plate, V-trim, collar, shoulder pads, gauntlets, thigh/knee/shin pieces and white boot soles are all attached and move with the limbs.
- [ ] Walking into walls and blast hits behave as if the armor isn't there (it doesn't collide or block).
- [ ] After respawning (reset character), the outfit is applied again with no duplicates.
- [ ] Tune if needed: emblem offset (`emblemFrame` in CharacterOutfitter), curl size/count.

## 2. Flight (keyboard)

- [ ] `F` starts flight, with a small upward pop, flight pose and trails. The FLY button changes to STOP.
- [ ] WASD flies relative to the camera. Looking up while holding W climbs.
- [ ] `Space` rises and `Ctrl`/`C` descends.
- [ ] The body tilts forward when moving fast and turns upright facing the camera heading when hovering.
- [ ] `F` again stops flight and the character falls normally.
- [ ] Pressing `F` repeatedly is limited by the 1.25 s cooldown (overlay + red flash).
- [ ] Normal flight never triggers `Flight revoked` in Output.

## 3. Flight (mobile): **Test → Device → iPhone** emulator, then a real iPhone

- [ ] The FLY / BLAST / LAND buttons don't overlap the jump button or thumbstick.
- [ ] ▲/▼ appear only while flying, and holding them climbs/descends.
- [ ] The thumbstick plus camera drag steers flight in 3D.
- [ ] Sliding a finger off ▲ while holding still stops climbing (no stuck input).
- [ ] The buttons are clear of the notch / home indicator in landscape.

## 4. Energy blasts

- [ ] Tapping `E` / LMB / BLAST fires a small white-cyan bolt toward the cursor (desktop) or crosshair (touch).
- [ ] A dummy hit loses about 12 HP. Its health bar updates.
- [ ] Holding shows the charge orb on the right hand, the arm-forward pose and the charge meter. The label changes to **EXPLOSIVE** at 60%.
- [ ] A full-charge release gives a bigger bolt and an **explosion** with flash, ring and particles. Nearby dummies take falloff damage and get knocked back.
- [ ] The dummy behind the **cover wall** takes no explosion damage.
- [ ] The 3 s charged cooldown shows on the BLAST button. A tap blast has 0.45 s.
- [ ] Holding past 6 s auto-releases.
- [ ] Blasts don't hit yourself, and flying while charging works.
- [ ] Two-player test (**Test → Clients and Servers → 2 players**): each player sees the other's projectiles, charge orb and explosions, and damage happens only on the server.

## 5. Superhero landing

- [ ] While flying high, `G` / DIVE dives fast. On ground contact: kneeling landing pose, white+cyan rings, ground cracks, dust, camera shake, and flight ends.
- [ ] Nearby dummies take shockwave damage (10–20) and get pushed.
- [ ] Jumping off the jump tower (60 studs) without flying also triggers the landing (`AutoFromFalls`).
- [ ] A short hop doesn't trigger it.
- [ ] The 4 s landing cooldown shows on the LAND button.
- [ ] Movement is locked for about 0.7 s during the pose, then restored.
- [ ] Tune `Poses.luau` → `Landing` if the kneel clips through the floor or looks wrong.

## 6. Security (use the command bar / a test LocalScript during Play)

Run these from a **client** context. Each should do nothing harmful, and the server shouldn't error:

```lua
local r = game.ReplicatedStorage.AllStar.Remotes.Request
r:FireServer("Fire", Vector3.new(0/0, 0, 0))      -- NaN → ignored
r:FireServer("Fire", Vector3.new(50, 0, 0))       -- not unit → ignored
r:FireServer("Fire", "hello")                     -- wrong type → ignored
r:FireServer("Explode", 1)                        -- unknown action → ignored
r:FireServer("ToggleFlight", "yes")               -- wrong type → ignored
for i = 1, 500 do r:FireServer("Fire", Vector3.zAxis) end -- rate limit + cooldown
r:FireServer("Land")                              -- standing still → denied, no shockwave
```

- [ ] None of the above deal damage, spawn effects, or print server errors.
- [ ] A client script that sets `LinearVelocity.VectorVelocity` to 500 while flying gets `Flight revoked` within about 0.5 s.
- [ ] Setting `character:SetAttribute("AllStarFlying", true)` from the client does **not** grant flight on the server.

## 7. Performance

- [ ] **View → Script Performance**: All-Star scripts stay low (< 1–2% each) with 5 blasts in flight.
- [ ] **Ctrl+Shift+F5 / MicroProfiler**: no spikes when explosions happen.
- [ ] Spam blasts for 30 s: the part count in `workspace.AllStarFX_Local` goes back to about 0 afterwards (no leaks).
- [ ] On a real iPhone 12: steady frame rate while flying with trails and explosions.

## 8. Edge cases

- [ ] Dying while flying or charging: after respawn you aren't flying, there's no orb, and the HUD is reset.
- [ ] A player leaving mid-charge causes no errors.
- [ ] With an R6 avatar forced, Output warns about R15 and nothing crashes.
- [ ] `Config.Access.GrantToAllPlayers = false` → abilities are denied until the server sets `player:SetAttribute("AllStarHero", true)`.
