import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import {
  Brain, Volume2, CheckCircle2, XCircle, ChevronRight,
  RotateCcw, BarChart2, Zap, Star, BookOpen, Clock,
} from 'lucide-react'
import api from '../utils/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Word {
  _id: string
  de: string
  en: string
  ipa?: string
  partOfSpeech: string
  gender?: string
  example?: string
  exampleEn?: string
  tip?: string
  conjugations?: Record<string, string>
  comparative?: string
  superlative?: string
}

interface QueueItem {
  reviewId: string | null
  wordId: string
  word: Word
  isNew: boolean
  interval: number
  repetitions: number
  easeFactor: number
  lastGrade: number | null
}

interface Stats {
  totalDue: number
  totalLearned: number
  mastered: number
  totalInLibrary: number
  unstarted: number
}

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADES = [
  { value: 0, label: 'Blackout',  desc: 'No idea',         color: 'bg-red-600   border-red-500   text-white' },
  { value: 1, label: 'Wrong',     desc: 'Incorrect',       color: 'bg-red-500   border-red-400   text-white' },
  { value: 2, label: 'Hard',      desc: 'Wrong but close', color: 'bg-orange-500 border-orange-400 text-white' },
  { value: 3, label: 'Good',      desc: 'Correct, hard',   color: 'bg-yellow-500 border-yellow-400 text-white' },
  { value: 4, label: 'Easy',      desc: 'Correct',         color: 'bg-green-500  border-green-400  text-white' },
  { value: 5, label: 'Perfect',   desc: 'Instant recall',  color: 'bg-teal-500   border-teal-400   text-white' },
]

const POS_COLORS: Record<string, string> = {
  noun: 'text-blue-400', verb: 'text-teal-400', adjective: 'text-violet-400',
  adverb: 'text-orange-400', preposition: 'text-pink-400', unknown: 'text-gray-400',
}

const GENDER_COLORS: Record<string, string> = {
  der: 'text-blue-400', die: 'text-pink-400', das: 'text-green-400',
}

function speakDE(text: string) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = 0.82; u.pitch = 1.0
  speechSynthesis.speak(u)
}

function formatInterval(days: number) {
  if (days === 0) return 'again today'
  if (days === 1) return 'tomorrow'
  if (days < 7)  return `in ${days} days`
  if (days < 30) return `in ${Math.round(days / 7)} week${Math.round(days / 7) > 1 ? 's' : ''}`
  return `in ${Math.round(days / 30)} month${Math.round(days / 30) > 1 ? 's' : ''}`
}

// ─── Stats panel ──────────────────────────────────────────────────────────────

function StatsPanel({ stats, onStart }: { stats: Stats; onStart: () => void }) {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl text-gold flex items-center gap-2">
          <Brain size={22}/> Spaced Repetition
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          SM-2 daily review — words resurface just before you forget them
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Due Today',    value: stats.totalDue,       color: 'text-gold',        icon: Clock },
          { label: 'Learning',     value: stats.totalLearned,   color: 'text-blue-400',    icon: BookOpen },
          { label: 'Mastered',     value: stats.mastered,       color: 'text-green-400',   icon: Star },
          { label: 'Not Started',  value: stats.unstarted,      color: 'text-gray-500',    icon: Zap },
        ].map(s => (
          <div key={s.label} className="card-sm text-center">
            <s.icon size={16} className={`${s.color} mx-auto mb-1.5`}/>
            <p className="text-2xl font-display text-gray-100">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.totalInLibrary > 0 && (
        <div className="card space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Library progress</span>
            <span>{stats.totalLearned}/{stats.totalInLibrary} words in rotation</span>
          </div>
          <div className="h-2 bg-ink-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-teal-400 rounded-full"
              style={{ width: `${(stats.totalLearned / stats.totalInLibrary) * 100}%` }}/>
          </div>
          <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full"
              style={{ width: `${(stats.mastered / stats.totalInLibrary) * 100}%` }}/>
          </div>
          <div className="flex gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>In rotation</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Mastered</span>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="card space-y-2 text-sm text-gray-400">
        <p className="section-label">How it works</p>
        <p>Rate each word 0–5 after revealing the answer. The SM-2 algorithm calculates the optimal next review date — easy words come back in weeks, hard ones in hours.</p>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { g: '0–2', label: 'Reset', desc: 'Back to today', color: 'text-red-400' },
            { g: '3',   label: 'Hard',  desc: 'Soon',          color: 'text-yellow-400' },
            { g: '4–5', label: 'Good',  desc: 'Longer gap',    color: 'text-green-400' },
          ].map(g => (
            <div key={g.g} className="p-2.5 bg-ink-800 rounded-xl text-center">
              <p className={`font-bold text-sm ${g.color}`}>{g.g}</p>
              <p className="text-xs text-gray-300 mt-0.5">{g.label}</p>
              <p className="text-[10px] text-gray-600">{g.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onStart} disabled={stats.totalDue === 0 && stats.unstarted === 0}
        className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
        {stats.totalDue > 0
          ? <><Brain size={17}/> Review {stats.totalDue} due word{stats.totalDue !== 1 ? 's' : ''}</>
          : stats.unstarted > 0
          ? <><Brain size={17}/> Start learning new words</>
          : <><CheckCircle2 size={17}/> All caught up!</>
        }
      </button>

      {stats.totalInLibrary === 0 && (
        <p className="text-center text-xs text-gray-600">
          Generate words in Grammar Drill or Article Drill to build your library first.
        </p>
      )}
    </div>
  )
}

// ─── Flashcard ────────────────────────────────────────────────────────────────

function FlashCard({
  item, index, total, onGrade,
}: {
  item: QueueItem; index: number; total: number; onGrade: (grade: number) => void
}) {
  const [revealed, setRevealed] = useState(false)
  const [graded, setGraded]     = useState(false)
  const w = item.word

  const handleGrade = (g: number) => {
    setGraded(true)
    setTimeout(() => {
      setRevealed(false)
      setGraded(false)
      onGrade(g)
    }, 300)
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-ink-700 rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all duration-500"
            style={{ width: `${(index / total) * 100}%` }}/>
        </div>
        <span className="text-xs text-gray-600 font-mono shrink-0">{index + 1}/{total}</span>
      </div>

      {/* Card front */}
      <div className="card text-center space-y-4 py-8 min-h-[220px] flex flex-col items-center justify-center">
        {item.isNew && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-400/25 text-blue-400">
            New word
          </span>
        )}
        {!item.isNew && item.lastGrade !== null && (
          <span className="text-[10px] text-gray-600">
            Last grade: {item.lastGrade}/5 · Due {formatInterval(0)}
          </span>
        )}
        <div>
          {w.gender && (
            <span className={`text-lg font-bold mr-2 ${GENDER_COLORS[w.gender] || 'text-gray-400'}`}>{w.gender}</span>
          )}
          <span className="font-display text-4xl text-gray-100">{w.de}</span>
        </div>
        {w.ipa && <p className="text-violet-400 font-mono text-sm">{w.ipa}</p>}
        <button onClick={() => speakDE(w.de)} className="btn-ghost p-2 text-gray-500 hover:text-gold">
          <Volume2 size={18}/>
        </button>
        <p className={`text-xs ${POS_COLORS[w.partOfSpeech] || 'text-gray-500'} capitalize`}>{w.partOfSpeech}</p>
      </div>

      {/* Reveal button or answer */}
      {!revealed ? (
        <button onClick={() => setRevealed(true)}
          className="btn-secondary w-full justify-center py-3 text-sm">
          Reveal Answer
        </button>
      ) : (
        <div className={`space-y-3 transition-opacity duration-200 ${graded ? 'opacity-0' : 'opacity-100'}`}>
          {/* Answer card */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-medium text-gray-100">{w.en}</p>
              <button onClick={() => speakDE(w.en)} className="btn-ghost p-1.5 text-gray-600 hover:text-gold">
                <Volume2 size={14}/>
              </button>
            </div>

            {w.conjugations && Object.values(w.conjugations).some(Boolean) && (
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(w.conjugations).map(([pro, form]) => (
                  <div key={pro} className="bg-ink-800 rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-gray-600">{pro} </span>
                    <span className="text-gray-200 font-medium">{form}</span>
                  </div>
                ))}
              </div>
            )}

            {(w.comparative || w.superlative) && (
              <div className="flex gap-4 text-xs text-gray-400">
                {w.comparative && <span>Comp: <span className="text-gray-200">{w.comparative}</span></span>}
                {w.superlative && <span>Superl: <span className="text-gray-200">{w.superlative}</span></span>}
              </div>
            )}

            {w.example && (
              <button onClick={() => speakDE(w.example!)}
                className="w-full text-left p-2.5 bg-ink-800 rounded-xl text-xs text-gray-400 italic hover:text-gray-200 transition-colors">
                "{w.example}"
                {w.exampleEn && <span className="block text-gray-600 not-italic mt-1">— {w.exampleEn}</span>}
              </button>
            )}

            {w.tip && (
              <div className="flex gap-2 p-2.5 bg-gold/5 border border-gold/15 rounded-xl">
                <span>💡</span>
                <p className="text-xs text-gray-400">{w.tip}</p>
              </div>
            )}
          </div>

          {/* Grade buttons */}
          <div>
            <p className="text-xs text-gray-600 text-center mb-2">How well did you know it?</p>
            <div className="grid grid-cols-3 gap-2">
              {GRADES.map(g => (
                <button key={g.value} onClick={() => handleGrade(g.value)}
                  className={`flex flex-col items-center py-2.5 px-2 rounded-xl border text-xs font-medium transition-all hover:scale-105 ${g.color}`}>
                  <span className="text-base font-bold">{g.value}</span>
                  <span>{g.label}</span>
                  <span className="opacity-70 text-[10px]">{g.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type View = 'stats' | 'session' | 'done'

export default function SpacedRepetitionPage() {
  const [view, setView]       = useState<View>('stats')
  const [stats, setStats]     = useState<Stats | null>(null)
  const [queue, setQueue]     = useState<QueueItem[]>([])
  const [index, setIndex]     = useState(0)
  const [sessionResults, setSessionResults] = useState<{ grade: number; word: string }[]>([])
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/spaced-rep/stats')
      setStats(res.data)
    } catch { toast.error('Failed to load stats') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const startSession = async () => {
    try {
      setLoading(true)
      const res = await api.get('/spaced-rep/queue', { params: { limit: 20 } })
      setQueue(res.data.queue)
      setIndex(0)
      setSessionResults([])
      setView('session')
    } catch { toast.error('Failed to load review queue') }
    finally { setLoading(false) }
  }

  const handleGrade = async (grade: number) => {
    const item = queue[index]
    if (!item) return

    try {
      await api.post('/spaced-rep/review', { wordId: item.wordId, grade })
      setSessionResults(prev => [...prev, { grade, word: item.word.de }])
    } catch { toast.error('Failed to save review') }

    if (index + 1 >= queue.length) {
      await loadStats()
      setView('done')
    } else {
      setIndex(i => i + 1)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="space-y-3 text-center">
        <div className="spinner w-8 h-8 mx-auto"/>
        <p className="text-gray-500 text-sm">Loading your review queue…</p>
      </div>
    </div>
  )

  if (view === 'stats' && stats) return <StatsPanel stats={stats} onStart={startSession}/>

  if (view === 'session' && queue.length > 0) return (
    <FlashCard
      item={queue[index]}
      index={index}
      total={queue.length}
      onGrade={handleGrade}
    />
  )

  if (view === 'done') {
    const correct  = sessionResults.filter(r => r.grade >= 3).length
    const total    = sessionResults.length
    const pct      = total > 0 ? Math.round((correct / total) * 100) : 0
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="card text-center py-10 space-y-3">
          <CheckCircle2 size={44} className="mx-auto text-green-400"/>
          <h2 className="font-display text-2xl text-gray-100">Session Complete!</h2>
          <p className="text-5xl font-display font-bold text-gold">{correct}/{total}</p>
          <p className="text-gray-400">{pct}% recalled correctly</p>
          <div className="w-36 h-2 bg-ink-700 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-green-400 rounded-full" style={{ width: `${pct}%` }}/>
          </div>
        </div>

        {/* Grade breakdown */}
        <div className="card space-y-2">
          <p className="section-label">Session breakdown</p>
          {[
            { label: 'Perfect (4–5)', count: sessionResults.filter(r => r.grade >= 4).length, color: 'bg-green-400' },
            { label: 'Correct (3)',   count: sessionResults.filter(r => r.grade === 3).length, color: 'bg-yellow-400' },
            { label: 'Incorrect (0–2)', count: sessionResults.filter(r => r.grade < 3).length,  color: 'bg-red-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 text-sm">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.color}`}/>
              <span className="text-gray-400 flex-1">{s.label}</span>
              <span className="text-gray-200 font-medium">{s.count}</span>
            </div>
          ))}
        </div>

        {stats && (
          <div className="card text-center space-y-1">
            <p className="text-xs text-gray-500">Library status</p>
            <p className="text-2xl font-display text-gold">{stats.mastered}</p>
            <p className="text-xs text-gray-500">words mastered of {stats.totalInLibrary} total</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setView('stats'); loadStats() }} className="btn-secondary flex-1 justify-center">
            <BarChart2 size={15}/> Stats
          </button>
          <button onClick={startSession} className="btn-primary flex-1 justify-center">
            <RotateCcw size={15}/> Review more
          </button>
        </div>
      </div>
    )
  }

  return null
}
