import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ADAPTERS, getAdapter } from '../adapters'
import { Markdown } from '../components/Markdown'
import { Header, Icon, Notice, Page } from '../components/ui'
import { AiError, askModder, health, type Health } from '../lib/api'
import { load, uid, update, useStored, type ModProject, type ProjectAsset } from '../lib/storage'
import { extractFiles, makeZip, dataUrlToBytes, saveBlob } from '../lib/zip'

const EXAMPLES = [
  'Create a superhero with black-and-white armor, flight, energy blasts and a custom sword.',
  'Add a plasma rifle that fires bouncing projectiles and a matching armor set.',
  'Make a dragon companion that follows me and breathes fire on enemies.',
  'A grappling hook tool with a rope animation and fall-damage protection.',
]

export default function Creator() {
  const { projectId } = useParams()
  return projectId ? <Chat projectId={projectId} /> : <NewMod />
}

function NewMod() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [settings] = useStored('settings')
  const [adapterId, setAdapterId] = useState(params.get('adapter') ?? '')
  const [game, setGame] = useState(params.get('game') ?? '')
  const [version, setVersion] = useState('')
  const [loader, setLoader] = useState('fabric')
  const [prompt, setPrompt] = useState('')
  const [h, setH] = useState<Health | null | undefined>()

  useEffect(() => {
    health().then(setH)
  }, [])
  useEffect(() => {
    if (!adapterId && settings.defaultAdapter) setAdapterId(settings.defaultAdapter)
    if (!version && settings.mcVersion) setVersion(settings.mcVersion)
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  const a = getAdapter(adapterId)
  const start = async () => {
    if (!prompt.trim() || !a) return
    const now = Date.now()
    const gamePrefix = game.trim() && game.trim() !== a.name ? `Game: ${game.trim()}\n\n` : ''
    const p: ModProject = {
      id: uid(),
      name: prompt.trim().replace(/\s+/g, ' ').slice(0, 48) + (prompt.trim().length > 48 ? '…' : ''),
      adapterId: a.id,
      gameVersion: a.id === 'minecraft' ? version.trim() || undefined : undefined,
      loader: a.id === 'minecraft' ? loader : undefined,
      description: prompt.trim(),
      chat: [{ role: 'user', content: gamePrefix + prompt.trim(), at: now }],
      assets: [],
      createdAt: now,
      updatedAt: now,
    }
    await update('projects', (list) => [p, ...list])
    nav(`/create/${p.id}?run=1`, { replace: true })
  }

  return (
    <>
      <Header title="AI Mod Creator" subtitle="Describe a mod in plain language" />
      <Page className="pt-3">
        {h && !h.ai.configured && (
          <div className="mb-3"><Notice tone="warn">The AI engine isn't connected yet: the server needs an <b>ANTHROPIC_API_KEY</b> secret. You can still create projects and use every other tool. See Settings → AI engine.</Notice></div>
        )}
        {h === null && (
          <div className="mb-3"><Notice tone="warn">The cloud backend is unreachable (offline or local preview). Projects are saved on this device and can be sent once you're back online.</Notice></div>
        )}

        <p className="label mb-2">1 · Target game</p>
        <div className="grid grid-cols-3 gap-2">
          {ADAPTERS.map((x) => (
            <button key={x.id} onClick={() => setAdapterId(x.id)} className={`card min-h-[64px] px-2 py-2 text-center text-[13px] font-semibold transition ${adapterId === x.id ? 'border-neon-400/60 bg-neon-400/10 text-neon-400' : 'text-slate-300'}`}>
              {x.name.replace(': Java Edition', '').replace(' games', '')}
            </button>
          ))}
        </div>
        {a && a.id !== 'roblox' && a.id !== 'minecraft' && (
          <input className="input mt-2" value={game} onChange={(e) => setGame(e.target.value)} placeholder="Which game exactly? (e.g. Valheim, Terraria)" />
        )}
        {a?.id === 'roblox' && <p className="mt-2 text-xs text-slate-500">For experiences you own or have edit permission on. Output: Luau scripts + Studio steps.</p>}
        {a?.id === 'minecraft' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input className="input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version e.g. 1.21.1" inputMode="decimal" />
            <select className="input" value={loader} onChange={(e) => setLoader(e.target.value)}>
              {['fabric', 'neoforge', 'forge', 'quilt', 'datapack', 'resourcepack'].map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        )}

        <p className="label mb-2 mt-5">2 · Describe your mod</p>
        <textarea className="input min-h-[140px] py-3 leading-relaxed" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Characters, weapons, armor, powers, abilities…" />
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          {EXAMPLES.map((e) => (
            <button key={e} className="chip-off max-w-[260px] text-left" onClick={() => setPrompt(e)}><span className="truncate">{e}</span></button>
          ))}
        </div>

        <button className="btn-primary mt-5 w-full text-base" disabled={!a || !prompt.trim() || (a.id === 'other' && !game.trim())} onClick={start}>
          <Icon name="ai" />Generate mod plan
        </button>

        <div className="card mt-5 p-3.5 text-[13px] text-slate-400">
          <p className="mb-1.5 font-semibold text-slate-200">What the AI does</p>
          <ol className="list-decimal space-y-1 pl-5 marker:text-neon-400">
            <li>Identifies the game, engine and supported mod routes</li>
            <li>Checks feasibility — and says when something isn't possible</li>
            <li>Writes a development plan and asset specs</li>
            <li>Generates code & config files you can save to the project</li>
            <li>Lists validation checks and install steps (flags PC-only steps)</li>
          </ol>
          {h?.ai && <p className="mt-2 text-xs text-slate-500">Model: {h.ai.model} · ${h.ai.pricing.inputPerMTok}/M input, ${h.ai.pricing.outputPerMTok}/M output tokens. Cost shown on every reply.</p>}
        </div>
      </Page>
    </>
  )
}

function Chat({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams()
  const [projects] = useStored('projects')
  const p = projects.find((x) => x.id === projectId)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'chat' | 'files'>('chat')
  const endRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const send = async (extra?: string) => {
    const proj = (await load('projects')).find((x) => x.id === projectId)
    if (!proj) return
    let chat = proj.chat
    if (extra) {
      chat = [...chat, { role: 'user', content: extra, at: Date.now() }]
      await patch({ chat })
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await askModder({
        adapterId: proj.adapterId,
        gameVersion: proj.gameVersion,
        loader: proj.loader,
        projectName: proj.name,
        messages: chat.map(({ role, content }) => ({ role, content })),
      })
      await patch({ chat: [...chat, { role: 'assistant', content: r.text, at: Date.now(), costUsd: r.costUsd }] })
      await update('settings', (s) => ({ ...s, aiSpendUsd: +(s.aiSpendUsd + r.costUsd).toFixed(5) }))
    } catch (e) {
      setErr(e instanceof AiError ? e.message : 'Network error — check your connection and retry.')
    } finally {
      setBusy(false)
    }
  }

  const patch = (fields: Partial<ModProject>) =>
    update('projects', (list) => list.map((x) => (x.id === projectId ? { ...x, ...fields, updatedAt: Date.now() } : x)))

  useEffect(() => {
    if (params.get('run') && p && !started.current) {
      started.current = true
      setParams({}, { replace: true })
      if (p.chat[p.chat.length - 1]?.role === 'user') send()
    }
  }, [p]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [p?.chat.length, busy])

  if (!p) return (<><Header title="Project" back /><Page><Notice tone="warn">Project not found on this device.</Notice></Page></>)

  const a = getAdapter(p.adapterId)
  const spent = p.chat.reduce((s, m) => s + (m.costUsd ?? 0), 0)
  const lastIsUser = p.chat[p.chat.length - 1]?.role === 'user'

  const saveFiles = async (text: string) => {
    const files = extractFiles(text)
    if (!files.length) return 0
    const assets: ProjectAsset[] = files.map((f) => ({ id: uid(), name: f.path, kind: /\.(json|toml|ya?ml|mcmeta)$/i.test(f.path) ? 'config' : 'script', mime: 'text/plain', data: f.content, at: Date.now() }))
    const fresh = (await load('projects')).find((x) => x.id === projectId)!
    const byName = new Map(fresh.assets.map((x) => [x.name, x]))
    for (const as of assets) byName.set(as.name, as)
    await patch({ assets: [...byName.values()] })
    return files.length
  }

  return (
    <>
      <Header title={p.name} back subtitle={`${a?.name ?? p.adapterId}${p.gameVersion ? ` · ${p.gameVersion}` : ''}${p.loader ? ` · ${p.loader}` : ''}`} />
      <div className="sticky top-[calc(56px+env(safe-area-inset-top))] z-20 border-b border-white/5 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 py-2">
          <button className={tab === 'chat' ? 'chip-on' : 'chip-off'} onClick={() => setTab('chat')}>Chat</button>
          <button className={tab === 'files' ? 'chip-on' : 'chip-off'} onClick={() => setTab('files')}>Files ({p.assets.length})</button>
          <span className="ml-auto self-center text-xs text-slate-500">AI cost ${spent.toFixed(4)}</span>
        </div>
      </div>

      {tab === 'files' ? (
        <Files project={p} onRemove={(id) => patch({ assets: p.assets.filter((x) => x.id !== id) })} />
      ) : (
        <main className="mx-auto max-w-2xl px-4 pb-[calc(150px+env(safe-area-inset-bottom))] pt-3">
          <div className="space-y-3">
            {p.chat.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                {m.role === 'user' ? (
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-neon-500 to-neon-blue px-3.5 py-2.5 text-[14.5px] text-ink-950">{m.content}</div>
                ) : (
                  <div className="card p-3.5">
                    <Markdown text={m.content} />
                    <AssistantActions text={m.content} cost={m.costUsd} onSave={saveFiles} />
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="card flex items-center gap-3 p-3.5 text-sm text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neon-400/30 border-t-neon-400" />
                Researching {a?.engine ?? 'the game'}, planning and writing code… this can take a minute.
              </div>
            )}
            {err && (
              <div className="card border-amber-400/25 p-3.5 text-sm text-amber-200">
                {err}
                {lastIsUser && <button className="btn-ghost mt-3 w-full" onClick={() => send()}>Retry</button>}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </main>
      )}

      {tab === 'chat' && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-white/5 bg-ink-950/90 backdrop-blur-xl">
          <form
            className="mx-auto flex max-w-2xl items-end gap-2 px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!input.trim() || busy) return
              const t = input.trim()
              setInput('')
              send(t)
            }}
          >
            <textarea className="input max-h-32 min-h-[44px] flex-1 resize-none py-2.5" rows={1} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Refine: add a cooldown, change colors…" />
            <button className="btn-primary h-11 w-11 shrink-0 px-0" disabled={busy || !input.trim()} aria-label="Send"><Icon name="send" /></button>
          </form>
        </div>
      )}
    </>
  )
}

function AssistantActions({ text, cost, onSave }: { text: string; cost?: number; onSave: (t: string) => Promise<number> }) {
  const n = extractFiles(text).length
  const [saved, setSaved] = useState<number | null>(null)
  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
      <span className="text-[11px] text-slate-500">{cost !== undefined ? `Cost $${cost.toFixed(4)}` : ''}</span>
      {n > 0 && (
        <button className="btn-ghost min-h-[36px] px-3 text-xs" onClick={async () => setSaved(await onSave(text))}>
          <Icon name="check" className="h-4 w-4" />{saved !== null ? `Saved ${saved} file${saved > 1 ? 's' : ''}` : `Save ${n} file${n > 1 ? 's' : ''} to project`}
        </button>
      )}
    </div>
  )
}

function Files({ project, onRemove }: { project: ModProject; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const exportZip = () => {
    const readme = `# ${project.name}\n\nGenerated with Universal Modder Mobile.\nTarget: ${getAdapter(project.adapterId)?.name}${project.gameVersion ? ` ${project.gameVersion}` : ''}${project.loader ? ` (${project.loader})` : ''}\n\n## Request\n${project.description}\n\nAI-generated files are unverified until built and tested in the game.\n`
    const plan = project.chat.filter((m) => m.role === 'assistant').map((m) => m.content).join('\n\n---\n\n')
    const blob = makeZip([
      { path: 'README.md', data: readme },
      ...(plan ? [{ path: 'PLAN.md', data: plan }] : []),
      ...project.assets.map((a) => ({ path: a.name, data: a.data.startsWith('data:') ? dataUrlToBytes(a.data) : a.data })),
    ])
    saveBlob(blob, `${project.name.replace(/[^\w-]+/g, '_').slice(0, 40) || 'mod'}.zip`)
  }
  return (
    <Page className="pt-3">
      <button className="btn-primary w-full" onClick={exportZip} disabled={!project.assets.length && !project.chat.some((m) => m.role === 'assistant')}>
        <Icon name="download" />Package project (.zip)
      </button>
      <p className="mt-2 text-xs text-slate-500">Includes README, the AI plan and every saved file, in the folder layout the AI specified. Building jars/DLLs needs a PC or the upcoming cloud build worker.</p>
      <div className="mt-4 space-y-2">
        {project.assets.length === 0 && <p className="text-sm text-slate-500">No files yet. Tap "Save files to project" under an AI reply, or create textures in the <Link className="text-neon-400" to="/assets">Asset Studio</Link>.</p>}
        {project.assets.map((f) => (
          <div key={f.id} className="card overflow-hidden">
            <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(open === f.id ? null : f.id)}>
              {f.data.startsWith('data:image') ? <img src={f.data} alt="" className="h-9 w-9 rounded bg-ink-700 object-contain [image-rendering:pixelated]" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-700 text-[10px] font-bold text-neon-400">{f.name.split('.').pop()?.toUpperCase().slice(0, 4)}</span>}
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-200">{f.name}</span>
              <span className="badge bg-white/5 text-slate-400">{f.kind}</span>
            </button>
            {open === f.id && (
              <div className="border-t border-white/5">
                {f.data.startsWith('data:image') ? <img src={f.data} alt="" className="mx-auto my-3 h-40 w-40 object-contain [image-rendering:pixelated]" /> : <pre className="no-scrollbar max-h-80 overflow-auto p-3 font-mono text-[12px] text-slate-300">{f.data}</pre>}
                <div className="flex gap-2 p-3 pt-0">
                  <button className="btn-ghost flex-1" onClick={() => saveBlob(f.data.startsWith('data:') ? new Blob([dataUrlToBytes(f.data) as BlobPart], { type: f.mime }) : new Blob([f.data], { type: 'text/plain' }), f.name.split('/').pop()!)}>Download</button>
                  <button className="btn-danger" onClick={() => onRemove(f.id)}><Icon name="trash" className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Page>
  )
}

