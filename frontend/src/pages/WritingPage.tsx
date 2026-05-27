import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { correctWriting, clearCorrection, fetchWritingHistory } from '../store/slices/writingSlice'
import { PenLine, CheckCircle2, AlertCircle, Sparkles, RotateCcw, History, ChevronDown, ChevronUp, Volume2 } from 'lucide-react'

const CEFR_LEVELS = ['A1','A2','B1','B2','C1']
const DIFF_COLORS: Record<string, string> = {
  grammar:    'bg-red-500/10 border-red-400/30 text-red-300',
  gender:     'bg-violet-500/10 border-violet-400/30 text-violet-300',
  case:       'bg-orange-500/10 border-orange-400/30 text-orange-300',
  'word-order':'bg-blue-500/10 border-blue-400/30 text-blue-300',
  spelling:   'bg-yellow-500/10 border-yellow-400/30 text-yellow-300',
  vocabulary: 'bg-teal-500/10 border-teal-400/30 text-teal-300',
}
const DIFF_LABELS: Record<string, string> = {
  grammar: 'Grammar', gender: 'Gender', case: 'Case',
  'word-order': 'Word Order', spelling: 'Spelling', vocabulary: 'Vocabulary',
}

const PROMPTS = [
  'Ich gehe gestern ins Kino.',
  'Der Hund ist sehr groß und er hat ein schwarzen Fell.',
  'Ich haben viele Bücher gelesen.',
  'Sie kommst aus Deutschland und sprecht sehr gut Englisch.',
  'Das ist ein interessante Geschichte über ein alte Mann.',
]

export default function WritingPage() {
  const dispatch = useAppDispatch()
  const { correction, history, loading } = useAppSelector(s => s.writing)
  const [text, setText]       = useState('')
  const [level, setLevel]     = useState('B1')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { dispatch(fetchWritingHistory()) }, [dispatch])

  const handleCorrect = async () => {
    if (!text.trim()) return toast.error('Write something in German first')
    const result = await dispatch(correctWriting({ text, level }))
    if (result.error) toast.error(String(result.payload))
  }

  const speak = (t: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(t)
    u.lang = 'de-DE'; u.rate = 0.85
    speechSynthesis.speak(u)
  }

  const scoreColor = (s: number) =>
    s >= 85 ? 'text-teal-soft' : s >= 60 ? 'text-gold' : 'text-red-400'

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">AI Writing Corrector</h1>
        <p className="text-gray-500 text-sm mt-1">Write in German → get grammar, gender & word-order corrections</p>
      </div>

      {/* CEFR level */}
      <div className="card mb-4">
        <label className="section-label">Your Level</label>
        <div className="flex gap-1.5 flex-wrap">
          {CEFR_LEVELS.map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                ${level === l ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="section-label mb-0">Your German Text</label>
          <button onClick={() => { setText(PROMPTS[Math.floor(Math.random()*PROMPTS.length)]); dispatch(clearCorrection()) }}
            className="btn-ghost text-xs gap-1 text-gray-500 hover:text-gold">
            <Sparkles size={11}/> Try example
          </button>
        </div>
        <textarea className="textarea min-h-[120px] sm:min-h-[140px] text-sm"
          placeholder="Schreibe hier auf Deutsch… z.B. «Ich gehe gestern ins Kino.»"
          value={text} onChange={e => { setText(e.target.value); dispatch(clearCorrection()) }} />
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={handleCorrect} className="btn-primary flex-1 sm:flex-none justify-center" disabled={loading}>
            {loading ? <span className="spinner"/> : <CheckCircle2 size={15}/>}
            {loading ? 'Checking…' : 'Correct My German'}
          </button>
          <button onClick={() => { setText(''); dispatch(clearCorrection()) }} className="btn-secondary px-3">
            <RotateCcw size={14}/>
          </button>
        </div>
      </div>

      {/* Result */}
      {correction && (
        <div className="space-y-4 animate-slide-up">
          {/* Score + corrected sentence */}
          <div className="card">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="section-label">Corrected Version</p>
                <p className="text-gray-100 text-base sm:text-lg font-medium leading-relaxed">{correction.corrected}</p>
                <p className="text-gray-500 text-xs mt-1 italic">{correction.summary}</p>
              </div>
              <div className="text-center shrink-0">
                <p className={`font-display text-4xl ${scoreColor(correction.score)}`}>{correction.score}</p>
                <p className="text-xs text-gray-600">/100</p>
                <div className="w-16 h-1.5 bg-ink-700 rounded-full overflow-hidden mt-1.5 mx-auto">
                  <div className={`h-full rounded-full transition-all ${correction.score >= 85 ? 'bg-teal-soft' : correction.score >= 60 ? 'bg-gold' : 'bg-red-400'}`}
                    style={{ width: `${correction.score}%` }}/>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={() => speak(correction.corrected)} className="btn-ghost text-xs gap-1.5">
                <Volume2 size={13}/> Hear corrected
              </button>
              <button onClick={() => speak(text)} className="btn-ghost text-xs gap-1.5 text-gray-500">
                <Volume2 size={13}/> Hear original
              </button>
            </div>
          </div>

          {/* Diff list */}
          {correction.diffs.length > 0 ? (
            <div className="card">
              <p className="section-label">{correction.diffs.length} Correction{correction.diffs.length !== 1 ? 's' : ''} Found</p>
              <div className="space-y-2.5">
                {correction.diffs.map((d, i) => (
                  <div key={i} className={`rounded-xl border p-3 ${DIFF_COLORS[d.type] || DIFF_COLORS.grammar}`}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{DIFF_LABELS[d.type]}</span>
                      <AlertCircle size={11} className="opacity-60"/>
                    </div>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="line-through opacity-50 break-all">{d.original}</span>
                      <span className="opacity-40">→</span>
                      <span className="font-semibold break-all">{d.corrected}</span>
                    </div>
                    <p className="text-xs mt-1.5 opacity-80 leading-relaxed">{d.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card text-center py-8">
              <CheckCircle2 size={36} className="text-teal-soft mx-auto mb-2"/>
              <p className="text-gray-200 font-medium">Perfekt! No errors found.</p>
              <p className="text-gray-500 text-sm mt-1">{correction.encouragement}</p>
            </div>
          )}

          {correction.diffs.length > 0 && (
            <div className="flex gap-2.5 px-4 py-3 bg-ink-800 rounded-xl">
              <span className="text-lg shrink-0">👨‍🏫</span>
              <p className="text-sm text-gray-300 leading-relaxed">{correction.encouragement}</p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="card mt-5">
          <button onClick={() => setShowHistory(v => !v)} className="w-full flex items-center justify-between">
            <span className="section-label mb-0 flex items-center gap-2"><History size={14}/> Recent Corrections</span>
            {showHistory ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {history.map(h => (
                <div key={h._id} onClick={() => { setText(h.original); dispatch(clearCorrection()) }}
                  className="flex items-start gap-3 p-3 bg-ink-800 rounded-xl cursor-pointer hover:bg-ink-700 transition-all">
                  <div className={`text-xs font-display px-2 py-1 rounded-lg shrink-0 ${scoreColor(h.score)} bg-ink-700`}>{h.score}</div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 truncate italic">"{h.original}"</p>
                    <p className="text-xs text-gray-200 truncate mt-0.5">→ {h.corrected}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
