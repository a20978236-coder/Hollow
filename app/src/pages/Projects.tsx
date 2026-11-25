import { Link } from 'react-router-dom'
import { getAdapter } from '../adapters'
import { Empty, Header, Icon, Page } from '../components/ui'
import { useStored } from '../lib/storage'

export default function Projects() {
  const [projects, setProjects] = useStored('projects')
  return (
    <>
      <Header title="My Projects" subtitle="Saved on this device" right={<Link to="/create" className="btn-primary min-h-[36px] px-3 text-xs"><Icon name="plus" className="h-4 w-4" />New</Link>} />
      <Page className="pt-3">
        {projects.length === 0 ? (
          <Empty icon="projects" title="No projects yet">
            Describe a mod in the <Link to="/create" className="text-neon-400">AI Mod Creator</Link> to start one.
          </Empty>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => {
              const a = getAdapter(p.adapterId)
              const cost = p.chat.reduce((s, m) => s + (m.costUsd ?? 0), 0)
              return (
                <div key={p.id} className="card flex items-stretch overflow-hidden">
                  <Link to={`/create/${p.id}`} className="min-w-0 flex-1 p-3 active:bg-white/5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a?.accent ?? '#888' }} />
                      <p className="truncate font-semibold text-white">{p.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {a?.name ?? p.adapterId}{p.gameVersion ? ` ${p.gameVersion}` : ''} · {p.chat.length} msgs · {p.assets.length} files · ${cost.toFixed(3)}
                    </p>
                    <p className="text-[11px] text-slate-600">Updated {new Date(p.updatedAt).toLocaleString()}</p>
                  </Link>
                  <button
                    className="grid w-12 place-items-center border-l border-white/5 text-slate-500 active:bg-rose-500/10 active:text-rose-300"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => confirm(`Delete "${p.name}"? This can't be undone.`) && setProjects((l) => l.filter((x) => x.id !== p.id))}
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Page>
    </>
  )
}
