import { get, set, createStore } from 'idb-keyval'
import { useCallback, useEffect, useState } from 'react'

/** All persistent user data lives in IndexedDB on the device (survives app restarts / PWA). */
const store = createStore('umm-db', 'kv')

export interface Favorite {
  id: string
  source: 'modrinth'
  title: string
  icon?: string | null
  slug: string
  addedAt: number
}

export interface DownloadRecord {
  id: string
  projectId: string
  projectTitle: string
  versionNumber: string
  filename: string
  url: string
  size: number
  sha1?: string
  gameVersions: string[]
  loaders: string[]
  license?: string
  source: 'modrinth' | 'local'
  at: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  at: number
  costUsd?: number
}

export interface ProjectAsset {
  id: string
  name: string
  kind: 'texture' | 'script' | 'config' | 'plan'
  mime: string
  /** data: URL or text content */
  data: string
  at: number
}

export interface ModProject {
  id: string
  name: string
  adapterId: string
  gameVersion?: string
  loader?: string
  description: string
  chat: ChatMessage[]
  assets: ProjectAsset[]
  createdAt: number
  updatedAt: number
}

export interface Settings {
  defaultAdapter: string
  mcVersion: string
  mcLoader: string
  aiSpendUsd: number
}

const DEFAULT_SETTINGS: Settings = { defaultAdapter: 'minecraft', mcVersion: '', mcLoader: 'fabric', aiSpendUsd: 0 }

type Keys = {
  favorites: Favorite[]
  downloads: DownloadRecord[]
  projects: ModProject[]
  settings: Settings
}

const DEFAULTS: Keys = { favorites: [], downloads: [], projects: [], settings: DEFAULT_SETTINGS }

const listeners = new Map<keyof Keys, Set<() => void>>()

export async function load<K extends keyof Keys>(key: K): Promise<Keys[K]> {
  const v = (await get(key, store)) as Keys[K] | undefined
  if (v === undefined) return structuredClone(DEFAULTS[key])
  if (key === 'settings') return { ...DEFAULT_SETTINGS, ...(v as Settings) } as Keys[K]
  return v
}

export async function save<K extends keyof Keys>(key: K, value: Keys[K]) {
  await set(key, value, store)
  listeners.get(key)?.forEach((fn) => fn())
}

export async function update<K extends keyof Keys>(key: K, fn: (v: Keys[K]) => Keys[K]) {
  const next = fn(await load(key))
  await save(key, next)
  return next
}

/** React hook bound to one IndexedDB key, shared across components. */
export function useStored<K extends keyof Keys>(key: K) {
  const [value, setValue] = useState<Keys[K]>(DEFAULTS[key])
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    const refresh = () => load(key).then((v) => alive && (setValue(v), setReady(true)))
    refresh()
    if (!listeners.has(key)) listeners.set(key, new Set())
    listeners.get(key)!.add(refresh)
    return () => {
      alive = false
      listeners.get(key)!.delete(refresh)
    }
  }, [key])
  const mutate = useCallback((fn: (v: Keys[K]) => Keys[K]) => update(key, fn), [key])
  return [value, mutate, ready] as const
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export async function clearAll() {
  for (const k of Object.keys(DEFAULTS) as (keyof Keys)[]) await save(k, structuredClone(DEFAULTS[k]))
}

export async function exportAll(): Promise<string> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(DEFAULTS) as (keyof Keys)[]) out[k] = await load(k)
  return JSON.stringify({ app: 'universal-modder-mobile', version: 1, exportedAt: new Date().toISOString(), data: out }, null, 2)
}
