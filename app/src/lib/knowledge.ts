/**
 * Field-note index from rehan-remade/universal-modder (knowledge/index.json, MIT).
 * Each entry links to the full note on GitHub. Loaded lazily to keep first paint fast.
 */
export interface FieldNote {
  path: string
  kind: string
  title: string
  game: string | null
  engine: string | null
  route: string | null
  status: string | null
  date: string | null
  anti_cheat: string | null
  platform: string | null
  tags: string[]
}

export const KB_REPO = 'https://github.com/rehan-remade/universal-modder'
export const noteUrl = (n: FieldNote) => `${KB_REPO}/blob/main/knowledge/${n.path}`

let cache: Promise<FieldNote[]> | null = null
export function loadNotes() {
  cache ??= import('../data/knowledge.json').then((m) => m.default as FieldNote[])
  return cache
}

export interface KbGame {
  name: string
  slug: string
  engine: string | null
  notes: number
  working: number
  routes: string[]
}

export async function loadGames(): Promise<KbGame[]> {
  const notes = await loadNotes()
  const map = new Map<string, KbGame>()
  for (const n of notes) {
    if (n.kind !== 'game' || !n.game) continue
    const g = map.get(n.game) ?? { name: n.game, slug: slugify(n.game), engine: null, notes: 0, working: 0, routes: [] }
    g.notes++
    if (n.status === 'working' || n.status === 'released') g.working++
    if (n.engine && n.engine !== 'unknown' && !g.engine) g.engine = n.engine
    if (n.route && !g.routes.includes(n.route)) g.routes.push(n.route)
    map.set(n.game, g)
  }
  return [...map.values()].sort((a, b) => b.notes - a.notes || a.name.localeCompare(b.name))
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function searchNotes(notes: FieldNote[], q: string) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return notes
  return notes
    .map((n) => {
      const hay = [n.title, n.game, n.engine, n.route, ...n.tags].join(' ').toLowerCase()
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0)
      return { n, score }
    })
    .filter((x) => x.score === terms.length)
    .map((x) => x.n)
}
