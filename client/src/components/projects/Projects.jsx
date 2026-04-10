import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import { useApp } from '../../App'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const STAGES = [
  {
    key: 'idea',
    label: 'Idea',
    color: 'text-slate-600',
    dot: 'bg-slate-400',
    bg: 'bg-slate-50',
    headerBg: 'bg-slate-100',
    border: 'border-slate-200',
    cardBorder: 'border-l-slate-400',
    badge: 'bg-slate-100 text-slate-600',
  },
  {
    key: 'sviluppo',
    label: 'Sviluppo',
    color: 'text-blue-700',
    dot: 'bg-blue-500',
    bg: 'bg-blue-50',
    headerBg: 'bg-blue-100',
    border: 'border-blue-200',
    cardBorder: 'border-l-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'test',
    label: 'Test',
    color: 'text-amber-700',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50',
    headerBg: 'bg-amber-100',
    border: 'border-amber-200',
    cardBorder: 'border-l-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'pronto',
    label: 'Pronto',
    color: 'text-emerald-700',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    headerBg: 'bg-emerald-100',
    border: 'border-emerald-200',
    cardBorder: 'border-l-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
]
const stageMap = Object.fromEntries(STAGES.map(s => [s.key, s]))

const MARKETS = ['Retail', 'Horeca', 'Export', 'Interno']
const MARKET_COLORS = {
  Retail:  'bg-violet-100 text-violet-700',
  Horeca:  'bg-orange-100 text-orange-700',
  Export:  'bg-cyan-100 text-cyan-700',
  Interno: 'bg-warm-100 text-warm-600',
}

const PRIORITIES = [
  { key: 'bassa', label: 'Bassa', cls: 'bg-warm-100 text-warm-500',   dot: 'bg-warm-400' },
  { key: 'media', label: 'Media', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  { key: 'alta',  label: 'Alta',  cls: 'bg-red-100 text-red-600',     dot: 'bg-red-500'  },
]
const priMap = Object.fromEntries(PRIORITIES.map(p => [p.key, p]))

function StageBadge({ stage }) {
  const s = stageMap[stage] || stageMap.idea
  return <span className={`inline-flex items-center gap-1 text-2xs font-700 px-2 py-0.5 rounded-full ${s.badge}`}>
    <span className={`w-1 h-1 rounded-full ${s.dot}`}/>
    {s.label}
  </span>
}

function PriBadge({ priority }) {
  const p = priMap[priority]
  if (!p) return null
  return <span className={`inline-flex items-center gap-1 text-2xs font-700 px-2 py-0.5 rounded-full ${p.cls}`}>
    <span className={`w-1 h-1 rounded-full ${p.dot}`}/>
    {p.label}
  </span>
}

function MarketBadge({ market }) {
  const cls = MARKET_COLORS[market] || 'bg-warm-100 text-warm-600'
  return <span className={`text-2xs font-700 px-2 py-0.5 rounded-full ${cls}`}>{market}</span>
}

// ── Modal crea/modifica progetto ──────────────────────────────────────
function ProjectModal({ project, onClose, onSaved, onDeleted }) {
  const { profile } = useApp()
  const isNew = !project
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    market: project?.market || 'Retail',
    stage: project?.stage || 'idea',
    priority: project?.priority || 'media',
    supplier: project?.supplier || '',
    weight_format: project?.weight_format || '',
    cost_per_unit: project?.cost_per_unit || '',
    country_code: project?.country_code || '',
    country: project?.country || '',
    client: project?.client || '',
    notes: project?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        ...form,
        cost_per_unit: form.cost_per_unit ? parseFloat(form.cost_per_unit) : null,
        supplier: form.supplier || null,
        weight_format: form.weight_format || null,
        country_code: form.country_code || null,
        country: form.country || null,
        client: form.client || null,
      }
      const d = isNew
        ? await api('/api/projects', { method: 'POST', body })
        : await api(`/api/projects/${project.id}`, { method: 'PATCH', body })
      onSaved(d.project, isNew)
      onClose()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  async function del() {
    if (!confirm(`Eliminare il progetto "${project.name}"?`)) return
    setDeleting(true)
    try {
      await api(`/api/projects/${project.id}`, { method: 'DELETE' })
      onDeleted(project.id)
      onClose()
    } catch (err) { alert(err.message) }
    setDeleting(false)
  }

  const currentStage = stageMap[form.stage]

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header colorato per stage */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b rounded-t-2xl md:rounded-t-2xl ${currentStage?.headerBg || 'bg-white'} border-warm-100 flex-shrink-0`}>
          <div className="flex-1 min-w-0">
            <div className="font-700 text-warm-900 text-sm truncate">
              {isNew ? 'Nuovo progetto' : form.name}
            </div>
            {!isNew && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <StageBadge stage={form.stage}/>
                <PriBadge priority={form.priority}/>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-warm-400 hover:text-warm-700 p-1">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>

        {/* Form */}
        <form id="proj-form" onSubmit={save} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-none">

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Nome progetto *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required
              placeholder="Es: OOH! Dessert Frozen 200g"
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50">
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Mercato</label>
              <select value={form.market} onChange={e => set('market', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50">
                {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Priorità</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50">
                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Fornitore</label>
              <input value={form.supplier} onChange={e => set('supplier', e.target.value)}
                placeholder="Nome fornitore"
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
            </div>
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Formato / Peso</label>
              <input value={form.weight_format} onChange={e => set('weight_format', e.target.value)}
                placeholder="Es: 200g, 6x100g"
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
            </div>
          </div>

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Costo indicativo (€/pz)</label>
            <input type="number" step="0.01" value={form.cost_per_unit} onChange={e => set('cost_per_unit', e.target.value)}
              placeholder="0.00"
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Cliente / Buyer</label>
            <input value={form.client} onChange={e => set('client', e.target.value)}
              placeholder="Es: VDB Frozen Food Production"
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="text-xs font-600 text-warm-500 mb-1 block">Sigla paese</label>
              <input value={form.country_code} onChange={e => set('country_code', e.target.value.toUpperCase().slice(0,2))}
                placeholder="IT"
                maxLength={2}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50 uppercase font-600 text-center tracking-widest"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-600 text-warm-500 mb-1 block">Paese destinazione</label>
              <input value={form.country} onChange={e => set('country', e.target.value)}
                placeholder="Es: Belgio"
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
            </div>
          </div>

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Descrizione</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50 resize-none"/>
          </div>

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Note interne</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              placeholder="Aggiornamenti, ostacoli, decisioni..."
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50 resize-none"/>
          </div>

        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-warm-100 flex gap-2 flex-shrink-0">
          {!isNew && profile?.role === 'admin' && (
            <button onClick={del} disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 font-500 border border-red-200 hover:border-red-300 rounded-xl px-4 py-2 transition-colors disabled:opacity-40">
              {deleting ? '...' : 'Elimina'}
            </button>
          )}
          <div className="flex-1"/>
          <button onClick={onClose} className="text-sm text-warm-500 hover:text-warm-700 font-500 border border-warm-200 rounded-xl px-4 py-2 transition-colors">
            Annulla
          </button>
          <button form="proj-form" type="submit" disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-xl px-5 py-2 transition-colors disabled:opacity-40">
            {saving ? 'Salvo...' : isNew ? 'Crea' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card Kanban ───────────────────────────────────────────────────────
function SortableCard({ project, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const stage = stageMap[project.stage] || stageMap.idea

  return (
    <div ref={setNodeRef} style={style} className="relative group/card">
      {/* Drag handle */}
      <div {...attributes} {...listeners}
        className="absolute top-2 right-2 cursor-grab active:cursor-grabbing opacity-0 group-hover/card:opacity-60 transition-opacity touch-none z-10">
        <svg viewBox="0 0 8 14" fill="currentColor" className="w-2 h-3 text-warm-400">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
          <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
        </svg>
      </div>
      <div onClick={onClick}
        className={`bg-white rounded-xl border border-l-4 border-warm-200 ${stage.cardBorder} p-3 cursor-pointer hover:shadow-md transition-all`}>

        {/* Nome */}
        <div className="font-600 text-sm text-warm-900 mb-2 pr-4 leading-snug">{project.name}</div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          {project.market && <MarketBadge market={project.market}/>}
          {project.priority && <PriBadge priority={project.priority}/>}
        </div>

        {/* Info secondarie */}
        <div className="space-y-0.5">
          {project.supplier && (
            <div className="flex items-center gap-1 text-xs text-warm-500">
              <span className="text-warm-300">Forn.</span>
              <span className="truncate font-500">{project.supplier}</span>
            </div>
          )}
          {project.weight_format && (
            <div className="text-xs text-warm-400">{project.weight_format}</div>
          )}
          {project.client && (
            <div className="flex items-center gap-1 text-xs text-warm-500">
              <span className="text-warm-300">Buy.</span>
              <span className="truncate">{project.client}</span>
            </div>
          )}
        </div>

        {/* Footer card: costo + paese */}
        {(project.cost_per_unit || project.country_code) && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-warm-100">
            {project.cost_per_unit
              ? <span className="text-xs font-700 text-warm-700">€ {Number(project.cost_per_unit).toFixed(2)}</span>
              : <span/>
            }
            {project.country_code && (
              <span className="text-xs font-700 text-warm-400 bg-warm-100 px-1.5 py-0.5 rounded font-mono">{project.country_code}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vista Tabella ─────────────────────────────────────────────────────
const TABLE_COLS = [
  { key: 'name',         label: 'Progetto' },
  { key: 'stage',        label: 'Stage' },
  { key: 'market',       label: 'Mercato' },
  { key: 'priority',     label: 'Priorità' },
  { key: 'supplier',     label: 'Fornitore' },
  { key: 'weight_format',label: 'Formato' },
  { key: 'cost_per_unit',label: 'Costo/pz' },
  { key: 'client',       label: 'Cliente' },
  { key: 'country',      label: 'Paese' },
]

function TableView({ projects, onRowClick }) {
  const [sortKey, setSortKey] = useState('stage')
  const [sortDir, setSortDir] = useState(1)

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(1) }
  }

  const STAGE_ORDER = { idea: 0, sviluppo: 1, test: 2, pronto: 3 }
  const PRI_ORDER   = { alta: 0, media: 1, bassa: 2 }

  const sorted = [...projects].sort((a, b) => {
    let va = a[sortKey] ?? ''
    let vb = b[sortKey] ?? ''
    if (sortKey === 'stage') { va = STAGE_ORDER[va] ?? 99; vb = STAGE_ORDER[vb] ?? 99 }
    if (sortKey === 'priority') { va = PRI_ORDER[va] ?? 99; vb = PRI_ORDER[vb] ?? 99 }
    if (sortKey === 'cost_per_unit') { va = Number(va) || 0; vb = Number(vb) || 0 }
    if (va < vb) return -sortDir
    if (va > vb) return sortDir
    return 0
  })

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className="text-warm-200 ml-1">↕</span>
    return <span className="text-brand-500 ml-1">{sortDir === 1 ? '↑' : '↓'}</span>
  }

  return (
    <div className="flex-1 overflow-auto scrollbar-none">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-white border-b border-warm-200">
            {TABLE_COLS.map(col => (
              <th key={col.key}
                onClick={() => toggleSort(col.key)}
                className="text-left text-xs font-700 text-warm-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-warm-900 whitespace-nowrap select-none">
                {col.label}<SortIcon col={col.key}/>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const stage = stageMap[p.stage] || stageMap.idea
            return (
              <tr key={p.id}
                onClick={() => onRowClick(p)}
                className={`border-b border-warm-100 cursor-pointer transition-colors hover:bg-brand-50/40 ${i % 2 === 0 ? 'bg-white' : 'bg-warm-50/40'}`}>
                <td className="px-4 py-2.5">
                  <div className={`flex items-center gap-2`}>
                    <div className={`w-1 h-8 rounded-full flex-shrink-0 ${stage.dot}`}/>
                    <span className="font-600 text-warm-900 leading-snug">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5"><StageBadge stage={p.stage}/></td>
                <td className="px-4 py-2.5">{p.market && <MarketBadge market={p.market}/>}</td>
                <td className="px-4 py-2.5"><PriBadge priority={p.priority}/></td>
                <td className="px-4 py-2.5 text-xs text-warm-600">{p.supplier || <span className="text-warm-300">—</span>}</td>
                <td className="px-4 py-2.5 text-xs text-warm-500">{p.weight_format || <span className="text-warm-300">—</span>}</td>
                <td className="px-4 py-2.5 text-xs font-700 text-warm-700">
                  {p.cost_per_unit ? `€ ${Number(p.cost_per_unit).toFixed(2)}` : <span className="text-warm-300 font-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-warm-600">{p.client || <span className="text-warm-300">—</span>}</td>
                <td className="px-4 py-2.5">
                  {p.country_code
                    ? <span className="inline-flex items-center gap-1 text-xs text-warm-600">
                        <span className="font-mono font-700 bg-warm-100 px-1.5 py-0.5 rounded text-warm-500">{p.country_code}</span>
                        {p.country && <span>{p.country}</span>}
                      </span>
                    : <span className="text-warm-300">—</span>
                  }
                </td>
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={9} className="text-center text-warm-300 py-16 text-sm">Nessun progetto</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Vista principale ──────────────────────────────────────────────────
export default function Projects() {
  const { profile } = useApp()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [filterMarket, setFilterMarket] = useState('')
  const [filterPri, setFilterPri] = useState('')
  const [view, setView] = useState('kanban') // 'kanban' | 'table'
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const fileInputRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const load = () => api('/api/projects')
    .then(d => setProjects(d.projects || []))
    .catch(() => {})
    .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const filtered = projects.filter(p => {
    if (filterMarket && p.market !== filterMarket) return false
    if (filterPri && p.priority !== filterPri) return false
    return true
  })

  function handleSaved(project, isNew) {
    if (isNew) setProjects(prev => [project, ...prev])
    else setProjects(prev => prev.map(p => p.id === project.id ? project : p))
  }

  function handleDeleted(id) {
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  async function handleSync(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setSyncing(true)
    setSyncResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const result = await api('/api/sync/progetti', { method: 'POST', body: form })
      setSyncResult({ ok: true, ...result })
      load() // ricarica progetti
    } catch (err) {
      setSyncResult({ ok: false, error: err.message })
    }
    setSyncing(false)
  }

  function handleDragEnd(stageKey, { active, over }) {
    if (!over || active.id === over.id) return
    setProjects(prev => {
      const stageItems = prev.filter(p => p.stage === stageKey)
      const oldIdx = stageItems.findIndex(p => p.id === active.id)
      const newIdx = stageItems.findIndex(p => p.id === over.id)
      const reordered = arrayMove(stageItems, oldIdx, newIdx)
      const rest = prev.filter(p => p.stage !== stageKey)
      return [...rest, ...reordered]
    })
  }

  // Riepilogo numeri per stage
  const stageCounts = Object.fromEntries(STAGES.map(s => [s.key, filtered.filter(p => p.stage === s.key).length]))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-warm-200 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold tracking-tight text-warm-900">Progetti</h1>
          {/* Riepilogo stage inline */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {STAGES.map(s => (
              <span key={s.key} className="flex items-center gap-1 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
                <span className={`font-600 ${s.color}`}>{s.label}</span>
                <span className="text-warm-400 font-400">{stageCounts[s.key]}</span>
              </span>
            ))}
            <span className="text-warm-300 text-xs">· {filtered.length} totali</span>
          </div>
        </div>

        {/* Filtri */}
        <div className="hidden md:flex gap-2">
          <select value={filterMarket} onChange={e => setFilterMarket(e.target.value)}
            className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 bg-white text-warm-700 focus:outline-none focus:border-brand-400">
            <option value="">Mercato</option>
            {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterPri} onChange={e => setFilterPri(e.target.value)}
            className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 bg-white text-warm-700 focus:outline-none focus:border-brand-400">
            <option value="">Priorità</option>
            {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>

        {/* Toggle Kanban / Tabella */}
        <div className="flex items-center bg-warm-100 rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setView('kanban')}
            className={`px-3 py-1.5 rounded-md text-xs font-600 transition-all flex items-center gap-1.5 ${view === 'kanban' ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-400 hover:text-warm-700'}`}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <rect x="1" y="3" width="4" height="10" rx="1"/><rect x="6" y="3" width="4" height="7" rx="1"/><rect x="11" y="3" width="4" height="12" rx="1"/>
            </svg>
            Kanban
          </button>
          <button onClick={() => setView('table')}
            className={`px-3 py-1.5 rounded-md text-xs font-600 transition-all flex items-center gap-1.5 ${view === 'table' ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-400 hover:text-warm-700'}`}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <rect x="1" y="1" width="14" height="14" rx="1.5"/>
              <path d="M1 5h14M1 9h14M1 13h14M5 1v14M11 1v14"/>
            </svg>
            Tabella
          </button>
        </div>

        {profile?.role === 'admin' && (
          <>
            <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleSync}/>
            <button onClick={() => fileInputRef.current?.click()} disabled={syncing}
              className="text-sm font-600 rounded-lg px-3 py-2 border border-warm-200 hover:border-brand-400 text-warm-600 hover:text-brand-600 transition-colors flex items-center gap-1.5 flex-shrink-0 disabled:opacity-40">
              {syncing
                ? <><span className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/><span>Sync...</span></>
                : <><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M2 8a6 6 0 1 0 1-3.3"/><path d="M2 2v4h4"/></svg><span>Sync Excel</span></>
              }
            </button>
          </>
        )}

        {['admin', 'manager'].includes(profile?.role) && (
          <button onClick={() => setModal('new')}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-lg px-4 py-2 transition-colors flex items-center gap-1.5 flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10"/></svg>
            Nuovo
          </button>
        )}
      </div>

      {/* Toast risultato sync */}
      {syncResult && (
        <div className={`mx-4 mt-2 px-4 py-2.5 rounded-xl text-sm flex items-center justify-between gap-3 ${syncResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <span>
            {syncResult.ok
              ? `✓ Sync completato — ${syncResult.inserted} inseriti, ${syncResult.updated} aggiornati, ${syncResult.skipped} invariati${syncResult.deleted_duplicates ? `, ${syncResult.deleted_duplicates} duplicati rimossi` : ''}`
              : `✗ Errore: ${syncResult.error}`
            }
          </span>
          <button onClick={() => setSyncResult(null)} className="opacity-50 hover:opacity-100 flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>
      )}

      {/* Filtri mobile */}
      <div className="md:hidden flex gap-2 px-4 py-2 bg-white border-b border-warm-100">
        <select value={filterMarket} onChange={e => setFilterMarket(e.target.value)}
          className="flex-1 text-xs border border-warm-200 rounded-lg px-2 py-1.5 bg-white text-warm-700 focus:outline-none">
          <option value="">Tutti i mercati</option>
          {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterPri} onChange={e => setFilterPri(e.target.value)}
          className="flex-1 text-xs border border-warm-200 rounded-lg px-2 py-1.5 bg-white text-warm-700 focus:outline-none">
          <option value="">Tutte le priorità</option>
          {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {/* Vista Tabella */}
      {view === 'table' && !loading && (
        <TableView projects={filtered} onRowClick={p => setModal(p)} />
      )}

      {/* Vista Kanban */}
      {view === 'kanban' && (
        <div className="flex flex-1 overflow-x-auto scrollbar-none bg-warm-50">
          {STAGES.map(stage => {
            const cards = filtered.filter(p => p.stage === stage.key)
            return (
              <div key={stage.key} className={`min-w-[220px] flex-1 flex flex-col border-r border-warm-200 last:border-r-0`}>
                {/* Colonna header colorata */}
                <div className={`px-3 py-3 ${stage.headerBg} border-b ${stage.border} flex items-center gap-2 flex-shrink-0`}>
                  <div className={`w-2 h-2 rounded-full ${stage.dot}`}/>
                  <span className={`text-xs font-700 uppercase tracking-widest ${stage.color}`}>{stage.label}</span>
                  <span className={`ml-auto text-xs font-700 ${stage.color} bg-white/60 px-2 py-0.5 rounded-full`}>{cards.length}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
                  {loading && [1,2].map(i => (
                    <div key={i} className="bg-white rounded-xl border border-warm-200 p-3 mb-2 animate-pulse h-24"/>
                  ))}
                  {!loading && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter}
                      onDragEnd={e => handleDragEnd(stage.key, e)}>
                      <SortableContext items={cards.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {cards.map(p => (
                            <SortableCard key={p.id} project={p} onClick={() => setModal(p)} />
                          ))}
                          {cards.length === 0 && (
                            <div className={`text-xs ${stage.color} opacity-40 text-center py-10 border-2 border-dashed ${stage.border} rounded-xl`}>
                              Nessun progetto
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Loading tabella */}
      {view === 'table' && loading && (
        <div className="flex-1 flex items-center justify-center text-warm-300 text-sm">Caricamento...</div>
      )}

      {/* Modal */}
      {modal && (
        <ProjectModal
          project={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
