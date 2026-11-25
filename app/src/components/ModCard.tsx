import { Link } from 'react-router-dom'
import { formatCount, type MrSearchHit } from '../lib/modrinth'
import { Icon } from './ui'

export function ModCard({ hit }: { hit: MrSearchHit }) {
  const banner = hit.featured_gallery ?? hit.gallery?.[0]
  return (
    <Link to={`/mod/${hit.slug || hit.project_id}`} className="card block overflow-hidden transition active:scale-[.985]">
      {banner && (
        <div className="relative aspect-[16/7] w-full overflow-hidden bg-ink-700">
          <img src={banner} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-800 via-ink-800/10 to-transparent" />
        </div>
      )}
      <div className={`flex gap-3 p-3 ${banner ? '-mt-8 relative' : ''}`}>
        <img
          src={hit.icon_url || '/icon-192.png'}
          alt=""
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-xl border border-white/10 bg-ink-700 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{hit.title}</p>
          <p className="truncate text-xs text-slate-500">by {hit.author} · {hit.project_type}</p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-300">{hit.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-400">
            <span className="inline-flex items-center gap-1"><Icon name="download" className="h-3.5 w-3.5" />{formatCount(hit.downloads)}</span>
            <span className="inline-flex items-center gap-1"><Icon name="heart" className="h-3.5 w-3.5" />{formatCount(hit.follows)}</span>
            {hit.latest_version && <span>MC {hit.latest_version}</span>}
            <span className="badge bg-white/5 text-slate-400">{hit.license}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function SourceTag() {
  return (
    <span className="badge border border-emerald-400/20 bg-emerald-400/10 text-emerald-300" title="Live data from the public Modrinth API">
      Live · Modrinth
    </span>
  )
}
