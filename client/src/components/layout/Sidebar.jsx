import { useState, useCallback, useEffect } from 'react'
import { useApp } from '../../App'
import { supabase } from '../../lib/supabase'
import { api } from '../../lib/api'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const DEFAULT_NAV = [
  {
    id: 'tasks', label: 'Task',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M2 4h12M2 8h8M2 12h5"/></svg>
  },
  {
    id: 'projects', label: 'Progetti',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1"/><rect x="9" y="9" width="5.5" height="5.5" rx="1"/></svg>
  },
  {
    id: 'contacts', label: 'Contatti',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path d="M1 14a6 6 0 0 1 12 0"/></svg>
  },
  {
    id: 'ai', label: 'Nota AI',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M8 1.5a3 3 0 0 1 3 3v3a3 3 0 0 1-6 0v-3a3 3 0 0 1 3-3z"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5"/></svg>
  },
  {
    id: 'pipeline', label: 'Pipeline',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="1" y="2" width="4" height="12" rx="1"/><rect x="7" y="2" width="4" height="8" rx="1"/><rect x="13" y="2" width="2" height="5" rx="1"/></svg>
  },
  {
    id: 'vendite', label: 'Vendite',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M2 12L6 7l3 3 5-6"/><path d="M11 4h3v3"/></svg>
  },
]

const STORAGE_KEY = 'followup-nav-order'

function loadOrder() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return DEFAULT_NAV
    const ids = JSON.parse(saved)
    const map = Object.fromEntries(DEFAULT_NAV.map(n => [n.id, n]))
    const ordered = ids.map(id => map[id]).filter(Boolean)
    // add any new items not in saved order
    DEFAULT_NAV.forEach(n => { if (!ids.includes(n.id)) ordered.push(n) })
    return ordered
  } catch {
    return DEFAULT_NAV
  }
}

const roleColors = {
  admin:    'bg-purple-100 text-purple-700',
  manager:  'bg-blue-100 text-blue-700',
  agent:    'bg-brand-100 text-brand-600',
  employee: 'bg-warm-100 text-warm-600',
}

function SortableNavItem({ item, isActive, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group/nav">
      {/* drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="w-4 flex-shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/nav:opacity-100 transition-opacity touch-none"
      >
        <svg viewBox="0 0 8 14" fill="currentColor" className="w-2.5 h-3.5 text-warm-300">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
          <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
        </svg>
      </div>
      <button
        onClick={onClick}
        className={`flex-1 flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-all text-left ${
          isActive
            ? 'bg-warm-100 text-warm-900 font-500'
            : 'text-warm-500 font-400 hover:bg-warm-50 hover:text-warm-800'
        }`}
      >
        <span className={`flex-shrink-0 ${isActive ? 'text-brand-500' : 'text-warm-400'}`}>
          {item.icon}
        </span>
        {item.label}
      </button>
    </div>
  )
}

function OutlookSection() {
  const [status, setStatus] = useState(null) // null | 'connected' | 'disconnected'
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    api('/api/outlook/status')
      .then(d => setStatus(d.connected ? 'connected' : 'disconnected'))
      .catch(() => setStatus('disconnected'))
  }, [])

  async function connect() {
    setConnecting(true)
    try {
      const d = await api('/api/outlook/authorize')
      if (d.authUrl) window.location.href = d.authUrl
    } catch { setConnecting(false) }
  }

  if (status === null) return null

  return (
    <div className="px-3 py-2.5 border-t border-warm-200">
      {status === 'connected' ? (
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
          <span className="text-xs text-warm-500 font-500">Outlook connesso</span>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={connecting}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-warm-500 hover:text-blue-600 hover:bg-blue-50 transition-colors font-500 disabled:opacity-50"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 flex-shrink-0">
            <rect x="1.5" y="3.5" width="13" height="10" rx="1.5"/>
            <path d="M1.5 6.5h13"/>
            <path d="M5.5 6.5v7"/>
          </svg>
          {connecting ? 'Connessione...' : 'Connetti Outlook'}
        </button>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { profile, view, setView } = useApp()
  const [navItems, setNavItems] = useState(loadOrder)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return
    setNavItems(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id)
      const newIndex = prev.findIndex(i => i.id === over.id)
      const next = arrayMove(prev, oldIndex, newIndex)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(i => i.id)))
      return next
    })
  }, [])

  return (
    <aside className="w-56 bg-white border-r border-warm-200 flex flex-col flex-shrink-0 h-full select-none">

      {/* Logo */}
      <div className="px-4 h-14 flex items-center gap-3 border-b border-warm-200 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-700 leading-none">F</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-600 text-warm-900 leading-tight">FollowUp</div>
          <div className="text-2xs text-warm-400 leading-tight mt-0.5">Confluencia</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-none space-y-0.5">

        <p className="px-3 mb-1.5 text-2xs font-600 text-warm-400 uppercase tracking-widest">Menu</p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={navItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {navItems.map(item => (
              <SortableNavItem
                key={item.id}
                item={item}
                isActive={view === item.id}
                onClick={() => setView(item.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {profile?.role !== 'agent' && (
          <>
            <p className="px-3 pt-5 mb-1.5 text-2xs font-600 text-warm-400 uppercase tracking-widest">Team</p>
            <button
              onClick={() => setView('team')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all text-left ${
                view === 'team'
                  ? 'bg-warm-100 text-warm-900 font-500'
                  : 'text-warm-500 font-400 hover:bg-warm-50 hover:text-warm-800'
              }`}
            >
              <span className={`flex-shrink-0 ${view === 'team' ? 'text-brand-500' : 'text-warm-400'}`}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <path d="M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                  <path d="M1 14a6 6 0 0 1 12 0"/>
                  <path d="M12.5 4a2 2 0 1 1 0 4M15 14a4 4 0 0 0-3-3.87"/>
                </svg>
              </span>
              Membri
            </button>
          </>
        )}
      </nav>

      {/* Outlook */}
      <OutlookSection />

      {/* User */}
      <div className="px-3 py-3 border-t border-warm-200 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-warm-100 text-warm-600 flex items-center justify-center text-xs font-600 flex-shrink-0">
            {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-500 text-warm-900 truncate">{profile?.full_name}</div>
            <span className={`text-2xs font-500 px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${roleColors[profile?.role] || 'bg-warm-100 text-warm-600'}`}>
              {profile?.role}
            </span>
          </div>
          <button onClick={() => supabase.auth.signOut()} title="Logout"
            className="p-1.5 rounded-md text-warm-400 hover:text-warm-700 hover:bg-warm-100 transition-all flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M10.5 5.5L13 8l-2.5 2.5M13 8H6"/><path d="M6 2H3.5A1 1 0 0 0 2.5 3v10a1 1 0 0 0 1 1H6"/>
            </svg>
          </button>
        </div>
      </div>

    </aside>
  )
}
