import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { fetchTodaySet } from '../store/slices/grammarSlice'
import api from '../services/api'   // ← same import as in GrammarDrillPage
import { Volume2, ChevronLeft, ChevronRight, ArrowLeft, Search } from 'lucide-react'

type Row = { pronoun: string; de: string; en: string }
type TenseData = { present: Row[]; past: Row[]; future: Row[] }

const PRONOUNS = ['I', 'you', 'he', 'she', 'it', 'we', 'they']

const TABS: { key: keyof TenseData; label: string; de: string; hint: string }[] = [
  { key: 'present', label: 'Present', de: 'Präsens',  hint: 'What is happening now' },
  { key: 'past',    label: 'Past',    de: 'Perfekt',  hint: 'What already happened' },
  { key: 'future',  label: 'Future',  de: 'Futur I',  hint: 'What will happen' },
]

function speak(text: string) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = 0.82
  speechSynthesis.speak(u)
}

export default function TensePage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { todaySet } = useAppSelector(s => s.grammar)

  const startVerb = (location.state as any)?.verb as string | undefined

  const [verb, setVerb]       = useState(startVerb || '')
  const [typed, setTyped]     = useState('')
  const [data, setData]       = useState<TenseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab]         = useState<keyof TenseData>('present')
  const [shown, setShown]     = useState<Set<number>>(new Set())

  // Verbs from today's verb set (fetch it if the store doesn't have verbs yet)
  useEffect(() => {
    if (!todaySet || todaySet.category === 'noun') dispatch(fetchTodaySet('verb'))
  }, [dispatch]) // eslint-disable-line

  const verbList = useMemo(
    () => (todaySet?.words || []).filter(w => w.category === 'verb').map(w => w.de),
    [todaySet]
  )

  const load = async (v: string) => {
    const clean = v.trim()
    if (!clean) return
    setVerb(clean)
    setLoading(true)
    setData(null)
    setShown(new Set())
    try {
      const res = await api.post('/grammar/verb-tenses', { verb: clean })   // ← CHECK path prefix
      setData(res.data.tenseExamples)
    } catch {
      toast.error('Could not load tenses. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Load automatically when opened from a word card
  useEffect(() => { if (startVerb) load(startVerb) }, []) // eslint-disable-line

  useEffect(() => { setShown(new Set()) }, [tab])

  const idx = verbList.indexOf(verb)
  const goto = (i: number) => { if (verbList[i]) load(verbList[i]) }

  const rows = data?.[tab] || []
  const activeTab = TABS.find(t => t.key === tab)!

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <button onClick={() => navigate('/grammar-drill')}
        className="btn-ghost text-xs text-gray-500 hover:text-gold flex items-center gap-1 mb-4">
        <ArrowLeft size={14}/> Back to Grammar Drill
      </button>

      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Verb Tenses</h1>
        <p className="text-gray-500 text-sm mt-1">
          See any verb with I / you / he / she / it / we / they in Present, Past and Future
        </p>
      </div>

      {/* Verb picker */}
      <div className="card mb-5">
        <label className="section-label">Type a verb</label>
        <div className="flex gap-2 mb-3">
          <input className="input text-sm flex-1" placeholder="e.g. antworten"
            value={typed} onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { load(typed); setTyped('') } }}/>
          <button className="btn-primary px-4" onClick={() => { load(typed); setTyped('') }}>
            <Search size={15}/>
          </button>
        </div>

        {verbList.length > 0 && (
          <>
            <label className="section-label">Or pick from your verb set</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {verbList.map(v => (
                <button key={v} onClick={() => load(v)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all
                    ${v === verb
                      ? 'bg-gold/10 border-gold/40 text-gold'
                      : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'}`}>
                  {v}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Empty state */}
      {!verb && !loading && (
        <div className="card text-center py-14 border-dashed border-2 border-white/[0.05]">
          <p className="text-4xl mb-3">🕐</p>
          <p className="text-gray-500 text-sm">Pick or type a verb to see its tenses</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card text-center py-12">
          <div className="spinner w-8 h-8 mx-auto mb-3"/>
          <p className="text-gray-500 text-sm">Building tenses for “{verb}”…</p>
        </div>
      )}

      {/* Result */}
      {data && !loading && (
        <div className="space-y-4">
          <div className="card flex items-center gap-3">
            <div className="flex-1">
              <h2 className="font-display text-3xl text-gray-100">{verb}</h2>
              <p className="text-xs text-gray-500 mt-1">{activeTab.hint}</p>
            </div>
            <button onClick={() => speak(verb)}
              className="btn-secondary p-3 text-gold border-gold/30 hover:bg-gold/10">
              <Volume2 size={20}/>
            </button>
          </div>

          {/* Tense tabs */}
          <div className="grid grid-cols-3 gap-2">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`py-3 rounded-xl border text-center transition-all
                  ${tab === t.key
                    ? 'bg-gold text-ink-950 border-gold'
                    : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'}`}>
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="text-[10px] opacity-70">{t.de}</p>
              </button>
            ))}
          </div>

          {/* Pronoun rows */}
          <div className="card !p-0 overflow-hidden divide-y divide-white/[0.05]">
            {rows.map((row, i) => (
              <div key={i} className="px-4 py-3.5 flex items-start gap-3">
                <span className="text-xs text-gray-500 w-10 shrink-0 mt-0.5">{PRONOUNS[i] || row.pronoun}</span>
                <div className="flex-1 min-w-0">
                  <button onClick={() => speak(row.de)} className="flex items-start gap-1.5 group text-left">
                    <span className="text-sm font-medium text-gray-100 group-hover:text-gold transition-colors leading-relaxed">
                      {row.de}
                    </span>
                    <Volume2 size={11} className="text-gray-700 group-hover:text-gold shrink-0 mt-1"/>
                  </button>
                  {shown.has(i)
                    ? <p className="text-xs text-teal-soft/80 mt-1 italic">{row.en}</p>
                    : <button onClick={() => setShown(p => new Set(p).add(i))}
                        className="block text-[11px] text-gray-600 hover:text-teal-soft mt-0.5">
                        Tap to see translation →
                      </button>}
                </div>
              </div>
            ))}
          </div>

          {/* Prev / next verb from the set */}
          {idx >= 0 && (
            <div className="flex items-center gap-3">
              <button onClick={() => goto(idx - 1)} disabled={idx === 0}
                className="btn-secondary flex-1 justify-center py-3 gap-2 disabled:opacity-30">
                <ChevronLeft size={18}/> Previous verb
              </button>
              <span className="text-xs text-gray-600 font-mono shrink-0">{idx + 1}/{verbList.length}</span>
              <button onClick={() => goto(idx + 1)} disabled={idx === verbList.length - 1}
                className="btn-primary flex-1 justify-center py-3 gap-2 disabled:opacity-30">
                Next verb <ChevronRight size={18}/>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
