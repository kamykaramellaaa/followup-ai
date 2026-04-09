import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { useApp } from '../../App'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const STAGES = [
  { key: 'idea',     label: 'Idea',     color: 'text-warm-600',   dot: 'bg-warm-400',   bg: 'bg-warm-50' },
  { key: 'sviluppo', label: 'Sviluppo', color: 'text-blue-600',   dot: 'bg-blue-400',   bg: 'bg-blue-50' },
  { key: 'test',     label: 'Test',     color: 'text-amber-600',  dot: 'bg-amber-400',  bg: 'bg-amber-50' },
  { key: 'pronto',   label: 'Pronto',   color: 'text-brand-600',  dot: 'bg-brand-500',  bg: 'bg-brand-50' },
]
const MARKETS = ['Retail', 'Horeca', 'Export', 'Interno']
const PRIORITIES = [
  { key: 'bassa', label: 'Bassa', cls: 'bg-warm-100 text-warm-500' },
  { key: 'media', label: 'Media', cls: 'bg-amber-50 text-amber-700' },
  { key: 'alta',  label: 'Alta',  cls: 'bg-red-50 text-red-600' },
]
const priMap = Object.fromEntries(PRIORITIES.map(p => [p.key, p]))

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

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-warm-100 flex-shrink-0">
          <div className="flex-1 font-700 text-warm-900 text-sm">
            {isNew ? 'Nuovo progetto' : project.name}
          </div>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-600">
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
            <label className="text-xs font-600 text-warm-500 mb-1 block">Costo indicativo (€)</label>
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
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50 uppercase font-600"/>
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

// ── Card progetto ─────────────────────────────────────────────────────
function SortableCard({ project, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const pri = priMap[project.priority]

  return (
    <div ref={setNodeRef} style={style} className="relative group/card">
      <div {...attributes} {...listeners}
        className="absolute top-2 right-2 cursor-grab active:cursor-grabbing opacity-0 group-hover/card:opacity-100 transition-opacity touch-none z-10">
        <svg viewBox="0 0 8 14" fill="currentColor" className="w-2 h-3 text-warm-300">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
          <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
        </svg>
      </div>
      <div onClick={onClick}
        className="bg-white rounded-xl border border-warm-200 p-3 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all">
        <div className="font-600 text-sm text-warm-900 mb-2 pr-4">{project.name}</div>
        <div className="flex flex-wrap gap-1 mb-2">
          {project.market && (
            <span className="text-2xs font-600 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{project.market}</span>
          )}
          {pri && (
            <span className={`text-2xs font-600 px-1.5 py-0.5 rounded-full ${pri.cls}`}>{pri.label}</span>
          )}
        </div>
        {project.supplier && (
          <div className="text-xs text-warm-500 truncate">📦 {project.supplier}</div>
        )}
        {project.weight_format && (
          <div className="text-xs text-warm-400">{project.weight_format}</div>
        )}
        {project.cost_per_unit && (
          <div className="text-xs text-warm-500 mt-1 font-600">€ {Number(project.cost_per_unit).toFixed(2)}/pz</div>
        )}
      </div>
    </div>
  )
}

// ── Vista principale ──────────────────────────────────────────────────
export default function Projects() {
  const { profile } = useApp()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | project object
  const [filterMarket, setFilterMarket] = useState('')
  const [filterPri, setFilterPri] = useState('')

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-warm-200 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1">
          <h1 className="text-base font-bold tracking-tight text-warm-900">Progetti</h1>
          <p className="text-xs text-warm-400 mt-0.5">{filtered.length} prodotti in lavorazione</p>
        </div>
        <div className="flex gap-2">
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
        {['admin', 'manager'].includes(profile?.role) && (
          <button onClick={() => setModal('new')}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-lg px-4 py-2 transition-colors flex items-center gap-1.5 flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10"/></svg>
            Nuovo
          </button>
        )}
      </div>

      {/* Kanban */}
      <div className="flex flex-1 overflow-x-auto scrollbar-none bg-warm-50">
        {STAGES.map(stage => {
          const cards = filtered.filter(p => p.stage === stage.key)
          return (
            <div key={stage.key} className="min-w-[220px] flex-1 flex flex-col border-r border-warm-200 last:border-r-0">
              {/* Colonna header */}
              <div className="px-3 py-3 bg-white border-b border-warm-200 flex items-center gap-2 flex-shrink-0">
                <div className={`w-1.5 h-1.5 rounded-full ${stage.dot}`}/>
                <span className={`text-xs font-700 uppercase tracking-widest ${stage.color}`}>{stage.label}</span>
                <span className="ml-auto text-xs font-600 text-warm-400 bg-warm-100 px-2 py-0.5 rounded-full">{cards.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
                {loading && [1,2].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-warm-200 p-3 mb-2 animate-pulse h-20"/>
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
                          <div className="text-xs text-warm-300 text-center py-8">Nessun progetto</div>
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
