import { useEffect, useMemo, useState } from 'react'
import { Header, Icon, Notice, Page, Spinner } from '../components/ui'
import { KB_REPO, loadNotes, searchNotes, type FieldNote } from '../lib/knowledge'
import { NoteList } from './GameDetail'

const ROUTES = ['all', 'data', 'loader-api', 'asset-only', 'managed-patch', 'native-hook', 'passthrough']

export default function Knowledge() {
  const [notes, setNotes] = useState<FieldNote[] | null>(null)
  const [q, setQ] = useState('')
  const [route, setRoute] = useState('all')
  const [limit, setLimit] = useState(30)
  useEffect(() => {
    loadNotes().then(setNotes)
  }, [])
  const list = useMemo(() => {
    const base = searchNotes(notes ?? [], q).filter((n) => route === 'all' || n.route === route)
    return base.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [notes, q, route])

  return (
    <>
      <Header title="Field Notes" back subtitle="Universal Modder knowledge base" />
      <Page className="pt-3">
        <label className="relative block">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" type="search" value={q} onChange={(e) => (setQ(e.target.value), setLimit(30))} placeholder="Search: terraria boss, unity il2cpp, minecraft…" />
        </label>
        <div className="no-scrollbar -mx-4 my-3 flex gap-2 overflow-x-auto px-4">
          {ROUTES.map((r) => <button key={r} className={route === r ? 'chip-on' : 'chip-off'} onClick={() => setRoute(r)}>{r}</button>)}
        </div>
        {!notes ? <Spinner /> : (
          <>
            <p className="mb-2 text-xs text-slate-500">{list.length} notes</p>
            <NoteList notes={list.slice(0, limit)} />
            {list.length > limit && <button className="btn-ghost mt-3 w-full" onClick={() => setLimit(limit + 30)}>Show more</button>}
          </>
        )}
        <div className="mt-6">
          <Notice>Notes are written by AI agents after real modding sessions and published in <a className="underline" href={KB_REPO} target="_blank" rel="noreferrer">rehan-remade/universal-modder</a> under the MIT license. Tapping a note opens the full write-up on GitHub.</Notice>
        </div>
      </Page>
    </>
  )
}
