import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { useApp } from '../../App'

const STAGES = [
  {
    key: 'proposto',
    label: 'Proposto',
    color: 'text-blue-700',
    dot: 'bg-blue-500',
    headerBg: 'bg-blue-50',
    border: 'border-blue-200',
    cardBorder: 'border-l-blue-400',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'campione',
    label: 'Campione',
    color: 'text-amber-700',
    dot: 'bg-amber-500',
    headerBg: 'bg-amber-50',
    border: 'border-amber-200',
    cardBorder: 'border-l-amber-400',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'offerta',
    label: 'Offerta',
    color: 'text-orange-700',
    dot: 'bg-orange-500',
    headerBg: 'bg-orange-50',
    border: 'border-orange-200',
    cardBorder: 'border-l-orange-400',
    badge: 'bg-orange-100 text-orange-700',
  },
  {
    key: 'ordine',
    label: 'Ordine',
    color: 'text-emerald-700',
    dot: 'bg-emerald-500',
    headerBg: 'bg-emerald-50',
    border: 'border-emerald-200',
    cardBorder: 'border-l-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
]
const stageMap = Object.fromEntries(STAGES.map(s => [s.key, s]))

// ── Modal crea/modifica opportunità ───────────────────────────────────────────
function OpportunityModal({ opp, preProject, onClose, onSaved, onDeleted }) {
  const { profile } = useApp()
  const isNew = !opp
  const [projects, setProjects] = useState([])
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({
    project_id: opp?.project?.id || preProject?.id || '',
    contact_id: opp?.contact?.id || '',
    contact_name: opp?.contact_name || opp?.contact?.name || '',
    stage: opp?.stage || 'proposto',
    notes: opp?.notes || '',
    value_estimate: opp?.value_estimate || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api('/api/projects').then(d => setProjects((d.projects || []).filter(p => p.stage === 'pronto')))
    api('/api/contacts').then(d => setContacts(d.contacts || []))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        project_id: form.project_id,
        contact_id: form.contact_id || null,
        contact_name: form.contact_name || null,
        stage: form.stage,
        notes: form.notes || null,
        value_estimate: form.value_estimate ? parseFloat(form.value_estimate) : null,
      }
      const d = isNew
        ? await api('/api/pipeline', { method: 'POST', body })
        : await api(`/api/pipeline/${opp.id}`, { method: 'PATCH', body })
      onSaved(d.opportunity, isNew)
      onClose()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  async function del() {
    if (!confirm('Eliminare questa opportunità?')) return
    setDeleting(true)
    try {
      await api(`/api/pipeline/${opp.id}`, { method: 'DELETE' })
      onDeleted(opp.id)
      onClose()
    } catch (err) { alert(err.message) }
    setDeleting(false)
  }

  const currentStage = stageMap[form.stage]

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">

        <div className={`flex items-center gap-3 px-5 py-4 border-b ${currentStage?.headerBg || 'bg-white'} border-warm-100 rounded-t-2xl flex-shrink-0`}>
          <div className={`w-2.5 h-2.5 rounded-full ${currentStage?.dot || 'bg-warm-300'}`}/>
          <span className="font-700 text-warm-900 text-sm flex-1">
            {isNew ? 'Nuova opportunità' : (opp.project?.name || 'Opportunità')}
          </span>
          <button onClick={onClose} className="text-warm-400 hover:text-warm-700 p-1">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>

        <form id="opp-form" onSubmit={save} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-none">

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Prodotto *</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} required
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50">
              <option value="">Seleziona prodotto...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.weight_format ? ` — ${p.weight_format}` : ''}</option>)}
            </select>
            {projects.length === 0 && (
              <p className="text-xs text-warm-400 mt-1">Nessun prodotto in "Pronto". Spostane uno dalla sezione Progetti.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Fase</label>
            <div className="grid grid-cols-4 gap-1.5">
              {STAGES.map(s => (
                <button key={s.key} type="button" onClick={() => set('stage', s.key)}
                  className={`py-1.5 rounded-lg text-xs font-600 border transition-all ${form.stage === s.key ? `${s.badge} border-current` : 'border-warm-200 text-warm-400 hover:border-warm-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Cliente</label>
            <select value={form.contact_id} onChange={e => {
              const c = contacts.find(c => c.id === e.target.value)
              set('contact_id', e.target.value)
              if (c) set('contact_name', c.name)
            }}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50">
              <option value="">Seleziona da rubrica...</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
            </select>
            <input value={form.contact_name} onChange={e => { set('contact_name', e.target.value); set('contact_id', '') }}
              placeholder="...oppure scrivi nome libero"
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 mt-1.5 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Valore stimato (€)</label>
            <input type="number" step="0.01" value={form.value_estimate} onChange={e => set('value_estimate', e.target.value)}
              placeholder="0.00"
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50"/>
          </div>

          <div>
            <label className="text-xs font-600 text-warm-500 mb-1 block">Note</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              placeholder="Feedback, condizioni, prossimi passi..."
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 bg-warm-50 resize-none"/>
          </div>

        </form>

        <div className="px-5 py-4 border-t border-warm-100 flex gap-2 flex-shrink-0">
          {!isNew && (profile?.role === 'admin') && (
            <button onClick={del} disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 font-500 border border-red-200 rounded-xl px-4 py-2 disabled:opacity-40">
              {deleting ? '...' : 'Elimina'}
            </button>
          )}
          <div className="flex-1"/>
          <button onClick={onClose} className="text-sm text-warm-500 border border-warm-200 rounded-xl px-4 py-2">Annulla</button>
          <button form="opp-form" type="submit" disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-xl px-5 py-2 disabled:opacity-40">
            {saving ? 'Salvo...' : isNew ? 'Crea' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card opportunità ──────────────────────────────────────────────────────────
function OppCard({ opp, stage, onClick }) {
  const clientLabel = opp.contact?.name || opp.contact_name || '—'
  const clientCompany = opp.contact?.company

  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-l-4 border-warm-200 ${stage.cardBorder} p-3 cursor-pointer hover:shadow-md transition-all`}>
      <div className="font-600 text-sm text-warm-900 mb-1 leading-snug">{opp.project?.name || '—'}</div>
      {opp.project?.weight_format && (
        <div className="text-xs text-warm-400 mb-1.5">{opp.project.weight_format}</div>
      )}
      <div className="flex items-center gap-1.5">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 text-warm-300 flex-shrink-0">
          <path d="M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path d="M1 14a6 6 0 0 1 12 0"/>
        </svg>
        <span className="text-xs text-warm-600 truncate font-500">{clientLabel}</span>
      </div>
      {clientCompany && <div className="text-xs text-warm-400 ml-4.5 truncate">{clientCompany}</div>}
      {opp.value_estimate && (
        <div className="mt-2 pt-2 border-t border-warm-100 text-xs font-700 text-warm-700">
          € {Number(opp.value_estimate).toLocaleString('it-IT')}
        </div>
      )}
      {opp.notes && (
        <div className="mt-1.5 text-xs text-warm-400 line-clamp-2">{opp.notes}</div>
      )}
    </div>
  )
}

// ── Vista principale ──────────────────────────────────────────────────────────
export default function ProductPipeline({ preProject, onModalClose }) {
  const { profile } = useApp()
  const [pipeline, setPipeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | opportunity object
  const [filterProject, setFilterProject] = useState('')
  const [projects, setProjects] = useState([])

  // Se arriva un preProject (da bottone Proponi in Projects), apri subito il modal
  useEffect(() => {
    if (preProject) setModal('new')
  }, [preProject])

  const load = () => api('/api/pipeline')
    .then(d => setPipeline(d.pipeline || []))
    .catch(() => {})
    .finally(() => setLoading(false))

  useEffect(() => {
    load()
    api('/api/projects').then(d => setProjects((d.projects || []).filter(p => p.stage === 'pronto')))
  }, [])

  const filtered = pipeline.filter(o => !filterProject || o.project?.id === filterProject)

  const stageCounts = Object.fromEntries(STAGES.map(s => [s.key, filtered.filter(o => o.stage === s.key).length]))

  const totalValue = filtered
    .filter(o => o.stage === 'ordine' && o.value_estimate)
    .reduce((acc, o) => acc + Number(o.value_estimate), 0)

  function handleSaved(opp, isNew) {
    if (isNew) setPipeline(prev => [opp, ...prev])
    else setPipeline(prev => prev.map(o => o.id === opp.id ? opp : o))
  }

  function handleDeleted(id) {
    setPipeline(prev => prev.filter(o => o.id !== id))
  }

  function closeModal() {
    setModal(null)
    if (onModalClose) onModalClose()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-warm-200 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold tracking-tight text-warm-900">Pipeline Vendite</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {STAGES.map(s => (
              <span key={s.key} className="flex items-center gap-1 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
                <span className={`font-600 ${s.color}`}>{s.label}</span>
                <span className="text-warm-400">{stageCounts[s.key]}</span>
              </span>
            ))}
            {totalValue > 0 && (
              <span className="text-xs text-emerald-600 font-700 ml-2">
                · € {totalValue.toLocaleString('it-IT')} ordinati
              </span>
            )}
          </div>
        </div>

        {projects.length > 0 && (
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 bg-white text-warm-700 focus:outline-none focus:border-brand-400 hidden md:block">
            <option value="">Tutti i prodotti</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {['admin', 'manager'].includes(profile?.role) && (
          <button onClick={() => setModal('new')}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-lg px-4 py-2 transition-colors flex items-center gap-1.5 flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10"/></svg>
            Nuova
          </button>
        )}
      </div>

      {/* Kanban */}
      <div className="flex flex-1 overflow-x-auto scrollbar-none bg-warm-50">
        {STAGES.map(stage => {
          const cards = filtered.filter(o => o.stage === stage.key)
          return (
            <div key={stage.key} className="flex-1 min-w-[220px] flex flex-col border-r border-warm-200 last:border-r-0">
              <div className={`px-3 py-3 ${stage.headerBg} border-b ${stage.border} flex items-center gap-2 flex-shrink-0`}>
                <div className={`w-2 h-2 rounded-full ${stage.dot}`}/>
                <span className={`text-xs font-700 uppercase tracking-widest ${stage.color}`}>{stage.label}</span>
                <span className={`ml-auto text-xs font-700 ${stage.color} bg-white/60 px-2 py-0.5 rounded-full`}>{cards.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
                {loading && [1,2].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-warm-200 p-3 mb-2 animate-pulse h-20"/>
                ))}
                {!loading && (
                  <div className="space-y-2">
                    {cards.map(o => (
                      <OppCard key={o.id} opp={o} stage={stage} onClick={() => setModal(o)}/>
                    ))}
                    {cards.length === 0 && (
                      <div className={`text-xs ${stage.color} opacity-40 text-center py-10 border-2 border-dashed ${stage.border} rounded-xl`}>
                        Nessuna opportunità
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <OpportunityModal
          opp={modal === 'new' ? null : modal}
          preProject={modal === 'new' ? preProject : null}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
