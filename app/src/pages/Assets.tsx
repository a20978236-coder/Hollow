import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Icon, Notice, Page, Section } from '../components/ui'
import { health, type Health } from '../lib/api'
import { uid, update, useStored } from '../lib/storage'
import { saveBlob, dataUrlToBytes } from '../lib/zip'

const PALETTE = ['#000000', '#1a1c2c', '#333c57', '#566c86', '#94b0c2', '#f4f4f4', '#ffffff', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#22d3ee', '#8b5cf6']
type Tool = 'pen' | 'erase' | 'fill' | 'pick'

export default function Assets() {
  const [size, setSize] = useState(16)
  const [px, setPx] = useState<(string | null)[]>(() => Array(16 * 16).fill(null))
  const [color, setColor] = useState('#22d3ee')
  const [tool, setTool] = useState<Tool>('pen')
  const [mirror, setMirror] = useState(false)
  const [history, setHistory] = useState<(string | null)[][]>([])
  const [name, setName] = useState('custom_sword')
  const [projectId, setProjectId] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [h, setH] = useState<Health | null>()
  const [projects] = useStored('projects')
  const grid = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    health().then(setH)
  }, [])

  const resize = (n: number) => {
    setSize(n)
    setPx(Array(n * n).fill(null))
    setHistory([])
  }

  const apply = (i: number, start: boolean) => {
    if (start) setHistory((hs) => [...hs.slice(-40), px])
    if (tool === 'pick') {
      if (px[i]) setColor(px[i]!)
      setTool('pen')
      return
    }
    if (tool === 'fill') {
      if (!start) return
      const target = px[i]
      const next = [...px]
      const stack = [i]
      const val = color
      if (target === val) return
      while (stack.length) {
        const k = stack.pop()!
        if (next[k] !== target) continue
        next[k] = val
        const x = k % size
        const y = Math.floor(k / size)
        if (x > 0) stack.push(k - 1)
        if (x < size - 1) stack.push(k + 1)
        if (y > 0) stack.push(k - size)
        if (y < size - 1) stack.push(k + size)
      }
      setPx(next)
      return
    }
    const val = tool === 'erase' ? null : color
    setPx((prev) => {
      const next = [...prev]
      next[i] = val
      if (mirror) {
        const x = i % size
        const y = Math.floor(i / size)
        next[y * size + (size - 1 - x)] = val
      }
      return next
    })
  }

  const cellAt = (clientX: number, clientY: number) => {
    const r = grid.current!.getBoundingClientRect()
    const x = Math.floor(((clientX - r.left) / r.width) * size)
    const y = Math.floor(((clientY - r.top) / r.height) * size)
    if (x < 0 || y < 0 || x >= size || y >= size) return -1
    return y * size + x
  }

  const toDataUrl = (scale = 1) => {
    const c = document.createElement('canvas')
    c.width = c.height = size * scale
    const ctx = c.getContext('2d')!
    px.forEach((v, i) => {
      if (!v) return
      ctx.fillStyle = v
      ctx.fillRect((i % size) * scale, Math.floor(i / size) * scale, scale, scale)
    })
    return c.toDataURL('image/png')
  }

  const fileName = `${name.replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'texture'}.png`
  const exportPng = () => saveBlob(new Blob([dataUrlToBytes(toDataUrl()) as BlobPart], { type: 'image/png' }), fileName)
  const saveToProject = async () => {
    const p = projects.find((x) => x.id === projectId)
    if (!p) return
    const path = p.adapterId === 'minecraft' ? `src/main/resources/assets/${slugId(p.name)}/textures/item/${fileName}` : `assets/textures/${fileName}`
    await update('projects', (list) => list.map((x) => (x.id === p.id ? { ...x, assets: [...x.assets.filter((a) => a.name !== path), { id: uid(), name: path, kind: 'texture', mime: 'image/png', data: toDataUrl(), at: Date.now() }], updatedAt: Date.now() } : x)))
    setMsg(`Saved to "${p.name}" as ${path}`)
  }

  return (
    <>
      <Header title="Asset Studio" back subtitle="Textures & sprites" />
      <Page className="pt-3">
        <Section title="AI generation (cloud)">
          <div className="card p-3.5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">Image, 3D & animation models</p>
              <span className={`badge ${h?.assets.configured ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>{h === undefined ? '…' : h?.assets.configured ? 'Key set' : 'Not connected'}</span>
            </div>
            <p className="mt-1 text-[13px] text-slate-400">Generated sprites, seamless textures, image-to-3D, rigging and SFX run on fal.ai through the backend (the same provider Universal Modder uses). This pipeline ships in Phase 7; until then, the AI Mod Creator writes ready-to-use prompts and specs for each asset.</p>
          </div>
        </Section>

        <Section title="Pixel texture editor">
          <div className="mb-2 flex gap-2">
            {[16, 32].map((n) => <button key={n} className={size === n ? 'chip-on' : 'chip-off'} onClick={() => resize(n)}>{n}×{n}</button>)}
            <button className={mirror ? 'chip-on' : 'chip-off'} onClick={() => setMirror(!mirror)}>⇋ Mirror</button>
          </div>
          <div
            ref={grid}
            className="relative mx-auto aspect-square w-full max-w-[360px] touch-none select-none overflow-hidden rounded-xl border border-white/10"
            style={{ backgroundImage: 'conic-gradient(#1a2230 25%, #111722 0 50%, #1a2230 0 75%, #111722 0)', backgroundSize: `${200 / size}% ${200 / size}%` }}
            onPointerDown={(e) => {
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
              drawing.current = true
              const i = cellAt(e.clientX, e.clientY)
              if (i >= 0) apply(i, true)
            }}
            onPointerMove={(e) => {
              if (!drawing.current || tool === 'fill' || tool === 'pick') return
              const i = cellAt(e.clientX, e.clientY)
              if (i >= 0) apply(i, false)
            }}
            onPointerUp={() => (drawing.current = false)}
            onPointerCancel={() => (drawing.current = false)}
          >
            <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
              {px.map((v, i) => <div key={i} style={{ background: v ?? 'transparent' }} className="border-[0.5px] border-white/[.04]" />)}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-2">
            {([['pen', '✎ Pen'], ['erase', '⌫ Erase'], ['fill', '◧ Fill'], ['pick', '◉ Pick']] as [Tool, string][]).map(([t, l]) => (
              <button key={t} className={`${tool === t ? 'chip-on' : 'chip-off'} justify-center`} onClick={() => setTool(t)}>{l}</button>
            ))}
            <button className="chip-off justify-center" disabled={!history.length} onClick={() => { setPx(history[history.length - 1]); setHistory((hs) => hs.slice(0, -1)) }}>↶ Undo</button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {PALETTE.map((c) => (
              <button key={c} aria-label={c} onClick={() => (setColor(c), tool !== 'fill' && setTool('pen'))} className={`h-8 w-8 rounded-lg border ${color === c ? 'border-white ring-2 ring-neon-400' : 'border-white/10'}`} style={{ background: c }} />
            ))}
            <label className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-lg border border-white/20 text-xs" style={{ background: color }}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Custom color" />+
            </label>
          </div>
        </Section>

        <Section title="Export">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="texture name" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={exportPng}><Icon name="download" className="h-4 w-4" />PNG {size}×{size}</button>
            <button className="btn-ghost" onClick={() => setPx(Array(size * size).fill(null))}>Clear</button>
          </div>
          {projects.length > 0 ? (
            <div className="mt-2 flex gap-2">
              <select className="input flex-1" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Save to project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-primary" disabled={!projectId} onClick={saveToProject}>Save</button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500"><Link to="/create" className="text-neon-400">Create a project</Link> to attach textures to a mod.</p>
          )}
          {msg && <div className="mt-2"><Notice tone="ok">{msg}</Notice></div>}
          <p className="mt-2 text-xs text-slate-500">Minecraft items/blocks use 16×16 PNGs; the path follows the Fabric/NeoForge resource layout.</p>
        </Section>
      </Page>
    </>
  )
}

function slugId(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'mymod'
}
