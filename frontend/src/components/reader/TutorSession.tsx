import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, Square, Volume2, RotateCcw, ChevronRight,
  CheckCircle2, XCircle, Trophy, BookOpen, SkipForward,
  GraduationCap,
} from 'lucide-react'
import type { ReadingSegment } from '../../store/slices/readAloudSlice'
import { SPEECH_MODES, type SpeechMode } from '../../hooks/useGermanTTS'

// ─── Types ────────────────────────────────────────────────────────────────────

type LineStatus   = 'pending' | 'active' | 'passed' | 'skipped'

// How many times the tutor reads a line before the student tries
const TUTOR_READS: Record<SpeechMode, number> = {
  learner:  5,
  moderate: 3,
  native:   1,
}
// Pass threshold per mode — easier at beginner
const PASS_THRESHOLD: Record<SpeechMode, number> = {
  learner:  55,
  moderate: 65,
  native:   75,
}
const MAX_ATTEMPTS = 5

// Phases of the whole session
type Phase =
  | { name: 'vocab_intro' }                           // beginner only — show vocab table
  | { name: 'vocab_drill'; wordIdx: number; rep: number }  // say each word 3×
  | { name: 'line_intro';  rep: number }              // tutor reads line N times
  | { name: 'line_wait';   countdown: number | null } // countdown before student speaks
  | { name: 'line_record' }                           // student is speaking
  | { name: 'line_eval' }                             // scoring
  | { name: 'line_feedback' }                         // show result
  | { name: 'complete' }

interface LineResult {
  idx: number
  attempts: number
  passed: boolean
  bestScore: number
}

interface Props {
  segments:      ReadingSegment[]
  title:         string
  selectedVoice: SpeechSynthesisVoice | null
  currentMode:   SpeechMode
  glossary?:     { de: string; en: string; ipa?: string }[]
  onExit:        () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeDE(t: string) {
  return t.toLowerCase()
    .replace(/[«»„"‟"''"\u201c\u201d]/g, '')
    .replace(/[.,!?;:\-–—()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function similarity(a: string, b: string): number {
  const na = normalizeDE(a), nb = normalizeDE(b)
  if (!na || !nb) return 0
  if (na === nb)  return 100
  const wa = new Set(na.split(' ')), wb = new Set(nb.split(' '))
  const inter = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  const jaccard = inter / union
  const longer = na.length > nb.length ? na : nb
  const shorter = na.length > nb.length ? nb : na
  let cm = 0; for (const c of shorter) if (longer.includes(c)) cm++
  return Math.round(jaccard * 0.7 * 100 + (cm / longer.length) * 0.3 * 100)
}

function scoreLabel(s: number) {
  if (s >= 85) return { label: 'Ausgezeichnet! 🌟', color: 'text-teal-soft',  bg: 'bg-teal-muted border-teal-soft/30' }
  if (s >= 65) return { label: 'Gut gemacht! 👍',   color: 'text-gold',        bg: 'bg-gold/10 border-gold/30' }
  if (s >= 40) return { label: 'Fast richtig 💪',   color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-400/30' }
  return             { label: 'Nochmal versuchen 🔄', color: 'text-red-400',   bg: 'bg-red-500/10 border-red-400/30' }
}

function coachMsg(score: number, attempt: number, mode: SpeechMode, target: string): string {
  const isBegin = mode === 'learner'
  if (score >= 85) return ['Perfekt!', 'Wunderbar!', 'Excellent!', 'Brilliant!'][attempt % 4] + ' Your pronunciation is spot on.'
  if (score >= 65) return 'Good effort! Focus on matching the rhythm — listen once more then try again.'
  if (score >= 40) return `You're getting there! Pay attention to "${target.split(' ').slice(0, 3).join(' ')}…"`
  if (isBegin && attempt <= 2) return 'No rush — we\'ll listen together again. Copy each sound slowly.'
  if (attempt === 1) return 'Don\'t worry! Listen carefully one more time and mirror every sound.'
  if (attempt === 2) return 'Try syllable by syllable — break it into pieces.'
  return 'Keep going — every repeat is building your ear. You\'ve got this!'
}

// Extract unique words from all segments, deduplicated and sorted
function extractWords(
  segments: ReadingSegment[],
  glossary: { de: string; en: string; ipa?: string }[]
) {
  const allWords = segments.flatMap(s =>
    s.text.split(/\s+/).map(w => w.replace(/[.,!?;:«»"„"]/g, '').trim()).filter(w => w.length > 2)
  )
  const unique = [...new Set(allWords)]
  return unique.map(word => {
    const gloss = glossary.find(g =>
      g.de.toLowerCase() === word.toLowerCase() ||
      g.de.toLowerCase().startsWith(word.toLowerCase().substring(0, 4))
    )
    return { word, en: gloss?.en || '', ipa: gloss?.ipa || '' }
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TutorSession({
  segments, title, selectedVoice, currentMode, glossary = [], onExit,
}: Props) {
  const isBeginnerMode = currentMode === 'learner'
  const tutorReads     = TUTOR_READS[currentMode]
  const passThresh     = PASS_THRESHOLD[currentMode]

  // All vocab words (for beginner drill)
  const vocabWords = isBeginnerMode ? extractWords(segments, glossary) : []

  const [phase, setPhase]           = useState<Phase>(
    isBeginnerMode ? { name: 'vocab_intro' } : { name: 'line_intro', rep: 1 }
  )
  const [lineIdx, setLineIdx]       = useState(0)
  const [attempt, setAttempt]       = useState(0)
  const [score, setScore]           = useState<number | null>(null)
  const [spokenText, setSpokenText] = useState('')
  const [results, setResults]       = useState<LineResult[]>([])
  const [lineStatuses, setLineStatuses] = useState<LineStatus[]>(
    segments.map((_, i) => (i === 0 ? 'active' : 'pending'))
  )
  const [vocabDrillDone, setVocabDrillDone] = useState(!isBeginnerMode)

  const isMounted  = useRef(true)
  const recogRef   = useRef<SpeechRecognition | null>(null)
  const cdInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const runningRef = useRef(false)   // prevents double-run in StrictMode

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      speechSynthesis.cancel()
      recogRef.current?.stop()
      if (cdInterval.current) clearInterval(cdInterval.current)
    }
  }, [])

  const seg         = segments[lineIdx]
  const isLastLine  = lineIdx === segments.length - 1

  // ── TTS ──────────────────────────────────────────────────────────────────────

  const modeRate = useCallback(() => {
    return SPEECH_MODES.find(m => m.key === currentMode)?.rate ?? 0.82
  }, [currentMode])

  const modePitch = useCallback(() => {
    return SPEECH_MODES.find(m => m.key === currentMode)?.pitch ?? 1.0
  }, [currentMode])

  const speak = useCallback((text: string, rateOverride?: number): Promise<void> => {
    return new Promise(resolve => {
      speechSynthesis.cancel()
      const u      = new SpeechSynthesisUtterance(text)
      u.lang       = selectedVoice?.lang  ?? 'de-DE'
      u.voice      = selectedVoice        ?? null
      u.rate       = rateOverride ?? modeRate()
      u.pitch      = modePitch()
      u.volume     = 1
      u.onend      = () => resolve()
      u.onerror    = () => resolve()
      speechSynthesis.speak(u)
    })
  }, [selectedVoice, modeRate, modePitch])

  const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

  // ── Vocab Drill (beginner only) ───────────────────────────────────────────────

  useEffect(() => {
    if (phase.name !== 'vocab_drill') return
    if (runningRef.current) return
    runningRef.current = true

    const { wordIdx, rep } = phase
    const entry = vocabWords[wordIdx]
    if (!entry) { runningRef.current = false; return }

    const run = async () => {
      await pause(300)
      if (!isMounted.current) return
      // Speak the word
      await speak(entry.word, 0.5)
      await pause(900)
      if (!isMounted.current) return

      if (rep < 3) {
        // More reps for this word
        runningRef.current = false
        setPhase({ name: 'vocab_drill', wordIdx, rep: rep + 1 })
      } else if (wordIdx + 1 < vocabWords.length) {
        // Next word
        runningRef.current = false
        setPhase({ name: 'vocab_drill', wordIdx: wordIdx + 1, rep: 1 })
      } else {
        // All words done → go to sentences
        runningRef.current = false
        setVocabDrillDone(true)
        setPhase({ name: 'line_intro', rep: 1 })
      }
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Line Intro (tutor reads the line N times) ─────────────────────────────────

  useEffect(() => {
    if (phase.name !== 'line_intro') return
    if (runningRef.current) return
    runningRef.current = true

    const { rep } = phase

    const run = async () => {
      await pause(rep === 1 ? 600 : 300)
      if (!isMounted.current) return

      await speak(seg.text)
      await pause(700)
      if (!isMounted.current) return

      if (rep < tutorReads) {
        // Read again
        runningRef.current = false
        setPhase({ name: 'line_intro', rep: rep + 1 })
      } else {
        // Done reading — start countdown
        runningRef.current = false
        setPhase({ name: 'line_wait', countdown: 3 })
      }
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lineIdx])

  // ── Countdown ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase.name !== 'line_wait' || phase.countdown === null) return
    if (phase.countdown <= 0) {
      setPhase({ name: 'line_record' })
      return
    }
    const t = setTimeout(() => {
      if (!isMounted.current) return
      setPhase({ name: 'line_wait', countdown: (phase.countdown ?? 1) - 1 })
    }, 1000)
    return () => clearTimeout(t)
  }, [phase])

  // ── Recording ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase.name !== 'line_record') return

    const SR = window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) { setPhase({ name: 'line_feedback' }); setScore(0); return }

    const recognition = new SR()
    recognition.lang            = 'de-DE'
    recognition.continuous      = false
    recognition.interimResults  = true
    recognition.maxAlternatives = 3

    let finalText = ''
    setSpokenText('')

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          let best = e.results[i][0].transcript
          let bestSc = similarity(best, seg.text)
          for (let j = 1; j < e.results[i].length; j++) {
            const sc = similarity(e.results[i][j].transcript, seg.text)
            if (sc > bestSc) { bestSc = sc; best = e.results[i][j].transcript }
          }
          finalText += best + ' '
        } else {
          interim += e.results[i][0].transcript
        }
      }
      if (isMounted.current) setSpokenText((finalText + interim).trim())
    }

    recognition.onend = () => {
      if (!isMounted.current) return
      const spoken = finalText.trim()
      const sc = spoken ? similarity(spoken, seg.text) : 0
      setScore(sc)
      setSpokenText(spoken || '')
      setAttempt(a => a + 1)
      setPhase({ name: 'line_eval' })
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (!isMounted.current) return
      if (e.error !== 'no-speech') console.error('STT error:', e.error)
      setScore(0); setPhase({ name: 'line_eval' })
    }

    recogRef.current = recognition
    recognition.start()

    return () => recognition.stop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.name])

  // ── Eval → Feedback ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase.name !== 'line_eval') return
    const t = setTimeout(() => {
      if (isMounted.current) setPhase({ name: 'line_feedback' })
    }, 500)
    return () => clearTimeout(t)
  }, [phase.name])

  // ── Actions ───────────────────────────────────────────────────────────────────

  const stopRecording = () => recogRef.current?.stop()

  const hearAgainAndRetry = useCallback(async () => {
    speechSynthesis.cancel()
    setScore(null); setSpokenText('')
    setPhase({ name: 'line_intro', rep: 1 })
    runningRef.current = false
  }, [])

  const advanceLine = useCallback((passed: boolean, forceSkip = false) => {
    speechSynthesis.cancel()
    recogRef.current?.stop()

    setResults(prev => [...prev, {
      idx: lineIdx, attempts: attempt, passed: passed || forceSkip, bestScore: score ?? 0,
    }])
    setLineStatuses(prev => {
      const next = [...prev]
      next[lineIdx] = passed || forceSkip ? 'passed' : 'skipped'
      if (lineIdx + 1 < segments.length) next[lineIdx + 1] = 'active'
      return next
    })

    if (isLastLine) {
      setPhase({ name: 'complete' })
    } else {
      setLineIdx(i => i + 1)
      setAttempt(0); setScore(null); setSpokenText('')
      runningRef.current = false
      setPhase({ name: 'line_intro', rep: 1 })
    }
  }, [lineIdx, attempt, score, isLastLine, segments.length])

  // ── Computed ──────────────────────────────────────────────────────────────────

  const passed  = results.filter(r => r.passed).length
  const skipped = results.filter(r => !r.passed).length
  const avgSc   = results.length ? Math.round(results.reduce((s, r) => s + r.bestScore, 0) / results.length) : 0
  const sl      = score !== null ? scoreLabel(score) : null
  const canSkip = attempt >= MAX_ATTEMPTS - 1

  // ── Render complete ───────────────────────────────────────────────────────────

  if (phase.name === 'complete') {
    return (
      <SessionComplete
        results={results} segments={segments} title={title}
        totalPassed={passed} totalSkipped={skipped} avgScore={avgSc}
        onExit={onExit}
        onRestart={() => {
          setLineIdx(0); setAttempt(0); setScore(null); setSpokenText('')
          setResults([])
          setLineStatuses(segments.map((_, i) => i === 0 ? 'active' : 'pending'))
          runningRef.current = false
          setVocabDrillDone(!isBeginnerMode)
          setPhase(isBeginnerMode ? { name: 'vocab_intro' } : { name: 'line_intro', rep: 1 })
        }}
      />
    )
  }

  // ── Render vocab intro ─────────────────────────────────────────────────────────

  if (phase.name === 'vocab_intro') {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Beginner Mode · Vocab Warm-Up</p>
            <h2 className="font-display text-xl sm:text-2xl text-gray-100">{title}</h2>
          </div>
          <button onClick={onExit} className="btn-ghost text-xs text-gray-600 hover:text-red-400">✕ Exit</button>
        </div>

        {/* Tutor explanation */}
        <div className="flex gap-3 p-4 bg-violet-muted border border-violet-soft/20 rounded-2xl">
          <span className="text-2xl shrink-0">👨‍🏫</span>
          <div className="text-sm text-gray-300 leading-relaxed">
            <p className="font-medium text-violet-soft mb-1">Before we read — let's learn the words first!</p>
            <p>Since you're at <strong className="text-white">Learner level</strong>, I will:</p>
            <ol className="mt-2 space-y-1 text-gray-400 list-decimal list-inside">
              <li>Read every word in this text <strong className="text-white">3 times</strong> out loud</li>
              <li>Then read each sentence <strong className="text-white">5 times</strong> before you repeat</li>
              <li>Coach you until you get it right</li>
            </ol>
          </div>
        </div>

        {/* Vocab table */}
        {vocabWords.length > 0 && (
          <div className="card overflow-x-auto">
            <p className="section-label">Words in this text ({vocabWords.length} unique)</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="text-left py-2 pr-3 text-xs text-gray-500 font-medium">🇩🇪 Word</th>
                  <th className="text-left py-2 pr-3 text-xs text-gray-500 font-medium">🇬🇧 Meaning</th>
                  <th className="text-left py-2 text-xs text-gray-500 font-medium hidden sm:table-cell">Pronunciation</th>
                </tr>
              </thead>
              <tbody>
                {vocabWords.map((w, i) => (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2 pr-3 font-semibold text-gold">{w.word}</td>
                    <td className="py-2 pr-3 text-gray-400">{w.en || '—'}</td>
                    <td className="py-2 text-violet-soft text-xs font-mono hidden sm:table-cell">{w.ipa || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={() => { runningRef.current = false; setPhase({ name: 'vocab_drill', wordIdx: 0, rep: 1 }) }}
          className="btn-primary w-full justify-center py-3"
        >
          <GraduationCap size={17}/> Start Vocab Drill → Sentences
        </button>
      </div>
    )
  }

  // ── Render vocab drill ─────────────────────────────────────────────────────────

  if (phase.name === 'vocab_drill') {
    const { wordIdx, rep } = phase
    const currentWord = vocabWords[wordIdx]
    const totalWords  = vocabWords.length

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Vocab Drill — Word {wordIdx + 1} of {totalWords}</p>
            <h2 className="font-display text-xl text-gray-100">{title}</h2>
          </div>
          <button onClick={onExit} className="btn-ghost text-xs text-gray-600 hover:text-red-400">✕</button>
        </div>

        {/* Progress */}
        <div className="flex gap-0.5">
          {vocabWords.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < wordIdx ? 'bg-teal-soft' : i === wordIdx ? 'bg-gold animate-pulse' : 'bg-ink-700'}`}/>
          ))}
        </div>

        {/* Word card */}
        <div className="card text-center py-10 sm:py-14 relative">
          <div className="flex items-center justify-center gap-2 mb-2">
            <p className="font-display text-4xl sm:text-5xl text-gray-100">{currentWord?.word}</p>
            <Volume2 size={20} className="text-gold animate-pulse"/>
          </div>
          {currentWord?.ipa && <p className="text-violet-soft font-mono text-lg">{currentWord.ipa}</p>}
          {currentWord?.en  && <p className="text-gray-400 mt-2 text-lg">{currentWord.en}</p>}

          {/* Rep indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {[1,2,3].map(r => (
              <div key={r} className={`w-3 h-3 rounded-full transition-all border-2
                ${r < rep ? 'bg-teal-soft border-teal-soft' : r === rep ? 'bg-gold border-gold scale-125' : 'bg-transparent border-gray-600'}`}/>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Reading {rep}/3 — {rep < 3 ? 'listen carefully…' : 'last time!'}
          </p>
        </div>

        {/* Tutor speaking indicator */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gold/5 border border-gold/20 rounded-xl">
          <span className="text-lg">👨‍🏫</span>
          <div className="flex-1">
            <p className="text-xs text-gold">Tutor reading word {wordIdx + 1} of {totalWords}</p>
            <p className="text-[10px] text-gray-500">Listen · don't repeat yet — just absorb the sound</p>
          </div>
          <div className="flex gap-0.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-1 bg-gold rounded-full animate-pulse" style={{ height: `${10 + i*4}px`, animationDelay: `${i*0.12}s` }}/>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Render sentence phases ─────────────────────────────────────────────────────

  const isIntro    = phase.name === 'line_intro'
  const isWait     = phase.name === 'line_wait'
  const isRecord   = phase.name === 'line_record'
  const isEval     = phase.name === 'line_eval'
  const isFeedback = phase.name === 'line_feedback'

  const repNum = isIntro ? (phase as { name: 'line_intro'; rep: number }).rep : tutorReads
  const countdown = isWait ? (phase as { name: 'line_wait'; countdown: number | null }).countdown : null

  return (
    <div className="flex flex-col gap-3 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">
            {currentMode === 'learner' ? '🐢 Beginner' : currentMode === 'moderate' ? '🚶 Moderate' : '🏎️ Native'} · Tutor Session
          </p>
          <h2 className="font-display text-xl sm:text-2xl text-gray-100 truncate max-w-[260px] sm:max-w-xs">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Line</p>
            <p className="font-display text-2xl text-gold leading-none">
              {lineIdx + 1}<span className="text-sm text-gray-600">/{segments.length}</span>
            </p>
          </div>
          <button onClick={onExit} className="btn-ghost text-xs text-gray-600 hover:text-red-400 p-2">✕</button>
        </div>
      </div>

      {/* Line progress dots */}
      <div className="flex gap-1">
        {segments.map((_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500
            ${lineStatuses[i] === 'passed'  ? 'bg-teal-soft' :
              lineStatuses[i] === 'skipped' ? 'bg-orange-400' :
              lineStatuses[i] === 'active'  ? 'bg-gold animate-pulse' : 'bg-ink-700'}`}/>
        ))}
      </div>

      {/* Mode explanation strip (first line only) */}
      {lineIdx === 0 && !vocabDrillDone && isBeginnerMode && (
        <div className="text-xs px-3 py-2 bg-violet-muted border border-violet-soft/20 rounded-xl text-violet-soft">
          👨‍🏫 I'll read each sentence <strong>{tutorReads} times</strong> before you repeat — listen carefully each time!
        </div>
      )}
      {lineIdx === 0 && (vocabDrillDone || !isBeginnerMode) && (
        <div className="text-xs px-3 py-2 bg-gold/5 border border-gold/15 rounded-xl text-gray-400">
          👨‍🏫 I'll read this {tutorReads === 1 ? 'once' : `${tutorReads} times`} then you repeat.
          Score ≥ {passThresh} to advance.
        </div>
      )}

      {/* Main card */}
      <div className={`card transition-all duration-300
        ${isIntro || isEval ? 'border-gold/25 bg-gold/[0.03]' : ''}
        ${isRecord ? 'border-red-500/25 bg-red-500/[0.03]' : ''}
        ${isFeedback && sl ? sl.bg : ''}`}
      >

        {/* Tutor avatar row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center text-base shrink-0">👨‍🏫</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gold">Your Tutor</p>
            <p className="text-[10px] text-gray-600 truncate">
              {isIntro   ? `Reading ${repNum}/${tutorReads} — listen closely…` :
               isWait    ? 'Get ready to repeat!' :
               isRecord  ? 'Listening to you…' :
               isEval    ? 'Checking your pronunciation…' :
               isFeedback ? 'Here\'s your feedback:' : ''}
            </p>
          </div>
          {(isIntro || isEval) && (
            <div className="flex gap-0.5 ml-auto">
              {[0,1,2].map(i => (
                <div key={i} className="w-1 bg-gold rounded-full animate-pulse"
                  style={{ height: `${8 + i*4}px`, animationDelay: `${i*0.15}s` }}/>
              ))}
            </div>
          )}
        </div>

        {/* Rep counter (intro phase) */}
        {isIntro && (
          <div className="flex gap-1.5 mb-3">
            {Array.from({ length: tutorReads }).map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all
                ${i < repNum - 1 ? 'bg-gold' : i === repNum - 1 ? 'bg-gold animate-pulse' : 'bg-ink-700'}`}/>
            ))}
          </div>
        )}

        {/* The sentence */}
        <p className={`font-display text-xl sm:text-2xl leading-relaxed mb-2
          ${isRecord ? 'text-red-200' : 'text-gray-100'}`}>
          {seg.text}
        </p>

        {/* Translation */}
        {seg.translation && (isIntro || isFeedback || isWait) && (
          <p className="text-sm text-gray-500 italic border-t border-white/[0.06] pt-2 mt-2">{seg.translation}</p>
        )}

        {/* Grammar note */}
        {seg.note && (isIntro || isFeedback) && (
          <p className="text-xs text-violet-soft/80 mt-2">💡 {seg.note}</p>
        )}

        {/* ── Countdown ── */}
        {isWait && countdown !== null && (
          <div className="flex flex-col items-center py-6">
            <div className="w-20 h-20 rounded-full border-4 border-gold flex items-center justify-center font-display text-5xl text-gold animate-pulse">
              {countdown}
            </div>
            <p className="text-gray-500 text-sm mt-3">Your turn in {countdown}…</p>
          </div>
        )}
        {isWait && countdown === 0 && (
          <div className="flex flex-col items-center py-4 gap-3">
            <p className="text-sm text-gray-400">Tap the mic to start speaking</p>
            <button onClick={() => setPhase({ name: 'line_record' })}
              className="w-16 h-16 rounded-full bg-ink-700 border-2 border-gold/40 hover:bg-gold/10 hover:border-gold flex items-center justify-center transition-all">
              <Mic size={28} className="text-gold"/>
            </button>
          </div>
        )}

        {/* ── Recording ── */}
        {isRecord && (
          <div className="flex flex-col items-center py-4 gap-3">
            <button onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center animate-pulse-ring">
              <Square size={28} className="text-red-400"/>
            </button>
            <p className="text-sm text-red-400 font-medium">🔴 Speak now!</p>
            {spokenText && (
              <div className="w-full bg-ink-700 rounded-xl px-4 py-3 text-sm text-gray-300 italic min-h-[44px] text-center">
                "{spokenText}"
              </div>
            )}
            <button onClick={stopRecording} className="btn-secondary text-xs gap-1.5">
              <Square size={11}/> Done speaking
            </button>
          </div>
        )}

        {/* ── Evaluating ── */}
        {isEval && (
          <div className="flex flex-col items-center py-8 gap-2">
            <div className="spinner w-8 h-8"/>
            <p className="text-gray-500 text-sm">Checking…</p>
          </div>
        )}

        {/* ── Feedback ── */}
        {isFeedback && sl && score !== null && (
          <div className="space-y-3 mt-2">
            {/* Score bar */}
            <div className="flex items-center justify-between mb-1">
              <p className={`font-display text-xl ${sl.color}`}>{sl.label}</p>
              <p className={`font-display text-3xl ${sl.color}`}>{score}<span className="text-sm text-gray-500">/100</span></p>
            </div>
            <div className="h-2 bg-black/20 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700
                ${score >= 85 ? 'bg-teal-soft' : score >= 65 ? 'bg-gold' : score >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                style={{ width: `${score}%` }}/>
            </div>

            {/* Comparison */}
            <div className="space-y-1.5 text-xs bg-black/10 rounded-xl p-3">
              <div className="flex gap-2 flex-wrap">
                <span className="text-gray-600 shrink-0 w-14">Target:</span>
                <span className="text-gray-200 font-medium">{seg.text}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-gray-600 shrink-0 w-14">You said:</span>
                <span className={`italic ${score >= 65 ? 'text-teal-soft' : 'text-orange-400'}`}>
                  "{spokenText || '— nothing detected —'}"
                </span>
              </div>
            </div>

            {/* Coach message */}
            <div className="flex gap-2 px-1">
              <span className="text-base shrink-0">👨‍🏫</span>
              <p className="text-sm text-gray-300 leading-relaxed">{coachMsg(score, attempt, currentMode, seg.text)}</p>
            </div>

            {/* Attempt dots */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all
                  ${i < attempt ? (score >= passThresh ? 'bg-teal-soft' : 'bg-red-400') : 'bg-ink-700'}`}/>
              ))}
              <span className="text-[10px] text-gray-600 ml-1">{attempt}/{MAX_ATTEMPTS} attempts</span>
            </div>

            {/* Actions */}
            {score >= passThresh ? (
              <div className="flex gap-2">
                <button onClick={() => advanceLine(true)} className="btn-primary flex-1 justify-center">
                  {isLastLine ? <><Trophy size={15}/> Finish!</> : <><ChevronRight size={15}/> Next Line</>}
                </button>
                <button onClick={() => speak(seg.text)} className="btn-secondary px-3"><Volume2 size={15}/></button>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button onClick={hearAgainAndRetry} className="btn-primary flex-1 justify-center gap-2">
                  <RotateCcw size={14}/> Hear again & retry
                </button>
                <button onClick={() => speak(seg.text)} className="btn-secondary px-3"><Volume2 size={15}/></button>
                {canSkip && (
                  <button onClick={() => advanceLine(false, true)}
                    className="btn-ghost text-xs text-gray-600 hover:text-orange-400 gap-1.5 w-full justify-center">
                    <SkipForward size={13}/> Skip this line
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Passed',    value: results.filter(r => r.passed).length,  color: 'text-teal-soft' },
          { label: 'Skipped',   value: results.filter(r => !r.passed).length, color: 'text-orange-400' },
          { label: 'Remaining', value: Math.max(0, segments.length - results.length - 1), color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="card-sm text-center">
            <p className={`font-display text-2xl ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Session Complete ─────────────────────────────────────────────────────────

interface CompleteProps {
  results: LineResult[]; segments: ReadingSegment[]; title: string
  totalPassed: number; totalSkipped: number; avgScore: number
  onExit: () => void; onRestart: () => void
}

function SessionComplete({ results, segments, title, totalPassed, totalSkipped, avgScore, onExit, onRestart }: CompleteProps) {
  const pct   = Math.round((totalPassed / segments.length) * 100)
  const medal = pct >= 90 ? '🥇' : pct >= 70 ? '🥈' : pct >= 50 ? '🥉' : '📚'

  return (
    <div className="card space-y-4 sm:space-y-5 animate-slide-up">
      <div className="text-center pt-2">
        <div className="text-5xl sm:text-6xl mb-3">{medal}</div>
        <h2 className="font-display text-2xl sm:text-3xl text-gray-100 mb-1">Session Complete!</h2>
        <p className="text-gray-500 text-sm">"{title}"</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Lines Passed',  value: `${totalPassed}/${segments.length}`, color: 'text-teal-soft' },
          { label: 'Avg Score',     value: `${avgScore}`,    color: 'text-gold',        suffix: '/100' },
          { label: 'Lines Skipped', value: `${totalSkipped}`, color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="card-sm text-center">
            <p className={`font-display text-xl sm:text-2xl ${s.color} leading-none`}>
              {s.value}{s.suffix && <span className="text-xs text-gray-600">{s.suffix}</span>}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="section-label">Line by Line</p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {results.map(r => {
            const sl = scoreLabel(r.bestScore)
            return (
              <div key={r.idx} className={`flex items-start gap-2 sm:gap-3 rounded-xl p-2.5 sm:p-3 border ${sl.bg}`}>
                {r.passed ? <CheckCircle2 size={14} className="text-teal-soft shrink-0 mt-0.5"/> : <XCircle size={14} className="text-orange-400 shrink-0 mt-0.5"/>}
                <p className="text-xs text-gray-300 flex-1 leading-relaxed truncate">{segments[r.idx]?.text}</p>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-medium ${sl.color}`}>{r.bestScore}/100</p>
                  <p className="text-[9px] text-gray-600">{r.attempts} try{r.attempts !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-2.5 bg-ink-800 rounded-xl p-3 sm:p-4">
        <span className="text-base sm:text-lg shrink-0">👨‍🏫</span>
        <p className="text-sm text-gray-300 leading-relaxed">
          {pct >= 90 ? 'Outstanding! Your German reading is excellent. Be very proud!'
           : pct >= 70 ? 'Great work! You passed most lines confidently.'
           : pct >= 50 ? 'Good effort! Try again and you\'ll improve each time.'
           : 'Keep practising — every attempt builds your ear. Try at a slower speed!'}
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={onRestart} className="btn-primary flex-1 justify-center"><RotateCcw size={15}/> Try Again</button>
        <button onClick={onExit} className="btn-secondary flex-1 justify-center"><BookOpen size={15}/> Back to Reader</button>
      </div>
    </div>
  )
}
