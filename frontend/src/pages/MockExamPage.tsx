import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import {
  Timer, Play, CheckCircle2, XCircle, ChevronLeft,
  Trophy, RotateCcw, History, FileText, Mic, PenLine,
  Headphones, BookOpen, AlertCircle, Trash2,
} from 'lucide-react'
import api from '../utils/api'

type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
type Section = 'reading' | 'listening' | 'writing'

interface Question { number: number; question: string; options: string[]; correctAnswer: string; explanation: string }
interface ExamSections {
  reading:  { passage: string; questions: Question[] }
  listening:{ transcript: string; questions: Question[] }
  writing:  { task: string; modelAnswer: string; markingCriteria: string[] }
}
interface Exam { _id: string; level: Level; sections: ExamSections; completed: boolean; results?: any; totalScore?: number; totalPercent?: number; passed?: boolean }

const LEVELS: { key: Level; color: string; bg: string; time: string }[] = [
  { key: 'A1', color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-400/30',   time: '45 min' },
  { key: 'A2', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-400/30',   time: '60 min' },
  { key: 'B1', color: 'text-gold',       bg: 'bg-gold/10 border-gold/30',           time: '75 min' },
  { key: 'B2', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-400/30', time: '90 min' },
  { key: 'C1', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-400/30',     time: '120 min' },
]
const TIME_LIMITS: Record<Level, number> = { A1: 2700, A2: 3600, B1: 4500, B2: 5400, C1: 7200 }
const SCORE_COLOR = (p: number) => p >= 80 ? 'text-green-400' : p >= 60 ? 'text-gold' : 'text-red-400'

function fmt(s: number) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }

function speakDE(text: string) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = 0.80; speechSynthesis.speak(u)
}

type View = 'setup' | 'exam' | 'results' | 'history'

export default function MockExamPage() {
  const [view, setView]           = useState<View>('setup')
  const [level, setLevel]         = useState<Level>('B1')
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exam, setExam]           = useState<Exam | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('reading')
  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [writingAnswer, setWritingAnswer] = useState('')
  const [result, setResult]       = useState<any>(null)
  const [history, setHistory]     = useState<any[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [timer, setTimer]         = useState(0)
  const [timeLimit, setTimeLimit] = useState(0)
  const timerRef = useRef<number|null>(null)

  useEffect(() => {
    if (view === 'exam' && exam && !exam.completed) {
      timerRef.current = window.setInterval(() => {
        setTimer(t => {
          if (t >= timeLimit - 1) { clearInterval(timerRef.current!); handleSubmit(); return t }
          return t + 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [view, exam])

  useEffect(() => {
    if (view !== 'history') return
    setHistLoading(true)
    api.get('/mock-exam/history').then(r => setHistory(r.data.history)).catch(() => toast.error('Failed to load history')).finally(() => setHistLoading(false))
  }, [view])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await api.post('/mock-exam/generate', { level })
      setExam(res.data.exam)
      setAnswers({}); setWritingAnswer(''); setResult(null)
      setTimer(0); setTimeLimit(TIME_LIMITS[level])
      setActiveSection('reading')
      setView('exam')
    } catch { toast.error('Failed to generate exam. Please try again.') }
    finally { setGenerating(false) }
  }

  const handleSubmit = async () => {
    if (!exam) return
    clearInterval(timerRef.current!)
    setSubmitting(true)
    try {
      const ansPayload = Object.entries(answers).map(([key, given]) => {
        const [section, num] = key.split('-')
        return { section, questionNumber: parseInt(num), given }
      })
      const res = await api.post(`/mock-exam/${exam._id}/submit`, { answers: ansPayload, writingAnswer, timeTaken: timer })
      setResult(res.data); setView('results')
    } catch { toast.error('Failed to submit exam') }
    finally { setSubmitting(false) }
  }

  const setAnswer = (section: string, num: number, val: string) =>
    setAnswers(prev => ({ ...prev, [`${section}-${num}`]: val }))

  const getAnswer = (section: string, num: number) => answers[`${section}-${num}`] || ''

  const lvlCfg = LEVELS.find(l => l.key === level)!
  const timeLeft = Math.max(0, timeLimit - timer)
  const isUrgent = timeLeft < 300 && timeLeft > 0

  // ── SETUP ─────────────────────────────────────────────────────────────────
  if (view === 'setup') return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-gold flex items-center gap-2"><Timer size={22}/> Mock Exam</h1>
          <p className="text-gray-500 text-sm mt-0.5">Full Goethe-style timed paper — Reading, Listening & Writing</p>
        </div>
        <button onClick={() => setView('history')} className="btn-ghost px-3 py-2 flex items-center gap-2 text-sm"><History size={15}/> History</button>
      </div>

      <div className="card space-y-3">
        <p className="section-label">Select CEFR Level</p>
        <div className="grid grid-cols-5 gap-2">
          {LEVELS.map(l => (
            <button key={l.key} onClick={() => setLevel(l.key)}
              className={`flex flex-col items-center py-3 rounded-xl border text-xs transition-all
                ${level === l.key ? `${l.bg} ${l.color}` : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15'}`}>
              <span className="text-lg font-display font-bold">{l.key}</span>
              <span className="opacity-60 mt-0.5">{l.time}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-2 text-sm">
        <p className="section-label">What to expect</p>
        <div className="space-y-2 text-gray-400">
          <div className="flex gap-3"><BookOpen size={15} className="text-blue-400 shrink-0 mt-0.5"/><span><span className="text-gray-200">Reading</span> — a German passage + 5 multiple choice questions (10 marks)</span></div>
          <div className="flex gap-3"><Headphones size={15} className="text-pink-400 shrink-0 mt-0.5"/><span><span className="text-gray-200">Listening</span> — a German transcript + 4 True/False questions (10 marks)</span></div>
          <div className="flex gap-3"><PenLine size={15} className="text-green-400 shrink-0 mt-0.5"/><span><span className="text-gray-200">Writing</span> — AI-marked task in German (10 marks). Pass mark: 60%</span></div>
        </div>
      </div>

      <button onClick={handleGenerate} disabled={generating} className="btn-primary w-full justify-center py-3 text-base">
        {generating ? <><span className="spinner"/> Generating paper…</> : <><Play size={17}/> Start Exam ({lvlCfg.time})</>}
      </button>
    </div>
  )

  // ── HISTORY ───────────────────────────────────────────────────────────────
  if (view === 'history') return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('setup')} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
        <h2 className="font-display text-xl text-gray-100">Past Mock Exams</h2>
      </div>
      {histLoading ? <div className="card py-12 text-center"><div className="spinner w-6 h-6 mx-auto"/></div>
      : history.length === 0 ? <div className="card py-12 text-center text-gray-500">No exams yet</div>
      : history.map(h => (
        <div key={h._id} className="card flex items-center gap-4">
          <span className={`text-xl font-display font-bold ${LEVELS.find(l=>l.key===h.level)?.color}`}>{h.level}</span>
          <div className="flex-1">
            <p className="text-sm text-gray-200">{new Date(h.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
            {h.completed && <p className={`text-xs ${SCORE_COLOR(h.totalPercent)}`}>{h.totalScore}/30 · {h.totalPercent}% · {h.passed ? '✓ Pass':'✗ Fail'}</p>}
          </div>
          {h.completed && <Trophy size={16} className={SCORE_COLOR(h.totalPercent)}/>}
          <button onClick={async () => { const r = await api.get(`/mock-exam/${h._id}`); setExam(r.data.exam); if(r.data.exam.results) { setResult(r.data.exam.results); setView('results') } else setView('exam') }} className="btn-ghost px-3 py-1 text-xs">Open</button>
          <button onClick={async () => { await api.delete(`/mock-exam/${h._id}`); setHistory(p=>p.filter(x=>x._id!==h._id)) }} className="text-gray-700 hover:text-red-400 p-1"><Trash2 size={14}/></button>
        </div>
      ))}
      <button onClick={() => setView('setup')} className="btn-secondary w-full justify-center"><Timer size={15}/> New Exam</button>
    </div>
  )

  if (!exam) return null

  // ── EXAM ──────────────────────────────────────────────────────────────────
  if (view === 'exam') {
    const sections: { key: Section; label: string; icon: any; color: string }[] = [
      { key: 'reading',  label: 'Reading',  icon: BookOpen,   color: 'text-blue-400' },
      { key: 'listening',label: 'Listening',icon: Headphones, color: 'text-pink-400' },
      { key: 'writing',  label: 'Writing',  icon: PenLine,    color: 'text-green-400' },
    ]
    const readingDone   = exam.sections.reading?.questions.every(q => getAnswer('reading',q.number))
    const listeningDone = exam.sections.listening?.questions.every(q => getAnswer('listening',q.number))
    const writingDone   = writingAnswer.trim().length > 0

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Timer bar */}
        <div className={`card flex items-center gap-4 ${isUrgent ? 'border-red-400/40 bg-red-500/5' : ''}`}>
          <Timer size={16} className={isUrgent ? 'text-red-400' : 'text-gray-500'}/>
          <div className="flex-1 h-1.5 bg-ink-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isUrgent ? 'bg-red-400' : 'bg-gold'}`}
              style={{ width: `${((timeLimit - timer) / timeLimit) * 100}%` }}/>
          </div>
          <span className={`font-mono text-sm font-bold ${isUrgent ? 'text-red-400' : 'text-gray-300'}`}>{fmt(timeLeft)}</span>
          <div className="flex gap-1">
            {[{k:'reading',done:readingDone},{k:'listening',done:listeningDone},{k:'writing',done:writingDone}].map(s => (
              <div key={s.k} className={`w-2 h-2 rounded-full ${s.done ? 'bg-green-400' : 'bg-gray-700'}`}/>
            ))}
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 p-1 bg-ink-800 rounded-xl border border-white/[0.07]">
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all
                ${activeSection === s.key ? 'bg-ink-700 text-white border border-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
              <s.icon size={13} className={activeSection === s.key ? s.color : ''}/>
              {s.label}
            </button>
          ))}
        </div>

        {/* READING */}
        {activeSection === 'reading' && (
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Reading Passage</p>
                <button onClick={() => speakDE(exam.sections.reading.passage)} className="btn-ghost p-1.5 text-gray-500 hover:text-gold"><Mic size={14}/></button>
              </div>
              {exam.sections.reading.passage.split('\n\n').map((p,i) => <p key={i} className="text-gray-200 text-sm leading-relaxed mb-2">{p}</p>)}
            </div>
            <p className="section-label">Questions (2 marks each)</p>
            {exam.sections.reading.questions.map((q,i) => (
              <div key={q.number} className="card space-y-3">
                <p className="text-sm text-gray-100 font-medium">{i+1}. {q.question}</p>
                <div className="grid gap-2">
                  {q.options.map(opt => {
                    const letter = opt.charAt(0)
                    const sel = getAnswer('reading', q.number) === letter
                    return (
                      <button key={opt} onClick={() => setAnswer('reading', q.number, letter)}
                        className={`flex gap-2 px-4 py-2.5 rounded-xl border text-sm text-left transition-all
                          ${sel ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-ink-800 border-white/[0.06] text-gray-300 hover:border-white/15'}`}>
                        <span className="font-bold">{letter})</span> {opt.slice(3)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LISTENING */}
        {activeSection === 'listening' && (
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Listening Transcript</p>
                <button onClick={() => speakDE(exam.sections.listening.transcript)} className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5 text-gold bg-gold/10 border border-gold/25 rounded-lg hover:bg-gold/20"><Headphones size={13}/> Play audio</button>
              </div>
              <details>
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">Show transcript (read this after listening)</summary>
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  {exam.sections.listening.transcript.split('\n\n').map((p,i) => <p key={i} className="text-gray-300 text-sm leading-relaxed mb-2">{p}</p>)}
                </div>
              </details>
            </div>
            <p className="section-label">True / False Questions (2.5 marks each)</p>
            {exam.sections.listening.questions.map((q,i) => (
              <div key={q.number} className="card space-y-3">
                <p className="text-sm text-gray-100 font-medium">{i+1}. {q.question}</p>
                <div className="flex gap-3">
                  {['True','False'].map(opt => {
                    const sel = getAnswer('listening', q.number) === opt
                    return (
                      <button key={opt} onClick={() => setAnswer('listening', q.number, opt)}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all
                          ${sel ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-ink-800 border-white/[0.06] text-gray-300 hover:border-white/15'}`}>
                        {opt === 'True' ? '✓ True' : '✗ False'}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WRITING */}
        {activeSection === 'writing' && (
          <div className="space-y-4">
            <div className="card">
              <p className="section-label mb-2">Writing Task (10 marks)</p>
              <p className="text-sm text-gray-200 leading-relaxed">{exam.sections.writing.task}</p>
              <div className="mt-3 space-y-1">
                {exam.sections.writing.markingCriteria.map((c,i) => (
                  <p key={i} className="text-xs text-gray-500 flex gap-2"><span className="text-gold">•</span>{c}</p>
                ))}
              </div>
            </div>
            <div className="card">
              <p className="section-label mb-2">Your Answer</p>
              <textarea
                value={writingAnswer} onChange={e => setWritingAnswer(e.target.value)}
                rows={10} placeholder="Schreiben Sie Ihre Antwort hier…"
                className="w-full bg-ink-900 border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gold/40 resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">{writingAnswer.split(/\s+/).filter(Boolean).length} words</p>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          {activeSection !== 'writing' && <button onClick={() => setActiveSection(activeSection === 'reading' ? 'listening' : 'writing')} className="btn-secondary flex-1 justify-center">Next Section →</button>}
          {activeSection === 'writing' && (
            <button onClick={handleSubmit} disabled={submitting}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {submitting ? <><span className="spinner"/> Grading…</> : <><Trophy size={15}/> Submit Exam</>}
            </button>
          )}
        </div>
        {(!readingDone || !listeningDone) && activeSection === 'writing' && (
          <p className="text-xs text-center text-orange-400 flex items-center justify-center gap-1.5">
            <AlertCircle size={12}/> Some questions are unanswered — you can still submit
          </p>
        )}
      </div>
    )
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (view === 'results' && result) {
    const pct = exam.totalPercent ?? Math.round(((result.reading?.score||0)+(result.listening?.score||0)+(result.writing?.score||0))/30*100)
    const total = (result.reading?.score||0)+(result.listening?.score||0)+(result.writing?.score||0)
    const passed = pct >= 60
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <div className="card text-center py-8 space-y-3">
          <Trophy size={40} className={`mx-auto ${passed ? 'text-gold' : 'text-red-400'}`}/>
          <p className={`font-display text-5xl font-bold ${passed ? 'text-gold' : 'text-red-400'}`}>{total}/30</p>
          <p className={`text-lg font-medium ${passed ? 'text-gold' : 'text-red-400'}`}>{pct}% · {passed ? '✓ Pass' : '✗ Fail'}</p>
          <div className="w-48 h-3 bg-ink-700 rounded-full overflow-hidden mx-auto">
            <div className={`h-full rounded-full ${passed ? 'bg-gold' : 'bg-red-400'}`} style={{width:`${pct}%`}}/>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm mt-2">
            {[
              {label:'Reading', score: result.reading?.score, out:10, icon: BookOpen},
              {label:'Listening',score:result.listening?.score, out:10, icon: Headphones},
              {label:'Writing', score: result.writing?.score,  out:10, icon: PenLine},
            ].map(s => (
              <div key={s.label} className="p-3 bg-ink-800 rounded-xl">
                <s.icon size={14} className="mx-auto text-gray-500 mb-1"/>
                <p className="font-display text-lg text-gray-100">{s.score}/{s.out}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Question review */}
        {['reading','listening'].map(sec => (
          <div key={sec} className="space-y-2">
            <p className="section-label capitalize">{sec} Review</p>
            {(result[sec]?.graded||[]).map((g: any) => {
              const q = exam.sections[sec as Section]?.questions?.find((q:any) => q.number === g.questionNumber)
              return q ? (
                <div key={g.questionNumber} className={`card border-2 ${g.correct ? 'border-green-400/25' : 'border-red-400/25'}`}>
                  <div className="flex gap-2 items-start">
                    {g.correct ? <CheckCircle2 size={15} className="text-green-400 shrink-0 mt-0.5"/> : <XCircle size={15} className="text-red-400 shrink-0 mt-0.5"/>}
                    <div className="flex-1 text-sm">
                      <p className="text-gray-200">{q.question}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Your answer: <span className={g.correct ? 'text-green-400' : 'text-red-400'}>{g.given || '—'}</span> · Correct: <span className="text-green-400">{q.correctAnswer}</span></p>
                      {!g.correct && q.explanation && <p className="text-xs text-gray-500 mt-1 italic">{q.explanation}</p>}
                    </div>
                  </div>
                </div>
              ) : null
            })}
          </div>
        ))}

        {/* Writing review */}
        {result.writing && (
          <div className="card space-y-3">
            <p className="section-label">Writing Feedback</p>
            <div className="p-3 bg-gold/5 border border-gold/15 rounded-xl">
              <p className="text-sm text-gray-300">{result.writing.feedback}</p>
            </div>
            <details>
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">Show model answer</summary>
              <div className="mt-2 p-3 bg-ink-800 rounded-xl text-sm text-gray-300 leading-relaxed">
                {exam.sections.writing.modelAnswer}
              </div>
            </details>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setExam(null); setResult(null); setView('setup') }} className="btn-secondary flex-1 justify-center"><RotateCcw size={15}/> New Exam</button>
          <button onClick={() => setView('history')} className="btn-ghost flex-1 justify-center"><History size={15}/> History</button>
        </div>
      </div>
    )
  }

  return null
}
