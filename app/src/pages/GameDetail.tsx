import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adapterForEngine, getAdapter } from '../adapters'
import { CAPABILITY_LABELS, type Capability, type GameAdapter, type SupportLevel } from '../adapters/types'
import { Header, Icon, Notice, Page, Section, Spinner } from '../components/ui'
import { loadGames, loadNotes, noteUrl, type FieldNote, type KbGame } from '../lib/knowledge'

const LEVEL: Record<SupportLevel, [string, string]> = {
  native: ['Official', 'bg-emerald-400/10 text-emerald-300'],
  loader: ['Via loader', 'bg-neon-400/10 text-neon-400'],
  limited: ['Case by case', 'bg-amber-400/10 text-amber-300'],
  none: ['Not supported', 'bg-white/5 text-slate-500'],
}

export default function GameDetail() {
  const { id = '' } = useParams()
  const [kbGame, setKbGame] = useState<KbGame | null | undefined>(undefined)
  const [notes, setNotes] = useState<FieldNote[] | null>(null)
  const isKb = id.startsWith('kb-')
  let adapter: GameAdapter | undefined = isKb ? undefined : getAdapter(id)

  useEffect(() => {
    if (!isKb) {
      setKbGame(null)
      return
    }
    loadGames().then((gs) => setKbGame(gs.find((g) => g.slug === id.slice(3)) ?? null))
  }, [id, isKb])

  if (isKb && kbGame) adapter = adapterForEngine(kbGame.engine)

  useEffect(() => {
    if (!adapter && !kbGame) return
    loadNotes().then((all) =>
      setNotes(
        all
          .filter((n) => n.kind === 'game' && (kbGame ? n.game === kbGame.name : adapter!.kbGames?.length ? adapter!.kbGames.includes(n.game ?? '') : adapter!.kbEngines.includes(n.engine ?? '')))
          .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
      ),
    )
  }, [adapter?.id, kbGame])

  if (isKb && kbGame === undefined) return (<><Header title="Game" back /><Spinner /></>)
  if (!adapter) return (<><Header title="Not found" back /><Page><Notice tone="warn">Unknown game.</Notice></Page></>)

  const title = kbGame?.name ?? adapter.name
  return (
    <>
      <Header title={title} back subtitle={kbGame ? `Uses adapter: ${adapter.name}` : adapter.engine} />
      <Page className="pt-3">
        <div className="card relative overflow-hidden p-4">
          <span className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: adapter.accent }} />
          <p className="label">{kbGame ? 'Game' : 'Adapter'}</p>
          <h2 className="mt-1 text-xl font-extrabold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{kbGame ? `Engine: ${kbGame.engine ?? 'unknown'} · ${kbGame.notes} field notes (${kbGame.working} working)` : adapter.tagline}</p>
          {kbGame && kbGame.routes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {kbGame.routes.map((r) => <span key={r} className="badge bg-white/5 text-slate-300">route: {r}</span>)}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Link to={`/create?adapter=${adapter.id}${kbGame ? `&game=${encodeURIComponent(kbGame.name)}` : ''}`} className="btn-primary flex-1"><Icon name="ai" />Create mod</Link>
            {adapter.browse && <Link to="/market" className="btn-ghost flex-1"><Icon name="market" />Browse mods</Link>}
          </div>
        </div>

        <Section title="What you can make">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CAPABILITY_LABELS) as Capability[]).map((c) => {
              const lvl = adapter!.capabilities[c] ?? 'none'
              return (
                <div key={c} className="card flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm text-slate-200">{CAPABILITY_LABELS[c]}</span>
                  <span className={`badge ${LEVEL[lvl][1]}`}>{LEVEL[lvl][0]}</span>
                </div>
              )
            })}
          </div>
          {kbGame && <p className="mt-2 text-[11px] text-slate-500">Capabilities are engine-level ({adapter.name}); the specific game may restrict them. The AI planner checks per game.</p>}
        </Section>

        <Section title="Mod sources">
          <div className="space-y-2">
            {adapter.sources.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-white">{s.name}</span>
                  {s.note && <span className="block text-xs text-slate-500">{s.note}</span>}
                </span>
                <span className={`badge ${s.connected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>{s.connected ? 'Connected' : 'External link'}</span>
              </a>
            ))}
          </div>
        </Section>

        <Section title="Loaders & tools">
          <div className="card divide-y divide-white/5">
            {adapter.loaders.map((l) => (
              <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-3 active:bg-white/5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-white">{l.name}</span>
                  {l.notes && <span className="block text-xs text-slate-500">{l.notes}</span>}
                </span>
                <Icon name="ext" className="h-4 w-4 text-slate-500" />
              </a>
            ))}
          </div>
        </Section>

        <Section title="Formats">
          <div className="flex flex-wrap gap-1.5">{adapter.formats.map((f) => <span key={f} className="badge bg-ink-700 py-1 text-slate-300">{f}</span>)}</div>
        </Section>

        <Section title="Asset requirements"><List items={adapter.assetRequirements} /></Section>
        <Section title="Install method"><List items={adapter.install} ordered /></Section>
        <Section title="Compatibility rules"><List items={adapter.compatibilityRules} /></Section>

        <Section title="Boundaries">
          <Notice tone="warn">
            <ul className="list-disc space-y-1 pl-4">{adapter.boundaries.map((b) => <li key={b}>{b}</li>)}</ul>
          </Notice>
        </Section>

        <Section title="What needs a computer">
          <Notice>{adapter.requiresDesktop}</Notice>
        </Section>

        <Section title={`Field notes${notes ? ` (${notes.length})` : ''}`}>
          {!notes ? <Spinner /> : notes.length === 0 ? <p className="text-sm text-slate-500">No field notes yet for this {kbGame ? 'game' : 'adapter'}.</p> : <NoteList notes={notes.slice(0, 25)} />}
        </Section>
      </Page>
    </>
  )
}

function List({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const T = ordered ? 'ol' : 'ul'
  return <T className={`card space-y-1.5 py-3 pl-8 pr-3 text-sm text-slate-300 marker:text-neon-400 ${ordered ? 'list-decimal' : 'list-disc'}`}>{items.map((i) => <li key={i}>{i}</li>)}</T>
}

export function NoteList({ notes }: { notes: FieldNote[] }) {
  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <a key={n.path} href={noteUrl(n)} target="_blank" rel="noreferrer" className="card block p-3 active:scale-[.99]">
          <p className="text-[14px] font-semibold leading-snug text-white">{n.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
            {n.game && <span className="badge bg-white/5 text-slate-300">{n.game}</span>}
            {n.route && <span className="badge bg-neon-400/10 text-neon-400">{n.route}</span>}
            {n.status && <span className={`badge ${n.status === 'working' || n.status === 'released' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>{n.status}</span>}
            {n.date && <span className="text-slate-500">{n.date}</span>}
          </div>
        </a>
      ))}
    </div>
  )
}
