# UI design: All-Star HUD

The whole UI is built in code by `HUD.luau`, so there's no `.rbxm` to import. Style: dark translucent circles (`UiBackground` 10,12,18 at 25% transparency), a 2 px **cyan** stroke, **white** Gotham SSm Heavy labels. This matches the black / white / cyan look of the armor.

## Touch layout (phones: iPhone 12 landscape ≈ 844×390 pt)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡][…]               ┌──────────────┐                                    │
│                      │ ✦ ALL-STAR ✦ │                                    │
│                      └──────────────┘                                    │
│                                                                          │
│                                  ┼   ← crosshair (blasts go here)        │
│                          ▕████████░░░▏│ ← charge meter + "EXPLOSIVE" tick │
│                              CHARGING                          ( LAND )  │
│                                                       ( ▲ )             │
│  (thumbstick)                                                 ( BLAST )  │
│                                                       ( ▼ )   (  96px )  │
│                                                         ( FLY )         │
│                                                                 (jump)   │
└──────────────────────────────────────────────────────────────────────────┘
```

| Element | Size | Behavior |
|---|---|---|
| **BLAST** | 96 px | **Hold** to charge, release to fire. The finger can slide off without breaking the hold |
| **FLY / STOP** | 66 px | Tap to toggle. The label changes to STOP while flying |
| **LAND / DIVE** | 58 px | While flying: dive into a superhero landing |
| **▲ / ▼** | 56 px | Hold for vertical flight. **Only visible while flying** |
| Crosshair | 22 px | Exact viewport centre (its own inset-free ScreenGui) |
| Charge meter | 180×10 px | White→cyan gradient fill, tick at 60% (explosive threshold) |

- The cluster sits **above Roblox's jump button**: 150 px up on phones, 260 px on tablets (screens whose short side is over 500 px).
- `ScreenInsets = CoreUISafeInsets` keeps buttons out of the iPhone notch and home-indicator areas.
- Movement uses Roblox's own thumbstick, read through `PlayerModule:GetControls():GetMoveVector()`. Flight steers relative to the camera: drag to look, push forward to fly where you look.

## Keyboard / gamepad layout

```
                ┌──────────────────────────────────────────┐
                │ WASD + camera to steer · Space up · ...  │ ← only while flying
                └──────────────────────────────────────────┘
                     ( FLY )    ( BLAST )    ( LAND )
                       [F]    [E] / hold LMB    [G]
```

The buttons are clickable as well as bound to keys. The crosshair appears with Shift-Lock / first person, or on gamepad.

## Cooldown display

- A dark overlay (35% transparent black) covers the button while it's on cooldown.
- The countdown shows whole seconds at 1 s or more, and one decimal below that (`0.4`).
- If you press during a cooldown, or the server rejects the request, the button's stroke flashes red and fades back to cyan over 0.4 s.
- Cooldowns are predicted instantly on the client, then **overwritten by the server's authoritative value** when the `Feedback` remote arrives.

## Accessibility notes

- All touch targets are 56 px or larger (Apple's minimum is 44 pt).
- Labels are text, not icons only, and the contrast of white on near-black is over 15:1.
- Everything is driven from `Config`, so colors and keybinds can be changed in one place.
