import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import { useApp } from '../../App'

// ── Costanti ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    key: 'idea',
    label: 'Idea',
    color: 'text-slate-600',
    dot: 'bg-slate-400',
    headerBg: 'bg-slate-50',
    border: 'border-slate-200',
    cardBorder: 'border-l-slate-400',
    emptyColor: 'text-slate-400',
    nextStage: 'sviluppo',
    nextLabel: 'Sviluppo →',
  },
  {
    key: 'sviluppo',
    label: 'Sviluppo',
    color: 'text-blue-700',
    dot: 'bg-blue-500',
    headerBg: 'bg-blue-50',
    border: 'border-blue-200',
    cardBorder: 'border-l-blue-400',
    emptyColor: 'text-blue-400',
    nextStage: 'pronto',
    nextLabel: 'Pronto →',
  },
  {
    key: 'pronto',
    label: 'Pronto',
    color: 'text-emerald-700',
    dot: 'bg-emerald-500',
    headerBg: 'bg-emerald-50',
    border: 'border-emerald-200',
    cardBorder: 'border-l-emerald-500',
    emptyColor: 'text-emerald-400',
    nextStage: null,
    nextLabel: 'Proponi →',
  },
]

const MARKETS = ['Retail', 'Horeca', 'Export', 'Interno']
const MARKET_COLORS = {
  Retail:  'bg-violet-100 text-violet-700',
  Horeca:  'bg-orange-100 text-orange-700',
  Export:  'bg-cyan-100 text-cyan-700',
  Interno: 'bg-warm-100 text-warm-600',
}
const PRI_COLORS = {
  alta:  'bg-red-100 text-red-600',
  media: 'bg-amber-100 text-amber-700',
  bassa: 'bg-warm-100 text-warm-500',
}
const ORIGIN_COLORS = {
  cliente: 'bg-purple-100 text-purple-700',
  interna: 'bg-teal-100 text-teal-700',
}
const ORIGIN_LABELS = { cliente: 'Richiesta cliente', interna: 'Opportunità interna' }
const PRI_ORDER = { alta: 0, media: 1, bassa: 2 }

const DEFAULT_DEV_STEPS = [
  { id: '1', title: 'Ricerca fornitore',     completed: false },
  { id: '2', title: 'Campione ricevuto',     completed: false },
  { id: '3', title: 'Valutazione qualità',   completed: false },
  { id: '4', title: 'Analisi costo',         completed: false },
  { id: '5', title: 'Etichetta / Packaging', completed: false },
  { id: '6', title: 'Approvazione finale',   completed: false },
]

const STEP_COLORS = [
  { bg: 'bg-indigo-50',  border: 'border-l-indigo-400',  dot: 'bg-indigo-500',  text: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700'  },
  { bg: 'bg-blue-50',    border: 'border-l-blue-400',    dot: 'bg-blue-500',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700'      },
  { bg: 'bg-cyan-50',    border: 'border-l-cyan-400',    dot: 'bg-cyan-500',    text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700'      },
  { bg: 'bg-teal-50',    border: 'border-l-teal-400',    dot: 'bg-teal-500',    text: 'text-teal-700',    badge: 'bg-teal-100 text-teal-700'      },
  { bg: 'bg-violet-50',  border: 'border-l-violet-400',  dot: 'bg-violet-500',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700'  },
  { bg: 'bg-purple-50',  border: 'border-l-purple-400',  dot: 'bg-purple-500',  text: 'text-purple-700',  badge: 'bg-purple-100 text-purple-700'  },
  { bg: 'bg-pink-50',    border: 'border-l-pink-400',    dot: 'bg-pink-500',    text: 'text-pink-700',    badge: 'bg-pink-100 text-pink-700'      },
  { bg: 'bg-orange-50',  border: 'border-l-orange-400',  dot: 'bg-orange-500',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function MarketBadge({ market }) {
  if (!market) return null
  return <span className={`text-2xs font-700 px-2 py-0.5 rounded-full ${MARKET_COLORS[market] || 'bg-warm-100 text-warm-600'}`}>{market}</span>
}

function PriBadge({ priority }) {
  if (!priority) return null
  return <span className={`text-2xs font-700 px-2 py-0.5 rounded-full ${PRI_COLORS[priority]}`}>{priority}</span>
}

function OriginBadge({ origin }) {
  if (!origin) return null
  return <span className={`text-2xs font-700 px-2 py-0.5 rounded-full ${ORIGIN_COLORS[origin]}`}>{ORIGIN_LABELS[origin]}</span>
}

function StepProgress({ steps }) {
  if (!steps?.length) return null
  const done = steps.filter(s => s.completed).length
  const pct = Math.round(done / steps.length * 100)
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs text-warm-400">{done}/{steps.length} step</span>
        <span className="text-2xs font-700 text-blue-600">{pct}%</span>
      </div>
      <div className="h-1 bg-warm-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }}/>
      </div>
    </div>
  )
}

// ── Modal Idea ────────────────────────────────────────────────────────────────
function IdeaModal({ project, onClose, onSaved, onDeleted }) {
  const { profile } = useApp()
  const isNew = !project
  const [form, setForm] = useState({
    name:         project?.name || '',
    market:       project?.market || 'Retail',
    priority:     project?.priority || 'media',
    origin:       project?.origin || '',
    supplier:     project?.supplier || '',
    weight_format: project?.weight_format || '',
    client:       project?.client || '',
    notes:        project?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { ...form, stage: 'idea', supplier: form.supplier || null, weight_format: form.weight_format || null, client: form.client || null, origin: form.origin || null }
      const d = isNew
        ? await api('/api/projects', { method: 'POST', body })
        : await api(`/api/projects/${project.id}`, { method: 'PATCH', body })
      onSaved(d.project, isNew)
      onClose()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  async function del() {
    if (!confirm(`Eliminare "${project.name}"?`)) return
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
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-slate-50 border-warm-100 rounded-t-2xl flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-slate-400"/>
          <span className="font-700 text-warm-900 text-sm flex-1">{isNew ? 'Nuova idea' : form.name}</span>
          <button onClick={onClose} className="text-warm-400 hover:text-warm-700 p-1">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>
        <form id="idea-form" onSubmit={save} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-none">
          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Nome *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>
          {/* Origine */}
          <div>
            <label className="text-xs font-600 text-warm-500 mb-1.5 block">Origine</label>
            <div className="flex gap-2">
              {['cliente','interna'].map(o => (
                <button key={o} type="button" onClick={() => set('origin', form.origin === o ? '' : o)}
                  className={`flex-1 py-2 rounded-xl text-xs font-600 border-2 transition-all ${form.origin === o ? `${ORIGIN_COLORS[o]} border-current` : 'border-warm-200 text-warm-400 hover:border-warm-300'}`}>
                  {ORIGIN_LABELS[o]}
                </button>
              ))}
            </div>
          </div>
          {/* Priorità */}
          <div>
            <label className="text-xs font-600 text-warm-500 mb-1.5 block">Priorità</label>
            <div className="flex gap-2">
              {['bassa','media','alta'].map(p => (
                <button key={p} type="button" onClick={() => set('priority', p)}
                  className={`flex-1 py-2 rounded-xl text-xs font-600 border-2 transition-all capitalize ${form.priority === p ? `${PRI_COLORS[p]} border-current` : 'border-warm-200 text-warm-400 hover:border-warm-300'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Mercato</label>
              <select value={form.market} onChange={e => set('market', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50">
                {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Formato / Peso</label>
              <input value={form.weight_format} onChange={e => set('weight_format', e.target.value)}
                placeholder="Es: 200g"
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Fornitore</label>
            <input value={form.supplier} onChange={e => set('supplier', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>
          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Cliente / Buyer</label>
            <input value={form.client} onChange={e => set('client', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>
          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Note</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50 resize-none"/>
          </div>
        </form>
        <div className="px-5 py-4 border-t border-warm-100 flex gap-2 flex-shrink-0">
          {!isNew && profile?.role === 'admin' && (
            <button onClick={del} disabled={deleting}
              className="text-sm text-red-500 border border-red-200 rounded-xl px-4 py-2 disabled:opacity-40">
              {deleting ? '...' : 'Elimina'}
            </button>
          )}
          <div className="flex-1"/>
          <button onClick={onClose} className="text-sm text-warm-500 border border-warm-200 rounded-xl px-4 py-2">Annulla</button>
          <button form="idea-form" type="submit" disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-xl px-5 py-2 disabled:opacity-40">
            {saving ? 'Salvo...' : isNew ? 'Crea' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Pronto ──────────────────────────────────────────────────────────────
function ProntoModal({ project, onClose, onSaved, onDeleted, onProponi }) {
  const { profile } = useApp()
  const [form, setForm] = useState({
    name:          project?.name || '',
    market:        project?.market || 'Retail',
    supplier:      project?.supplier || '',
    weight_format: project?.weight_format || '',
    cost_per_unit: project?.cost_per_unit || '',
    country_code:  project?.country_code || '',
    country:       project?.country || '',
    client:        project?.client || '',
    notes:         project?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { ...form, cost_per_unit: form.cost_per_unit ? parseFloat(form.cost_per_unit) : null, supplier: form.supplier || null, weight_format: form.weight_format || null, country_code: form.country_code || null, country: form.country || null, client: form.client || null }
      const d = await api(`/api/projects/${project.id}`, { method: 'PATCH', body })
      onSaved(d.project, false)
      onClose()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  async function del() {
    if (!confirm(`Eliminare "${project.name}"?`)) return
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
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-emerald-50 border-warm-100 rounded-t-2xl flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500"/>
          <span className="font-700 text-warm-900 text-sm flex-1 truncate">{form.name}</span>
          <button onClick={() => { onClose(); onProponi(project) }}
            className="text-xs font-600 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><path d="M2 8h10M8 4l6 4-6 4"/></svg>
            Proponi
          </button>
          <button onClick={onClose} className="text-warm-400 hover:text-warm-700 p-1">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>
        <form id="pronto-form" onSubmit={save} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-none">
          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Nome *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Mercato</label>
              <select value={form.market} onChange={e => set('market', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50">
                {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Formato</label>
              <input value={form.weight_format} onChange={e => set('weight_format', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Fornitore</label>
              <input value={form.supplier} onChange={e => set('supplier', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
            </div>
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Costo (€/pz)</label>
              <input type="number" step="0.01" value={form.cost_per_unit} onChange={e => set('cost_per_unit', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Cliente / Buyer</label>
            <input value={form.client} onChange={e => set('client', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-600 text-warm-500 mb-1 block">Paese</label>
              <input value={form.country_code} onChange={e => set('country_code', e.target.value.toUpperCase().slice(0,2))}
                placeholder="IT" maxLength={2}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50 uppercase text-center font-600 tracking-widest"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-600 text-warm-500 mb-1 block">Destinazione</label>
              <input value={form.country} onChange={e => set('country', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Note</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50 resize-none"/>
          </div>
        </form>
        <div className="px-5 py-4 border-t border-warm-100 flex gap-2 flex-shrink-0">
          {profile?.role === 'admin' && (
            <button onClick={del} disabled={deleting}
              className="text-sm text-red-500 border border-red-200 rounded-xl px-4 py-2 disabled:opacity-40">
              {deleting ? '...' : 'Elimina'}
            </button>
          )}
          <div className="flex-1"/>
          <button onClick={onClose} className="text-sm text-warm-500 border border-warm-200 rounded-xl px-4 py-2">Annulla</button>
          <button form="pronto-form" type="submit" disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-xl px-5 py-2 disabled:opacity-40">
            {saving ? 'Salvo...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vista Sviluppo (full-page) ────────────────────────────────────────────────
function SviluppoView({ project: initialProject, onBack, onSaved, onDeleted, onAdvance }) {
  const { profile } = useApp()
  const [project, setProject] = useState(initialProject)
  const [steps, setSteps] = useState(
    initialProject.dev_steps?.length ? initialProject.dev_steps : DEFAULT_DEV_STEPS
  )
  const [newStepTitle, setNewStepTitle] = useState('')
  const [advancing, setAdvancing] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(initialProject.name)
  const [notes, setNotes] = useState(initialProject.notes || '')

  const done = steps.filter(s => s.completed).length
  const pct = steps.length ? Math.round(done / steps.length * 100) : 0
  const allDone = steps.length > 0 && done === steps.length

  function syncUp(updated) {
    const merged = { ...project, dev_steps: updated }
    setProject(merged)
    onSaved(merged)
  }

  async function toggleStep(id) {
    const updated = steps.map(s =>
      s.id === id ? { ...s, completed: !s.completed, completed_at: !s.completed ? new Date().toISOString() : null } : s
    )
    setSteps(updated)
    await api(`/api/projects/${project.id}/steps`, { method: 'PATCH', body: { dev_steps: updated } })
    syncUp(updated)
  }

  async function addStep(e) {
    e.preventDefault()
    const title = newStepTitle.trim()
    if (!title) return
    const updated = [...steps, { id: Date.now().toString(), title, completed: false, completed_at: null }]
    setSteps(updated)
    setNewStepTitle('')
    await api(`/api/projects/${project.id}/steps`, { method: 'PATCH', body: { dev_steps: updated } })
    syncUp(updated)
  }

  async function removeStep(id) {
    const updated = steps.filter(s => s.id !== id)
    setSteps(updated)
    await api(`/api/projects/${project.id}/steps`, { method: 'PATCH', body: { dev_steps: updated } })
    syncUp(updated)
  }

  async function saveName() {
    if (!name.trim() || name === project.name) { setEditingName(false); return }
    await api(`/api/projects/${project.id}`, { method: 'PATCH', body: { name } })
    const updated = { ...project, name }
    setProject(updated)
    onSaved(updated)
    setEditingName(false)
  }

  async function saveNotes() {
    await api(`/api/projects/${project.id}`, { method: 'PATCH', body: { notes } })
    const updated = { ...project, notes }
    setProject(updated)
    onSaved(updated)
  }

  async function advance() {
    setAdvancing(true)
    try {
      const d = await api(`/api/projects/${project.id}`, { method: 'PATCH', body: { stage: 'pronto' } })
      onAdvance(d.project)
      onBack()
    } catch (err) { alert(err.message) }
    setAdvancing(false)
  }

  async function del() {
    if (!confirm(`Eliminare "${project.name}"?`)) return
    await api(`/api/projects/${project.id}`, { method: 'DELETE' })
    onDeleted(project.id)
    onBack()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="px-6 py-4 bg-blue-50 border-b border-blue-200 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-600 text-blue-600 hover:text-blue-800 transition-colors">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M10 3L5 8l5 5"/></svg>
          Progetti
        </button>
        <span className="text-warm-300">/</span>
        {editingName ? (
          <input value={name} onChange={e => setName(e.target.value)}
            onBlur={saveName} onKeyDown={e => { if (e.key === 'Enter') saveName() }} autoFocus
            className="font-700 text-sm text-warm-900 border border-blue-300 rounded px-2 py-0.5 focus:outline-none bg-white"/>
        ) : (
          <span className="font-700 text-sm text-warm-900 cursor-pointer hover:text-blue-700 transition-colors"
            onClick={() => setEditingName(true)} title="Clicca per modificare">
            {project.name}
          </span>
        )}
        <span className="text-2xs font-700 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Sviluppo</span>
        {project.market && <MarketBadge market={project.market}/>}
        <div className="flex-1"/>
        {profile?.role === 'admin' && (
          <button onClick={del} className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5">
            Elimina
          </button>
        )}
        <button onClick={advance} disabled={advancing}
          className={`text-sm font-700 rounded-lg px-5 py-2 transition-all flex items-center gap-2 ${allDone ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'} disabled:opacity-40`}>
          {advancing ? '...' : <><span>Pronto</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg></>}
        </button>
      </div>

      {/* Barra progresso */}
      <div className="px-6 py-3 border-b border-warm-100 flex-shrink-0 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-warm-500">{done} di {steps.length} step completati</span>
          <span className="text-sm font-700 text-blue-600">{pct}%</span>
        </div>
        <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : '#60a5fa' }}/>
        </div>
      </div>

      {/* Contenuto principale */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-3">

          {/* Step cards */}
          {steps.map((step, i) => {
            const c = STEP_COLORS[i % STEP_COLORS.length]
            return (
              <div key={step.id} className={`group flex gap-4 p-5 rounded-2xl border-l-4 border border-warm-100 shadow-sm transition-all
                ${step.completed ? 'bg-warm-50 opacity-70' : `${c.bg} ${c.border} hover:shadow-md`}`}>
                {/* Numero step */}
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-700 text-sm
                    ${step.completed ? 'bg-emerald-100 text-emerald-600' : `${c.badge}`}`}>
                    {step.completed
                      ? <svg viewBox="0 0 10 10" fill="none" className="w-4 h-4"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5"/></svg>
                      : i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-0.5 flex-1 min-h-4 rounded-full ${step.completed ? 'bg-emerald-200' : 'bg-warm-200'}`}/>
                  )}
                </div>
                {/* Contenuto */}
                <div className="flex-1 min-w-0 pt-1">
                  <button onClick={() => toggleStep(step.id)} className="w-full text-left group/toggle">
                    <span className={`text-base font-600 transition-colors leading-snug
                      ${step.completed ? 'line-through text-warm-400' : `${c.text} group-hover/toggle:opacity-80`}`}>
                      {step.title}
                    </span>
                  </button>
                  {step.completed && step.completed_at && (
                    <div className="text-xs text-warm-400 mt-1 flex items-center gap-1">
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5V6l1.5 1.5"/></svg>
                      Completato {new Date(step.completed_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })}
                    </div>
                  )}
                  {!step.completed && (
                    <div className="mt-2">
                      <button onClick={() => toggleStep(step.id)}
                        className={`text-xs font-600 px-3 py-1 rounded-lg ${c.badge} hover:opacity-80 transition-opacity`}>
                        Segna come fatto
                      </button>
                    </div>
                  )}
                </div>
                {/* Elimina */}
                {profile?.role === 'admin' && (
                  <button onClick={() => removeStep(step.id)}
                    className="opacity-0 group-hover:opacity-100 text-warm-300 hover:text-red-400 transition-all p-1 flex-shrink-0 self-start mt-1">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                  </button>
                )}
              </div>
            )
          })}

          {/* Aggiungi step */}
          <form onSubmit={addStep} className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-warm-200 hover:border-blue-300 transition-colors mt-2">
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-warm-300 flex items-center justify-center text-warm-300 text-lg font-300 flex-shrink-0">+</div>
            <input value={newStepTitle} onChange={e => setNewStepTitle(e.target.value)}
              placeholder="Aggiungi nuovo step..."
              className="flex-1 text-sm text-warm-600 bg-transparent focus:outline-none placeholder-warm-300"/>
            <button type="submit" disabled={!newStepTitle.trim()}
              className="text-xs font-600 bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-30 px-3 py-1.5 rounded-lg transition-colors">
              Aggiungi
            </button>
          </form>

          {/* Note */}
          <div className="mt-6 pt-6 border-t border-warm-100">
            <label className="text-xs font-700 text-warm-400 mb-3 block uppercase tracking-wider">Note interne</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} rows={4}
              placeholder="Aggiungi note sul progetto..."
              className="w-full text-sm border border-warm-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-300 bg-warm-50 resize-none"/>
          </div>

          {/* Pulsante Pronto in fondo */}
          <div className="pt-6 pb-4 flex justify-end">
            <button onClick={advance} disabled={advancing}
              className={`text-sm font-700 rounded-xl px-8 py-3 transition-all flex items-center gap-2 shadow-sm
                ${allDone ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}
                disabled:opacity-40`}>
              {advancing ? '...' : <><span>Segna come Pronto</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 8h10M9 4l4 4-4 4"/></svg></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card Kanban ───────────────────────────────────────────────────────────────
function ProjectCard({ project, col, onClick, onAdvance, onProponi }) {
  const [advancing, setAdvancing] = useState(false)

  async function handleAdvance(e) {
    e.stopPropagation()
    if (col.key === 'pronto') { onProponi(project); return }
    setAdvancing(true)
    try {
      const d = await api(`/api/projects/${project.id}`, { method: 'PATCH', body: { stage: col.nextStage } })
      onAdvance(d.project)
    } catch (err) { alert(err.message) }
    setAdvancing(false)
  }

  const steps = project.dev_steps || []

  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-l-4 border-warm-200 ${col.cardBorder} p-3 cursor-pointer hover:shadow-md transition-all`}>

      <div className="font-600 text-sm text-warm-900 mb-1.5 leading-snug">{project.name}</div>

      <div className="flex flex-wrap gap-1 mb-2">
        {project.market && <MarketBadge market={project.market}/>}
        {col.key === 'idea' && project.priority && <PriBadge priority={project.priority}/>}
        {col.key === 'idea' && project.origin && <OriginBadge origin={project.origin}/>}
      </div>

      {project.weight_format && <div className="text-xs text-warm-400 mb-1">{project.weight_format}</div>}
      {project.supplier && <div className="text-xs text-warm-500"><span className="text-warm-300">Forn. </span>{project.supplier}</div>}
      {project.client && <div className="text-xs text-warm-500"><span className="text-warm-300">Buy. </span>{project.client}</div>}

      {col.key === 'sviluppo' && steps.length > 0 && <StepProgress steps={steps}/>}

      {/* Bottone avanzamento — sempre visibile */}
      <div className="mt-2.5 pt-2 border-t border-warm-100 flex justify-end">
        <button onClick={handleAdvance} disabled={advancing}
          className={`text-2xs font-700 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1
            ${col.key === 'pronto' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}
            disabled:opacity-30`}>
          {advancing ? '...' : col.nextLabel}
        </button>
      </div>
    </div>
  )
}

// ── Vista principale ──────────────────────────────────────────────────────────
export default function Projects({ onProponiPipeline }) {
  const { profile } = useApp()
  const [projects, setProjects]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(null)
  const [sviluppoView, setSviluppoView] = useState(null) // progetto aperto in vista dettaglio
  const [filterMarket, setFilterMarket] = useState('')
  const [syncing, setSyncing]         = useState(false)
  const [deduping, setDeduping]       = useState(false)
  const [syncResult, setSyncResult]   = useState(null)
  const fileInputRef = useRef(null)

  const load = () => api('/api/projects')
    .then(d => setProjects(d.projects || []))
    .catch(() => {})
    .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const filtered = projects.filter(p => !filterMarket || p.market === filterMarket)

  function handleSaved(project) {
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...project } : p))
  }
  function handleCreated(project) { setProjects(prev => [project, ...prev]) }
  function handleDeleted(id) {
    setProjects(prev => prev.filter(p => p.id !== id))
    if (sviluppoView?.id === id) setSviluppoView(null)
  }
  function handleAdvanced(project) {
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...project } : p))
  }

  async function handleDedup() {
    setDeduping(true); setSyncResult(null)
    try {
      const r = await api('/api/sync/dedup', { method: 'POST', body: {} })
      setSyncResult({ ok: true, inserted: 0, updated: 0, skipped: 0, deleted_duplicates: r.deleted })
      if (r.deleted > 0) load()
    } catch (err) { setSyncResult({ ok: false, error: err.message }) }
    setDeduping(false)
  }

  async function handleSync(e) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; setSyncing(true); setSyncResult(null)
    try {
      const form = new FormData(); form.append('file', file)
      const r = await api('/api/sync/progetti', { method: 'POST', body: form })
      setSyncResult({ ok: true, ...r }); load()
    } catch (err) { setSyncResult({ ok: false, error: err.message }) }
    setSyncing(false)
  }

  // Se è aperta la vista sviluppo, mostra quella al posto del kanban
  if (sviluppoView) {
    return (
      <SviluppoView
        project={sviluppoView}
        onBack={() => setSviluppoView(null)}
        onSaved={p => { handleSaved(p); setSviluppoView(prev => ({ ...prev, ...p })) }}
        onDeleted={handleDeleted}
        onAdvance={p => { handleAdvanced(p); setSviluppoView(null) }}
      />
    )
  }

  const colCounts = Object.fromEntries(
    COLUMNS.map(c => [c.key, filtered.filter(p => p.stage === c.key || (c.key === 'sviluppo' && p.stage === 'test')).length])
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-warm-200 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold tracking-tight text-warm-900">Progetti</h1>
          <div className="flex items-center gap-3 mt-1">
            {COLUMNS.map(c => (
              <span key={c.key} className="flex items-center gap-1 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
                <span className={`font-600 ${c.color}`}>{c.label}</span>
                <span className="text-warm-400">{colCounts[c.key]}</span>
              </span>
            ))}
            <span className="text-warm-300 text-xs">· {filtered.length} totali</span>
          </div>
        </div>

        <select value={filterMarket} onChange={e => setFilterMarket(e.target.value)}
          className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 bg-white text-warm-700 focus:outline-none hidden md:block">
          <option value="">Mercato</option>
          {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {profile?.role === 'admin' && (
          <>
            <button onClick={handleDedup} disabled={deduping} title="Rimuovi duplicati"
              className="text-sm font-600 rounded-lg p-2 border border-warm-200 hover:border-red-300 text-warm-400 hover:text-red-500 transition-colors disabled:opacity-40">
              {deduping ? <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-transparent rounded-full animate-spin block"/> : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleSync}/>
            <button onClick={() => fileInputRef.current?.click()} disabled={syncing}
              className="text-xs font-600 rounded-lg px-3 py-2 border border-warm-200 hover:border-brand-400 text-warm-600 hover:text-brand-600 transition-colors flex items-center gap-1.5 disabled:opacity-40">
              {syncing ? <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/> : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><path d="M2 8a6 6 0 1 0 1-3.3"/><path d="M2 2v4h4"/></svg>}
              Sync
            </button>
          </>
        )}

        {['admin', 'manager'].includes(profile?.role) && (
          <button onClick={() => setModal({ type: 'idea', project: null })}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-lg px-4 py-2 transition-colors flex items-center gap-1.5 flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10"/></svg>
            Nuovo
          </button>
        )}
      </div>

      {/* Toast sync */}
      {syncResult && (
        <div className={`mx-4 mt-2 px-4 py-2.5 rounded-xl text-sm flex items-center justify-between gap-3 flex-shrink-0 ${syncResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <span>{syncResult.ok
            ? `✓ ${syncResult.inserted > 0 || syncResult.updated > 0 || syncResult.deleted_duplicates > 0 ? `${syncResult.inserted} inseriti, ${syncResult.updated} aggiornati${syncResult.deleted_duplicates ? `, ${syncResult.deleted_duplicates} duplicati rimossi` : ''}` : 'Nessuna modifica necessaria'}`
            : `✗ ${syncResult.error}`}
          </span>
          <button onClick={() => setSyncResult(null)} className="opacity-50 hover:opacity-100">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>
      )}

      {/* Kanban */}
      <div className="flex flex-1 overflow-x-auto scrollbar-none bg-warm-50">
        {COLUMNS.map(col => {
          let cards = filtered.filter(p =>
            p.stage === col.key || (col.key === 'sviluppo' && p.stage === 'test')
          )
          // Ordina le idee per priorità: alta → media → bassa
          if (col.key === 'idea') {
            cards = [...cards].sort((a, b) =>
              (PRI_ORDER[a.priority] ?? 99) - (PRI_ORDER[b.priority] ?? 99)
            )
          }
          return (
            <div key={col.key} className="flex-1 min-w-[240px] flex flex-col border-r border-warm-200 last:border-r-0">
              <div className={`px-3 py-3 ${col.headerBg} border-b ${col.border} flex items-center gap-2 flex-shrink-0`}>
                <div className={`w-2 h-2 rounded-full ${col.dot}`}/>
                <span className={`text-xs font-700 uppercase tracking-widest ${col.color}`}>{col.label}</span>
                <span className={`ml-auto text-xs font-700 ${col.color} bg-white/60 px-2 py-0.5 rounded-full`}>{cards.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
                {loading && [1,2].map(i => <div key={i} className="bg-white rounded-xl border border-warm-200 p-3 mb-2 animate-pulse h-20"/>)}
                {!loading && (
                  <div className="space-y-2">
                    {cards.map(p => (
                      <ProjectCard key={p.id} project={p} col={col}
                        onClick={() => {
                          if (col.key === 'sviluppo') {
                            setSviluppoView(p)
                          } else if (col.key === 'idea') {
                            setModal({ type: 'idea', project: p })
                          } else {
                            setModal({ type: 'pronto', project: p })
                          }
                        }}
                        onAdvance={handleAdvanced}
                        onProponi={p => { onProponiPipeline?.(p) }}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className={`text-xs ${col.emptyColor} opacity-40 text-center py-10 border-2 border-dashed ${col.border} rounded-xl`}>
                        Nessun progetto
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {modal?.type === 'idea' && (
        <IdeaModal
          project={modal.project}
          onClose={() => setModal(null)}
          onSaved={(p, isNew) => { isNew ? handleCreated(p) : handleSaved(p) }}
          onDeleted={handleDeleted}
        />
      )}
      {modal?.type === 'pronto' && (
        <ProntoModal
          project={modal.project}
          onClose={() => setModal(null)}
          onSaved={(p) => handleSaved(p)}
          onDeleted={handleDeleted}
          onProponi={p => { setModal(null); onProponiPipeline?.(p) }}
        />
      )}
    </div>
  )
}
