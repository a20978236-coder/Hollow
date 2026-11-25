import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ADAPTERS } from '../adapters'
import { Header, Icon, Page, Section } from '../components/ui'
import { health, type Health } from '../lib/api'
import { search, formatCount, type MrSearchHit } from '../lib/modrinth'
import { useStored } from '../lib/storage'

const ACTIONS = [
  { to: '/create', icon: 'ai', title: 'AI Mod Creator', sub: 'Describe it, get a plan + code', hero: true },
  { to: '/market', icon: 'market', title: 'Marketplace', sub: 'Browse live mods' },
  { to: '/compat', icon: 'shield', title: 'Compatibility', sub: 'Verify versions & deps' },
  { to: '/assets', icon: 'image', title: 'Asset Studio', sub: 'Textures & sprites' },
  { to: '/downloads', icon: 'download', title: 'Downloads', sub: 'Your saved files' },
  { to: '/knowledge', icon: 'book', title: 'Field Notes', sub: '395 real mod write-ups' },
]

export default function Home() {
  const [h, setH] = useState<Health | null | undefined>(undefined)
  const [trending, setTrending] = useState<MrSearchHit[] | null>(null)
  const [projects] = useStored('projects')
  const [downloads] = useStored('downloads')
  const [favs] = useStored('favorites')

  useEffect(() => {
    health().then(setH)
    const ac = new AbortController()
    search({ projectType: 'mod', index: 'follows', limit: 8 }, ac.signal).then((r) => setTrending(r.hits), () => setTrending([]))
    return () => ac.abort()
  }, [])

  return (
    <>
      <Header title="Universal Modder" subtitle="Mobile · AI game modding" />
      <Page>
        <div className="card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-neon-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-neon-blue/20 blur-3xl" />
          <p className="label text-neon-400">Mod any game</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight text-white">Build characters, weapons & powers — from your iPhone.</h2>
          <p className="mt-2 text-sm text-slate-400">Pick a game, browse real mods, and let AI plan, generate and package new ones through legitimate modding routes.</p>
          <div className="mt-4 flex gap-2">
            <Link to="/create" className="btn-primary flex-1"><Icon name="ai" />Create a mod</Link>
            <Link to="/games" className="btn-ghost">Pick game</Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat n={projects.length} label="Projects" to="/projects" />
          <Stat n={favs.length} label="Favorites" to="/market?fav=1" />
          <Stat n={downloads.length} label="Downloads" to="/downloads" />
        </div>

        <Section title="Tools">
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map((a) => (
              <Link key={a.to} to={a.to} className={`card flex min-h-[92px] flex-col justify-between p-3.5 active:scale-[.98] ${a.hero ? 'col-span-2 border-neon-400/25 bg-gradient-to-br from-neon-400/10 to-neon-blue/5' : ''}`}>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-neon-400/10 text-neon-400"><Icon name={a.icon} /></span>
                <span>
                  <span className="block font-semibold text-white">{a.title}</span>
                  <span className="block text-xs text-slate-500">{a.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>

        <Section title="System status">
          <div className="card divide-y divide-white/5 text-sm">
            <StatusRow label="Mod source: Modrinth" ok={trending === null ? undefined : trending.length > 0} okText="Online" badText="Unreachable" />
            <StatusRow label="Cloud backend" ok={h === undefined ? undefined : !!h} okText="Online" badText="Offline" />
            <StatusRow label="AI engine" ok={h === undefined ? undefined : !!h?.ai.configured} okText={h?.ai.model ?? 'Ready'} badText="Key not set" />
            <StatusRow label="Asset generation (fal)" ok={h === undefined ? undefined : !!h?.assets.configured} okText="Ready" badText="Not configured" />
          </div>
        </Section>

        <Section title="Trending Minecraft mods" action={<Link to="/market" className="text-xs font-semibold text-neon-400">See all</Link>}>
          {trending === null ? (
            <div className="flex gap-3 overflow-hidden">{[0, 1, 2].map((i) => <div key={i} className="card h-36 w-36 shrink-0 animate-pulse" />)}</div>
          ) : trending.length === 0 ? (
            <p className="text-sm text-slate-500">Couldn't reach Modrinth right now.</p>
          ) : (
            <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
              {trending.map((m) => (
                <Link key={m.project_id} to={`/mod/${m.slug}`} className="card w-36 shrink-0 snap-start p-3 active:scale-[.98]">
                  <img src={m.icon_url || '/icon-192.png'} alt="" loading="lazy" className="h-14 w-14 rounded-xl bg-ink-700 object-cover" />
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-white">{m.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{formatCount(m.downloads)} downloads</p>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Game adapters" action={<Link to="/games" className="text-xs font-semibold text-neon-400">Library</Link>}>
          <div className="space-y-2">
            {ADAPTERS.map((a) => (
              <Link key={a.id} to={`/games/${a.id}`} className="card flex items-center gap-3 p-3 active:scale-[.99]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black text-ink-950" style={{ background: a.accent }}>{a.name.slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{a.name}</span>
                  <span className="block truncate text-xs text-slate-500">{a.tagline}</span>
                </span>
                {a.sources.some((s) => s.connected) && <span className="badge bg-emerald-400/10 text-emerald-300">Live mods</span>}
              </Link>
            ))}
          </div>
        </Section>

        {projects.length > 0 && (
          <Section title="Recent projects">
            <div className="space-y-2">
              {projects.slice(0, 3).map((p) => (
                <Link key={p.id} to={`/create/${p.id}`} className="card block p-3 active:scale-[.99]">
                  <p className="font-semibold text-white">{p.name}</p>
                  <p className="text-xs text-slate-500">{ADAPTERS.find((a) => a.id === p.adapterId)?.name} · {p.chat.length} messages</p>
                </Link>
              ))}
            </div>
          </Section>
        )}
      </Page>
    </>
  )
}

function Stat({ n, label, to }: { n: number; label: string; to: string }) {
  return (
    <Link to={to} className="card py-3 active:scale-[.98]">
      <p className="text-xl font-extrabold text-white">{n}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </Link>
  )
}

function StatusRow({ label, ok, okText, badText }: { label: string; ok: boolean | undefined; okText: string; badText: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-3">
      <span className="text-slate-300">{label}</span>
      {ok === undefined ? (
        <span className="text-xs text-slate-500">Checking…</span>
      ) : (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
          <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {ok ? okText : badText}
        </span>
      )}
    </div>
  )
}
