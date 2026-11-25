import { lazy, Suspense } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { Icon, Spinner } from './components/ui'
import Home from './pages/Home'

const Games = lazy(() => import('./pages/Games'))
const GameDetail = lazy(() => import('./pages/GameDetail'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const ModDetail = lazy(() => import('./pages/ModDetail'))
const Creator = lazy(() => import('./pages/Creator'))
const Assets = lazy(() => import('./pages/Assets'))
const Compat = lazy(() => import('./pages/Compat'))
const Downloads = lazy(() => import('./pages/Downloads'))
const Projects = lazy(() => import('./pages/Projects'))
const Settings = lazy(() => import('./pages/Settings'))
const Knowledge = lazy(() => import('./pages/Knowledge'))

const TABS = [
  { to: '/', icon: 'home', label: 'Home' },
  { to: '/games', icon: 'games', label: 'Games' },
  { to: '/market', icon: 'market', label: 'Mods' },
  { to: '/create', icon: 'ai', label: 'Create' },
  { to: '/projects', icon: 'projects', label: 'Projects' },
]

function TabBar() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-ink-950/85 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-2xl grid-cols-5">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition ${isActive ? 'text-neon-400' : 'text-slate-500 active:text-slate-300'}`}
          >
            {({ isActive }) => (
              <>
                <span className={`grid h-8 w-12 place-items-center rounded-full transition ${isActive ? 'bg-neon-400/15' : ''}`}>
                  <Icon name={t.icon} className="h-[22px] w-[22px]" />
                </span>
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner label="Loading…" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/:id" element={<GameDetail />} />
          <Route path="/market" element={<Marketplace />} />
          <Route path="/mod/:id" element={<ModDetail />} />
          <Route path="/create" element={<Creator />} />
          <Route path="/create/:projectId" element={<Creator />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/compat" element={<Compat />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      <TabBar />
    </BrowserRouter>
  )
}
