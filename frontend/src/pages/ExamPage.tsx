import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { generateExam, submitAnswers, clearSession } from '../store/slices/examSlice'
import {
  GraduationCap, ChevronRight, ChevronLeft, Clock, CheckCircle,
  XCircle, Mic, Square, Volume2, Send, RotateCcw, Trophy, AlertCircle,
} from 'lucide-react'

// ── Speech Recognition types (reuse from CoachPage pattern) ──────────────────
declare global {
  interface Window { SpeechRecognition?: any; webkitSpeechRecognition?: any }
}

const SECTION_LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary', grammar: 'Grammar', reading: 'Reading',
  writing: 'Writing', listening: 'Listening', speaking: 'Speaking', full: 'Full Mock Exam',
}

const Q_COUNT: Record<string, number> = {
  vocabulary: 12, grammar: 12, reading: 8, writing: 8, listening: 8, speaking: 6, full: 20,
}

export default function ExamPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { currentSession, generating, submitting } = useAppSelector(s => s.exam)

  const level   = searchParams.get('level') || 'A1'
  const section = searchParams.get('section') || 'vocabulary'

  const [phase, setPhase]         = useState<'intro' | 'exam' | 'results'>('intro')
  const [currentIdx, setIdx]      = useState(0)
  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [startTime, setStartTime] = useState(0)
  const [elapsed, setElapsed]     = useState(0)
  const [isRecording, setRecording] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Timer
  useEffect(() => {
    if (phase === 'exam') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const handleStart = async () => {
    dispatch(clearSession())
    const result = await dispatch(generateExam({ examLevel: level, section, questionCount: Q_COUNT[section] || 10 }))
    if ('error' in result) { toast.error(String(result.payload)); return }
    setPhase('exam')
    setIdx(0)
    setAnswers({})
    setStartTime(Date.now())
    setElapsed(0)
  }

  const currentQ = currentSession?.questions[currentIdx]

  const setAnswer = (qId: string, val: string) => setAnswers(prev => ({ ...prev, [qId]: val }))

  const handleNext = () => {
    if (currentIdx < (currentSession?.questions.length ?? 0) - 1) {
      setIdx(i => i + 1)
      setSpokenText('')
    }
  }
  const handlePrev = () => { if (currentIdx > 0) { setIdx(i => i - 1); setSpokenText('') } }

  const handleSubmit = async () => {
    if (!currentSession) return
    const answerArray = currentSession.questions.map(q => ({
      questionId: q._id,
      userAnswer: answers[q._id] || '',
    }))
    const unanswered = answerArray.filter(a => !a.userAnswer).length
    if (unanswered > 0 && !window.confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return

    const result = await dispatch(submitAnswers({
      sessionId: currentSession._id,
      answers: answerArray,
      timeSpentSeconds: elapsed,
    }))
    if ('error' in result) { toast.error(String(result.payload)); return }
    const { xpEarned, percentage } = (result.payload as any)
    toast.success(`${percentage}% — ${(result.payload as any).session.passed ? '✅ Passed!' : '📚 Keep practising'} (+${xpEarned} XP)`)
    setPhase('results')
  }

  // Speech recording for speaking questions
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Use Chrome for speech recognition'); return }
    const r = new SR()
    r.lang = 'de-DE'; r.continuous = true; r.interimResults = true
    let final = ''
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      const full = final + interim
      setSpokenText(full)
      if (currentQ) setAnswer(currentQ._id, full)
    }
    r.onerror = () => setRecording(false)
    r.onend = () => setRecording(false)
    recognitionRef.current = r
    r.start()
    setRecording(true)
    setSpokenText('')
  }, [currentQ])

  const stopRecording = () => { recognitionRef.current?.stop(); setRecording(false) }

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'; u.rate = 0.8
    speechSynthesis.speak(u)
  }

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto animate-fade-in">
      <button onClick={() => navigate('/goethe')} className="btn-ghost mb-6 text-sm">
        <ChevronLeft size={15} /> Back to Course
      </button>
      <div className="card text-center py-10">
        <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <GraduationCap size={30} className="text-gold" />
        </div>
        <h1 className="font-display text-3xl text-gray-100 mb-1">{level} — {SECTION_LABELS[section]}</h1>
        <p className="text-gray-500 text-sm mb-6">Goethe-Zertifikat Practice Test</p>

        <div className="grid grid-cols-3 gap-3 mb-8 max-w-sm mx-auto">
          {[
            { label: 'Questions', value: Q_COUNT[section] || 10 },
            { label: 'Pass Mark', value: '60%' },
            { label: 'XP Reward', value: '20–50' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-ink-800 rounded-xl p-3">
              <div className="font-display text-xl text-gray-100">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {section === 'speaking' && (
          <div className="mb-6 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-sm text-orange-300 flex items-start gap-2 text-left max-w-sm mx-auto">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>Speaking questions are recorded via your microphone and graded by AI. Use Chrome for best results.</span>
          </div>
        )}

        <button onClick={handleStart} className="btn-primary px-8 py-3 text-base" disabled={generating}>
          {generating ? <><span className="spinner" /> Generating…</> : <><GraduationCap size={17} /> Start Test</>}
        </button>
      </div>
    </div>
  )

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (phase === 'results' && currentSession) {
    const pct = Math.round((currentSession.totalScore / currentSession.maxScore) * 100)
    const passed = currentSession.passed
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
        {/* Score banner */}
        <div className={`card mb-5 text-center py-8 border-2 ${passed ? 'border-teal-soft/30 bg-teal-muted' : 'border-orange-400/30 bg-orange-500/5'}`}>
          <div className={`font-display text-6xl sm:text-7xl mb-2 ${passed ? 'text-teal-soft' : 'text-orange-400'}`}>{pct}%</div>
          <div className={`text-lg font-medium ${passed ? 'text-teal-soft' : 'text-orange-400'}`}>
            {passed ? '🎉 Bestanden! (Passed)' : '📚 Nicht bestanden — keep going!'}
          </div>
          <div className="text-sm text-gray-500 mt-1">{currentSession.totalScore}/{currentSession.maxScore} points · {formatTime(elapsed)}</div>
        </div>

        {/* Per-question review */}
        <h2 className="section-label mb-3">Question Review</h2>
        <div className="space-y-3 mb-6">
          {currentSession.questions.map((q, i) => (
            <div key={q._id} className={`card border ${q.isCorrect ? 'border-teal-soft/20 bg-teal-muted' : 'border-red-400/20 bg-red-500/5'}`}>
              <div className="flex items-start gap-3 mb-2">
                {q.isCorrect
                  ? <CheckCircle size={16} className="text-teal-soft shrink-0 mt-0.5" />
                  : <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                }
                <p className="text-sm text-gray-200 flex-1">
                  <span className="text-gray-500 mr-2">Q{i + 1}.</span>{q.question}
                </p>
                {q.score !== null && (
                  <span className={`text-sm font-medium shrink-0 ${q.isCorrect ? 'text-teal-soft' : 'text-red-400'}`}>{q.score}/10</span>
                )}
              </div>
              {q.userAnswer && (
                <div className="ml-7 text-xs text-gray-400">Your answer: <span className="text-gray-200">{q.userAnswer}</span></div>
              )}
              {!q.isCorrect && (
                <div className="ml-7 text-xs text-teal-soft mt-1">✓ {q.correctAnswer}</div>
              )}
              {q.explanation && (
                <div className="ml-7 text-xs text-gray-500 mt-1 italic">{q.explanation}</div>
              )}
              {q.aiFeedback && (
                <div className="ml-7 mt-2 p-2 bg-ink-800 rounded-lg text-xs text-gray-300">{q.aiFeedback}</div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <button onClick={handleStart} className="btn-primary" disabled={generating}>
            {generating ? <span className="spinner" /> : <RotateCcw size={15} />} Retry
          </button>
          <button onClick={() => navigate('/goethe')} className="btn-secondary">
            <ChevronLeft size={15} /> Back to Course
          </button>
          <button onClick={() => navigate('/conversation?level=' + level)} className="btn-secondary">
            <Mic size={15} /> Practice Speaking
          </button>
        </div>
      </div>
    )
  }

  // ── EXAM ───────────────────────────────────────────────────────────────────
  if (!currentSession || !currentQ) return (
    <div className="p-8 flex justify-center"><span className="spinner w-8 h-8" /></div>
  )

  const totalQ = currentSession.questions.length
  const progress = ((currentIdx + 1) / totalQ) * 100
  const answered = Object.keys(answers).length

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <span className="text-sm font-medium text-gray-200">{level} — {SECTION_LABELS[section]}</span>
          <span className="text-xs text-gray-500 ml-2">Q{currentIdx + 1}/{totalQ}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} />{formatTime(elapsed)}</span>
          <span className="text-xs text-gray-500">{answered}/{totalQ} answered</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-ink-700 rounded-full mb-5 overflow-hidden">
        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Question card */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="badge-gold text-[10px] uppercase">{currentQ.type}</span>
          {(currentQ.type === 'listening' || currentQ.type === 'speaking') && (
            <button onClick={() => speak(currentQ.question)} className="btn-ghost px-2 py-1 text-xs">
              <Volume2 size={12} /> Hear
            </button>
          )}
        </div>

        <p className="text-gray-100 text-base mb-5 leading-relaxed">{currentQ.question}</p>

        {/* MCQ options */}
        {currentQ.type === 'mcq' && currentQ.options.length > 0 && (
          <div className="space-y-2">
            {currentQ.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setAnswer(currentQ._id, opt)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all
                  ${answers[currentQ._id] === opt
                    ? 'bg-gold/10 border-gold/40 text-gold'
                    : 'bg-ink-800 border-white/[0.06] text-gray-300 hover:border-white/20 hover:text-gray-100'
                  }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Fill / translate / writing */}
        {(currentQ.type === 'fill' || currentQ.type === 'translate' || currentQ.type === 'writing' || currentQ.type === 'listening') && (
          <textarea
            className="textarea min-h-[100px]"
            placeholder="Type your answer here…"
            value={answers[currentQ._id] || ''}
            onChange={e => setAnswer(currentQ._id, e.target.value)}
          />
        )}

        {/* Speaking */}
        {currentQ.type === 'speaking' && (
          <div>
            <div className="bg-ink-800 rounded-xl p-4 min-h-[80px] text-sm mb-3">
              {spokenText || answers[currentQ._id]
                ? <span className="text-gray-200 italic">"{spokenText || answers[currentQ._id]}"</span>
                : <span className="text-gray-600">Your spoken answer will appear here…</span>
              }
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all
                  ${isRecording ? 'bg-red-500/10 border-red-500 text-red-400 animate-pulse' : 'bg-ink-800 border-white/10 text-gray-300 hover:border-gold/40'}`}
              >
                {isRecording ? <><Square size={14} /> Stop</> : <><Mic size={14} /> Record</>}
              </button>
              {(spokenText || answers[currentQ._id]) && (
                <button onClick={() => { setSpokenText(''); setAnswer(currentQ._id, '') }} className="btn-ghost text-sm">
                  <RotateCcw size={13} /> Clear
                </button>
              )}
              <button onClick={() => speak(currentQ.question)} className="btn-ghost text-sm">
                <Volume2 size={13} /> Hear prompt
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={handlePrev} className="btn-secondary" disabled={currentIdx === 0}>
          <ChevronLeft size={15} /> Prev
        </button>

        <div className="flex gap-1 flex-wrap justify-center flex-1">
          {currentSession.questions.map((q, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-7 h-7 rounded-md text-xs font-medium transition-all
                ${i === currentIdx ? 'bg-gold text-ink-950' : answers[q._id] ? 'bg-teal-soft/20 text-teal-soft' : 'bg-ink-800 text-gray-500 hover:bg-ink-700'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentIdx < totalQ - 1
          ? <button onClick={handleNext} className="btn-secondary"><ChevronRight size={15} /> Next</button>
          : <button onClick={handleSubmit} className="btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : <><Send size={14} /> Submit</>}
            </button>
        }
      </div>
    </div>
  )
}
