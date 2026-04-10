import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import { useApp } from '../../App'
import EmailDraftModal from '../ai/EmailDraftModal'
import TaskEditModal from './TaskEditModal'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const TYPE_BADGE = { chiamata: 'bg-blue-50 text-blue-700', email: 'bg-brand-50 text-brand-700', meeting: 'bg-purple-50 text-purple-700', task: 'bg-warm-100 text-warm-600' }
const PRI_BADGE  = { alta: 'bg-red-50 text-red-600', media: 'bg-amber-50 text-amber-700', bassa: 'bg-brand-50 text-brand-600' }
const TYPE_COLORS = { chiamata: 'bg-blue-100 text-blue-700', email: 'bg-brand-100 text-brand-700', meeting: 'bg-purple-100 text-purple-700', task: 'bg-warm-100 text-warm-600' }
const PRI_COLORS  = { alta: 'bg-red-100 text-red-600', media: 'bg-amber-100 text-amber-700', bassa: 'bg-warm-100 text-warm-500' }
const TYPES = ['task','chiamata','email','meeting']
const PRIS  = ['bassa','media','alta']

function Badge({ text, cls }) {
  return <span className={`text-2xs font-600 px-2 py-0.5 rounded-full capitalize ${cls}`}>{text}</span>
}

function SortableTask({ task, today, onToggle, onDelete, onDraft, onSync, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const overdue = !task.completed && task.due_date && task.due_date < today

  return (
    <div ref={setNodeRef} style={style}
      className="flex items-start gap-3 px-6 py-3.5 hover:bg-warm-50 transition-colors group border-b border-warm-100 last:border-b-0">
      <div {...attributes} {...listeners}
        className="mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none">
        <svg viewBox="0 0 8 14" fill="currentColor" className="w-2.5 h-3.5 text-warm-300">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
          <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
        </svg>
      </div>
      <button onClick={() => onToggle(task.id, !task.completed)}
        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
          task.completed ? 'bg-brand-500 border-brand-500' : 'border-warm-300 hover:border-brand-400'
        }`}>
        {task.completed && <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5"/></svg>}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-500 ${task.completed ? 'text-warm-300 line-through' : overdue ? 'text-red-600' : 'text-warm-900'}`}>
          {task.urgent && !task.completed && <span className="mr-1">⚡</span>}
          {task.title}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {task.task_type && <Badge text={task.task_type} cls={TYPE_BADGE[task.task_type] || TYPE_BADGE.task} />}
          {task.priority && <Badge text={task.priority} cls={PRI_BADGE[task.priority]} />}
          {task.due_date && (
            <span className={`text-2xs font-500 ${overdue ? 'text-red-500' : 'text-warm-400'}`}>
              {overdue ? '⚠ ' : ''}{new Date(task.due_date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {task.assigned_to && <span className="text-2xs text-warm-400">{task.assigned_to.full_name}</span>}
          {task.ai_generated && (
            <span className="text-2xs font-700 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 flex items-center gap-0.5">
              ✦ AI
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onEdit(task)} title="Modifica"
          className="text-warm-300 hover:text-warm-600 p-1 rounded hover:bg-warm-100 transition-colors">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>
        </button>
        <button onClick={() => onDraft(task)} title="Bozza email AI"
          className="text-xs text-warm-400 hover:text-brand-500 p-1 rounded hover:bg-brand-50 transition-colors">✉</button>
        {task.due_date && (
          <button onClick={() => onSync(task)} title="Sincronizza Outlook"
            className="text-warm-300 hover:text-blue-500 p-1 rounded hover:bg-blue-50 transition-colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="M1.5 6h13M5.5 6v7"/>
            </svg>
          </button>
        )}
        <button onClick={() => onDelete(task.id)}
          className="text-warm-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>
    </div>
  )
}

// ── Quick Add bar (in cima alla lista) ────────────────────────────────────────
function QuickAdd({ members, onCreated }) {
  const { profile } = useApp()
  const [title, setTitle]       = useState('')
  const [type, setType]         = useState('task')
  const [priority, setPriority] = useState('media')
  const [dueDate, setDueDate]   = useState('')
  const [assignee, setAssignee] = useState('')
  const [saving, setSaving]     = useState(false)
  const inputRef = useRef(null)

  async function submit(e) {
    e?.preventDefault()
    const t = title.trim()
    if (!t) return
    setSaving(true)
    try {
      const body = {
        title: t,
        type,
        priority,
        due_date: dueDate || null,
        assigned_to_id: assignee || null,
      }
      await api('/api/tasks', { method: 'POST', body })
      setTitle('')
      setDueDate('')
      setAssignee('')
      onCreated()
      inputRef.current?.focus()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  return (
    <div className="px-4 py-2.5 bg-warm-50 border-b border-warm-200">
      <form onSubmit={submit} className="flex items-center gap-2 flex-wrap">
        {/* Input titolo */}
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          placeholder="Aggiungi task..."
          disabled={saving}
          className="flex-1 min-w-[160px] text-sm border border-warm-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-brand-400 transition-colors placeholder:text-warm-300"/>

        {/* Tipo */}
        <select value={type} onChange={e => setType(e.target.value)}
          className={`text-xs font-600 rounded-lg px-2 py-1.5 border border-warm-200 bg-white focus:outline-none cursor-pointer ${TYPE_COLORS[type]}`}>
          {TYPES.map(t => <option key={t} value={t} className="text-warm-900 bg-white">{t}</option>)}
        </select>

        {/* Priorità */}
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className={`text-xs font-600 rounded-lg px-2 py-1.5 border border-warm-200 bg-white focus:outline-none cursor-pointer ${PRI_COLORS[priority]}`}>
          {PRIS.map(p => <option key={p} value={p} className="text-warm-900 bg-white">{p}</option>)}
        </select>

        {/* Data */}
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="text-xs text-warm-600 border border-warm-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-brand-400 cursor-pointer"/>

        {/* Assegna */}
        {(profile?.role === 'admin' || profile?.role === 'manager') && members.length > 0 && (
          <select value={assignee} onChange={e => setAssignee(e.target.value)}
            className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 bg-white text-warm-600 focus:outline-none focus:border-brand-400 cursor-pointer max-w-[130px]">
            <option value="">Assegna a…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        )}

        {/* Aggiungi */}
        <button type="submit" disabled={saving || !title.trim()}
          className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-600 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 flex items-center gap-1 flex-shrink-0">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10"/></svg>
          Aggiungi
        </button>
      </form>
    </div>
  )
}

// ── Vista principale ──────────────────────────────────────────────────────────
export default function Tasks() {
  const { profile } = useApp()
  const [tasks, setTasks]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPri, setFilterPri]   = useState('')
  const [filterType, setFilterType] = useState('')
  const [aiText, setAiText]         = useState('')
  const [draftTask, setDraftTask]   = useState(null)
  const [editTask, setEditTask]     = useState(null)
  const [parsing, setParsing]       = useState(false)
  const [preview, setPreview]       = useState(null)
  const [members, setMembers]       = useState([])
  const [processingEmails, setProcessingEmails] = useState(false)
  const [emailResult, setEmailResult] = useState(null)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const aiInputRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const load = () => {
    api('/api/tasks')
      .then(d => setTasks(d.tasks || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'manager') {
      api('/api/team/members').then(d => setMembers(d.members || [])).catch(() => {})
      api('/api/outlook/status').then(d => setOutlookConnected(d.connected)).catch(() => {})
    }
  }, [profile])

  async function processEmails() {
    setProcessingEmails(true)
    setEmailResult(null)
    try {
      const r = await api('/api/outlook/process-emails', { method: 'POST', body: {} })
      setEmailResult({ ok: true, count: r.processed })
      if (r.processed > 0) load()
    } catch (e) {
      setEmailResult({ ok: false, error: e.message })
    }
    setProcessingEmails(false)
  }

  const filtered = tasks.filter(t => {
    if (filterStatus && String(t.completed) !== filterStatus) return false
    if (filterPri && t.priority !== filterPri) return false
    if (filterType && (t.task_type || t.type) !== filterType) return false
    return true
  })

  async function toggle(id, completed) {
    await api(`/api/tasks/${id}`, { method: 'PATCH', body: { completed } })
    load()
  }

  async function deleteTask(id) {
    if (!confirm('Eliminare questo task?')) return
    await api(`/api/tasks/${id}`, { method: 'DELETE' })
    load()
  }

  async function syncToOutlook(task) {
    try {
      await api('/api/outlook/sync-task', { method: 'POST', body: { task_id: task.id } })
      alert('Task sincronizzato con Outlook!')
    } catch (e) {
      alert(e.message?.includes('non trovato')
        ? 'Prima connetti il tuo account Outlook dalla barra laterale.'
        : 'Errore sincronizzazione: ' + e.message)
    }
  }

  // ── AI parse ───────────────────────────────────────────────────────────────
  async function handleAiSubmit(e) {
    e?.preventDefault()
    const text = aiText.trim()
    if (!text) return
    setParsing(true)
    try {
      const { parsed } = await api('/api/ai/parse-task', { method: 'POST', body: { text } })
      setPreview({ ...parsed, assignee_id: '' })
    } catch {
      await api('/api/tasks', { method: 'POST', body: { title: text, type: 'task', priority: 'media' } })
      setAiText('')
      load()
    }
    setParsing(false)
  }

  async function confirmCreate() {
    if (!preview) return
    const body = {
      title: preview.title,
      type: preview.type || 'task',
      priority: preview.priority || 'media',
      due_date: preview.due_date || null,
      urgent: preview.urgent || false,
    }
    if (preview.assignee_id) body.assigned_to_id = preview.assignee_id
    await api('/api/tasks', { method: 'POST', body })
    setPreview(null)
    setAiText('')
    load()
    aiInputRef.current?.focus()
  }

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    setTasks(prev => {
      const ids = filtered.map(t => t.id)
      const oldIdx = ids.indexOf(active.id)
      const newIdx = ids.indexOf(over.id)
      const reorderedIds = arrayMove(ids, oldIdx, newIdx)
      const result = [...prev]
      const positions = prev.reduce((acc, t, i) => { if (ids.includes(t.id)) acc.push(i); return acc }, [])
      reorderedIds.forEach((id, i) => { result[positions[i]] = prev.find(t => t.id === id) })
      return result
    })
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-warm-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-warm-900">Task & Reminder</h1>
            <p className="text-xs text-warm-400 mt-0.5">{filtered.length} task{tasks.filter(t=>t.ai_generated && !t.completed).length > 0 && <span className="ml-2 text-purple-500 font-600">· {tasks.filter(t=>t.ai_generated && !t.completed).length} da email</span>}</p>
          </div>
          {outlookConnected && ['admin','manager'].includes(profile?.role) && (
            <button onClick={processEmails} disabled={processingEmails}
              className="flex items-center gap-1.5 text-xs font-600 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40">
              {processingEmails
                ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><rect x="1.5" y="3.5" width="13" height="10" rx="1.5"/><path d="M1.5 6.5h13"/><path d="M5.5 6.5v7"/></svg>
              }
              {processingEmails ? 'Analisi...' : 'Analizza email'}
            </button>
          )}
        </div>
        {emailResult && (
          <div className={`mb-2 px-3 py-2 rounded-lg text-xs font-500 flex items-center justify-between ${emailResult.ok ? 'bg-purple-50 text-purple-700' : 'bg-red-50 text-red-600'}`}>
            <span>{emailResult.ok ? (emailResult.count > 0 ? `✦ ${emailResult.count} email analizzate — nuove task create` : '✦ Nessuna email nuova da processare') : `✗ ${emailResult.error}`}</span>
            <button onClick={() => setEmailResult(null)} className="opacity-50 hover:opacity-100 ml-2">✕</button>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: filterStatus, set: setFilterStatus, opts: [['','Tutti'],['false','Aperti'],['true','Completati']] },
            { value: filterPri,    set: setFilterPri,    opts: [['','Priorità'],['alta','Alta'],['media','Media'],['bassa','Bassa']] },
            { value: filterType,   set: setFilterType,   opts: [['','Tipo'],['task','Task'],['chiamata','Chiamata'],['email','Email'],['meeting','Meeting']] },
          ].map((f, i) => (
            <select key={i} value={f.value} onChange={e => f.set(e.target.value)}
              className="text-xs border border-warm-200 rounded-lg px-3 py-1.5 bg-white text-warm-700 font-medium focus:outline-none focus:border-brand-400">
              {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
        </div>
      </div>

      {/* Quick add manuale — in cima alla lista */}
      <QuickAdd members={members} onCreated={load} />

      {/* Lista task */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {loading && (
          <div className="p-6 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded-xl border border-warm-200 animate-pulse" />)}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-warm-300 gap-2">
            <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className="w-10 h-10 opacity-40">
              <path d="M14 20l5 5L26 14"/><circle cx="20" cy="20" r="17"/>
            </svg>
            <p className="text-sm">Nessun task. Creane uno!</p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-warm-100">
                {filtered.map(t => (
                  <SortableTask key={t.id} task={t} today={today}
                    onToggle={toggle} onDelete={deleteTask}
                    onDraft={setDraftTask} onSync={syncToOutlook} onEdit={setEditTask}/>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Preview interpretazione AI */}
      {preview && (
        <div className="px-4 pt-3 pb-1 bg-gradient-to-b from-brand-50 to-white border-t border-brand-100 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-700 text-brand-600">✦ Claude ha interpretato:</span>
            <button onClick={() => setPreview(null)} className="ml-auto text-warm-300 hover:text-warm-600 p-0.5">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
            </button>
          </div>
          <input value={preview.title} onChange={e => setPreview(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmCreate() } }}
            className="w-full text-sm font-600 text-warm-900 border border-brand-200 rounded-lg px-3 py-1.5 mb-2 focus:outline-none focus:border-brand-400 bg-white"/>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <select value={preview.type} onChange={e => setPreview(p => ({ ...p, type: e.target.value }))}
              className={`text-2xs font-700 px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${TYPE_COLORS[preview.type] || TYPE_COLORS.task}`}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={preview.priority} onChange={e => setPreview(p => ({ ...p, priority: e.target.value }))}
              className={`text-2xs font-700 px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${PRI_COLORS[preview.priority] || PRI_COLORS.media}`}>
              {PRIS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={() => setPreview(p => ({ ...p, urgent: !p.urgent }))}
              className={`text-2xs font-700 px-2 py-1 rounded-full transition-colors ${preview.urgent ? 'bg-red-100 text-red-600' : 'bg-warm-100 text-warm-400 hover:bg-warm-200'}`}>
              ⚡ Urgente
            </button>
            <input type="date" value={preview.due_date || ''} onChange={e => setPreview(p => ({ ...p, due_date: e.target.value || null }))}
              className="text-2xs font-600 text-warm-600 bg-warm-100 rounded-full px-2 py-1 border-0 focus:outline-none cursor-pointer"/>
          </div>
          {members.length > 0 && (
            <div className="mb-2">
              <select value={preview.assignee_id || ''} onChange={e => setPreview(p => ({ ...p, assignee_id: e.target.value }))}
                className="text-xs border border-warm-200 rounded-lg px-2 py-1 bg-white text-warm-700 focus:outline-none focus:border-brand-400 w-full">
                <option value="">Assegna a… {preview.assignee_hint ? `(suggerito: ${preview.assignee_hint})` : ''}</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>)}
              </select>
            </div>
          )}
          <button onClick={confirmCreate}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-lg py-2 transition-colors">
            Crea task
          </button>
        </div>
      )}

      {/* Barra AI — in fondo */}
      <form onSubmit={handleAiSubmit} className="px-4 py-3 bg-white border-t border-warm-200 flex gap-2 flex-shrink-0">
        <input ref={aiInputRef} value={aiText} onChange={e => setAiText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAiSubmit(e) } }}
          placeholder={parsing ? 'Claude sta analizzando…' : 'Scrivi in modo naturale e Claude interpreta… (es: chiama Marco lunedì)'}
          disabled={parsing || !!preview}
          className="flex-1 text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/10 transition-all bg-warm-50 disabled:opacity-50"/>
        <button type="submit" disabled={parsing || !!preview || !aiText.trim()}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-lg px-4 py-2 transition-colors disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0">
          {parsing
            ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
            : 'Invia'
          }
        </button>
      </form>

      {draftTask && <EmailDraftModal task={draftTask} onClose={() => setDraftTask(null)} />}
      {editTask && (
        <TaskEditModal task={editTask} onClose={() => setEditTask(null)}
          onSaved={updated => {
            setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
            setEditTask(null)
          }}/>
      )}
    </div>
  )
}
