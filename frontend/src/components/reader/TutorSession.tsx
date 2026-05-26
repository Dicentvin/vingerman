import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, Square, Volume2, RotateCcw, ChevronRight,
  CheckCircle2, XCircle, Trophy, BookOpen, SkipForward,
} from 'lucide-react'
import type { ReadingSegment } from '../../store/slices/readAloudSlice'
import { SPEECH_MODES, type SpeechMode } from '../../hooks/useGermanTTS'

// ─── Types ────────────────────────────────────────────────────────────────────

type LineStatus = 'pending' | 'active' | 'passed' | 'skipped'

interface LineResult {
  idx: number
  attempts: number
  passed: boolean
  bestScore: number
  spokenTexts: string[]
}

interface TutorPhase {
  phase: 'intro'          // tutor reads the line aloud
       | 'waiting'        // "now you try" — mic is ready
       | 'recording'      // user is speaking
       | 'evaluating'     // comparing spoken vs target
       | 'feedback'       // showing result, retry or next
       | 'complete'       // all lines done
}

interface Props {
  segments: ReadingSegment[]
  title: string
  selectedVoice: SpeechSynthesisVoice | null
  currentMode: SpeechMode
  onExit: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize German text for comparison — strip punctuation, lowercase, collapse spaces */
function normalizeDE(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»„"‟"''"]/g, '')
    .replace(/[.,!?;:\-–—()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Compute similarity 0–100 between two strings using character-level matching */
function similarity(a: string, b: string): number {
  const na = normalizeDE(a)
  const nb = normalizeDE(b)
  if (!na || !nb) return 0
  if (na === nb) return 100

  // Word-level Jaccard similarity (handles German STT near-misses well)
  const wa = new Set(na.split(' '))
  const wb = new Set(nb.split(' '))
  const intersection = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  const jaccard = intersection / union

  // Char-level overlap as secondary signal
  const longer  = na.length > nb.length ? na : nb
  const shorter = na.length > nb.length ? nb : na
  let charMatches = 0
  for (const c of shorter) if (longer.includes(c)) charMatches++
  const charSim = charMatches / longer.length

  return Math.round(((jaccard * 0.7) + (charSim * 0.3)) * 100)
}

/** Score → label + color */
function scoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 85) return { label: 'Ausgezeichnet! 🌟', color: 'text-teal-soft',   bg: 'bg-teal-muted border-teal-soft/30' }
  if (score >= 65) return { label: 'Gut gemacht! 👍',  color: 'text-gold',         bg: 'bg-gold/10 border-gold/30' }
  if (score >= 40) return { label: 'Fast richtig 💪',  color: 'text-orange-400',   bg: 'bg-orange-500/10 border-orange-400/30' }
  return              { label: 'Nochmal versuchen 🔄', color: 'text-red-400',      bg: 'bg-red-500/10 border-red-400/30' }
}

/** Coaching message based on score + attempt count */
function coachMessage(score: number, attempt: number, target: string): string {
  if (score >= 85) {
    const msgs = [
      'Perfekt! Your pronunciation is spot on.',
      'Wunderbar! That sounded very natural.',
      'Excellent! A native speaker would be proud.',
      'Brilliant! You nailed every sound.',
    ]
    return msgs[attempt % msgs.length]
  }
  if (score >= 65) {
    return `Good effort! Listen again and focus on the rhythm. Try matching the exact speed.`
  }
  if (score >= 40) {
    // Find probably hard part — highlight first few words
    const words = target.split(' ').slice(0, 3).join(' ')
    return `You're getting there! Pay attention to "${words}…" — listen carefully to that part.`
  }
  if (attempt === 1) return 'Don\'t worry! Listen again slowly and try to copy each sound.'
  if (attempt === 2) return 'Try saying it syllable by syllable — don\'t rush.'
  return 'Keep going — even native speakers needed lots of practice! Take your time.'
}

// ─── Component ───────────────────────────────────────────────────────────────

const PASS_THRESHOLD = 65   // score >= this to advance
const MAX_ATTEMPTS   = 4    // auto-skip after this many tries

export default function TutorSession({ segments, title, selectedVoice, currentMode, onExit }: Props) {
  const [lineIdx, setLineIdx]       = useState(0)
  const [phase, setPhase]           = useState<TutorPhase>({ phase: 'intro' })
  const [spokenText, setSpokenText] = useState('')
  const [score, setScore]           = useState<number | null>(null)
  const [attempt, setAttempt]       = useState(0)
  const [results, setResults]       = useState<LineResult[]>([])
  const [lineStatuses, setLineStatuses] = useState<LineStatus[]>(
    segments.map((_, i) => (i === 0 ? 'active' : 'pending'))
  )
  const [countdown, setCountdown]   = useState<number | null>(null)

  const recognitionRef  = useRef<SpeechRecognition | null>(null)
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef    = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      speechSynthesis.cancel()
      recognitionRef.current?.stop()
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const currentSegment = segments[lineIdx]
  const isLastLine     = lineIdx === segments.length - 1

  // ── TTS helpers ─────────────────────────────────────────────────────────────

  const getModeConfig = useCallback(() => {
    return SPEECH_MODES.find(m => m.key === currentMode)!
  }, [currentMode])

  const speakText = useCallback((text: string, rateOverride?: number): Promise<void> => {
    return new Promise((resolve) => {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang   = selectedVoice?.lang ?? 'de-DE'
      u.voice  = selectedVoice ?? null
      u.volume = 1
      u.rate   = rateOverride ?? getModeConfig().rate
      u.pitch  = getModeConfig().pitch
      u.onend  = () => resolve()
      u.onerror = () => resolve()
      speechSynthesis.speak(u)
    })
  }, [selectedVoice, getModeConfig])

  // ── Phase machine ───────────────────────────────────────────────────────────

  // When entering a new line — tutor reads it aloud
  useEffect(() => {
    if (phase.phase !== 'intro') return

    const run = async () => {
      // Brief pause before tutor speaks
      await new Promise(r => setTimeout(r, 600))
      if (!isMountedRef.current) return

      // Tutor reads it once
      await speakText(currentSegment.text)
      if (!isMountedRef.current) return

      // Short gap, then start countdown for student
      await new Promise(r => setTimeout(r, 800))
      if (!isMountedRef.current) return

      // Start 3-2-1 countdown
      setPhase({ phase: 'waiting' })
      startCountdown()
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.phase, lineIdx])

  const startCountdown = useCallback(() => {
    setCountdown(3)
    let c = 3
    countdownRef.current = setInterval(() => {
      c--
      if (!isMountedRef.current) { clearInterval(countdownRef.current!); return }
      if (c <= 0) {
        clearInterval(countdownRef.current!)
        setCountdown(null)
        startRecording()
      } else {
        setCountdown(c)
      }
    }, 1000)
  }, []) // eslint-disable-line

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return

    setSpokenText('')
    setPhase({ phase: 'recording' })

    const recognition = new SR()
    recognition.lang = 'de-DE'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 3

    let finalText = ''

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          // Take the alternative that scores highest against target
          let bestAlt = e.results[i][0].transcript
          let bestScore = similarity(bestAlt, currentSegment.text)
          for (let j = 1; j < e.results[i].length; j++) {
            const altScore = similarity(e.results[i][j].transcript, currentSegment.text)
            if (altScore > bestScore) { bestScore = altScore; bestAlt = e.results[i][j].transcript }
          }
          finalText += bestAlt + ' '
        } else {
          interim += e.results[i][0].transcript
        }
      }
      if (isMountedRef.current) setSpokenText((finalText + interim).trim())
    }

    recognition.onend = () => {
      if (!isMountedRef.current) return
      const spoken = finalText.trim() || spokenText
      if (spoken) {
        evaluateAttempt(spoken)
      } else {
        // Nothing heard
        setScore(0)
        setPhase({ phase: 'feedback' })
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (!isMountedRef.current) return
      if (e.error !== 'no-speech') console.error('Speech recognition error:', e.error)
      setPhase({ phase: 'feedback' })
      setScore(0)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [currentSegment, spokenText]) // eslint-disable-line

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const evaluateAttempt = useCallback((spoken: string) => {
    setPhase({ phase: 'evaluating' })
    const sc = similarity(spoken, currentSegment.text)
    setScore(sc)

    const newAttempt = attempt + 1
    setAttempt(newAttempt)
    setSpokenText(spoken)

    setTimeout(() => {
      if (!isMountedRef.current) return
      setPhase({ phase: 'feedback' })
    }, 400)
  }, [attempt, currentSegment])

  // ── Navigation ──────────────────────────────────────────────────────────────

  const advanceLine = useCallback((passed: boolean, forceSkip = false) => {
    speechSynthesis.cancel()
    recognitionRef.current?.stop()

    // Record result
    const result: LineResult = {
      idx: lineIdx,
      attempts: attempt + (passed ? 0 : 1),
      passed: passed || forceSkip,
      bestScore: score ?? 0,
      spokenTexts: [spokenText],
    }
    setResults(prev => [...prev, result])

    // Update status
    setLineStatuses(prev => {
      const next = [...prev]
      next[lineIdx] = passed || forceSkip ? 'passed' : 'skipped'
      if (lineIdx + 1 < segments.length) next[lineIdx + 1] = 'active'
      return next
    })

    if (isLastLine) {
      setPhase({ phase: 'complete' })
    } else {
      setLineIdx(i => i + 1)
      setAttempt(0)
      setScore(null)
      setSpokenText('')
      setPhase({ phase: 'intro' })
    }
  }, [lineIdx, attempt, score, spokenText, isLastLine, segments.length])

  const retryLine = useCallback(() => {
    speechSynthesis.cancel()
    setScore(null)
    setSpokenText('')
    setPhase({ phase: 'intro' })
  }, [])

  const hearAgain = useCallback(async () => {
    speechSynthesis.cancel()
    await speakText(currentSegment.text)
    if (!isMountedRef.current) return
    setPhase({ phase: 'waiting' })
    startCountdown()
  }, [currentSegment, speakText, startCountdown])

  // ── Computed ────────────────────────────────────────────────────────────────

  const totalPassed  = results.filter(r => r.passed).length
  const totalSkipped = results.filter(r => !r.passed).length
  const avgScore     = results.length
    ? Math.round(results.reduce((s, r) => s + r.bestScore, 0) / results.length)
    : 0

  const sl = score !== null ? scoreLabel(score) : null
  const canAutoSkip = attempt >= MAX_ATTEMPTS - 1

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (phase.phase === 'complete') {
    return <SessionComplete
      results={results}
      segments={segments}
      title={title}
      totalPassed={totalPassed}
      totalSkipped={totalSkipped}
      avgScore={avgScore}
      onExit={onExit}
      onRestart={() => {
        setLineIdx(0); setAttempt(0); setScore(null); setSpokenText('')
        setResults([])
        setLineStatuses(segments.map((_, i) => i === 0 ? 'active' : 'pending'))
        setPhase({ phase: 'intro' })
      }}
    />
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Tutor Session</p>
          <h2 className="font-display text-xl text-gray-100 truncate max-w-xs">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Line</p>
            <p className="font-display text-2xl text-gold leading-none">
              {lineIdx + 1}<span className="text-sm text-gray-600">/{segments.length}</span>
            </p>
          </div>
          <button onClick={onExit} className="btn-ghost text-xs text-gray-600 hover:text-red-400">
            ✕ Exit
          </button>
        </div>
      </div>

      {/* ── Line progress bar ──────────────────────────────────────────────── */}
      <div className="flex gap-1">
        {segments.map((_, i) => {
          const st = lineStatuses[i]
          return (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-all duration-500
                ${st === 'passed'  ? 'bg-teal-soft' :
                  st === 'skipped' ? 'bg-orange-400' :
                  st === 'active'  ? 'bg-gold animate-pulse' :
                  'bg-ink-700'}`}
            />
          )
        })}
      </div>

      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <div className="card space-y-5">

        {/* Current line display */}
        <div className={`rounded-2xl p-5 border transition-all duration-500
          ${phase.phase === 'intro' || phase.phase === 'evaluating'
            ? 'bg-gold/5 border-gold/25'
            : phase.phase === 'recording'
            ? 'bg-red-500/5 border-red-500/25'
            : 'bg-ink-800 border-white/[0.07]'
          }`}>

          {/* Tutor label */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
              <span className="text-sm">👨‍🏫</span>
            </div>
            <div>
              <p className="text-xs font-medium text-gold">Your Tutor</p>
              <p className="text-[10px] text-gray-600">
                {phase.phase === 'intro'      ? 'Reading the line for you…' :
                 phase.phase === 'waiting'    ? 'Get ready to repeat!' :
                 phase.phase === 'recording'  ? 'Listening to you…' :
                 phase.phase === 'evaluating' ? 'Checking your pronunciation…' :
                 phase.phase === 'feedback'   ? 'Here\'s your feedback:' : ''}
              </p>
            </div>
            {(phase.phase === 'intro' || phase.phase === 'evaluating') && (
              <div className="ml-auto flex gap-0.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1 bg-gold rounded-full animate-pulse"
                    style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
          </div>

          {/* The line text */}
          <p className="font-display text-2xl text-gray-100 leading-relaxed">
            {currentSegment.text}
          </p>

          {/* Grammar note */}
          {currentSegment.note && (
            <p className="mt-2 text-xs text-violet-soft italic border-t border-white/[0.06] pt-2">
              💡 {currentSegment.note}
            </p>
          )}
        </div>

        {/* ── Countdown ────────────────────────────────────────────────────── */}
        {phase.phase === 'waiting' && countdown !== null && (
          <div className="flex flex-col items-center py-4">
            <div className={`w-20 h-20 rounded-full border-4 border-gold flex items-center justify-center
              font-display text-5xl text-gold animate-pulse`}>
              {countdown}
            </div>
            <p className="text-gray-500 text-sm mt-3">Get ready to repeat the line…</p>
          </div>
        )}

        {/* ── Waiting (countdown done) ──────────────────────────────────────── */}
        {phase.phase === 'waiting' && countdown === null && (
          <div className="flex flex-col items-center py-2 gap-3">
            <p className="text-gray-400 text-sm">Now repeat the line in German</p>
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-ink-800 border-2 border-gold/40
                         hover:bg-gold/10 hover:border-gold transition-all flex items-center justify-center"
            >
              <Mic size={32} className="text-gold" />
            </button>
            <p className="text-xs text-gray-600">Tap mic or wait — recording starts automatically</p>
          </div>
        )}

        {/* ── Recording ────────────────────────────────────────────────────── */}
        {phase.phase === 'recording' && (
          <div className="flex flex-col items-center py-2 gap-3">
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500
                         flex items-center justify-center animate-pulse-ring"
            >
              <Square size={28} className="text-red-400" />
            </button>
            <p className="text-sm text-red-400 font-medium">🔴 Recording — speak the line!</p>

            {spokenText && (
              <div className="w-full bg-ink-800 rounded-xl px-4 py-3 text-sm text-gray-300 italic min-h-[44px]">
                "{spokenText}"
              </div>
            )}

            <button onClick={stopRecording} className="btn-secondary text-xs">
              <Square size={12} /> Done speaking
            </button>
          </div>
        )}

        {/* ── Evaluating ───────────────────────────────────────────────────── */}
        {phase.phase === 'evaluating' && (
          <div className="flex flex-col items-center py-6 gap-2">
            <div className="spinner w-8 h-8" />
            <p className="text-gray-500 text-sm">Checking your pronunciation…</p>
          </div>
        )}

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
        {phase.phase === 'feedback' && sl && score !== null && (
          <div className="space-y-4">
            {/* Score */}
            <div className={`rounded-xl border p-4 ${sl.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`font-display text-xl ${sl.color}`}>{sl.label}</p>
                <div className="text-right">
                  <p className={`font-display text-3xl ${sl.color} leading-none`}>{score}</p>
                  <p className="text-[10px] text-gray-600">/ 100</p>
                </div>
              </div>

              {/* Score bar */}
              <div className="h-2 bg-black/20 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-700
                    ${score >= 85 ? 'bg-teal-soft' : score >= 65 ? 'bg-gold' : score >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                  style={{ width: `${score}%` }}
                />
              </div>

              {/* Comparison */}
              <div className="space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <span className="text-gray-600 w-16 shrink-0">Target:</span>
                  <span className="text-gray-200 font-medium">{currentSegment.text}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-600 w-16 shrink-0">You said:</span>
                  <span className={`italic ${score >= 65 ? 'text-teal-soft' : 'text-orange-400'}`}>
                    "{spokenText || '— nothing detected —'}"
                  </span>
                </div>
              </div>
            </div>

            {/* Coach message */}
            <div className="flex gap-2.5 px-1">
              <span className="text-lg shrink-0">👨‍🏫</span>
              <p className="text-sm text-gray-300 leading-relaxed">
                {coachMessage(score, attempt, currentSegment.text)}
              </p>
            </div>

            {/* Attempt counter */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all
                  ${i < attempt ? (score >= PASS_THRESHOLD ? 'bg-teal-soft' : 'bg-red-400') : 'bg-ink-700'}`} />
              ))}
              <span className="text-[10px] text-gray-600 ml-1">{attempt}/{MAX_ATTEMPTS} attempts</span>
            </div>

            {/* Action buttons */}
            {score >= PASS_THRESHOLD ? (
              <div className="flex gap-2">
                <button
                  onClick={() => advanceLine(true)}
                  className="btn-primary flex-1 justify-center"
                >
                  {isLastLine ? <><Trophy size={15} /> Finish!</> : <><ChevronRight size={15} /> Next Line</>}
                </button>
                <button onClick={hearAgain} className="btn-secondary px-3">
                  <Volume2 size={15} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button onClick={retryLine} className="btn-primary flex-1 justify-center gap-2">
                  <RotateCcw size={14} /> Hear again & retry
                </button>
                <button onClick={hearAgain} className="btn-secondary px-3" title="Hear the line">
                  <Volume2 size={15} />
                </button>
                {canAutoSkip && (
                  <button
                    onClick={() => advanceLine(false, true)}
                    className="btn-ghost text-xs text-gray-600 hover:text-orange-400 gap-1.5"
                  >
                    <SkipForward size={13} /> Skip this line
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Session stats sidebar ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Passed',   value: results.filter(r => r.passed).length,  color: 'text-teal-soft' },
          { label: 'Skipped',  value: results.filter(r => !r.passed).length, color: 'text-orange-400' },
          { label: 'Remaining',value: segments.length - results.length - 1,  color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="card-sm text-center">
            <p className={`font-display text-2xl ${s.color}`}>{Math.max(0, s.value)}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Complete screen ──────────────────────────────────────────────────────────

interface CompleteProps {
  results: LineResult[]
  segments: ReadingSegment[]
  title: string
  totalPassed: number
  totalSkipped: number
  avgScore: number
  onExit: () => void
  onRestart: () => void
}

function SessionComplete({ results, segments, title, totalPassed, totalSkipped, avgScore, onExit, onRestart }: CompleteProps) {
  const pct = Math.round((totalPassed / segments.length) * 100)
  const medal = pct >= 90 ? '🥇' : pct >= 70 ? '🥈' : pct >= 50 ? '🥉' : '📚'

  return (
    <div className="card space-y-5 animate-slide-up">
      <div className="text-center pt-2">
        <div className="text-6xl mb-3">{medal}</div>
        <h2 className="font-display text-3xl text-gray-100 mb-1">Session Complete!</h2>
        <p className="text-gray-500 text-sm">"{title}"</p>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Lines Passed',   value: `${totalPassed}/${segments.length}`, color: 'text-teal-soft' },
          { label: 'Avg Score',      value: `${avgScore}`,                       color: 'text-gold', suffix: '/100' },
          { label: 'Lines Skipped',  value: `${totalSkipped}`,                   color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="card-sm text-center">
            <p className={`font-display text-2xl ${s.color} leading-none`}>
              {s.value}{s.suffix && <span className="text-sm text-gray-600">{s.suffix}</span>}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Line-by-line recap */}
      <div>
        <p className="section-label">Line by Line</p>
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {results.map((r) => {
            const seg = segments[r.idx]
            const sl  = scoreLabel(r.bestScore)
            return (
              <div key={r.idx} className={`flex items-start gap-3 rounded-xl p-3 border ${sl.bg}`}>
                {r.passed
                  ? <CheckCircle2 size={15} className="text-teal-soft shrink-0 mt-0.5" />
                  : <XCircle size={15} className="text-orange-400 shrink-0 mt-0.5" />
                }
                <p className="text-xs text-gray-300 flex-1 leading-relaxed truncate">{seg.text}</p>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-medium ${sl.color}`}>{r.bestScore}/100</p>
                  <p className="text-[9px] text-gray-600">{r.attempts} try{r.attempts !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Motivational message */}
      <div className="flex gap-2.5 bg-ink-800 rounded-xl p-4">
        <span className="text-lg shrink-0">👨‍🏫</span>
        <p className="text-sm text-gray-300 leading-relaxed">
          {pct >= 90
            ? 'Outstanding! Your German reading is excellent. You should be very proud of that performance!'
            : pct >= 70
            ? 'Great work! You passed most lines confidently. Focus on the skipped ones next time.'
            : pct >= 50
            ? 'Good effort! Reading a new language is hard. Try again and you\'ll improve each time.'
            : 'Keep practising — every attempt builds your ear for German. Try the session again at a slower speed!'}
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={onRestart} className="btn-primary flex-1 justify-center">
          <RotateCcw size={15} /> Try Again
        </button>
        <button onClick={onExit} className="btn-secondary flex-1 justify-center">
          <BookOpen size={15} /> Back to Reader
        </button>
      </div>
    </div>
  )
}
