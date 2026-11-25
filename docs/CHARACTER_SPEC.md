# Character asset specification: All-Star (Lunar Prime Armor)

Reference: [`reference/all-star-character-sheet.png`](reference/all-star-character-sheet.png)

| Field | Value |
|---|---|
| Real name | Alan Murry |
| Codename | All-Star |
| Age | 19 |
| Origin | Neon City |
| Height | 6'0" (183 cm). Use default R15 proportions with scale 1.0 (about 5.5 studs) |
| Rig | **R15** (required: poses and armor attach to R15 limb names) |
| Look | **Helmetless.** Black-and-white Lunar Prime armor, white compass-star chest emblem, dark curly hair, brown skin |

> The character sheet also shows a helmet and a shield. Per the project brief, the in-game hero is **helmetless**, and the shield isn't part of this ability set.

## Palette (`Config.Colors`)

| Token | RGB | Use |
|---|---|---|
| ArmorBlack | 14, 14, 18 | Body suit, plates (Metal material) |
| ArmorTrim | 232, 236, 244 | Stripes, collar line, belt, boot soles (SmoothPlastic) |
| ArmorSilver | 190, 196, 206 | Knee pads (Metal) |
| EmblemWhite | 255, 255, 255 | Chest star (Neon, so it glows) |
| EnergyWhite | 245, 252, 255 | Blast core, UI text |
| EnergyCyan | 70, 225, 255 | Blast shell, trails, UI strokes |
| Hair | 22, 16, 13 | Curls |
| Skin | 141, 92, 62 | Head (hands are gloved black) |

## Current in-game build (procedural, no uploads needed)

`CharacterOutfitter.luau` builds the look on the server when a character spawns:

| Limb | Pieces |
|---|---|
| UpperTorso | Chest plate, V-shaped white chest trim (2 angled bars), side stripes, high collar + collar trim, **star emblem** (16 WedgeParts: 4 long points + 4 short diagonal points) |
| LowerTorso | White belt |
| Upper arms | Shoulder pads + trim band |
| Lower arms | Gauntlets + white wrist band |
| Upper legs | Front thigh plates + outer white stripe |
| Lower legs | Silver knee pads, shin guards, white shin stripe |
| Feet | White boot soles |
| Head | ~70 dark spheres arranged on the scalp (fixed random seed, so every spawn looks the same). The face area is kept clear |
| HumanoidDescription | Black body colors (suit + gloves), skin head, hats/face accessories stripped (helmetless), optional catalog hair / clothing IDs |

Every piece is sized **relative to the limb's own `Size`**, so it adapts to different R15 body proportions.

## Upgrade path: modeled MeshParts (Blender → Roblox)

When you want the sheet's sculpted look, replace the procedural pieces with meshes. The code doesn't need to change: create the meshes, then swap `buildArmor` and `buildHair` to clone them from a folder such as `ServerStorage.AllStarAssets`.

### Budgets

| Asset | Triangles | Texture | Notes |
|---|---|---|---|
| Full armor set (all pieces) | ≤ 10,000 total | 1× 1024² color + 1× 1024² normal + roughness/metalness via SurfaceAppearance | Split per limb: one MeshPart per R15 limb |
| Chest emblem | ≤ 300 | none: separate Neon MeshPart, so it glows | Keep it as its own part |
| Curly hair | ≤ 4,000 | 512² color + normal | Export as a **rigid Accessory** (`HairAttachment`) |
| Single MeshPart limit | 20,000 tris | max 1024² per map | Roblox import limit |

### Modeling rules

- Model against the **Roblox R15 template** (Blender: *Avatar Tools / Rig importer* plugin, or export a dummy from Studio as `.fbx`).
- Use one mesh per limb named after the R15 part it hugs (`UpperTorso_Armor`, `LeftLowerArm_Armor`, …). Put the pivot at the limb's pivot, +Y up, −Z forward.
- Scale: 1 stud = 1 unit when exporting `.fbx` with *Apply Scalings: FBX All*. Check the size in Studio after import.
- Pack trim lines into the texture (white on black), or keep them as separate thin meshes if you want them Neon.
- Hair: start from the sheet's tight curls with a volume about 0.15 studs above the scalp. Leave the forehead and face clear. Hair is **not** a helmet.

### Import + hookup

1. Studio → **3D Importer** → import the `.fbx`. Set *Rig General* to off for static armor pieces.
2. Add a `SurfaceAppearance` to each MeshPart (ColorMap, NormalMap, MetalnessMap, RoughnessMap).
3. Put them in `ServerStorage/AllStarAssets/Armor/<R15 limb name>` (Folder per limb).
4. In `CharacterOutfitter.buildArmor`, for each limb: `clone`, set `Massless/CanCollide/CanQuery/CanTouch` the same way `newPiece` does, then `attach(clone, limb, CFrame.identity, folder)`.
5. Layered Clothing is an alternative for the suit (a cage-fitted jacket like the sheet). It needs inner/outer cages and `WrapLayer`. Use the Roblox Layered Clothing template and follow Roblox's *Accessory Fitting Tool* docs.

### Animation assets (optional)

Uploaded animations go in `Config.Animations` (Flight, Charge, Landing). Author them on the R15 rig in the Animation Editor, then **publish to Roblox** under the same owner (user or group) as the game. The procedural poses (`Poses.luau`) still blend on top.

## Effects spec

| Effect | Look | Built in |
|---|---|---|
| Energy blast | White neon core inside a translucent cyan shell, white→cyan trail, cyan point light. Size grows with charge | `VFX.createProjectile` |
| Charge | Orb on the right hand that grows from 0.4 to 1.8 studs, with inward-sucking sparkles and a pulsing light | `VFX.createChargeOrb` |
| Explosion (charge ≥ 60%) | White flash, cyan shell, shock ring, sparkles + smoke, camera shake | `VFX.impact` |
| Superhero landing | Two expanding rings (white + cyan), 8 radial ground cracks, dust + energy burst, camera shake, kneeling pose | `VFX.landing` + `Poses` "Landing" |
| Flight | White→cyan trails from hands and feet, forward body tilt, "Superman" arm pose | `VFX.attachFlightTrails` + `Poses` "Flight" |
