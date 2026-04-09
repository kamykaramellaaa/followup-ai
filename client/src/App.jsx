import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import { api } from './lib/api'
import Login from './components/auth/Login'
import Layout from './components/layout/Layout'
import Pipeline from './components/pipeline/Pipeline'
import Tasks from './components/tasks/Tasks'
import Projects from './components/projects/Projects'
import AINote from './components/ai/AINote'
import Team from './components/team/Team'
import Contacts from './components/contacts/Contacts'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 8000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-600 flex items-center gap-2 transition-all
      ${type === 'success' ? 'bg-brand-500 text-white' : 'bg-red-500 text-white'}`}>
      {type === 'success'
        ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 8l3.5 3.5L13 5"/></svg>
        : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M4 4l8 8M12 4l-8 8"/></svg>
      }
      {msg}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('tasks')
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // Gestisci redirect Outlook (?outlook=success|error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ol = params.get('outlook')
    if (ol === 'success') {
      setToast({ msg: 'Outlook connesso con successo!', type: 'success' })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (ol === 'error') {
      const msg = params.get('msg')
      setToast({ msg: msg ? `Outlook: ${decodeURIComponent(msg)}` : 'Errore connessione Outlook. Riprova.', type: 'error' })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); setTeam([]); return }
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data))
    api('/api/team/stats').then(d => setTeam(d.members || [])).catch(() => {})
  }, [session])

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-warm-50">
      <div className="w-5 h-5 border-2 border-brand-100 border-t-brand-500 rounded-full animate-spin" />
    </div>
  )

  if (!session || !profile) return <Login />

  const views = {
    pipeline: <Pipeline />,
    tasks: <Tasks />,
    projects: <Projects />,
    contacts: <Contacts />,
    ai: <AINote />,
    team: <Team />,
  }

  return (
    <AppContext.Provider value={{ profile, session, view, setView, team, setTeam }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <Layout>{views[view]}</Layout>
    </AppContext.Provider>
  )
}
