import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import {
  Mic, Square, Play, Volume2, RotateCcw, ChevronRight,
  CheckCircle2, XCircle, Star, Wand2, BookOpen, Target,
} from 'lucide-react'
import api from '../utils/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

interface Sentence {
  de: string
  en: string
  tip?: string
}

interface WordResult {
  word: string
  status: 'correct' | 'close' | 'wrong' | 'missing'
}

interface AttemptResult {
  transcript: string
  score: number            // 0–100
  fluencyScore: number
  accuracyScore: number
  wordResults: WordResult[]
  feedback: string
  tip: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVELS: { key: Level; label: string; color: string; bg: string; desc: string }[] = [
  { key: 'A1', label: 'A1', color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-400/30',    desc: 'Very short simple sentences' },
  { key: 'A2', label: 'A2', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-400/30',    desc: 'Simple everyday phrases' },
  { key: 'B1', label: 'B1', color: 'text-gold',       bg: 'bg-gold/10 border-gold/30',            desc: 'Intermediate sentences' },
  { key: 'B2', label: 'B2', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-400/30',desc: 'Complex structures' },
  { key: 'C1', label: 'C1', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-400/30',      desc: 'Advanced expression' },
]

const TOPICS = [
  'introduce yourself', 'daily routine', 'food & restaurant',
  'travel & directions', 'work & career', 'weather',
  'shopping', 'family', 'health', 'hobbies',
]

const SCORE_COLOR = (s: number) =>
  s >= 80 ? 'text-green-400' : s >= 60 ? 'text-gold' : s >= 40 ? 'text-orange-400' : 'text-red-400'

const SCORE_LABEL = (s: number) =>
  s >= 80 ? 'Excellent!' : s >= 60 ? 'Good' : s >= 40 ? 'Keep practising' : 'Needs work'

const WORD_COLORS: Record<string, string> = {
  correct: 'text-green-400 bg-green-500/10',
  close:   'text-yellow-400 bg-yellow-500/10',
  wrong:   'text-red-400 bg-red-500/10 line-through',
  missing: 'text-gray-600 bg-gray-700/20',
}

function speakDE(text: string, rate = 0.82) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = rate; u.pitch = 1.0
  speechSynthesis.speak(u)
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r     = (size / 2) - 8
  const circ  = 2 * Math.PI * r
  const dash  = (score / 100) * circ
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#f87171'
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}/>
      <text x={size/2} y={size/2} dominantBaseline="middle" textAnchor="middle"
        className="rotate-90" fill={color} fontSize="14" fontWeight="bold"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}
      </text>
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Stage = 'setup' | 'practice'

export default function SpeakingPage() {
  const [stage, setStage]           = useState<Stage>('setup')
  const [level, setLevel]           = useState<Level>('B1')
  const [topic, setTopic]           = useState('introduce yourself')
  const [customTopic, setCustomTopic] = useState('')
  const [sentences, setSentences]   = useState<Sentence[]>([])
  const [sentIdx, setSentIdx]       = useState(0)
  const [loading, setLoading]       = useState(false)

  // Recording
  const [recording, setRecording]   = useState(false)
  const [audioBlob, setAudioBlob]   = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl]     = useState<string | null>(null)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Results
  const [result, setResult]         = useState<AttemptResult | null>(null)
  const [scoring, setScoring]       = useState(false)
  const [sessionScores, setSessionScores] = useState<number[]>([])

  const currentSentence = sentences[sentIdx]

  // ── Generate sentences ──────────────────────────────────────────────────────
  const generateSentences = async () => {
    setLoading(true)
    const finalTopic = customTopic.trim() || topic
    try {
      const res = await api.post('/coach/sentences', { level, topic: finalTopic })
      setSentences(res.data.sentences)
      setSentIdx(0)
      setResult(null)
      setAudioBlob(null)
      setAudioUrl(null)
      setSessionScores([])
      setStage('practice')
    } catch { toast.error('Failed to generate sentences. Please try again.') }
    finally { setLoading(false) }
  }

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url  = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRef.current = mr
      mr.start()
      setRecording(true)
      setResult(null)
      setAudioBlob(null)
      setAudioUrl(null)
    } catch {
      toast.error('Microphone access denied. Please allow microphone permissions.')
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    setRecording(false)
  }

  // ── Score attempt ───────────────────────────────────────────────────────────
  const scoreAttempt = async () => {
    if (!currentSentence) return
    setScoring(true)
    try {
      // Use Web Speech API for transcription (client-side, free)
      const transcript = await transcribeWithWebSpeech(currentSentence.de)
      // Send transcript + target to backend for scoring
      const res = await api.post('/coach/score', {
        target:     currentSentence.de,
        transcript,
        level,
      })
      const r: AttemptResult = res.data
      setResult(r)
      setSessionScores(prev => [...prev, r.score])
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Scoring failed. Please try again.')
    } finally { setScoring(false) }
  }

  // Web Speech API transcription
  const transcribeWithWebSpeech = (targetHint: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        // Fallback: just use the audio blob if no SpeechRecognition API
        reject(new Error('Speech recognition not supported in this browser. Try Chrome.'))
        return
      }
      const recog = new SpeechRecognition()
      recog.lang             = 'de-DE'
      recog.interimResults   = false
      recog.maxAlternatives  = 1
      recog.continuous       = false

      let resolved = false
      recog.onresult = (e: any) => {
        resolved = true
        resolve(e.results[0][0].transcript)
      }
      recog.onerror = (e: any) => {
        if (!resolved) reject(new Error(`Recognition error: ${e.error}`))
      }
      recog.onend = () => {
        if (!resolved) reject(new Error('No speech detected. Please try again.'))
      }
      recog.start()
    })
  }

  // ── Live record + transcribe together ──────────────────────────────────────
  const [liveRecognition, setLiveRecognition] = useState<any>(null)
  const [liveTranscript, setLiveTranscript]   = useState('')
  const [isListening, setIsListening]          = useState(false)

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Speech recognition requires Chrome or Edge browser.')
      return
    }
    const recog = new SpeechRecognition()
    recog.lang = 'de-DE'
    recog.continuous = true
    recog.interimResults = true

    recog.onresult = (e: any) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      setLiveTranscript(final || interim)
    }
    recog.onerror = () => { setIsListening(false) }
    recog.onend   = () => { setIsListening(false) }
    recog.start()
    setLiveRecognition(recog)
    setIsListening(true)
    setLiveTranscript('')
    setResult(null)
  }, [])

  const stopListeningAndScore = useCallback(async () => {
    if (!liveRecognition) return
    liveRecognition.stop()
    setIsListening(false)
    if (!liveTranscript.trim()) {
      toast.warn('No speech detected. Please try again.')
      return
    }
    setScoring(true)
    try {
      const res = await api.post('/coach/score', {
        target:     currentSentence.de,
        transcript: liveTranscript,
        level,
      })
      const r: AttemptResult = res.data
      setResult(r)
      setSessionScores(prev => [...prev, r.score])
    } catch { toast.error('Scoring failed. Please try again.') }
    finally { setScoring(false) }
  }, [liveRecognition, liveTranscript, currentSentence, level])

  const nextSentence = () => {
    setSentIdx(i => Math.min(sentences.length - 1, i + 1))
    setResult(null)
    setLiveTranscript('')
    setIsListening(false)
  }

  const avgScore = sessionScores.length
    ? Math.round(sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length)
    : 0

  const lvl = LEVELS.find(l => l.key === level)!

  // ── SETUP ────────────────────────────────────────────────────────────────────
  if (stage === 'setup') return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl text-gold flex items-center gap-2">
          <Mic size={22}/> Speaking & Pronunciation
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Speak German aloud — AI scores your fluency and accuracy word by word
        </p>
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
              <span className="opacity-60 mt-0.5 text-center hidden sm:block leading-tight">{l.desc.split(' ')[0]}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600">{lvl.desc}</p>
      </div>

      {/* Topic */}
      <div className="card space-y-3">
        <p className="section-label">Topic</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map(t => (
            <button key={t} onClick={() => { setTopic(t); setCustomTopic('') }}
              className={`px-3 py-1.5 rounded-xl border text-xs capitalize transition-all
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

      {/* Info */}
      <div className="card space-y-2 text-sm text-gray-400">
        <p className="section-label">How it works</p>
        <div className="space-y-1.5">
          {[
            { icon: Volume2,       text: 'Listen to the target sentence spoken by native TTS' },
            { icon: Mic,           text: 'Record yourself speaking the same sentence in German' },
            { icon: Target,        text: 'AI compares your speech word by word and scores accuracy + fluency' },
            { icon: Star,          text: 'Get feedback and move to the next sentence' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex gap-2.5 items-start">
              <Icon size={13} className="text-gold shrink-0 mt-0.5"/>
              <span className="text-xs">{text}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 pt-1">
          ⚠️ Speech recognition works best in Chrome or Edge. Allow microphone access when prompted.
        </p>
      </div>

      <button onClick={generateSentences} disabled={loading}
        className="btn-primary w-full justify-center py-3 text-base">
        {loading ? <><span className="spinner"/> Generating sentences…</> : <><Wand2 size={17}/> Generate Practice Sentences</>}
      </button>
    </div>
  )

  // ── PRACTICE ─────────────────────────────────────────────────────────────────
  if (!currentSentence) return null
  const lvlCfg = LEVELS.find(l => l.key === level)!

  return (
    <div className="max-w-xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg text-gray-100 flex items-center gap-2">
            <Mic size={18} className="text-gold"/> Speaking Practice
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-bold ${lvlCfg.color}`}>{level}</span>
            <span className="text-xs text-gray-600 capitalize">{customTopic || topic}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-600">Sentence {sentIdx + 1}/{sentences.length}</p>
          {sessionScores.length > 0 && (
            <p className={`text-sm font-bold ${SCORE_COLOR(avgScore)}`}>Avg {avgScore}%</p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full transition-all duration-500"
          style={{ width: `${((sentIdx + 1) / sentences.length) * 100}%` }}/>
      </div>

      {/* Target sentence card */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-label">Target sentence</p>
          <div className="flex gap-1">
            <button onClick={() => speakDE(currentSentence.de, 0.65)}
              title="Slow" className="btn-ghost px-2 py-1 text-xs text-gray-500 hover:text-gold">
              Slow
            </button>
            <button onClick={() => speakDE(currentSentence.de, 0.90)}
              title="Normal" className="btn-ghost p-1.5 text-gray-500 hover:text-gold">
              <Volume2 size={16}/>
            </button>
          </div>
        </div>
        <p className="font-display text-xl text-gray-100 leading-snug">{currentSentence.de}</p>
        <p className="text-sm text-gray-500 italic">{currentSentence.en}</p>
        {currentSentence.tip && (
          <div className="flex gap-2 p-2.5 bg-gold/5 border border-gold/15 rounded-xl">
            <span>💡</span>
            <p className="text-xs text-gray-400">{currentSentence.tip}</p>
          </div>
        )}
      </div>

      {/* Record controls */}
      <div className="card space-y-4">
        <p className="section-label">Your turn</p>

        {/* Live transcript display */}
        <div className={`min-h-[48px] p-3 rounded-xl border text-sm transition-all ${
          isListening
            ? 'bg-red-500/5 border-red-400/30 text-gray-200'
            : liveTranscript
            ? 'bg-ink-800 border-white/[0.07] text-gray-300'
            : 'bg-ink-900 border-white/[0.04] text-gray-700 italic'
        }`}>
          {isListening
            ? <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/>{liveTranscript || 'Listening…'}</span>
            : liveTranscript || 'Your speech will appear here…'
          }
        </div>

        {/* Mic button */}
        <div className="flex items-center justify-center gap-3">
          {!isListening ? (
            <button onClick={startListening}
              className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-400/40 flex items-center justify-center hover:bg-red-500/20 transition-all hover:scale-105 active:scale-95">
              <Mic size={24} className="text-red-400"/>
            </button>
          ) : (
            <button onClick={stopListeningAndScore}
              className="w-16 h-16 rounded-full bg-red-500 border-2 border-red-400 flex items-center justify-center hover:bg-red-600 transition-all animate-pulse">
              <Square size={22} className="text-white"/>
            </button>
          )}
        </div>
        <p className="text-xs text-center text-gray-600">
          {isListening ? 'Speaking… tap square to stop and score' : 'Tap microphone to start speaking'}
        </p>

        {/* Score button (if transcript ready) */}
        {liveTranscript && !isListening && !result && (
          <button onClick={stopListeningAndScore} disabled={scoring}
            className="btn-primary w-full justify-center">
            {scoring ? <><span className="spinner"/> Scoring…</> : <><Target size={15}/> Score my pronunciation</>}
          </button>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="card space-y-4">
          {/* Score header */}
          <div className="flex items-center gap-4">
            <ScoreRing score={result.score} size={72}/>
            <div className="flex-1">
              <p className={`text-lg font-bold ${SCORE_COLOR(result.score)}`}>{SCORE_LABEL(result.score)}</p>
              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                <span>Fluency: <span className={SCORE_COLOR(result.fluencyScore)}>{result.fluencyScore}%</span></span>
                <span>Accuracy: <span className={SCORE_COLOR(result.accuracyScore)}>{result.accuracyScore}%</span></span>
              </div>
            </div>
          </div>

          {/* Word-by-word breakdown */}
          {result.wordResults.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-2">Word-by-word</p>
              <div className="flex flex-wrap gap-1.5">
                {result.wordResults.map((w, i) => (
                  <span key={i}
                    className={`px-2 py-1 rounded-lg text-sm font-medium ${WORD_COLORS[w.status] || 'text-gray-400'}`}>
                    {w.word}
                  </span>
                ))}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <span className="text-green-400">■ Correct</span>
                <span className="text-yellow-400">■ Close</span>
                <span className="text-red-400">■ Wrong/Missing</span>
              </div>
            </div>
          )}

          {/* Feedback */}
          {result.feedback && (
            <div className="p-3 bg-gold/5 border border-gold/15 rounded-xl">
              <p className="text-sm text-gray-300 leading-relaxed">{result.feedback}</p>
            </div>
          )}

          {/* Tip */}
          {result.tip && (
            <div className="flex gap-2 p-3 bg-blue-500/5 border border-blue-400/15 rounded-xl">
              <span>💡</span>
              <p className="text-xs text-gray-400">{result.tip}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => { setResult(null); setLiveTranscript('') }}
              className="btn-ghost flex-1 justify-center text-sm">
              <RotateCcw size={14}/> Retry
            </button>
            {sentIdx < sentences.length - 1 ? (
              <button onClick={nextSentence} className="btn-primary flex-1 justify-center text-sm">
                Next <ChevronRight size={14}/>
              </button>
            ) : (
              <button onClick={() => setStage('setup')} className="btn-primary flex-1 justify-center text-sm">
                <BookOpen size={14}/> New set
              </button>
            )}
          </div>
        </div>
      )}

      {/* Session score trail */}
      {sessionScores.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-600">Session:</span>
          {sessionScores.map((s, i) => (
            <span key={i} className={`text-xs font-mono font-bold ${SCORE_COLOR(s)}`}>{s}%</span>
          ))}
        </div>
      )}

      {/* Change settings */}
      <button onClick={() => setStage('setup')} className="btn-ghost text-xs text-gray-600 hover:text-gray-400 w-full">
        ← Change level or topic
      </button>
    </div>
  )
}
