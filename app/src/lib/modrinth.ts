/**
 * Modrinth public API v2 client (https://docs.modrinth.com/api/).
 * Called directly from the browser: Modrinth serves CORS headers and needs no key for reads.
 * All listings shown in the app come from this live API — nothing is mocked.
 */
const BASE = 'https://api.modrinth.com/v2'

export interface MrSearchHit {
  project_id: string
  slug: string
  title: string
  description: string
  author: string
  icon_url: string | null
  downloads: number
  follows: number
  categories: string[]
  display_categories?: string[]
  project_type: string
  versions: string[]
  latest_version?: string
  license: string
  gallery?: string[]
  featured_gallery?: string | null
  color?: number | null
  date_modified: string
  client_side?: string
  server_side?: string
}

export interface MrProject {
  id: string
  slug: string
  title: string
  description: string
  body: string
  icon_url: string | null
  project_type: string
  downloads: number
  followers: number
  categories: string[]
  game_versions: string[]
  loaders: string[]
  license: { id: string; name: string; url: string | null }
  source_url: string | null
  issues_url: string | null
  wiki_url: string | null
  discord_url: string | null
  client_side: string
  server_side: string
  gallery: { url: string; raw_url?: string; title: string | null; description: string | null; featured: boolean }[]
  team: string
  updated: string
  published: string
  color?: number | null
}

export interface MrFile {
  url: string
  filename: string
  primary: boolean
  size: number
  hashes: { sha1?: string; sha512?: string }
  file_type?: string | null
}

export interface MrDependency {
  version_id: string | null
  project_id: string | null
  file_name: string | null
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded'
}

export interface MrVersion {
  id: string
  project_id: string
  name: string
  version_number: string
  changelog?: string | null
  game_versions: string[]
  loaders: string[]
  version_type: 'release' | 'beta' | 'alpha'
  date_published: string
  downloads: number
  files: MrFile[]
  dependencies: MrDependency[]
}

export interface MrGameVersion {
  version: string
  version_type: 'release' | 'snapshot' | 'alpha' | 'beta'
  date: string
  major: boolean
}

export interface MrLoader {
  name: string
  supported_project_types: string[]
}

async function req<T>(path: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(BASE + path, { signal, headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`Modrinth ${r.status}: ${r.statusText}`)
  return r.json() as Promise<T>
}

export interface SearchParams {
  query?: string
  projectType?: string
  categories?: string[]
  gameVersion?: string
  loader?: string
  index?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
  offset?: number
  limit?: number
}

export function search(p: SearchParams, signal?: AbortSignal) {
  const facets: string[][] = []
  if (p.projectType) facets.push([`project_type:${p.projectType}`])
  for (const c of p.categories ?? []) facets.push([`categories:${c}`])
  if (p.gameVersion) facets.push([`versions:${p.gameVersion}`])
  if (p.loader) facets.push([`categories:${p.loader}`])
  const qs = new URLSearchParams({
    query: p.query ?? '',
    index: p.index ?? 'relevance',
    offset: String(p.offset ?? 0),
    limit: String(p.limit ?? 20),
  })
  if (facets.length) qs.set('facets', JSON.stringify(facets))
  return req<{ hits: MrSearchHit[]; total_hits: number; offset: number; limit: number }>(`/search?${qs}`, signal)
}

export const getProject = (idOrSlug: string, signal?: AbortSignal) => req<MrProject>(`/project/${encodeURIComponent(idOrSlug)}`, signal)

export function getVersions(idOrSlug: string, opts: { gameVersion?: string; loader?: string } = {}, signal?: AbortSignal) {
  const qs = new URLSearchParams()
  if (opts.gameVersion) qs.set('game_versions', JSON.stringify([opts.gameVersion]))
  if (opts.loader) qs.set('loaders', JSON.stringify([opts.loader]))
  const q = qs.toString()
  return req<MrVersion[]>(`/project/${encodeURIComponent(idOrSlug)}/version${q ? '?' + q : ''}`, signal)
}

export const getProjects = (ids: string[], signal?: AbortSignal) =>
  ids.length ? req<MrProject[]>(`/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`, signal) : Promise.resolve([])

let gvCache: Promise<MrGameVersion[]> | null = null
export function gameVersions() {
  gvCache ??= req<MrGameVersion[]>('/tag/game_version').catch((e) => {
    gvCache = null
    throw e
  })
  return gvCache
}

let loaderCache: Promise<MrLoader[]> | null = null
export function loaders() {
  loaderCache ??= req<MrLoader[]>('/tag/loader').catch((e) => {
    loaderCache = null
    throw e
  })
  return loaderCache
}

/** Marketplace category → Modrinth query mapping. Only real Modrinth facets/project types are used. */
export interface MarketCategory {
  id: string
  label: string
  icon: string
  projectType?: string
  categories?: string[]
  query?: string
}

export const MARKET_CATEGORIES: MarketCategory[] = [
  { id: 'all', label: 'All', icon: '◆' },
  { id: 'characters', label: 'Characters', icon: '☺', projectType: 'mod', categories: ['mobs'] },
  { id: 'weapons', label: 'Weapons', icon: '⚔', projectType: 'mod', categories: ['equipment'], query: 'weapons' },
  { id: 'armor', label: 'Armor', icon: '⛨', projectType: 'mod', categories: ['equipment'], query: 'armor' },
  { id: 'powers', label: 'Superpowers', icon: 'ϟ', projectType: 'mod', categories: ['magic'] },
  { id: 'skins', label: 'Skins', icon: '◐', projectType: 'resourcepack', query: 'skins' },
  { id: 'animations', label: 'Animations', icon: '↻', projectType: 'mod', query: 'animation' },
  { id: 'maps', label: 'Maps & Worlds', icon: '⌖', projectType: 'mod', categories: ['worldgen'] },
  { id: 'vehicles', label: 'Vehicles', icon: '➹', projectType: 'mod', categories: ['transportation'] },
  { id: 'textures', label: 'Textures', icon: '▦', projectType: 'resourcepack' },
  { id: 'shaders', label: 'Shaders', icon: '☀', projectType: 'shader' },
  { id: 'gameplay', label: 'Gameplay', icon: '⚙', projectType: 'mod', categories: ['game-mechanics'] },
  { id: 'modpacks', label: 'Modpacks', icon: '▣', projectType: 'modpack' },
]

export function formatCount(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

export function formatBytes(n: number) {
  if (n >= 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB'
  if (n >= 1 << 10) return (n / (1 << 10)).toFixed(0) + ' KB'
  return n + ' B'
}
