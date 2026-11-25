/**
 * Game modding adapter contract.
 *
 * Each adapter describes how a game (or a family of games sharing an engine) can be modded
 * through legitimate, authorized routes. The facts here are drawn from the engine playbooks in
 * rehan-remade/universal-modder (skills/mod-any-game/references/engines, MIT licensed).
 *
 * An adapter never claims a specific mod is compatible. Compatibility is only reported when a
 * `ModSource` returns version metadata that can be checked (see lib/compat.ts).
 */

export type Capability =
  | 'characters'
  | 'weapons'
  | 'armor'
  | 'powers'
  | 'skins'
  | 'textures'
  | 'models3d'
  | 'animations'
  | 'maps'
  | 'vehicles'
  | 'gameplay'
  | 'modpacks'

/** How well a capability is supported through the adapter's routes. */
export type SupportLevel = 'native' | 'loader' | 'limited' | 'none'

export interface ModLoader {
  name: string
  url: string
  notes?: string
}

export interface ModSourceRef {
  id: 'modrinth' | 'thunderstore' | 'nexus' | 'curseforge' | 'steam-workshop' | 'roblox-creator-store' | 'mod.io'
  name: string
  url: string
  /** true when this app can browse the source directly (public API with CORS or our proxy). */
  connected: boolean
  note?: string
}

export interface GameAdapter {
  id: string
  name: string
  category: 'roblox' | 'minecraft' | 'unity' | 'unreal' | 'godot' | 'other'
  tagline: string
  engine: string
  /** Matches `engine` values in the knowledge base so field notes can be linked. */
  kbEngines: string[]
  /** Matches `game` values in the knowledge base. Empty = engine-level adapter. */
  kbGames?: string[]
  accent: string
  formats: string[]
  loaders: ModLoader[]
  sources: ModSourceRef[]
  assetRequirements: string[]
  install: string[]
  compatibilityRules: string[]
  capabilities: Partial<Record<Capability, SupportLevel>>
  /** Hard limits: what the adapter will refuse to do. */
  boundaries: string[]
  /** What a user needs outside the phone to finish/install a mod. */
  requiresDesktop: string
  /** Default Modrinth-like browse target if a connected source exists. */
  browse?: { source: 'modrinth' }
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  characters: 'Characters',
  weapons: 'Weapons',
  armor: 'Armor',
  powers: 'Superpowers',
  skins: 'Skins',
  textures: 'Textures',
  models3d: '3D models',
  animations: 'Animations',
  maps: 'Maps',
  vehicles: 'Vehicles',
  gameplay: 'Gameplay',
  modpacks: 'Modpacks',
}
