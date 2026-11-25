import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const paths: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  games: 'M6 9h4M8 7v4M15 10h.01M18 8h.01M7 5h10a5 5 0 0 1 5 5v3a4 4 0 0 1-7 2.5L13.5 14h-3L9 15.5A4 4 0 0 1 2 13v-3a5 5 0 0 1 5-5z',
  market: 'M4 7h16l-1.5 11a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM9 7a3 3 0 0 1 6 0',
  ai: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  back: 'M15 18l-6-6 6-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  check: 'M20 6L9 17l-5-5',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
  x: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  book: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM18 17H7a3 3 0 0 0-3 3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
}

export function Icon({ name, className = 'h-5 w-5', fill = false }: { name: keyof typeof paths | string; className?: string; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name] ?? ''} />
    </svg>
  )
}

export function Header({ title, back, right, subtitle }: { title: string; back?: boolean; right?: ReactNode; subtitle?: string }) {
  const nav = useNavigate()
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3">
        {back && (
          <button onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} className="-ml-1 grid h-11 w-11 place-items-center rounded-xl text-slate-300 active:bg-white/5" aria-label="Back">
            <Icon name="back" className="h-6 w-6" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="-mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
        {!right && (
          <Link to="/settings" className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 active:bg-white/5" aria-label="Settings">
            <Icon name="settings" />
          </Link>
        )}
      </div>
    </header>
  )
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto max-w-2xl px-4 pb-28 pt-4 ${className}`}>{children}</main>
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="label">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-neon-400/30 border-t-neon-400" />
      {label}
    </div>
  )
}

export function Empty({ icon = 'projects', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-neon-400/10 text-neon-400">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="font-semibold text-white">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-400">{children}</div>}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="card border-rose-500/20 p-4 text-sm text-rose-300">
      <p>{error}</p>
      {onRetry && (
        <button className="btn-ghost mt-3" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode }) {
  const c = tone === 'warn' ? 'border-amber-400/25 bg-amber-400/5 text-amber-200' : tone === 'ok' ? 'border-emerald-400/25 bg-emerald-400/5 text-emerald-200' : 'border-neon-400/20 bg-neon-400/5 text-cyan-100'
  return <div className={`rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed ${c}`}>{children}</div>
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="pb-safe max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink-900 px-4 pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/15" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 active:bg-white/5" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="pb-6">{children}</div>
      </div>
    </div>
  )
}
