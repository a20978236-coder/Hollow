import { Fragment, useState, type ReactNode } from 'react'

/**
 * Small, safe markdown renderer for AI replies (no innerHTML). Supports headings, lists,
 * fenced code with copy, inline code, bold and links.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(/^```(\S*)/)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++])
      i++
      blocks.push(<Code key={key++} lang={fence[1]} code={body.join('\n')} />)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)/)
    if (h) {
      const size = h[1].length <= 2 ? 'text-base' : 'text-[15px]'
      blocks.push(
        <p key={key++} className={`mt-3 font-bold text-white ${size}`}>
          {inline(h[2])}
        </p>,
      )
      i++
      continue
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = []
      const ordered = /^\s*\d+\./.test(line)
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''))
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={key++} className={`my-1.5 space-y-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-neon-400/70`}>
          {items.map((t, j) => (
            <li key={j}>{inline(t)}</li>
          ))}
        </Tag>,
      )
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    blocks.push(
      <p key={key++} className="my-1.5">
        {inline(line)}
      </p>,
    )
    i++
  }
  return <div className="text-[14.5px] leading-relaxed text-slate-200">{blocks}</div>
}

function inline(s: string): ReactNode {
  const parts = s.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="rounded bg-ink-700 px-1 py-0.5 font-mono text-[12.5px] text-cyan-200">{p.slice(1, -1)}</code>
    if (p.startsWith('**')) return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>
    const l = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (l && /^https?:\/\//.test(l[2])) return <a key={i} href={l[2]} target="_blank" rel="noreferrer" className="text-neon-400 underline">{l[1]}</a>
    return <Fragment key={i}>{p}</Fragment>
  })
}

function Code({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-ink-950">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5 text-[11px] text-slate-500">
        <span>{lang || 'code'}</span>
        <button
          className="rounded px-2 py-1 text-neon-400 active:bg-white/5"
          onClick={() => navigator.clipboard?.writeText(code).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1200)))}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="no-scrollbar overflow-x-auto p-3 font-mono text-[12px] leading-snug text-slate-200">{code}</pre>
    </div>
  )
}
