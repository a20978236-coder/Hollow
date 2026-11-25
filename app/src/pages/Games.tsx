import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ADAPTERS, adapterForEngine } from '../adapters'
import { Header, Icon, Page, Section, Spinner } from '../components/ui'
import { loadGames, type KbGame } from '../lib/knowledge'

export default function Games() {
  const [games, setGames] = useState<KbGame[] | null>(null)
  const [q, setQ] = useState('')
  const [engine, setEngine] = useState('all')
  useEffect(() => {
    loadGames().then(setGames)
  }, [])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (games ?? []).filter((g) => (!t || g.name.toLowerCase().includes(t)) && (engine === 'all' || adapterForEngine(g.engine).id === engine))
  }, [games, q, engine])

  return (
    <>
      <Header title="Game Library" subtitle="Adapters + games with real mod field notes" />
      <Page className="pt-3">
        <label className="relative block">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 160+ games…" />
        </label>

        {!q && (
          <Section title="Platforms & engines">
            <div className="grid grid-cols-2 gap-2">
              {ADAPTERS.map((a) => (
                <Link key={a.id} to={`/games/${a.id}`} className="card relative overflow-hidden p-3 active:scale-[.98]">
                  <span className="absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-25 blur-xl" style={{ background: a.accent }} />
                  <span className="grid h-9 w-9 place-items-center rounded-lg text-xs font-black text-ink-950" style={{ background: a.accent }}>{a.name.slice(0, 2)}</span>
                  <p className="mt-2 font-semibold leading-tight text-white">{a.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] text-slate-500">{a.tagline}</p>
                </Link>
              ))}
            </div>
          </Section>
        )}

        <Section title="Games with field notes">
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {[{ id: 'all', name: 'All' }, ...ADAPTERS.filter((a) => a.id !== 'roblox')].map((a) => (
              <button key={a.id} className={engine === a.id ? 'chip-on' : 'chip-off'} onClick={() => setEngine(a.id)}>{a.id === 'all' ? 'All' : a.name.replace(' games', '').replace(': Java Edition', '')}</button>
            ))}
          </div>
          {!games ? (
            <Spinner />
          ) : (
            <div className="card divide-y divide-white/5">
              {filtered.map((g) => {
                const a = adapterForEngine(g.engine)
                return (
                  <Link key={g.slug} to={`/games/kb-${g.slug}`} className="flex items-center gap-3 px-3 py-3 active:bg-white/5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-700 text-xs font-bold text-slate-300">{g.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-white">{g.name}</span>
                      <span className="block truncate text-xs text-slate-500">{g.engine && g.engine !== 'unknown' ? g.engine : 'engine n/a'} · {a.name}</span>
                    </span>
                    <span className="text-right text-[11px] text-slate-500">
                      <span className="block font-semibold text-neon-400">{g.notes}</span>notes
                    </span>
                  </Link>
                )
              })}
              {filtered.length === 0 && <p className="p-4 text-sm text-slate-500">No games match.</p>}
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-600">Field notes come from the Universal Modder knowledge base (MIT): real write-ups by AI agents of how each game was modded.</p>
        </Section>
      </Page>
    </>
  )
}
