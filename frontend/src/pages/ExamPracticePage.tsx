import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import {
  Trophy, Headphones, FileText, PenLine, Mic,
  Sparkles, CheckCircle2, XCircle, RotateCcw,
  Volume2, ChevronRight, BarChart3, Clock,
} from 'lucide-react'
import api from '../utils/api'
import { useAppSelector } from '../hooks/redux'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'A1' | 'A2'
type Skill = 'horen' | 'lesen' | 'schreiben' | 'sprechen'

interface ExamQuestion {
  skill: Skill
  level: Level
  topic: string
  instruction: string
  // Lesen / Hören
  text?: string
  transcript?: string
  speakers?: string
  question?: string
  options?: string[]
  correctOption?: string
  explanation?: string
  // Schreiben / Sprechen
  prompt?: string
  task?: string
  type?: string
  keyPoints?: string[]
  promptQuestions?: string[]
  usefulPhrases?: string[]
  sampleAnswer?: string
  sampleAnswerTranslation?: string
  gradingCriteria?: string
}

interface GradeResult {
  feedback: string
  score: number
}

interface HistoryItem {
  _id: string
  level: string
  skill: string
  topic: string
  score: number
  createdAt: string
}

interface AvgItem {
  skill: string
  count: number
  avg: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SKILLS: { key: Skill; label: string; de: string; icon: React.ReactNode; color: string; bg: string; desc: string }[] = [
  { key: 'horen',     label: 'Hören',     de: 'Listening', icon: <Headphones size={20}/>, color: 'text-gold',        bg: 'bg-gold/10 border-gold/30',           desc: 'Understand spoken German' },
  { key: 'lesen',     label: 'Lesen',     de: 'Reading',   icon: <FileText size={20}/>,   color: 'text-teal-soft',   bg: 'bg-teal-muted border-teal-soft/30',    desc: 'Understand written texts' },
  { key: 'schreiben', label: 'Schreiben', de: 'Writing',   icon: <PenLine size={20}/>,    color: 'text-violet-soft', bg: 'bg-violet-muted border-violet-soft/30',desc: 'Write messages & replies' },
  { key: 'sprechen',  label: 'Sprechen',  de: 'Speaking',  icon: <Mic size={20}/>,        color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-400/30',desc: 'Speak on familiar topics' },
]

const TOPICS_BY_LEVEL: Record<Level, string[]> = {
  A1: ['personal information', 'daily life', 'food and shopping', 'travel and directions', 'health and body'],
  A2: ['work and career', 'leisure and hobbies', 'shopping and services', 'housing', 'travel and transport', 'health and wellbeing'],
}

const SKILL_LABELS: Record<Skill, string> = {
  horen: 'Hören', lesen: 'Lesen', schreiben: 'Schreiben', sprechen: 'Sprechen',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExamPracticePage() {
  const user = useAppSelector(s => s.auth.user)

  const [level, setLevel]         = useState<Level>('A1')
  const [skill, setSkill]         = useState<Skill>('lesen')
  const [topic, setTopic]         = useState(TOPICS_BY_LEVEL.A1[0])
  const [question, setQuestion]   = useState<ExamQuestion | null>(null)
  const [answer, setAnswer]       = useState('')
  const [selected, setSelected]   = useState<string>('')
  const [result, setResult]       = useState<GradeResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [grading, setGrading]     = useState(false)
  const [showSample, setShowSample] = useState(false)
  const [activeTab, setActiveTab] = useState<'practice' | 'stats'>('practice')
  const [history, setHistory]     = useState<HistoryItem[]>([])
  const [avgBySkill, setAvgBySkill] = useState<AvgItem[]>([])

  useEffect(() => {
    setTopic(TOPICS_BY_LEVEL[level][0])
    setQuestion(null); setResult(null); setAnswer(''); setSelected('')
  }, [level])

  useEffect(() => {
    if (activeTab === 'stats') loadStats()
  }, [activeTab, level])

  const loadStats = async () => {
    try {
      const res = await api.get(`/exam/history?level=${level}`)
      setHistory(res.data.history || [])
      setAvgBySkill(res.data.avgBySkill || [])
    } catch { /* silent */ }
  }

  const handleGenerate = async () => {
    setLoading(true); setQuestion(null); setResult(null)
    setAnswer(''); setSelected(''); setShowSample(false)
    try {
      const res = await api.post('/exam/generate', { level, skill, topic })
      setQuestion(res.data.question)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e?.response?.data?.message || 'Failed to generate question')
    }
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!question) return
    const ans = (skill === 'lesen' || skill === 'horen') ? selected : answer
    if (!ans?.trim()) return toast.error('Please answer the question first')

    setGrading(true)
    try {
      const res = await api.post('/exam/grade', {
        level, skill,
        topic: question.topic,
        question: question.question || question.prompt || question.task || question.instruction,
        userAnswer: ans,
      })
      setResult(res.data)
    } catch {
      toast.error('Grading failed — please try again')
    }
    setGrading(false)
  }

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'; u.rate = 0.82
    speechSynthesis.speak(u)
  }

  const scoreColor = (s: number) =>
    s >= 80 ? 'text-teal-soft' : s >= 60 ? 'text-gold' : s >= 40 ? 'text-orange-400' : 'text-red-400'

  const scoreLabel = (s: number) =>
    s >= 80 ? '✅ Pass' : s >= 60 ? '🟡 Near Pass' : '❌ Needs Work'

  // ── Render question body ────────────────────────────────────────────────────

  const renderQuestion = () => {
    if (!question) return null

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Instruction */}
        <div className="flex gap-2.5 p-3 bg-gold/5 border border-gold/15 rounded-xl">
          <Trophy size={14} className="text-gold shrink-0 mt-0.5"/>
          <p className="text-sm text-gray-300 leading-relaxed">{question.instruction}</p>
        </div>

        {/* HÖREN transcript */}
        {skill === 'horen' && question.transcript && (
          <div className="card">
            {question.speakers && (
              <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">{question.speakers}</p>
            )}
            <div className="bg-ink-800 rounded-xl p-4 text-sm text-gray-200 leading-relaxed font-mono whitespace-pre-wrap">
              {question.transcript}
            </div>
            <button onClick={() => speak(question.transcript!)} className="btn-ghost text-xs gap-1.5 mt-3">
              <Volume2 size={13}/> Listen to transcript
            </button>
          </div>
        )}

        {/* LESEN text */}
        {skill === 'lesen' && question.text && (
          <div className="card">
            <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">📖 Text</p>
            <p className="text-sm text-gray-200 leading-relaxed">{question.text}</p>
            <button onClick={() => speak(question.text!)} className="btn-ghost text-xs gap-1.5 mt-3">
              <Volume2 size={13}/> Hear text
            </button>
          </div>
        )}

        {/* Multiple choice (Lesen / Hören) */}
        {(skill === 'lesen' || skill === 'horen') && question.question && (
          <div className="card">
            <p className="font-medium text-gray-100 text-sm mb-3">{question.question}</p>
            <div className="space-y-2">
              {(question.options || []).map(opt => (
                <button key={opt}
                  onClick={() => !result && setSelected(opt[0])}
                  className={`w-full text-left p-3 rounded-xl border text-sm transition-all
                    ${selected === opt[0]
                      ? result
                        ? selected === question.correctOption
                          ? 'bg-teal-muted border-teal-soft/40 text-teal-soft'
                          : 'bg-red-500/10 border-red-400/40 text-red-400'
                        : 'bg-gold/10 border-gold/40 text-gold'
                      : result && opt[0] === question.correctOption
                      ? 'bg-teal-muted border-teal-soft/40 text-teal-soft'
                      : 'bg-ink-800 border-white/[0.06] text-gray-300 hover:border-white/15'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SCHREIBEN task */}
        {skill === 'schreiben' && (
          <div className="space-y-3">
            {question.prompt && (
              <div className="card">
                <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">📝 Your Task</p>
                <p className="text-sm text-gray-200 leading-relaxed">{question.prompt}</p>
                {question.keyPoints && question.keyPoints.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-[10px] text-gray-500 mb-1.5">You must mention:</p>
                    <ul className="space-y-1">
                      {question.keyPoints.map((p, i) => (
                        <li key={i} className="text-xs text-gold flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-gold/10 flex items-center justify-center text-[9px]">{i+1}</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="section-label">Your Answer (auf Deutsch)</label>
              <textarea className="textarea min-h-[140px] text-sm" disabled={!!result}
                placeholder="Schreibe hier auf Deutsch…"
                value={answer} onChange={e => setAnswer(e.target.value)}/>
              <p className="text-[10px] text-gray-600 mt-1">{answer.trim().split(/\s+/).filter(Boolean).length} words</p>
            </div>
          </div>
        )}

        {/* SPRECHEN task */}
        {skill === 'sprechen' && (
          <div className="space-y-3">
            {question.task && (
              <div className="card">
                <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">
                  🗣️ Speaking Task · {question.type}
                </p>
                <p className="text-sm text-gray-200 leading-relaxed font-medium">{question.task}</p>
                {question.promptQuestions && question.promptQuestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-[10px] text-gray-500 mb-1.5">Address these points:</p>
                    <ul className="space-y-1">
                      {question.promptQuestions.map((q, i) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                          <ChevronRight size={10} className="text-gold shrink-0 mt-0.5"/>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {question.usefulPhrases && question.usefulPhrases.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-[10px] text-gray-500 mb-1.5">Useful phrases:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {question.usefulPhrases.map((p, i) => (
                        <button key={i} onClick={() => speak(p)}
                          className="text-[11px] px-2.5 py-1 bg-ink-800 border border-white/[0.06] rounded-lg text-gold hover:bg-gold/10 transition-all flex items-center gap-1">
                          <Volume2 size={9}/> {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="section-label">Write your spoken answer (auf Deutsch)</label>
              <textarea className="textarea min-h-[120px] text-sm" disabled={!!result}
                placeholder="Write what you would say in German…"
                value={answer} onChange={e => setAnswer(e.target.value)}/>
            </div>
          </div>
        )}

        {/* Submit button */}
        {!result && (
          <button onClick={handleSubmit} disabled={grading || (!selected && !answer.trim())}
            className="btn-primary w-full justify-center" >
            {grading
              ? <><span className="spinner"/> Grading…</>
              : <><ChevronRight size={15}/> Submit Answer</>}
          </button>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3 animate-slide-up">
            {/* Score card */}
            <div className={`rounded-2xl border p-4 ${result.score >= 60 ? 'bg-teal-muted border-teal-soft/30' : 'bg-red-500/10 border-red-400/30'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {result.score >= 60
                    ? <CheckCircle2 size={20} className="text-teal-soft"/>
                    : <XCircle size={20} className="text-red-400"/>}
                  <p className={`font-medium ${scoreColor(result.score)}`}>{scoreLabel(result.score)}</p>
                </div>
                <p className={`font-display text-3xl ${scoreColor(result.score)}`}>
                  {result.score}<span className="text-sm text-gray-500">/100</span>
                </p>
              </div>
              <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700
                  ${result.score >= 80 ? 'bg-teal-soft' : result.score >= 60 ? 'bg-gold' : result.score >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                  style={{ width: `${result.score}%` }}/>
              </div>
            </div>

            {/* Multiple choice explanation */}
            {(skill === 'lesen' || skill === 'horen') && question?.explanation && (
              <div className="flex gap-2.5 p-3 bg-ink-800 border border-white/[0.07] rounded-xl">
                <span className="text-base shrink-0">💡</span>
                <p className="text-xs text-gray-300 leading-relaxed">{question.explanation}</p>
              </div>
            )}

            {/* Written feedback */}
            {(skill === 'schreiben' || skill === 'sprechen') && (
              <div className="card">
                <p className="section-label flex items-center gap-1.5">
                  <Trophy size={12}/> Examiner Feedback
                </p>
                <div className="bg-ink-800 rounded-xl p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {result.feedback}
                </div>
              </div>
            )}

            {/* Sample answer toggle */}
            {question?.sampleAnswer && (
              <div className="card">
                <button onClick={() => setShowSample(v => !v)}
                  className="w-full flex items-center justify-between text-left">
                  <span className="text-sm text-gray-300 font-medium">📝 Model Answer</span>
                  <span className="text-xs text-gray-500">{showSample ? 'Hide' : 'Show'}</span>
                </button>
                {showSample && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    <div className="bg-ink-800 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">German:</p>
                      <p className="text-sm text-gray-200 leading-relaxed">{question.sampleAnswer}</p>
                      <button onClick={() => speak(question.sampleAnswer!)} className="btn-ghost text-xs gap-1 mt-2">
                        <Volume2 size={11}/> Hear model answer
                      </button>
                    </div>
                    {question.sampleAnswerTranslation && (
                      <div className="bg-ink-800 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">English translation:</p>
                        <p className="text-sm text-gray-400 italic">{question.sampleAnswerTranslation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Try again */}
            <div className="flex gap-2">
              <button onClick={handleGenerate} className="btn-primary flex-1 justify-center">
                <Sparkles size={14}/> New Question
              </button>
              <button onClick={() => { setQuestion(null); setResult(null); setAnswer(''); setSelected('') }}
                className="btn-secondary px-3">
                <RotateCcw size={14}/>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Stats tab ───────────────────────────────────────────────────────────────

  const renderStats = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SKILLS.map(s => {
          const stat = avgBySkill.find(a => a.skill === s.key)
          return (
            <div key={s.key} className={`card-sm border ${s.bg}`}>
              <div className={s.color}>{s.icon}</div>
              <p className={`font-display text-2xl mt-2 ${s.color}`}>{stat?.avg || 0}</p>
              <p className="text-[10px] text-gray-500">{s.label} avg</p>
              <p className="text-[9px] text-gray-700">{stat?.count || 0} attempts</p>
            </div>
          )
        })}
      </div>

      {history.length === 0 ? (
        <div className="card text-center py-12">
          <BarChart3 size={36} className="text-gray-700 mx-auto mb-3"/>
          <p className="text-gray-500 text-sm">No practice history yet</p>
          <p className="text-gray-600 text-xs mt-1">Complete some exercises to see your stats</p>
        </div>
      ) : (
        <div className="card">
          <p className="section-label">Recent Practice</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {history.map(h => {
              const skillInfo = SKILLS.find(s => s.key === h.skill)
              return (
                <div key={h._id} className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0">
                  <div className={skillInfo?.color}>{skillInfo?.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 capitalize truncate">{h.topic}</p>
                    <p className="text-[10px] text-gray-600">{SKILL_LABELS[h.skill as Skill]} · {h.level}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${scoreColor(h.score)}`}>{h.score}/100</p>
                    <p className="text-[9px] text-gray-600">
                      {new Date(h.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={20} className="text-gold"/>
          <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Exam Practice</h1>
        </div>
        <p className="text-gray-500 text-sm">Goethe-Zertifikat style questions for all four exam skills</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-ink-800 p-1 gap-1 mb-5">
        {([['practice', '⚡ Practice'], ['stats', '📊 My Stats']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all
              ${activeTab === k ? 'bg-gold text-ink-950' : 'text-gray-400 hover:text-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {activeTab === 'practice' && (
        <>
          {/* Level + skill selectors */}
          <div className="card mb-4 space-y-4">
            {/* Level */}
            <div>
              <label className="section-label">Exam Level</label>
              <div className="flex gap-2">
                {(['A1', 'A2'] as Level[]).map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`flex-1 py-2.5 rounded-xl border font-display text-lg transition-all
                      ${level === l
                        ? 'bg-gold/10 border-gold/40 text-gold'
                        : 'bg-ink-800 border-white/[0.07] text-gray-400 hover:text-gray-200'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Skill */}
            <div>
              <label className="section-label">Exam Skill</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SKILLS.map(s => (
                  <button key={s.key} onClick={() => setSkill(s.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all
                      ${skill === s.key ? s.bg + ' ' + s.color : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15'}`}>
                    <div className={skill === s.key ? s.color : 'text-gray-500'}>{s.icon}</div>
                    {s.label}
                    <span className="text-[9px] opacity-60">{s.de}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="section-label">Topic</label>
              <div className="flex flex-wrap gap-1.5">
                {TOPICS_BY_LEVEL[level].map(t => (
                  <button key={t} onClick={() => setTopic(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all capitalize
                      ${topic === t
                        ? 'bg-gold/10 border-gold/30 text-gold'
                        : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleGenerate} className="btn-primary w-full justify-center" disabled={loading}>
              {loading
                ? <><span className="spinner"/> Generating question…</>
                : <><Sparkles size={15}/> Generate {level} {SKILLS.find(s=>s.key===skill)?.label} Question</>}
            </button>
          </div>

          {/* Question area */}
          {loading && (
            <div className="card text-center py-12">
              <div className="spinner w-8 h-8 mx-auto mb-3"/>
              <p className="text-gray-500 text-sm">Creating your exam question…</p>
            </div>
          )}
          {!loading && renderQuestion()}
          {!loading && !question && (
            <div className="card text-center py-12 border-dashed border-2 border-white/[0.05]">
              <Trophy size={40} className="text-gray-700 mx-auto mb-3"/>
              <p className="text-gray-500 text-sm font-medium">Ready to practise?</p>
              <p className="text-gray-600 text-xs mt-1">
                Select your level, skill and topic, then click Generate
              </p>
              <div className="flex justify-center gap-2 mt-4 text-xs text-gray-700 flex-wrap">
                {SKILLS.map(s => (
                  <span key={s.key} className={`px-3 py-1.5 rounded-full border ${s.bg} ${s.color}`}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'stats' && renderStats()}
    </div>
  )
}
