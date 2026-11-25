import { Link } from 'react-router-dom'
import { Empty, Header, Icon, Notice, Page } from '../components/ui'
import { formatBytes } from '../lib/modrinth'
import { useStored } from '../lib/storage'

export default function Downloads() {
  const [downloads, setDownloads] = useStored('downloads')
  return (
    <>
      <Header title="Downloads" back subtitle={`${downloads.length} files`} />
      <Page className="pt-3">
        <Notice>Files download straight from the mod host (Modrinth CDN) to your iPhone's Files app → Downloads. This list keeps the version, loader, license and SHA-1 so you can re-download or verify later.</Notice>
        <div className="mt-4 space-y-2">
          {downloads.length === 0 && <Empty icon="download" title="Nothing downloaded yet"><Link to="/market" className="text-neon-400">Browse mods</Link> and tap the download button on a file.</Empty>}
          {downloads.map((d) => (
            <div key={d.id} className="card p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/mod/${d.projectId}`} className="font-semibold text-white">{d.projectTitle}</Link>
                  <p className="truncate font-mono text-[12px] text-slate-400">{d.filename}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    v{d.versionNumber} · {d.loaders.join(', ')} · {formatBytes(d.size)} · {d.license ?? 'license n/a'}
                  </p>
                  <p className="text-[11px] text-slate-600">{new Date(d.at).toLocaleString()}</p>
                  {d.sha1 && <p className="truncate font-mono text-[10px] text-slate-600">sha1 {d.sha1}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <a href={d.url} target="_blank" rel="noreferrer" className="btn-primary h-10 w-10 px-0" aria-label="Download again"><Icon name="download" className="h-4 w-4" /></a>
                  <button className="btn-ghost h-10 w-10 px-0" aria-label="Remove from list" onClick={() => setDownloads((l) => l.filter((x) => x.id !== d.id))}><Icon name="trash" className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {downloads.length > 1 && (
          <button className="btn-danger mt-4 w-full" onClick={() => confirm('Clear the download history? Files already on your device stay.') && setDownloads(() => [])}>Clear history</button>
        )}
      </Page>
    </>
  )
}
