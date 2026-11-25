import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAdapter } from '../adapters'
import { SourceTag } from '../components/ModCard'
import { ErrorBox, Header, Icon, Notice, Page, Section, Spinner } from '../components/ui'
import { formatBytes, formatCount, getProject, getVersions, type MrFile, type MrProject, type MrVersion } from '../lib/modrinth'
import { uid, update, useStored } from '../lib/storage'

export default function ModDetail() {
  const { id = '' } = useParams()
  const [p, setP] = useState<MrProject | null>(null)
  const [versions, setVersions] = useState<MrVersion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [favs, setFavs] = useStored('favorites')
  const [settings, setSettings] = useStored('settings')
  const [gv, setGv] = useState('')
  const [loader, setLoader] = useState('')
  const [showBody, setShowBody] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [img, setImg] = useState<string | null>(null)
  const adapter = getAdapter('minecraft')!

  const loadAll = () => {
    setError(null)
    const ac = new AbortController()
    Promise.all([getProject(id, ac.signal), getVersions(id, {}, ac.signal)])
      .then(([proj, vs]) => {
        setP(proj)
        setVersions(vs)
      })
      .catch((e) => e.name !== 'AbortError' && setError((e as Error).message))
    return () => ac.abort()
  }
  useEffect(loadAll, [id])

  useEffect(() => {
    if (!p) return
    setGv((g) => g || (settings.mcVersion && p.game_versions.includes(settings.mcVersion) ? settings.mcVersion : ''))
    setLoader((l) => l || (p.loaders.includes(settings.mcLoader) ? settings.mcLoader : ''))
  }, [p, settings.mcVersion, settings.mcLoader])

  const fav = !!p && favs.some((f) => f.id === p.id)
  const toggleFav = () =>
    p &&
    setFavs((list) =>
      fav ? list.filter((f) => f.id !== p.id) : [{ id: p.id, source: 'modrinth', title: p.title, icon: p.icon_url, slug: p.slug, addedAt: Date.now() }, ...list],
    )

  const releaseVersions = useMemo(() => {
    const set = new Set<string>()
    for (const v of versions ?? []) for (const g of v.game_versions) if (/^\d+\.\d+(\.\d+)?$/.test(g)) set.add(g)
    return [...set].sort((a, b) => cmpVer(b, a))
  }, [versions])

  const matching = useMemo(
    () => (versions ?? []).filter((v) => (!gv || v.game_versions.includes(gv)) && (!loader || v.loaders.includes(loader))),
    [versions, gv, loader],
  )

  const download = async (v: MrVersion, f: MrFile) => {
    if (!p) return
    await update('downloads', (list) => [
      { id: uid(), projectId: p.id, projectTitle: p.title, versionNumber: v.version_number, filename: f.filename, url: f.url, size: f.size, sha1: f.hashes.sha1, gameVersions: v.game_versions, loaders: v.loaders, license: p.license.id, source: 'modrinth', at: Date.now() },
      ...list,
    ])
    if (gv || loader) setSettings((s) => ({ ...s, mcVersion: gv || s.mcVersion, mcLoader: loader || s.mcLoader }))
    window.open(f.url, '_blank', 'noopener')
  }

  if (error) return (<><Header title="Mod" back /><Page><ErrorBox error={error} onRetry={loadAll} /></Page></>)
  if (!p) return (<><Header title="Mod" back /><Spinner label="Loading mod…" /></>)

  const verdict = gv && loader ? (matching.length ? 'ok' : 'none') : null

  return (
    <>
      <Header
        title={p.title}
        back
        right={
          <button onClick={toggleFav} className={`grid h-11 w-11 place-items-center rounded-xl active:bg-white/5 ${fav ? 'text-rose-400' : 'text-slate-400'}`} aria-label={fav ? 'Remove from favorites' : 'Save to favorites'}>
            <Icon name="heart" fill={fav} />
          </button>
        }
      />
      <Page className="pt-3">
        <div className="flex gap-3">
          <img src={p.icon_url || '/icon-192.png'} alt="" className="h-20 w-20 shrink-0 rounded-2xl border border-white/10 bg-ink-700 object-cover" />
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold leading-tight text-white">{p.title}</h2>
            <p className="mt-1 text-[13px] leading-snug text-slate-400">{p.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SourceTag />
              <span className="badge bg-white/5 text-slate-300">{p.project_type}</span>
              <span className="badge bg-white/5 text-slate-300">{p.license.name || p.license.id}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Kpi v={formatCount(p.downloads)} l="Downloads" />
          <Kpi v={formatCount(p.followers)} l="Followers" />
          <Kpi v={new Date(p.updated).toLocaleDateString()} l="Updated" />
        </div>

        {p.gallery.length > 0 && (
          <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4">
            {p.gallery.map((g) => (
              <button key={g.url} onClick={() => setImg(g.raw_url || g.url)} className="relative aspect-video w-72 shrink-0 snap-start overflow-hidden rounded-xl bg-ink-700">
                <img src={g.url} alt={g.title ?? ''} loading="lazy" className="h-full w-full object-cover" />
                {g.title && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4 text-left text-xs text-white">{g.title}</span>}
              </button>
            ))}
          </div>
        )}

        <Section title="Compatibility check">
          <div className="card p-3">
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={gv} onChange={(e) => setGv(e.target.value)} aria-label="Game version">
                <option value="">Game version</option>
                {releaseVersions.map((v) => <option key={v}>{v}</option>)}
              </select>
              <select className="input" value={loader} onChange={(e) => setLoader(e.target.value)} aria-label="Loader">
                <option value="">Loader</option>
                {p.loaders.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="mt-3">
              {verdict === 'ok' && <Notice tone="ok"><b>Declared compatible.</b> {matching.length} file{matching.length > 1 ? 's' : ''} on Modrinth list Minecraft {gv} + {loader}. Verified against the author's version metadata, not tested in-game. Check required dependencies below.</Notice>}
              {verdict === 'none' && <Notice tone="warn"><b>Not compatible.</b> No published file declares Minecraft {gv} with {loader}.</Notice>}
              {!verdict && <p className="text-xs text-slate-500">Pick your game version and loader to verify against published files.</p>}
            </div>
          </div>
        </Section>

        <Section title={`Files${gv || loader ? ' · filtered' : ''}`} action={<span className="text-xs text-slate-500">{matching.length} versions</span>}>
          <div className="space-y-2">
            {(showAll ? matching : matching.slice(0, 5)).map((v) => (
              <VersionRow key={v.id} v={v} onDownload={download} />
            ))}
            {matching.length > 5 && !showAll && <button className="btn-ghost w-full" onClick={() => setShowAll(true)}>Show all {matching.length} versions</button>}
            {versions && matching.length === 0 && <p className="text-sm text-slate-500">No files match this filter.</p>}
          </div>
        </Section>

        <Section title="How to install">
          <ol className="card list-decimal space-y-1.5 py-3 pl-8 pr-3 text-sm text-slate-300 marker:text-neon-400">
            {adapter.install.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="mt-2 text-xs text-slate-500">On iPhone, downloaded files go to Files → Downloads. Move them to your PC/Mac (iCloud Drive, AirDrop) — Java Edition doesn't run on iOS.</p>
        </Section>

        <Section title="About">
          <div className="card p-3">
            <p className={`whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-300 ${showBody ? '' : 'line-clamp-6'}`}>{stripMd(p.body)}</p>
            <button className="mt-2 text-sm font-semibold text-neon-400" onClick={() => setShowBody(!showBody)}>{showBody ? 'Show less' : 'Read more'}</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="btn-ghost" href={`https://modrinth.com/${p.project_type}/${p.slug}`} target="_blank" rel="noreferrer"><Icon name="ext" className="h-4 w-4" />Modrinth page</a>
            {p.source_url && <a className="btn-ghost" href={p.source_url} target="_blank" rel="noreferrer"><Icon name="ext" className="h-4 w-4" />Source</a>}
            {p.license.url && <a className="btn-ghost" href={p.license.url} target="_blank" rel="noreferrer">License</a>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.categories.map((c) => <span key={c} className="badge bg-white/5 text-slate-400">{c}</span>)}
            {p.loaders.map((c) => <span key={c} className="badge bg-neon-400/10 text-neon-400">{c}</span>)}
          </div>
        </Section>

        <Link to={`/compat?add=${p.id}`} className="btn-primary mt-6 w-full"><Icon name="shield" />Add to compatibility check</Link>
      </Page>

      {img && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-2" onClick={() => setImg(null)}>
          <img src={img} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  )
}

function VersionRow({ v, onDownload }: { v: MrVersion; onDownload: (v: MrVersion, f: MrFile) => void }) {
  const f = v.files.find((x) => x.primary) ?? v.files[0]
  const req = v.dependencies.filter((d) => d.dependency_type === 'required').length
  const tone = v.version_type === 'release' ? 'bg-emerald-400/10 text-emerald-300' : v.version_type === 'beta' ? 'bg-amber-400/10 text-amber-300' : 'bg-rose-400/10 text-rose-300'
  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`badge ${tone}`}>{v.version_type}</span>
          <span className="truncate text-sm font-semibold text-white">{v.version_number}</span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-400">{v.loaders.join(', ')} · {summarizeVersions(v.game_versions)}</p>
        <p className="text-[11px] text-slate-500">{f ? `${f.filename} · ${formatBytes(f.size)}` : 'no file'}{req ? ` · ${req} required dep${req > 1 ? 's' : ''}` : ''}</p>
      </div>
      {f && (
        <button className="btn-primary h-11 w-11 shrink-0 px-0" onClick={() => onDownload(v, f)} aria-label={`Download ${f.filename}`}>
          <Icon name="download" />
        </button>
      )}
    </div>
  )
}

function Kpi({ v, l }: { v: string; l: string }) {
  return (
    <div className="card py-2.5">
      <p className="truncate px-1 text-[15px] font-bold text-white">{v}</p>
      <p className="text-[11px] text-slate-500">{l}</p>
    </div>
  )
}

function summarizeVersions(vs: string[]) {
  const rel = vs.filter((g) => /^\d+\.\d+(\.\d+)?$/.test(g)).sort(cmpVer)
  if (!rel.length) return vs.slice(0, 3).join(', ')
  return rel.length === 1 ? rel[0] : `${rel[0]} – ${rel[rel.length - 1]}`
}

export function cmpVer(a: string, b: string) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

function stripMd(s: string) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
