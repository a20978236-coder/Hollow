import type { GameAdapter } from './types'

const roblox: GameAdapter = {
  id: 'roblox',
  name: 'Roblox',
  category: 'roblox',
  tagline: 'Custom content for experiences you own, via Roblox Studio',
  engine: 'Roblox engine (Luau)',
  kbEngines: ['roblox'],
  kbGames: ['Roblox'],
  accent: '#e2231a',
  formats: ['.rbxm / .rbxmx (models)', '.rbxl / .rbxlx (places)', 'Luau scripts (.luau)', '.fbx / .obj meshes', 'PNG textures & decals'],
  loaders: [
    { name: 'Roblox Studio', url: 'https://create.roblox.com/docs/studio', notes: 'Official editor (Windows/macOS).' },
    { name: 'Rojo', url: 'https://rojo.space', notes: 'Sync Luau files from Git into Studio.' },
    { name: 'Open Cloud APIs', url: 'https://create.roblox.com/docs/cloud', notes: 'Upload assets & publish places with an API key you own.' },
  ],
  sources: [
    { id: 'roblox-creator-store', name: 'Creator Store', url: 'https://create.roblox.com/store', connected: false, note: 'Browse in Studio or the web; no public CORS API.' },
  ],
  assetRequirements: [
    'Meshes: FBX/OBJ, ≤ 20k triangles per MeshPart',
    'Textures: PNG/JPG up to 1024×1024',
    'Layered clothing / avatar items must follow the Avatar specifications',
    'Animations: authored in the Animation Editor or imported as FBX rigs (R15)',
  ],
  install: [
    'Open your experience in Roblox Studio.',
    'Insert the .rbxm model (File → Import / drag & drop) or sync scripts with Rojo.',
    'Upload meshes/textures via the Asset Manager or Open Cloud.',
    'Play-test in Studio, then publish the experience.',
  ],
  compatibilityRules: [
    'Only for experiences you own or have collaborator permission on.',
    'Scripts must run server-side (ServerScriptService) for gameplay authority.',
    'Assets must pass Roblox moderation before they load for other players.',
  ],
  capabilities: { characters: 'native', weapons: 'native', armor: 'native', powers: 'native', skins: 'native', textures: 'native', models3d: 'native', animations: 'native', maps: 'native', vehicles: 'native', gameplay: 'native', modpacks: 'none' },
  boundaries: [
    'No executors, script injection or client exploits in other people\'s experiences.',
    'No bypassing Hyperion/Byfron anti-cheat or moderation.',
  ],
  requiresDesktop: 'Roblox Studio runs on Windows/macOS only. The phone can design, generate and package; a Mac or PC (or a friend\'s) is needed to place content in Studio. Open Cloud uploads can be done from the cloud backend with your API key.',
}

const minecraft: GameAdapter = {
  id: 'minecraft',
  name: 'Minecraft: Java Edition',
  category: 'minecraft',
  tagline: 'Fabric, NeoForge, Forge, Quilt mods, resource & data packs',
  engine: 'Java (LWJGL)',
  kbEngines: ['java'],
  kbGames: ['Minecraft', 'Minecraft: Java Edition'],
  accent: '#3fbf5f',
  formats: ['.jar mods (Fabric / NeoForge / Forge / Quilt)', 'Resource packs (.zip)', 'Data packs (.zip)', 'Shader packs', '.mrpack modpacks'],
  loaders: [
    { name: 'Fabric', url: 'https://fabricmc.net', notes: 'Light loader + Fabric API; Mixin for patches.' },
    { name: 'NeoForge', url: 'https://neoforged.net', notes: 'Successor to Forge on modern versions.' },
    { name: 'Forge', url: 'https://files.minecraftforge.net', notes: 'Still used by many 1.20.1 packs.' },
    { name: 'Quilt', url: 'https://quiltmc.org' },
  ],
  sources: [
    { id: 'modrinth', name: 'Modrinth', url: 'https://modrinth.com', connected: true, note: 'Public API, live in this app.' },
    { id: 'curseforge', name: 'CurseForge', url: 'https://www.curseforge.com/minecraft', connected: false, note: 'Needs a CurseForge API key on the backend (planned).' },
  ],
  assetRequirements: [
    'Item/block textures: 16×16 PNG (or multiples for HD packs)',
    'Models: Minecraft JSON block/item models (Blockbench exports)',
    'Entities: Java model classes or GeckoLib/Blockbench animated models',
    'Sounds: .ogg + sounds.json',
  ],
  install: [
    'Install the loader for your Minecraft version (Fabric/NeoForge installer, or a launcher like Prism/Modrinth App).',
    'Put .jar files into .minecraft/mods (resource packs → resourcepacks, data packs → world/datapacks).',
    'Install every required dependency (e.g. Fabric API).',
    'Launch the matching profile.',
  ],
  compatibilityRules: [
    'Mod must declare your exact game version AND loader.',
    'All required dependencies must be present; declared incompatibilities must be absent.',
    'Server-side mods must be installed on the server as well.',
  ],
  capabilities: { characters: 'loader', weapons: 'loader', armor: 'loader', powers: 'loader', skins: 'native', textures: 'native', models3d: 'loader', animations: 'loader', maps: 'native', vehicles: 'loader', gameplay: 'loader', modpacks: 'native' },
  boundaries: ['No hacked clients for multiplayer servers you do not run.'],
  requiresDesktop: 'Java Edition runs on PC/Mac. Downloads from this app can be saved to iCloud Drive and moved to the computer. Building a code mod (.jar) needs a JDK — planned as a cloud build worker.',
  browse: { source: 'modrinth' },
}

const unity: GameAdapter = {
  id: 'unity',
  name: 'Unity games',
  category: 'unity',
  tagline: 'BepInEx / MelonLoader plugins, Harmony patches, asset bundles',
  engine: 'Unity (Mono or IL2CPP)',
  kbEngines: ['unity-mono', 'unity-il2cpp', 'unity'],
  accent: '#a1a1aa',
  formats: ['BepInEx plugins (.dll)', 'MelonLoader mods (.dll)', 'AssetBundles', 'Thunderstore packages (.zip with manifest.json)'],
  loaders: [
    { name: 'BepInEx', url: 'https://github.com/BepInEx/BepInEx', notes: '5.x for Mono, 6.x for IL2CPP.' },
    { name: 'MelonLoader', url: 'https://github.com/LavaGang/MelonLoader' },
    { name: 'Harmony', url: 'https://github.com/pardeike/Harmony', notes: 'Runtime method patching.' },
  ],
  sources: [
    { id: 'thunderstore', name: 'Thunderstore', url: 'https://thunderstore.io', connected: false, note: 'Public API; backend proxy planned (Phase 6).' },
    { id: 'nexus', name: 'Nexus Mods', url: 'https://www.nexusmods.com', connected: false, note: 'Requires your Nexus API key (planned).' },
  ],
  assetRequirements: ['Match the game\'s Unity version for AssetBundles', 'Textures: PNG/TGA; models: FBX built into bundles', 'IL2CPP games need generated interop assemblies (Cpp2IL)'],
  install: ['Install BepInEx/MelonLoader matching the game\'s architecture (x64/x86) and backend (Mono/IL2CPP).', 'Run the game once to generate folders.', 'Drop plugin .dll files into BepInEx/plugins (or Mods/).', 'Check BepInEx/LogOutput.log.'],
  compatibilityRules: ['Loader build must match Mono vs IL2CPP.', 'Plugins are game-version specific; check the mod page.', 'Online games with anti-cheat are off limits.'],
  capabilities: { characters: 'loader', weapons: 'loader', armor: 'loader', powers: 'loader', skins: 'loader', textures: 'loader', models3d: 'loader', animations: 'limited', maps: 'limited', vehicles: 'limited', gameplay: 'loader', modpacks: 'limited' },
  boundaries: ['Single-player / self-hosted only.', 'No anti-cheat or DRM bypass.'],
  requiresDesktop: 'Plugins compile with the .NET SDK and run on the PC with the game. Compilation is planned as a cloud worker; installation needs the PC.',
}

const unreal: GameAdapter = {
  id: 'unreal',
  name: 'Unreal Engine games',
  category: 'unreal',
  tagline: 'UE4SS Lua/C++ mods, .pak / IoStore overrides',
  engine: 'Unreal Engine 4/5',
  kbEngines: ['unreal'],
  accent: '#e5e7eb',
  formats: ['.pak / .utoc / .ucas (IoStore)', 'UE4SS Lua mods', 'UE4SS C++ mods (.dll)', 'Blueprint mods (LogicMods)'],
  loaders: [
    { name: 'UE4SS', url: 'https://github.com/UE4SS-RE/RE-UE4SS', notes: 'Lua scripting, live property viewer, Blueprint mod loader.' },
    { name: 'FModel', url: 'https://fmodel.app', notes: 'Browse/extract game paks (research only).' },
  ],
  sources: [{ id: 'nexus', name: 'Nexus Mods', url: 'https://www.nexusmods.com', connected: false }, { id: 'mod.io', name: 'mod.io', url: 'https://mod.io', connected: false }],
  assetRequirements: ['Cook assets with the same engine version the game uses', 'Paks may need the game\'s AES key (from the community, never cracked by us)'],
  install: ['Install UE4SS into Binaries/Win64.', 'Put Lua mods in ue4ss/Mods and enable them in mods.txt.', 'Put .pak overrides in Content/Paks/~mods.'],
  compatibilityRules: ['Engine version must match exactly for cooked assets.', 'Many UE games ship EAC — use offline modes only.'],
  capabilities: { characters: 'loader', weapons: 'loader', armor: 'loader', powers: 'loader', skins: 'loader', textures: 'loader', models3d: 'loader', animations: 'limited', maps: 'limited', vehicles: 'limited', gameplay: 'loader', modpacks: 'none' },
  boundaries: ['Stop at EasyAntiCheat / BattlEye protected online modes.', 'Never ship extracted game assets.'],
  requiresDesktop: 'Cooking assets requires the Unreal Editor on a PC. Lua mods can be written on the phone and copied over.',
}

const godot: GameAdapter = {
  id: 'godot',
  name: 'Godot games',
  category: 'godot',
  tagline: 'PCK patches, GDScript mods, Godot Mod Loader',
  engine: 'Godot 3/4',
  kbEngines: ['godot'],
  accent: '#478cbf',
  formats: ['.pck / .zip resource packs', 'GDScript (.gd)', 'Godot Mod Loader mods (.zip with manifest.json)'],
  loaders: [
    { name: 'Godot Mod Loader', url: 'https://github.com/GodotModding/godot-mod-loader' },
    { name: 'GDRE Tools', url: 'https://github.com/GDRETools/gdsdecomp', notes: 'Recover project structure from your own copy.' },
  ],
  sources: [{ id: 'thunderstore', name: 'Thunderstore', url: 'https://thunderstore.io', connected: false }],
  assetRequirements: ['Match the game\'s Godot major version (3.x vs 4.x)', 'Resources exported from a Godot editor of the same version'],
  install: ['Install the game\'s mod loader if it has one.', 'Place mod .zip files in the mods folder.', 'Or launch with --main-pack for a patched .pck.'],
  compatibilityRules: ['GDScript bytecode differs between Godot versions.', 'Encrypted PCKs need the community-published key route.'],
  capabilities: { characters: 'loader', weapons: 'loader', armor: 'loader', powers: 'loader', skins: 'loader', textures: 'loader', models3d: 'loader', animations: 'loader', maps: 'loader', vehicles: 'limited', gameplay: 'loader', modpacks: 'limited' },
  boundaries: ['Single-player only.'],
  requiresDesktop: 'Godot editor runs on PC/Mac/Linux (and Android). Scripts can be drafted here.',
}

const other: GameAdapter = {
  id: 'other',
  name: 'Other PC games',
  category: 'other',
  tagline: 'Bethesda, Source, .NET/XNA, Paradox, GameMaker and more',
  engine: 'Various',
  kbEngines: ['native', 'creation', 'source', 'xna-fna', 'dotnet', 'gamemaker', 'clausewitz', 'idtech', 'fromsoft', 're-engine', 'redengine', 'genie'],
  accent: '#8b5cf6',
  formats: ['Data packs, ESP/ESL plugins, VPK, JSON content packs', 'tModLoader / SMAPI / SKSE / REFramework mods'],
  loaders: [
    { name: 'tModLoader (Terraria)', url: 'https://github.com/tModLoader/tModLoader' },
    { name: 'SMAPI (Stardew Valley)', url: 'https://smapi.io' },
    { name: 'SKSE (Skyrim)', url: 'https://skse.silverlock.org' },
    { name: 'REFramework (RE Engine)', url: 'https://github.com/praydog/REFramework' },
  ],
  sources: [{ id: 'nexus', name: 'Nexus Mods', url: 'https://www.nexusmods.com', connected: false }, { id: 'steam-workshop', name: 'Steam Workshop', url: 'https://steamcommunity.com/workshop', connected: false }],
  assetRequirements: ['Depends on engine — the AI planner reads the matching Universal Modder playbook.'],
  install: ['Follow the community loader\'s install guide for your exact game version.'],
  compatibilityRules: ['Game version and loader version must match.', 'Anti-cheat protected online modes are off limits.'],
  capabilities: { characters: 'limited', weapons: 'limited', armor: 'limited', powers: 'limited', skins: 'limited', textures: 'limited', models3d: 'limited', animations: 'limited', maps: 'limited', vehicles: 'limited', gameplay: 'limited', modpacks: 'limited' },
  boundaries: ['No DRM tampering, no online cheating, no redistribution of game files.'],
  requiresDesktop: 'These games run on PC; the phone handles discovery, planning, asset generation and packaging.',
}

export const ADAPTERS: GameAdapter[] = [roblox, minecraft, unity, unreal, godot, other]

export function getAdapter(id: string | undefined): GameAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id)
}

/** Pick the best adapter for a knowledge-base engine string. */
export function adapterForEngine(engine: string | null | undefined): GameAdapter {
  if (!engine) return other
  return ADAPTERS.find((a) => a.kbEngines.includes(engine)) ?? other
}
