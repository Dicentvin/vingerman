import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import {
  BookOpen, Wand2, CheckCircle2, XCircle, Volume2,
  ChevronRight, ChevronLeft, Trophy, RotateCcw, History,
  Clock, FileText, Eye, EyeOff, Trash2, BarChart2, X,
} from 'lucide-react'
import api from '../utils/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
type Genre = 'story' | 'news' | 'dialogue' | 'letter' | 'description' | 'opinion'

interface Question {
  number: number
  type:   'multiple_choice' | 'true_false' | 'short_answer'
  question: string
  options:  string[]
  correctAnswer: string
  explanation:   string
}

interface VocabItem { de: string; en: string; ipa: string }

interface Comprehension {
  _id: string
  level: Level
  topic: string
  genre: Genre
  title: string
  titleEn: string
  passage: string
  passageEn: string
  vocabulary: VocabItem[]
  questions: Question[]
  totalMarks: number
  completed: boolean
  score?: number
  percentage?: number
  feedback?: string
  answers?: { questionNumber: number; given: string; correct: boolean }[]
  createdAt: string
}

interface HistoryItem {
  _id: string
  title: string
  titleEn: string
  level: Level
  genre: Genre
  topic: string
  score?: number
  percentage?: number
  totalMarks: number
  completed: boolean
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVELS: { key: Level; label: string; color: string; bg: string; desc: string }[] = [
  { key: 'A1', label: 'A1', color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-400/30',   desc: 'Beginner · 5 questions' },
  { key: 'A2', label: 'A2', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-400/30',   desc: 'Elementary · 6 questions' },
  { key: 'B1', label: 'B1', color: 'text-gold',       bg: 'bg-gold/10 border-gold/30',           desc: 'Intermediate · 8 questions' },
  { key: 'B2', label: 'B2', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-400/30', desc: 'Upper-intermediate · 10 questions' },
  { key: 'C1', label: 'C1', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-400/30',     desc: 'Advanced · 10 questions' },
]

const GENRES: { key: Genre; label: string; emoji: string }[] = [
  { key: 'story',       label: 'Story',       emoji: '📖' },
  { key: 'news',        label: 'News',        emoji: '📰' },
  { key: 'dialogue',    label: 'Dialogue',    emoji: '💬' },
  { key: 'letter',      label: 'Letter',      emoji: '✉️' },
  { key: 'description', label: 'Description', emoji: '🏙️' },
  { key: 'opinion',     label: 'Opinion',     emoji: '💭' },
]

const TOPICS = [
  'daily life', 'travel', 'food & cooking', 'work & career', 'family',
  'school & education', 'nature & environment', 'sport & fitness',
  'technology', 'health', 'culture & art', 'history',
]

const SCORE_COLOR = (pct: number) =>
  pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-gold' : pct >= 40 ? 'text-orange-400' : 'text-red-400'

const SCORE_LABEL = (pct: number) =>
  pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Needs work' : 'Keep practising'

function speakDE(text: string) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = 0.82; u.pitch = 1.0
  speechSynthesis.speak(u)
}

// ─── Question component ───────────────────────────────────────────────────────

function QuestionCard({
  q, index, answer, onChange, submitted, revealed,
}: {
  q: Question
  index: number
  answer: string
  onChange: (val: string) => void
  submitted: boolean
  revealed: boolean
}) {
  const gradedAnswer = submitted
    ? (q.type === 'short_answer'
        ? (answer.toLowerCase().includes(q.correctAnswer.toLowerCase()) ||
           q.correctAnswer.toLowerCase().includes(answer.toLowerCase()))
        : answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase())
    : null

  const typeLabel = q.type === 'multiple_choice' ? 'Multiple Choice'
    : q.type === 'true_false' ? 'True / False' : 'Short Answer'

  return (
    <div className={`card space-y-4 border-2 transition-all ${
      submitted
        ? gradedAnswer ? 'border-green-400/30 bg-green-500/[0.03]' : 'border-red-400/30 bg-red-500/[0.03]'
        : 'border-white/[0.07]'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
            ${submitted
              ? gradedAnswer ? 'bg-green-500/10 text-green-400 border-green-400/30' : 'bg-red-500/10 text-red-400 border-red-400/30'
              : 'bg-ink-800 text-gray-400 border-white/10'}`}>
            {index + 1}
          </span>
          <div>
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">{typeLabel}</span>
            <p className="text-sm text-gray-100 font-medium mt-0.5 leading-snug">{q.question}</p>
          </div>
        </div>
        {submitted && (
          gradedAnswer
            ? <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5"/>
            : <XCircle size={18} className="text-red-400 shrink-0 mt-0.5"/>
        )}
      </div>

      {/* Input area */}
      {q.type === 'multiple_choice' && (
        <div className="grid gap-2 pl-10">
          {q.options.map(opt => {
            const letter = opt.charAt(0)
            const isSelected = answer === letter
            const isCorrect  = q.correctAnswer === letter
            return (
              <button key={opt} onClick={() => !submitted && onChange(letter)}
                disabled={submitted}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all
                  ${submitted
                    ? isCorrect
                      ? 'bg-green-500/10 border-green-400/40 text-green-300'
                      : isSelected && !isCorrect
                      ? 'bg-red-500/10 border-red-400/40 text-red-300'
                      : 'bg-ink-800 border-white/[0.05] text-gray-500 opacity-60'
                    : isSelected
                    ? 'bg-gold/10 border-gold/40 text-gold'
                    : 'bg-ink-800 border-white/[0.06] text-gray-300 hover:border-white/15 hover:text-white'}`}>
                <span className={`shrink-0 font-bold ${isSelected && !submitted ? 'text-gold' : ''}`}>
                  {letter})
                </span>
                <span>{opt.slice(3)}</span>
              </button>
            )
          })}
        </div>
      )}

      {q.type === 'true_false' && (
        <div className="flex gap-3 pl-10">
          {['True', 'False'].map(opt => {
            const isSelected = answer === opt
            const isCorrect  = q.correctAnswer === opt
            return (
              <button key={opt} onClick={() => !submitted && onChange(opt)}
                disabled={submitted}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all
                  ${submitted
                    ? isCorrect
                      ? 'bg-green-500/10 border-green-400/40 text-green-300'
                      : isSelected && !isCorrect
                      ? 'bg-red-500/10 border-red-400/40 text-red-300'
                      : 'bg-ink-800 border-white/[0.05] text-gray-500 opacity-60'
                    : isSelected
                    ? 'bg-gold/10 border-gold/40 text-gold'
                    : 'bg-ink-800 border-white/[0.06] text-gray-300 hover:border-white/15'}`}>
                {opt === 'True' ? '✓ True' : '✗ False'}
              </button>
            )
          })}
        </div>
      )}

      {q.type === 'short_answer' && (
        <div className="pl-10">
          <input
            value={answer}
            onChange={e => !submitted && onChange(e.target.value)}
            disabled={submitted}
            placeholder="Type your answer…"
            className={`w-full px-4 py-2.5 bg-ink-800 border rounded-xl text-sm focus:outline-none transition-all
              ${submitted
                ? gradedAnswer
                  ? 'border-green-400/40 text-green-300'
                  : 'border-red-400/40 text-red-300'
                : 'border-white/[0.07] text-gray-200 focus:border-gold/40 placeholder-gray-600'}`}
          />
          {submitted && !gradedAnswer && (
            <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={11}/> Correct answer: <span className="font-medium">{q.correctAnswer}</span>
            </p>
          )}
        </div>
      )}

      {/* Explanation */}
      {(submitted || revealed) && q.explanation && (
        <div className="pl-10">
          <div className="flex gap-2 p-3 bg-gold/5 border border-gold/15 rounded-xl">
            <span className="text-sm shrink-0">💡</span>
            <p className="text-xs text-gray-400 leading-relaxed">{q.explanation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type View = 'setup' | 'reading' | 'questions' | 'results' | 'history'

export default function ComprehensionPage() {
  const [view, setView]               = useState<View>('setup')
  const [level, setLevel]             = useState<Level>('B1')
  const [genre, setGenre]             = useState<Genre>('story')
  const [topic, setTopic]             = useState('daily life')
  const [customTopic, setCustomTopic] = useState('')
  const [generating, setGenerating]   = useState(false)
  const [submitting, setSubmitting]   = useState(false)

  const [comp, setComp]               = useState<Comprehension | null>(null)
  const [answers, setAnswers]         = useState<Record<number, string>>({})
  const [result, setResult]           = useState<{ score: number; percentage: number; feedback: string; answers: { questionNumber: number; given: string; correct: boolean }[] } | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [revealAll, setRevealAll]     = useState(false)
  const [history, setHistory]         = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [timer, setTimer]             = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const timerRef                      = useRef<number | null>(null)

  // Timer
  useEffect(() => {
    if (timerActive) {
      timerRef.current = window.setInterval(() => setTimer(t => t + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerActive])

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // Load history when that view is active
  useEffect(() => {
    if (view !== 'history') return
    setHistoryLoading(true)
    api.get('/comprehension/history')
      .then(r => setHistory(r.data.history))
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setHistoryLoading(false))
  }, [view])

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const finalTopic = customTopic.trim() || topic
    setGenerating(true)
    try {
      const res = await api.post('/comprehension/generate', { level, genre, topic: finalTopic })
      setComp(res.data.comprehension)
      setAnswers({})
      setResult(null)
      setShowTranslation(false)
      setRevealAll(false)
      setTimer(0)
      setTimerActive(false)
      setView('reading')
    } catch {
      toast.error('Failed to generate comprehension. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Load from history ──────────────────────────────────────────────────────
  const handleLoadHistory = async (id: string) => {
    try {
      const res = await api.get(`/comprehension/${id}`)
      const c: Comprehension = res.data.comprehension
      setComp(c)
      setAnswers({})
      setResult(c.completed && c.answers ? {
        score: c.score!,
        percentage: c.percentage!,
        feedback: c.feedback!,
        answers: c.answers,
      } : null)
      setShowTranslation(false)
      setRevealAll(false)
      setTimer(0)
      setTimerActive(false)
      setView(c.completed ? 'results' : 'reading')
    } catch {
      toast.error('Failed to load comprehension')
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!comp) return
    const unanswered = comp.questions.filter(q => !answers[q.number])
    if (unanswered.length > 0) {
      toast.warn(`Please answer all questions (${unanswered.length} remaining)`)
      return
    }
    setSubmitting(true)
    setTimerActive(false)
    try {
      const payload = comp.questions.map(q => ({ questionNumber: q.number, given: answers[q.number] || '' }))
      const res = await api.post(`/comprehension/${comp._id}/submit`, { answers: payload })
      setResult(res.data)
      setView('results')
    } catch {
      toast.error('Failed to submit answers')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/comprehension/${id}`)
      setHistory(prev => prev.filter(h => h._id !== id))
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const levelCfg  = LEVELS.find(l => l.key === level)!
  const answeredCount = comp ? comp.questions.filter(q => answers[q.number]).length : 0

  // ── SETUP VIEW ────────────────────────────────────────────────────────────
  if (view === 'setup') return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-gold flex items-center gap-2">
            <BookOpen size={22}/> Reading Comprehension
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Generate a German passage and answer exam-style questions
          </p>
        </div>
        <button onClick={() => setView('history')}
          className="btn-ghost px-3 py-2 flex items-center gap-2 text-sm">
          <History size={15}/> History
        </button>
      </div>

      {/* Level */}
      <div className="card space-y-3">
        <p className="section-label">CEFR Level</p>
        <div className="grid grid-cols-5 gap-2">
          {LEVELS.map(l => (
            <button key={l.key} onClick={() => setLevel(l.key)}
              className={`flex flex-col items-center py-3 rounded-xl border text-xs transition-all
                ${level === l.key ? `${l.bg} ${l.color}` : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15'}`}>
              <span className="text-lg font-display font-bold">{l.key}</span>
              <span className="opacity-60 mt-0.5 text-center leading-tight hidden sm:block">{l.desc.split(' · ')[0]}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600">{levelCfg.desc}</p>
      </div>

      {/* Genre */}
      <div className="card space-y-3">
        <p className="section-label">Text Type</p>
        <div className="grid grid-cols-3 gap-2">
          {GENRES.map(g => (
            <button key={g.key} onClick={() => setGenre(g.key)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all
                ${genre === g.key
                  ? 'bg-gold/10 border-gold/40 text-gold'
                  : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15 hover:text-gray-200'}`}>
              <span>{g.emoji}</span> {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic */}
      <div className="card space-y-3">
        <p className="section-label">Topic</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map(t => (
            <button key={t} onClick={() => { setTopic(t); setCustomTopic('') }}
              className={`px-3 py-1.5 rounded-xl border text-xs transition-all capitalize
                ${topic === t && !customTopic
                  ? 'bg-gold/10 border-gold/40 text-gold'
                  : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15 hover:text-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>
        <input
          value={customTopic} onChange={e => setCustomTopic(e.target.value)}
          placeholder="Or type a custom topic…"
          className="input text-sm w-full"
        />
      </div>

      <button onClick={handleGenerate} disabled={generating} className="btn-primary w-full justify-center py-3 text-base">
        {generating
          ? <><span className="spinner"/> Generating comprehension…</>
          : <><Wand2 size={17}/> Generate Comprehension Test</>}
      </button>
    </div>
  )

  // ── HISTORY VIEW ──────────────────────────────────────────────────────────
  if (view === 'history') return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('setup')} className="btn-ghost p-2">
          <ChevronLeft size={18}/>
        </button>
        <h2 className="font-display text-xl text-gray-100">Past Comprehensions</h2>
      </div>

      {historyLoading ? (
        <div className="card py-12 text-center"><div className="spinner w-6 h-6 mx-auto"/></div>
      ) : history.length === 0 ? (
        <div className="card py-16 text-center">
          <FileText size={36} className="text-gray-700 mx-auto mb-3"/>
          <p className="text-gray-500">No comprehensions yet. Generate your first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(h => {
            const genreInfo = GENRES.find(g => g.key === h.genre)
            const lvl = LEVELS.find(l => l.key === h.level)
            return (
              <div key={h._id} className="card flex items-center gap-4 hover:border-white/15 transition-all">
                <div className="text-2xl">{genreInfo?.emoji || '📖'}</div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadHistory(h._id)}>
                  <p className="text-sm font-medium text-gray-200 truncate">{h.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className={`font-medium ${lvl?.color}`}>{h.level}</span>
                    {' · '}{h.topic}{' · '}
                    {new Date(h.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                {h.completed && h.percentage != null ? (
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-display font-bold ${SCORE_COLOR(h.percentage)}`}>
                      {h.score}/{h.totalMarks}
                    </p>
                    <p className={`text-xs ${SCORE_COLOR(h.percentage)}`}>{h.percentage}%</p>
                  </div>
                ) : (
                  <span className="text-xs text-gray-600 italic shrink-0">Not submitted</span>
                )}
                <button onClick={() => handleDelete(h._id)}
                  className="text-gray-700 hover:text-red-400 transition-colors p-1 shrink-0">
                  <Trash2 size={14}/>
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button onClick={() => setView('setup')} className="btn-secondary w-full justify-center">
        <Wand2 size={15}/> Generate New Comprehension
      </button>
    </div>
  )

  if (!comp) return null

  // ── READING VIEW ──────────────────────────────────────────────────────────
  if (view === 'reading') return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setView('setup')} className="btn-ghost p-2">
          <ChevronLeft size={18}/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${levelCfg.bg} ${levelCfg.color}`}>
              {comp.level}
            </span>
            <span className="text-xs text-gray-600 capitalize">{comp.genre} · {comp.topic}</span>
          </div>
          <h1 className="font-display text-xl text-gray-100 mt-0.5 truncate">{comp.title}</h1>
          {comp.titleEn && <p className="text-xs text-gray-500 italic">{comp.titleEn}</p>}
        </div>
        <button onClick={() => speakDE(comp.passage)}
          className="btn-ghost p-2 text-gray-500 hover:text-gold shrink-0" title="Listen">
          <Volume2 size={18}/>
        </button>
      </div>

      {/* Passage */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="section-label">Read the passage</p>
          <button onClick={() => setShowTranslation(t => !t)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gold transition-colors">
            {showTranslation ? <EyeOff size={13}/> : <Eye size={13}/>}
            {showTranslation ? 'Hide' : 'Show'} translation
          </button>
        </div>
        <div className="prose prose-sm max-w-none">
          {comp.passage.split('\n\n').map((para, i) => (
            <p key={i} className="text-gray-200 leading-relaxed text-sm sm:text-base mb-3 last:mb-0">
              {para}
            </p>
          ))}
        </div>
        {showTranslation && comp.passageEn && (
          <div className="pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">English Translation</p>
            {comp.passageEn.split('\n\n').map((para, i) => (
              <p key={i} className="text-gray-500 text-sm leading-relaxed mb-2 last:mb-0 italic">
                {para}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Vocabulary */}
      {comp.vocabulary.length > 0 && (
        <div className="card">
          <p className="section-label mb-3">Key Vocabulary</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {comp.vocabulary.map((v, i) => (
              <button key={i} onClick={() => speakDE(v.de)}
                className="flex flex-col items-start px-3 py-2 bg-ink-800 border border-white/[0.05] rounded-xl text-left hover:border-gold/20 transition-colors group">
                <div className="flex items-center gap-1.5 w-full">
                  <span className="text-sm font-medium text-gray-200 truncate">{v.de}</span>
                  <Volume2 size={10} className="text-gray-700 group-hover:text-gold shrink-0 transition-colors"/>
                </div>
                {v.ipa && <span className="text-[10px] text-violet-400 font-mono">{v.ipa}</span>}
                <span className="text-xs text-gray-500 mt-0.5 truncate w-full">{v.en}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => { setView('questions'); setTimerActive(true) }}
        className="btn-primary w-full justify-center py-3 text-base">
        Start Questions ({comp.questions.length} questions · {comp.totalMarks} marks)
        <ChevronRight size={17}/>
      </button>
    </div>
  )

  // ── QUESTIONS VIEW ────────────────────────────────────────────────────────
  if (view === 'questions') return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setView('reading')} className="btn-ghost p-2">
          <ChevronLeft size={18}/>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg text-gray-100 truncate">{comp.title}</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className={`text-xs font-medium ${levelCfg.color}`}>{comp.level}</span>
            <span className="text-xs text-gray-600">{comp.questions.length} questions · {comp.totalMarks} marks</span>
          </div>
        </div>
        {/* Timer */}
        <div className="flex items-center gap-1.5 text-sm font-mono text-gray-500 shrink-0">
          <Clock size={14}/> {formatTime(timer)}
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-ink-700 rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all duration-500"
            style={{ width: `${(answeredCount / comp.questions.length) * 100}%` }}/>
        </div>
        <span className="text-xs text-gray-600 shrink-0 font-mono">{answeredCount}/{comp.questions.length}</span>
      </div>

      {/* Re-read passage (collapsed) */}
      <details className="card cursor-pointer">
        <summary className="flex items-center gap-2 text-sm text-gray-400 select-none">
          <FileText size={14}/> Re-read the passage (click to expand)
        </summary>
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
          {comp.passage.split('\n\n').map((para, i) => (
            <p key={i} className="text-gray-300 text-sm leading-relaxed">{para}</p>
          ))}
        </div>
      </details>

      {/* Questions */}
      <div className="space-y-4">
        {comp.questions.map((q, i) => (
          <QuestionCard
            key={q.number}
            q={q} index={i}
            answer={answers[q.number] || ''}
            onChange={val => setAnswers(prev => ({ ...prev, [q.number]: val }))}
            submitted={false}
            revealed={revealAll}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={() => setRevealAll(r => !r)}
          className="btn-secondary flex-1 justify-center text-sm">
          {revealAll ? <EyeOff size={14}/> : <Eye size={14}/>}
          {revealAll ? 'Hide hints' : 'Show hints'}
        </button>
        <button onClick={handleSubmit} disabled={submitting || answeredCount < comp.questions.length}
          className="btn-primary flex-1 justify-center disabled:opacity-50 text-sm">
          {submitting
            ? <><span className="spinner"/> Grading…</>
            : <><Trophy size={15}/> Submit Answers</>}
        </button>
      </div>
      {answeredCount < comp.questions.length && (
        <p className="text-xs text-center text-gray-600">
          {comp.questions.length - answeredCount} question{comp.questions.length - answeredCount !== 1 ? 's' : ''} remaining
        </p>
      )}
    </div>
  )

  // ── RESULTS VIEW ──────────────────────────────────────────────────────────
  if (view === 'results' && result) return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Score card */}
      <div className="card text-center py-8 space-y-3">
        <Trophy size={40} className={`mx-auto ${SCORE_COLOR(result.percentage)}`}/>
        <div>
          <p className={`font-display text-5xl font-bold ${SCORE_COLOR(result.percentage)}`}>
            {result.score}/{comp.totalMarks}
          </p>
          <p className={`text-lg font-medium mt-1 ${SCORE_COLOR(result.percentage)}`}>
            {result.percentage}% · {SCORE_LABEL(result.percentage)}
          </p>
        </div>
        <div className="w-48 h-3 bg-ink-700 rounded-full overflow-hidden mx-auto">
          <div className={`h-full rounded-full transition-all duration-700 ${
            result.percentage >= 80 ? 'bg-green-400' : result.percentage >= 60 ? 'bg-gold' : result.percentage >= 40 ? 'bg-orange-400' : 'bg-red-400'
          }`} style={{ width: `${result.percentage}%` }}/>
        </div>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle2 size={13}/> {result.answers.filter(a => a.correct).length} correct
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <XCircle size={13}/> {result.answers.filter(a => !a.correct).length} wrong
          </span>
          <span className="flex items-center gap-1">
            <Clock size={13}/> {formatTime(timer)}
          </span>
        </div>
        <p className="text-sm text-gray-400 max-w-sm mx-auto">{result.feedback}</p>
      </div>

      {/* Question review */}
      <div className="space-y-4">
        <p className="section-label">Question Review</p>
        {comp.questions.map((q, i) => {
          const answerRecord = result.answers.find(a => a.questionNumber === q.number)
          return (
            <QuestionCard
              key={q.number}
              q={q} index={i}
              answer={answerRecord?.given || ''}
              onChange={() => {}}
              submitted={true}
              revealed={true}
            />
          )
        })}
      </div>

      {/* Full passage again for reference */}
      <details className="card">
        <summary className="flex items-center gap-2 text-sm text-gray-400 select-none cursor-pointer">
          <FileText size={14}/> Review the passage
        </summary>
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
          {comp.passage.split('\n\n').map((para, i) => (
            <p key={i} className="text-gray-300 text-sm leading-relaxed">{para}</p>
          ))}
          {comp.passageEn && (
            <div className="pt-3 border-t border-white/[0.06]">
              {comp.passageEn.split('\n\n').map((para, i) => (
                <p key={i} className="text-gray-500 text-sm leading-relaxed italic mb-2">{para}</p>
              ))}
            </div>
          )}
        </div>
      </details>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => { setComp(null); setResult(null); setView('setup') }}
          className="btn-secondary flex-1 justify-center">
          <RotateCcw size={15}/> New Test
        </button>
        <button onClick={() => setView('history')} className="btn-ghost flex-1 justify-center">
          <History size={15}/> History
        </button>
      </div>
    </div>
  )

  return null
}
