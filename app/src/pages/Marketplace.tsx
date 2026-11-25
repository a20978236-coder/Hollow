import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ModCard, SourceTag } from '../components/ModCard'
import { Empty, ErrorBox, Header, Icon, Notice, Page, Sheet, Spinner } from '../components/ui'
import { MARKET_CATEGORIES, gameVersions, search, type MrGameVersion, type MrSearchHit } from '../lib/modrinth'
import { useStored } from '../lib/storage'

const SORTS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'follows', label: 'Popular' },
  { id: 'updated', label: 'Updated' },
  { id: 'newest', label: 'Newest' },
] as const
const LOADERS = ['', 'fabric', 'neoforge', 'forge', 'quilt']

export default function Marketplace() {
  const [params, setParams] = useSearchParams()
  const [settings] = useStored('settings')
  const [favs] = useStored('favorites')
  const cat = params.get('cat') ?? 'all'
  const sort = (params.get('sort') ?? 'relevance') as (typeof SORTS)[number]['id']
  const gv = params.get('v') ?? ''
  const loader = params.get('l') ?? ''
  const showFav = params.get('fav') === '1'
  const [q, setQ] = useState(params.get('q') ?? '')
  const [hits, setHits] = useState<MrSearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState(false)
  const [versions, setVersions] = useState<MrGameVersion[]>([])
  const reqId = useRef(0)

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k, v)
    else n.delete(k)
    setParams(n, { replace: true })
  }

  const run = useCallback(
    async (offset: number) => {
      const c = MARKET_CATEGORIES.find((x) => x.id === cat) ?? MARKET_CATEGORIES[0]
      const id = ++reqId.current
      setLoading(true)
      setError(null)
      try {
        const query = [params.get('q') ?? '', c.query ?? ''].filter(Boolean).join(' ')
        const r = await search({ query, projectType: c.projectType, categories: c.categories, gameVersion: gv || undefined, loader: loader || undefined, index: sort, offset, limit: 20 })
        if (id !== reqId.current) return
        setHits((prev) => (offset ? [...prev, ...r.hits] : r.hits))
        setTotal(r.total_hits)
      } catch (e) {
        if (id === reqId.current) setError((e as Error).message)
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    },
    [cat, sort, gv, loader, params],
  )

  useEffect(() => {
    if (!showFav) run(0)
  }, [run, showFav])

  useEffect(() => {
    gameVersions().then((v) => setVersions(v.filter((x) => x.version_type === 'release').slice(0, 40)), () => {})
  }, [])

  // Debounced search-as-you-type
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== q) setParam('q', q)
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const activeFilters = [gv, loader].filter(Boolean).length

  return (
    <>
      <Header title="Mod Marketplace" subtitle="Minecraft: Java Edition" right={<SourceTag />} />
      <Page className="pt-3">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mods, packs, shaders…" enterKeyHint="search" type="search" />
          </label>
          <button className="btn-ghost relative px-3" onClick={() => setFilters(true)} aria-label="Filters">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            {activeFilters > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-neon-400 text-[11px] font-bold text-ink-950">{activeFilters}</span>}
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <button className={showFav ? 'chip-on' : 'chip-off'} onClick={() => setParam('fav', showFav ? '' : '1')}>
            <Icon name="heart" className="h-3.5 w-3.5" fill={showFav} /> Saved
          </button>
          {MARKET_CATEGORIES.map((c) => (
            <button key={c.id} className={!showFav && cat === c.id ? 'chip-on' : 'chip-off'} onClick={() => { const n = new URLSearchParams(params); n.delete('fav'); if (c.id === 'all') n.delete('cat'); else n.set('cat', c.id); setParams(n, { replace: true }) }}>
              <span aria-hidden>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        {showFav ? (
          <div className="mt-3 space-y-2">
            {favs.length === 0 ? (
              <Empty icon="heart" title="No saved mods yet">Tap the heart on any mod to save it here.</Empty>
            ) : (
              favs.map((f) => (
                <Link key={f.id} to={`/mod/${f.slug}`} className="card flex items-center gap-3 p-3 active:scale-[.99]">
                  <img src={f.icon || '/icon-192.png'} alt="" className="h-12 w-12 rounded-xl bg-ink-700 object-cover" />
                  <span className="flex-1 font-semibold text-white">{f.title}</span>
                  <Icon name="heart" fill className="h-4 w-4 text-rose-400" />
                </Link>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{loading && !hits.length ? 'Searching…' : `${total.toLocaleString()} results`}{gv && ` · ${gv}`}{loader && ` · ${loader}`}</span>
              <select className="rounded-lg bg-transparent py-1 text-right text-xs font-semibold text-neon-400" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            {cat !== 'all' && cat !== 'textures' && cat !== 'modpacks' && cat !== 'shaders' && (
              <p className="mt-1 text-[11px] text-slate-600">Category mapped to Modrinth tags/keywords; results are Modrinth's, not hand-picked.</p>
            )}
            {error && <div className="mt-3"><ErrorBox error={`Couldn't load mods: ${error}`} onRetry={() => run(0)} /></div>}
            <div className="mt-3 space-y-3">
              {hits.map((h) => <ModCard key={h.project_id} hit={h} />)}
            </div>
            {loading && <Spinner />}
            {!loading && !error && hits.length === 0 && <Empty icon="search" title="No mods found">Try another search or remove filters.</Empty>}
            {!loading && hits.length > 0 && hits.length < total && (
              <button className="btn-ghost mt-4 w-full" onClick={() => run(hits.length)}>Load more</button>
            )}
            <div className="mt-6">
              <Notice>
                Listings are third-party content from <a className="underline" href="https://modrinth.com" target="_blank" rel="noreferrer">Modrinth</a>. Each mod keeps its own author and license, shown on its page. More sources (Thunderstore, CurseForge, Nexus) are planned via the cloud backend.
              </Notice>
            </div>
          </>
        )}
      </Page>

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filters">
        <p className="label mb-2">Game version</p>
        <select className="input" value={gv} onChange={(e) => setParam('v', e.target.value)}>
          <option value="">Any version</option>
          {settings.mcVersion && !versions.some((v) => v.version === settings.mcVersion) && <option value={settings.mcVersion}>{settings.mcVersion}</option>}
          {versions.map((v) => <option key={v.version} value={v.version}>{v.version}</option>)}
        </select>
        <p className="label mb-2 mt-4">Loader</p>
        <div className="flex flex-wrap gap-2">
          {LOADERS.map((l) => (
            <button key={l || 'any'} className={loader === l ? 'chip-on' : 'chip-off'} onClick={() => setParam('l', l)}>{l || 'Any'}</button>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => { const n = new URLSearchParams(params); n.delete('v'); n.delete('l'); setParams(n, { replace: true }) }}>Reset</button>
          <button className="btn-primary flex-1" onClick={() => setFilters(false)}>Show results</button>
        </div>
      </Sheet>
    </>
  )
}
