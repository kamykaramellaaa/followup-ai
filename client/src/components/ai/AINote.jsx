import { useState, useRef, useEffect } from 'react'
import { api } from '../../lib/api'
import { useApp } from '../../App'

const DESTINATION_LABELS = {
  contact: { label: 'Contatto', icon: '👤', desc: 'Interazione con cliente/prospect' },
  task:    { label: 'Task',     icon: '✅', desc: 'Promemoria o azione generica' },
  project_note: { label: 'Nota progetto', icon: '📁', desc: 'Aggiornamento su progetto interno' },
}

const DEMOS = [
  { label: '📞 Chiamata', text: 'Ho chiamato Mario Rossi di Rossi Alimentari. Vuole sconto 5% sul lotto frozen 200kg. Richiamare giovedì con proposta.' },
  { label: '⚡ Urgente',  text: 'URGENTE — Anna Martini di SISA: fornitore in crisi, cercano 800 pz frozen entro venerdì. Richiamarla subito!' },
  { label: '✅ Task',     text: 'Ricordarmi di aggiornare il listino prezzi entro venerdì e mandarlo a tutto il team.' },
  { label: '📁 Progetto', text: 'Riunione sul progetto lancio OOH! — deciso di spostare il lancio a giugno, aggiornare tutti i materiali.' },
]

const urgColors = { alta: 'text-red-600 bg-red-50', media: 'text-amber-700 bg-amber-50', bassa: 'text-brand-600 bg-brand-50' }

export default function AINote() {
  const { profile, team } = useApp()
  const [mode, setMode] = useState('idle') // idle | recording | transcribing | analyzing | result | saving | saved
  const [note, setNote] = useState('')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [recSeconds, setRecSeconds] = useState(0)

  // Opzioni salvataggio
  const [assigneeId, setAssigneeId] = useState('')
  const [contactId, setContactId] = useState('')   // contatto esistente da collegare
  const [projectId, setProjectId] = useState('')   // progetto da collegare
  const [contacts, setContacts] = useState([])
  const [projects, setProjects] = useState([])

  const mediaRec = useRef(null)
  const chunks = useRef([])
  const timerRef = useRef(null)

  // Carica contatti e progetti per il linking
  useEffect(() => {
    api('/api/contacts').then(d => setContacts(d.contacts || [])).catch(() => {})
    api('/api/projects').then(d => setProjects(d.projects || [])).catch(() => {})
  }, [])

  // Timer registrazione
  useEffect(() => {
    if (mode === 'recording') {
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [mode])

  function formatSecs(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  async function startRec() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Registrazione audio non supportata su questo browser. Usa Chrome o Safari su HTTPS.')
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
      if (err.name === 'NotAllowedError') setError('Permesso microfono negato. Abilitalo nelle impostazioni del browser.')
      else setError('Microfono non disponibile: ' + err.message)
      return null
    })
    if (!stream) return

    // Rileva il formato supportato (Safari usa mp4, Chrome webm)
    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ].find(m => MediaRecorder.isTypeSupported(m)) || ''

    mediaRec.current = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    chunks.current = []
    mediaRec.current.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data) }
    mediaRec.current.start(100) // raccogli chunk ogni 100ms
    setMode('recording')
  }

  async function stopRec() {
    if (!mediaRec.current) return
    const mimeType = mediaRec.current.mimeType || 'audio/webm'
    mediaRec.current.stop()
    mediaRec.current.stream.getTracks().forEach(t => t.stop())
    setMode('transcribing')
    await new Promise(r => { mediaRec.current.onstop = r })
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
    const blob = new Blob(chunks.current, { type: mimeType })
    const form = new FormData()
    form.append('audio', blob, `audio.${ext}`)
    try {
      const d = await api('/api/transcribe', { method: 'POST', body: form })
      setNote(d.transcript)
      setTranscript(d.transcript)
      await analyze(d.transcript)
    } catch (err) {
      setError('Errore trascrizione: ' + (err.message || 'Riprova'))
      setMode('idle')
    }
  }

  async function analyze(text) {
    const textToAnalyze = text || note
    if (!textToAnalyze.trim()) return
    setMode('analyzing')
    setError('')
    const asgnName = assigneeId ? team.find(m => m.id === assigneeId)?.full_name : profile?.full_name
    try {
      const d = await api('/api/ai/analyze', {
        method: 'POST',
        body: { note: textToAnalyze, assignee_name: asgnName, contact_id: contactId || undefined, assignee_id: assigneeId || undefined }
      })
      setResult(d.analysis)
      setMode('result')
    } catch (e) {
      setError(e.message)
      setMode('idle')
    }
  }

  async function save() {
    if (!result) return
    setMode('saving')
    try {
      await api('/api/ai/save-voice', {
        method: 'POST',
        body: {
          analysis: result,
          contact_id: contactId || undefined,
          project_id: (result.destination === 'project_note' ? projectId : undefined) || undefined,
          assignee_id: assigneeId || undefined,
          original_note: note
        }
      })
      setMode('saved')
      setTimeout(() => reset(), 2500)
    } catch (e) {
      setError(e.message)
      setMode('result')
    }
  }

  function reset() {
    setMode('idle')
    setNote('')
    setTranscript('')
    setResult(null)
    setError('')
    setContactId('')
    setProjectId('')
  }

  function useDemo(text) {
    setNote(text)
    setTranscript('')
    setResult(null)
    setMode('idle')
  }

  const isLoading = mode === 'transcribing' || mode === 'analyzing' || mode === 'saving'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 bg-white border-b border-warm-200 flex-shrink-0">
        <h1 className="text-base font-bold tracking-tight text-warm-900">Nota AI</h1>
        <p className="text-xs text-warm-400 mt-0.5">Parla o scrivi — Claude capisce e salva al posto giusto</p>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

        {/* ── LEFT: input ── */}
        <div className="flex-1 flex flex-col p-5 overflow-y-auto scrollbar-none border-b md:border-b-0 md:border-r border-warm-200">

          {/* Demo chips */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {DEMOS.map((d, i) => (
              <button key={i} onClick={() => useDemo(d.text)}
                className="text-xs font-500 px-3 py-1.5 rounded-full border border-warm-200 bg-white text-warm-600 hover:border-brand-300 hover:text-brand-600 transition-all">
                {d.label}
              </button>
            ))}
          </div>

          {/* Big record button */}
          <div className="flex flex-col items-center justify-center py-6 mb-5">
            {mode === 'recording' ? (
              <button onClick={stopRec}
                className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all animate-pulse active:scale-95">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </button>
            ) : (
              <button onClick={startRec} disabled={isLoading}
                className="w-20 h-20 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center shadow-lg transition-all active:scale-95 disabled:opacity-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-8 h-8">
                  <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>
                </svg>
              </button>
            )}

            <div className="mt-3 text-center">
              {mode === 'recording' && (
                <div className="flex items-center gap-2 text-red-500">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
                  <span className="text-sm font-600 tabular-nums">{formatSecs(recSeconds)}</span>
                  <span className="text-xs">— tocca per fermare</span>
                </div>
              )}
              {mode === 'transcribing' && <p className="text-sm text-warm-400 animate-pulse">Trascrizione in corso...</p>}
              {mode === 'analyzing'    && <p className="text-sm text-brand-500 animate-pulse">Claude sta analizzando...</p>}
              {mode === 'saving'       && <p className="text-sm text-brand-500 animate-pulse">Salvataggio in corso...</p>}
              {mode === 'saved'        && <p className="text-sm text-brand-500 font-600">✓ Salvato!</p>}
              {mode === 'idle' && !note && (
                <p className="text-xs text-warm-400 mt-1">Tieni premuto per registrare</p>
              )}
            </div>
          </div>

          {/* Transcript / text area */}
          {(mode === 'idle' || mode === 'result') && (
            <>
              <p className="text-xs font-700 text-warm-400 uppercase tracking-wider mb-2">Oppure scrivi</p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
                placeholder="Es: Ho chiamato Mario Rossi, interessato al lotto frozen..."
                className="w-full text-sm border border-warm-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/10 bg-warm-50 text-warm-900 leading-relaxed mb-3"/>
            </>
          )}

          {transcript && mode === 'result' && (
            <div className="bg-warm-50 border border-warm-200 rounded-xl px-4 py-3 text-xs text-warm-600 mb-3 leading-relaxed">
              <span className="font-700 text-warm-400 uppercase tracking-wider text-2xs">Trascritto: </span>
              {transcript}
            </div>
          )}

          {/* Opzioni assegnazione */}
          <div className="space-y-2 mb-4">
            {team.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-600 text-warm-500 min-w-20">Assegna a</span>
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                  className="flex-1 text-sm border border-warm-200 rounded-lg px-3 py-1.5 bg-white text-warm-700 focus:outline-none focus:border-brand-400">
                  <option value="">Me stesso</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
            )}
            {contacts.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-600 text-warm-500 min-w-20">Contatto</span>
                <select value={contactId} onChange={e => setContactId(e.target.value)}
                  className="flex-1 text-sm border border-warm-200 rounded-lg px-3 py-1.5 bg-white text-warm-700 focus:outline-none focus:border-brand-400">
                  <option value="">Nuovo / auto-detect</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                </select>
              </div>
            )}
            {result?.destination === 'project_note' && projects.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-600 text-warm-500 min-w-20">Progetto</span>
                <select value={projectId} onChange={e => setProjectId(e.target.value)}
                  className="flex-1 text-sm border border-warm-200 rounded-lg px-3 py-1.5 bg-white text-warm-700 focus:outline-none focus:border-brand-400">
                  <option value="">Nessuno</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2 mb-3">{error}</p>}

          {/* Analyze button (testo) */}
          {mode === 'idle' && note.trim() && (
            <button onClick={() => analyze()} disabled={isLoading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-xl py-3 transition-colors flex items-center justify-center gap-2">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M13 8A5 5 0 1 1 3 8"/><path d="M10 5l3 3-3 3"/></svg>
              Analizza con AI
            </button>
          )}
        </div>

        {/* ── RIGHT: result ── */}
        <div className="md:w-80 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-warm-200 bg-white flex items-center gap-2 flex-shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${result ? 'bg-brand-500 animate-pulse' : 'bg-warm-300'}`} />
            <span className="text-xs font-700 text-warm-400 uppercase tracking-wider">Risultato AI</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-none">
            {!result && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-warm-300">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1" className="w-10 h-10 opacity-30">
                  <circle cx="20" cy="20" r="17"/><path d="M13 20c0-3.9 3.1-7 7-7s7 3.1 7 7-3.1 7-7 7"/><circle cx="20" cy="20" r="2.5"/>
                </svg>
                <p className="text-xs text-center">Registra o scrivi, poi premi Analizza</p>
              </div>
            )}

            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-warm-400">
                <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin"/>
                <p className="text-xs">
                  {mode === 'transcribing' ? 'Trascrizione audio...' : mode === 'analyzing' ? 'Analisi con Claude...' : 'Salvataggio...'}
                </p>
              </div>
            )}

            {result && !isLoading && (
              <div className="space-y-4">
                {/* Destination badge */}
                {result.destination && DESTINATION_LABELS[result.destination] && (
                  <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
                    <span className="text-base">{DESTINATION_LABELS[result.destination].icon}</span>
                    <div>
                      <div className="text-xs font-700 text-brand-700">{DESTINATION_LABELS[result.destination].label}</div>
                      <div className="text-2xs text-brand-500">{DESTINATION_LABELS[result.destination].desc}</div>
                    </div>
                  </div>
                )}

                {/* Contact info */}
                {(result.contact_name || result.company || result.urgency) && (
                  <Section label="Estratto">
                    <div className="bg-warm-50 rounded-xl border border-warm-200 divide-y divide-warm-100">
                      {[
                        ['Nome', result.contact_name],
                        ['Azienda', result.company],
                        ['Info chiave', result.key_info],
                        ['Urgenza', result.urgency],
                      ].filter(([, v]) => v).map(([l, v]) => (
                        <div key={l} className="flex items-start gap-2 px-3 py-2">
                          <span className="text-xs text-warm-400 min-w-16">{l}</span>
                          <span className={`text-xs font-600 flex-1 ${l === 'Urgenza' ? `px-2 py-0.5 rounded-full ${urgColors[v] || ''}` : 'text-warm-900'}`}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Tasks */}
                {result.tasks?.length > 0 && (
                  <Section label={`Task (${result.tasks.length})`}>
                    <div className="space-y-1.5">
                      {result.tasks.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 bg-white rounded-lg border border-warm-200 px-3 py-2">
                          <div className="w-3.5 h-3.5 border border-warm-300 rounded mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-500 text-warm-900">{t.text}</div>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              <span className="text-2xs font-600 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">{t.type}</span>
                              {t.urgent && <span className="text-2xs font-600 bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">urgente</span>}
                              {t.when && <span className="text-2xs text-warm-400">{t.when}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* AI advice */}
                {result.ai_advice && (
                  <div className="bg-amber-50 border-l-2 border-amber-400 rounded-r-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
                    <div className="font-700 uppercase tracking-wider text-amber-600 mb-1">Consiglio AI</div>
                    {result.ai_advice}
                  </div>
                )}

                {mode === 'saved' && (
                  <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-sm text-brand-700 font-600 text-center">
                    ✓ Salvato con successo!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {result && mode === 'result' && (
            <div className="px-4 py-3 border-t border-warm-200 bg-white flex gap-2 flex-shrink-0">
              <button onClick={reset}
                className="text-sm text-warm-500 hover:text-warm-700 font-500 border border-warm-200 rounded-xl px-3 py-2 transition-colors">
                Scarta
              </button>
              <button onClick={save}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white text-sm font-600 rounded-xl py-2 transition-colors flex items-center justify-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 8l3.5 3.5L13 5"/></svg>
                Conferma e salva
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-2xs font-700 text-warm-400 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  )
}
