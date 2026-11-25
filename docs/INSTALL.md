# Installation: getting All-Star into Roblox Studio

## What you can do on an iPhone, and what you can't

| Task | iPhone 12 | Computer (Windows/Mac) |
|---|---|---|
| Read, edit, add, organize source files | ✅ github.com in Safari, or the GitHub app | ✅ |
| Change tuning values (`Config.luau`) | ✅ edit the file on github.com → **Commit** | ✅ |
| Build the `.rbxlx` place file | ✅ automatic: GitHub Actions builds it on every commit | ✅ |
| Download the place file | ✅ Actions → run → Artifacts | ✅ |
| **Open, playtest, publish in Roblox Studio** | ❌ Studio has no iOS version | ✅ required |
| Play the published game | ✅ Roblox app | ✅ |

None of the writing or organizing needs a computer. For the Studio steps you need one: your own, a school or library PC, or a friend's.

---

## Editing from your iPhone

1. Open the repository on github.com and switch to your branch.
2. Tap a file, then the **pencil** icon. Make your edit and tap **Commit changes**.
3. Each commit starts the **Build All-Star place** workflow. The **Actions** tab shows a ✅ or ❌:
   - ✅ means the Luau passed the linter (Selene) and Rojo built the place file.
   - ❌ means tap the run, then the failed step, to read the error, which includes file and line.

Most tuning (speeds, damage, cooldowns, colors, keybinds) is done in `src/ReplicatedStorage/AllStar/Config.luau`.

---

## Route A (recommended): download the built place file

1. On github.com go to **Actions → Build All-Star place**, open the latest ✅ run, and download **AllStar-place** under *Artifacts*. You have to be signed in to GitHub. You get a `.zip` containing `AllStar.rbxlx`.
2. Move the zip to a computer (AirDrop, iCloud Drive, email or USB) and unzip it.
3. Open `AllStar.rbxlx` in **Roblox Studio**: *File → Open from File*.
4. **Home → Game Settings → Avatar** → Avatar Type **R15**, then **Save**.
   If Studio asks you to publish first, use **File → Publish to Roblox As…**. It can stay private.
5. Press **Play** (F5). The Output window should show `[All-Star] Server ready (v1.0.0)`.
6. Work through [`TESTING.md`](TESTING.md).

To test touch controls on the computer, use **Test → Device** and pick a phone emulator such as iPhone 12/13. To test on your real iPhone, publish the place and join it from the Roblox app.

## Route B: live sync with Rojo (computer)

If you'll edit a lot on the computer, Rojo syncs files into Studio as you save.

1. Install the [Rojo](https://rojo.space/docs/v7/getting-started/installation/) CLI (v7.4+) and the Rojo Studio plugin.
2. `git clone` this repo and `cd` into it.
3. `rojo serve default.project.json`
4. In Studio, open a new Baseplate, then **Plugins → Rojo → Connect**.
5. Do step 4 of Route A (R15), then press Play.

## Route C: manual copy/paste (no tools)

Use this only if you can't use Route A or B. In Studio's Explorer, create these objects with **exactly** these names and types, then paste each file's contents in:

```
ReplicatedStorage
└─ AllStar                       (Folder)
   ├─ Config                     (ModuleScript)  ← Config.luau
   ├─ Remotes                    (ModuleScript)  ← Remotes.luau
   ├─ Validation                 (ModuleScript)  ← Validation.luau
   ├─ CooldownTracker            (ModuleScript)  ← CooldownTracker.luau
   ├─ StarShape                  (ModuleScript)  ← StarShape.luau
   ├─ Poses                      (ModuleScript)  ← Poses.luau
   └─ VFX                        (ModuleScript)  ← VFX.luau

ServerScriptService
└─ AllStarServer                 (Script)        ← init.server.luau
   ├─ PlayerState                (ModuleScript)  ← PlayerState.luau
   ├─ RateLimiter                (ModuleScript)
   ├─ ServerNet                  (ModuleScript)
   ├─ FlightService              (ModuleScript)
   ├─ BlastService               (ModuleScript)
   ├─ LandingService             (ModuleScript)
   ├─ DamageService              (ModuleScript)
   ├─ CharacterOutfitter         (ModuleScript)
   └─ TestArena                  (ModuleScript)

StarterPlayer
└─ StarterPlayerScripts
   └─ AllStarClient              (LocalScript)   ← init.client.luau
      ├─ FlightController        (ModuleScript)
      ├─ BlastController         (ModuleScript)
      ├─ EffectsController       (ModuleScript)
      ├─ InputController         (ModuleScript)
      └─ HUD                     (ModuleScript)
```

The ModuleScripts go **inside** the Script/LocalScript, because the code uses `script:WaitForChild(...)`. The `Remotes` folder is created at runtime, so don't add it yourself.

---

## Before publishing a real game

- `Config.Testing.BuildTestArena = false` removes the dummies and tower.
- Decide on `Config.Access.GrantToAllPlayers`. If it's `false`, only players your server code marks with `player:SetAttribute("AllStarHero", true)` get the kit.
- Review `Config.Combat.PvPEnabled` and `FriendlyFire`.
- Optional: upload animations and put their IDs in `Config.Animations`. Add catalog hair IDs in `Config.Appearance.HairAccessoryIds`.
