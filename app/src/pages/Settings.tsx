import { useEffect, useState } from 'react'
import { ADAPTERS } from '../adapters'
import { Header, Notice, Page, Section } from '../components/ui'
import { health, type Health } from '../lib/api'
import { KB_REPO } from '../lib/knowledge'
import { clearAll, exportAll, useStored } from '../lib/storage'
import { saveBlob } from '../lib/zip'

export default function Settings() {
  const [settings, setSettings] = useStored('settings')
  const [h, setH] = useState<Health | null | undefined>()
  const [quota, setQuota] = useState<string>('')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)

  useEffect(() => {
    health().then(setH)
    navigator.storage?.estimate?.().then((e) => setQuota(`${((e.usage ?? 0) / 1048576).toFixed(1)} MB used of ${((e.quota ?? 0) / 1073741824).toFixed(1)} GB`))
    navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  return (
    <>
      <Header title="Settings" back right={<span />} />
      <Page className="pt-3">
        {!standalone && (
          <Notice>
            <b>Install on iPhone:</b> in Safari tap <b>Share</b> (□↑) → <b>Add to Home Screen</b>. The app then opens full-screen, works offline for browsing saved projects, and keeps your data on the device.
          </Notice>
        )}

        <Section title="Defaults">
          <div className="card space-y-3 p-3">
            <label className="block">
              <span className="label">Default game</span>
              <select className="input mt-1" value={settings.defaultAdapter} onChange={(e) => setSettings((s) => ({ ...s, defaultAdapter: e.target.value }))}>
                {ADAPTERS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Minecraft version</span>
                <input className="input mt-1" value={settings.mcVersion} placeholder="e.g. 1.21.1" onChange={(e) => setSettings((s) => ({ ...s, mcVersion: e.target.value.trim() }))} />
              </label>
              <label className="block">
                <span className="label">Loader</span>
                <select className="input mt-1" value={settings.mcLoader} onChange={(e) => setSettings((s) => ({ ...s, mcLoader: e.target.value }))}>
                  {['fabric', 'neoforge', 'forge', 'quilt'].map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
            </div>
          </div>
        </Section>

        <Section title="AI engine & costs">
          <div className="card divide-y divide-white/5 text-sm">
            <Row k="Backend" v={h === undefined ? 'Checking…' : h ? `Online (v${h.version})` : 'Unreachable'} />
            <Row k="AI model" v={h?.ai.model ?? '—'} />
            <Row k="AI key on server" v={h ? (h.ai.configured ? 'Configured' : 'Missing') : '—'} />
            <Row k="Pricing" v={h ? `$${h.ai.pricing.inputPerMTok} / $${h.ai.pricing.outputPerMTok} per M tokens` : '—'} />
            <Row k="Your AI spend (this device)" v={`$${settings.aiSpendUsd.toFixed(4)}`} />
            <Row k="Asset generation key (fal)" v={h ? (h.assets.configured ? 'Configured' : 'Missing') : '—'} />
          </div>
          {h && !h.ai.configured && (
            <div className="mt-2">
              <Notice tone="warn">
                To turn on AI from your iPhone: open <b>dash.cloudflare.com</b> in Safari → Workers &amp; Pages → <b>universal-modder-mobile</b> → Settings → Variables and Secrets → Add → type <b>Secret</b>, name <b>ANTHROPIC_API_KEY</b>, paste your key from console.anthropic.com → Deploy. The key stays on the server and is never sent to the app.
              </Notice>
            </div>
          )}
        </Section>

        <Section title="Storage">
          <div className="card divide-y divide-white/5 text-sm">
            <Row k="Used" v={quota || '—'} />
            <Row k="Protected from eviction" v={persisted === null ? '—' : persisted ? 'Yes' : 'No (install to Home Screen)'} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={async () => saveBlob(new Blob([await exportAll()], { type: 'application/json' }), `umodder-backup-${new Date().toISOString().slice(0, 10)}.json`)}>Export backup</button>
            <button className="btn-danger" onClick={async () => { if (confirm('Delete all projects, favorites and download history on this device?')) await clearAll() }}>Erase data</button>
          </div>
          {!persisted && <button className="btn-ghost mt-2 w-full" onClick={() => navigator.storage?.persist?.().then(setPersisted)}>Request persistent storage</button>}
        </Section>

        <Section title="Safety & legality">
          <Notice>Universal Modder Mobile only supports authorized modding: single-player games, servers you run, and Roblox experiences you own or may edit. It will not inject code into online games, bypass anti-cheat or DRM, or redistribute game files.</Notice>
        </Section>

        <Section title="Credits & licenses">
          <div className="card space-y-2 p-3 text-[13px] text-slate-400">
            <p>Built on ideas, engine playbooks and the field-note knowledge base of <a className="text-neon-400 underline" href={KB_REPO} target="_blank" rel="noreferrer">Universal Modder</a> by Rehan and contributors (MIT License).</p>
            <p>Mod listings, images and files are provided by <a className="text-neon-400 underline" href="https://modrinth.com" target="_blank" rel="noreferrer">Modrinth</a> and belong to their authors under each project's license.</p>
            <p>Minecraft is a trademark of Mojang/Microsoft; Roblox of Roblox Corporation. This app is not affiliated with either.</p>
          </div>
        </Section>
      </Page>
    </>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <span className="text-slate-400">{k}</span>
      <span className="text-right font-medium text-slate-200">{v}</span>
    </div>
  )
}
