import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Empty, ErrorBox, Header, Icon, Notice, Page, Section, Sheet, Spinner } from '../components/ui'
import { checkMods, type CompatReport } from '../lib/compat'
import { gameVersions, getProjects, search, type MrGameVersion, type MrSearchHit } from '../lib/modrinth'
import { useStored } from '../lib/storage'

interface Sel {
  id: string
  title: string
  icon: string | null
}

export default function Compat() {
  const [params, setParams] = useSearchParams()
  const [settings, setSettings] = useStored('settings')
  const [favs] = useStored('favorites')
  const [sel, setSel] = useState<Sel[]>([])
  const [versions, setVersions] = useState<MrGameVersion[]>([])
  const [gv, setGv] = useState('')
  const [loader, setLoader] = useState('fabric')
  const [report, setReport] = useState<CompatReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)

  useEffect(() => {
    gameVersions().then((v) => setVersions(v.filter((x) => x.version_type === 'release')), (e) => setError((e as Error).message))
  }, [])
  useEffect(() => {
    if (settings.mcVersion) setGv((g) => g || settings.mcVersion)
    if (settings.mcLoader) setLoader(settings.mcLoader)
  }, [settings.mcVersion, settings.mcLoader])
  useEffect(() => {
    const add = params.get('add')
    if (!add) return
    getProjects([add]).then((ps) => ps[0] && setSel((s) => (s.some((x) => x.id === ps[0].id) ? s : [...s, { id: ps[0].id, title: ps[0].title, icon: ps[0].icon_url }])))
    setParams({}, { replace: true })
  }, [params, setParams])

  const run = async () => {
    if (!gv || !sel.length) return
    setBusy(true)
    setError(null)
    try {
      setReport(await checkMods(sel, gv, loader))
      setSettings((s) => ({ ...s, mcVersion: gv, mcLoader: loader }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const add = (s: Sel) => setSel((list) => (list.some((x) => x.id === s.id) ? list : [...list, s]))
  const okCount = report?.checks.filter((c) => c.status === 'compatible').length ?? 0

  return (
    <>
      <Header title="Compatibility Checker" back subtitle="Minecraft: Java Edition · Modrinth metadata" />
      <Page className="pt-3">
        <Notice>Checks the exact files each author published: game version, loader, required dependencies and declared incompatibilities. It does not launch the game, so a "compatible" result means <b>declared compatible</b>, not play-tested.</Notice>

        <Section title="Target">
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={gv} onChange={(e) => setGv(e.target.value)}>
              <option value="">Game version</option>
              {versions.map((v) => <option key={v.version}>{v.version}</option>)}
            </select>
            <select className="input" value={loader} onChange={(e) => setLoader(e.target.value)}>
              {['fabric', 'neoforge', 'forge', 'quilt'].map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </Section>

        <Section title={`Mods (${sel.length})`} action={<button className="text-xs font-semibold text-neon-400" onClick={() => setPicker(true)}>+ Add mods</button>}>
          {sel.length === 0 ? (
            <Empty icon="shield" title="Add mods to check">Search Modrinth or pick from your saved mods.</Empty>
          ) : (
            <div className="card divide-y divide-white/5">
              {sel.map((m) => {
                const c = report?.checks.find((x) => x.projectId === m.id)
                return (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                    <img src={m.icon || '/icon-192.png'} alt="" className="h-9 w-9 rounded-lg bg-ink-700 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{m.title}</p>
                      {c && <p className={`text-[11.5px] ${c.status === 'compatible' ? 'text-emerald-300' : 'text-amber-300'}`}>{c.message}</p>}
                    </div>
                    <button className="grid h-9 w-9 place-items-center text-slate-500" aria-label="Remove" onClick={() => setSel((l) => l.filter((x) => x.id !== m.id))}><Icon name="x" className="h-4 w-4" /></button>
                  </div>
                )
              })}
            </div>
          )}
          <button className="btn-primary mt-3 w-full" disabled={!gv || !sel.length || busy} onClick={run}>
            <Icon name="shield" />{busy ? 'Checking…' : 'Verify compatibility'}
          </button>
        </Section>

        {error && <div className="mt-4"><ErrorBox error={error} /></div>}

        {report && (
          <Section title="Report">
            <div className={`card p-4 ${okCount === report.checks.length && !report.issues.length ? 'border-emerald-400/30' : 'border-amber-400/30'}`}>
              <p className="text-lg font-bold text-white">{okCount}/{report.checks.length} mods declare {report.gameVersion} + {report.loader}</p>
              <p className="text-sm text-slate-400">{report.issues.length ? `${report.issues.length} dependency issue${report.issues.length > 1 ? 's' : ''} found` : 'No dependency conflicts declared'}</p>
            </div>
            {report.issues.length > 0 && (
              <div className="mt-2 space-y-2">
                {report.issues.map((i, k) => (
                  <div key={k} className={`card p-3 text-sm ${i.kind === 'incompatible' ? 'border-rose-400/30 text-rose-200' : 'border-amber-400/30 text-amber-200'}`}>
                    <p className="font-semibold">{i.kind === 'incompatible' ? 'Conflict' : 'Missing dependency'}: {i.targetTitle ?? i.target}</p>
                    <p className="text-[13px] opacity-80">{i.message}</p>
                    {i.kind === 'missing-dependency' && (
                      <div className="mt-2 flex gap-2">
                        <button className="btn-ghost min-h-[36px] text-xs" onClick={() => add({ id: i.target, title: i.targetTitle ?? i.target, icon: null })}>Add to check</button>
                        <Link className="btn-ghost min-h-[36px] text-xs" to={`/mod/${i.target}`}>View</Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-600">Checked {new Date(report.checkedAt).toLocaleString()} against api.modrinth.com.</p>
          </Section>
        )}
      </Page>

      <Picker open={picker} onClose={() => setPicker(false)} onPick={add} favs={favs.map((f) => ({ id: f.id, title: f.title, icon: f.icon ?? null }))} />
    </>
  )
}

function Picker({ open, onClose, onPick, favs }: { open: boolean; onClose: () => void; onPick: (s: Sel) => void; favs: Sel[] }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<MrSearchHit[] | null>(null)
  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    const t = setTimeout(() => {
      setHits(null)
      search({ query: q, projectType: 'mod', index: q ? 'relevance' : 'downloads', limit: 15 }, ac.signal).then((r) => setHits(r.hits), () => {})
    }, 300)
    return () => (clearTimeout(t), ac.abort())
  }, [q, open])
  return (
    <Sheet open={open} onClose={onClose} title="Add mods">
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Modrinth…" />
      {favs.length > 0 && !q && (
        <>
          <p className="label mb-2 mt-4">Saved</p>
          <div className="flex flex-wrap gap-2">{favs.map((f) => <button key={f.id} className="chip-off" onClick={() => onPick(f)}>+ {f.title}</button>)}</div>
        </>
      )}
      <div className="mt-4 space-y-1">
        {!hits ? <Spinner /> : hits.map((h) => (
          <button key={h.project_id} className="flex w-full items-center gap-3 rounded-xl p-2 text-left active:bg-white/5" onClick={() => onPick({ id: h.project_id, title: h.title, icon: h.icon_url })}>
            <img src={h.icon_url || '/icon-192.png'} alt="" className="h-10 w-10 rounded-lg bg-ink-700 object-cover" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{h.title}</span><span className="block truncate text-xs text-slate-500">{h.description}</span></span>
            <Icon name="plus" className="h-5 w-5 text-neon-400" />
          </button>
        ))}
      </div>
    </Sheet>
  )
}
