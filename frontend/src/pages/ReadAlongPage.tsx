import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { fetchReadableChunks, evaluateReading, clearChunks, clearEval } from '../store/slices/podcastSlice'
import type { ReadChunk } from '../store/slices/podcastSlice'
import {
  ChevronLeft, Volume2, VolumeX, Mic, Square, ChevronRight,
  CheckCircle, XCircle, RotateCcw, BookOpen, Eye, EyeOff, Sparkles,
} from 'lucide-react'

declare global {
  interface Window { SpeechRecognition?: any; webkitSpeechRecognition?: any }
}

type Phase = 'listening' | 'waiting' | 'recording' | 'evaluating' | 'feedback' | 'done'

export default function ReadAlongPage() {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const dispatch  = useAppDispatch()

  const { readChunks, readTitle, readLanguage, loadingChunks, readingEval, evaluating } =
    useAppSelector(s => s.podcast as any)

  const [chunkIdx,     setChunkIdx]     = useState(0)
  const [phase,        setPhase]        = useState<Phase>('listening')
  const [spokenText,   setSpokenText]   = useState('')
  const [showTranslation, setShowTrans] = useState(false)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [scores,       setScores]       = useState<Record<number, number>>({})
  const [allFeedback,  setAllFeedback]  = useState<Record<number, any>>({})

  const recognitionRef = useRef<any>(null)
  const utteranceRef   = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (id) {
      dispatch(clearChunks())
      dispatch(fetchReadableChunks(id))
    }
    return () => { speechSynthesis.cancel(); dispatch(clearChunks()) }
  }, [id, dispatch])

  // Auto-read first chunk when loaded
  useEffect(() => {
    if (readChunks.length > 0 && phase === 'listening' && chunkIdx === 0) {
      // small delay so UI settles
      const t = setTimeout(() => speakChunk(readChunks[0]), 600)
      return () => clearTimeout(t)
    }
  }, [readChunks.length])

  const currentChunk: ReadChunk | undefined = readChunks[chunkIdx]
  const totalChunks = readChunks.length
  const progress = totalChunks ? ((chunkIdx) / totalChunks) * 100 : 0

  // ── TTS ───────────────────────────────────────────────────────────────────
  const speakChunk = useCallback((chunk: ReadChunk) => {
    speechSynthesis.cancel()
    setIsPlaying(true)
    setPhase('listening')
    dispatch(clearEval())
    setSpokenText('')

    const u = new SpeechSynthesisUtterance(chunk.text)
    u.lang  = readLanguage === 'de' ? 'de-DE' : 'en-US'
    u.rate  = 0.82
    u.pitch = 1
    u.onend = () => {
      setIsPlaying(false)
      setPhase('waiting')
    }
    u.onerror = () => { setIsPlaying(false); setPhase('waiting') }
    utteranceRef.current = u
    speechSynthesis.speak(u)
  }, [readLanguage, dispatch])

  const stopSpeaking = () => {
    speechSynthesis.cancel()
    setIsPlaying(false)
    setPhase('waiting')
  }

  // ── STT ───────────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Use Chrome for speech recognition'); return }

    const r = new SR()
    r.lang = readLanguage === 'de' ? 'de-DE' : 'en-US'
    r.continuous = true
    r.interimResults = true
    let final = ''

    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      setSpokenText((final + interim).trim())
    }
    r.onerror = () => { setPhase('waiting'); setIsPlaying(false) }
    r.onend = () => {}

    recognitionRef.current = r
    r.start()
    setPhase('recording')
    setSpokenText('')
  }, [readLanguage])

  const stopRecording = useCallback(async () => {
    recognitionRef.current?.stop()
    setPhase('evaluating')

    if (!currentChunk || !spokenText.trim()) {
      toast.error('Nothing recorded — try again')
      setPhase('waiting')
      return
    }

    const result = await dispatch(evaluateReading({
      originalText: currentChunk.text,
      spokenText: spokenText.trim(),
      chunkId: currentChunk.id,
    }))

    if (!('error' in result)) {
      const evalData = (result.payload as any)
      setAllFeedback(prev => ({ ...prev, [chunkIdx]: evalData }))
      setScores(prev => ({ ...prev, [chunkIdx]: evalData.score }))
      setPhase('feedback')
    } else {
      toast.error('Evaluation failed')
      setPhase('waiting')
    }
  }, [currentChunk, spokenText, chunkIdx, dispatch])

  const handleNext = useCallback(() => {
    if (chunkIdx < totalChunks - 1) {
      const nextIdx = chunkIdx + 1
      setChunkIdx(nextIdx)
      setPhase('listening')
      dispatch(clearEval())
      setSpokenText('')
      setShowTrans(false)
      setTimeout(() => speakChunk(readChunks[nextIdx]), 300)
    } else {
      setPhase('done')
    }
  }, [chunkIdx, totalChunks, readChunks, speakChunk, dispatch])

  const handleRetry = () => {
    setPhase('waiting')
    setSpokenText('')
    dispatch(clearEval())
  }

  const scoreColor = (s: number) => s >= 8 ? 'text-teal-soft' : s >= 5 ? 'text-gold' : 'text-red-400'
  const scoreBg    = (s: number) => s >= 8 ? 'bg-teal-muted border-teal-soft/20' : s >= 5 ? 'bg-gold/10 border-gold/20' : 'bg-red-500/10 border-red-400/20'

  const avgScore = Object.values(scores).length
    ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length)
    : null

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadingChunks) return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Sparkles size={32} className="text-gold animate-pulse" />
      <p className="text-gray-400 text-sm">Preparing your reading lesson…</p>
      <p className="text-gray-600 text-xs">AI is chunking the material into 4–5 sentence paragraphs</p>
    </div>
  )

  if (!readChunks.length) return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <BookOpen size={36} className="text-gray-700" />
      <p className="text-gray-500">No content found for this material</p>
      <button onClick={() => navigate('/materials')} className="btn-secondary">
        <ChevronLeft size={14} /> Back to Materials
      </button>
    </div>
  )

  // ── DONE screen ───────────────────────────────────────────────────────────
  if (phase === 'done') return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto animate-fade-in">
      <div className="card text-center py-10">
        <div className="text-5xl mb-4">{avgScore && avgScore >= 8 ? '🎉' : avgScore && avgScore >= 5 ? '👍' : '📚'}</div>
        <h2 className="font-display text-3xl text-gray-100 mb-1">Session Complete!</h2>
        <p className="text-gray-500 text-sm mb-6">You read all {totalChunks} sections of <span className="text-gold">"{readTitle}"</span></p>

        {avgScore !== null && (
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border mb-6 ${scoreBg(avgScore)}`}>
            <span className={`font-display text-2xl ${scoreColor(avgScore)}`}>{avgScore}/10</span>
            <span className="text-sm text-gray-400">average score</span>
          </div>
        )}

        {/* Per-chunk summary */}
        <div className="space-y-2 text-left mb-8">
          {readChunks.map((chunk, i) => {
            const s = scores[i]
            return (
              <div key={chunk.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${s !== undefined ? scoreBg(s) : 'bg-ink-800 border-white/[0.06]'}`}>
                <span className="text-xs text-gray-500 w-6 shrink-0">§{i + 1}</span>
                <p className="text-xs text-gray-300 flex-1 line-clamp-1">{chunk.text.slice(0, 70)}…</p>
                {s !== undefined
                  ? <span className={`text-sm font-medium shrink-0 ${scoreColor(s)}`}>{s}/10</span>
                  : <span className="text-xs text-gray-600 shrink-0">skipped</span>
                }
              </div>
            )
          })}
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={() => { setChunkIdx(0); setPhase('listening'); setScores({}); setAllFeedback({}); setTimeout(() => speakChunk(readChunks[0]), 300) }}
            className="btn-secondary">
            <RotateCcw size={14} /> Read Again
          </button>
          <button onClick={() => navigate('/materials')} className="btn-primary">
            <ChevronLeft size={14} /> Back to Materials
          </button>
        </div>
      </div>
    </div>
  )

  // ── Main reader ───────────────────────────────────────────────────────────
  const feedback = allFeedback[chunkIdx]

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => { speechSynthesis.cancel(); navigate('/materials') }} className="btn-ghost p-1.5">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-lg text-gray-100 truncate">{readTitle}</h1>
          <p className="text-xs text-gray-500">Section {chunkIdx + 1} of {totalChunks}</p>
        </div>
        {avgScore !== null && (
          <span className={`text-sm font-display ${scoreColor(avgScore)}`}>{avgScore}/10 avg</span>
        )}
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-ink-700 rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-gold rounded-full transition-all duration-500"
          style={{ width: `${progress + (1 / totalChunks) * 100}%` }} />
      </div>

      {/* Chunk scores strip */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {readChunks.map((_, i) => {
          const s = scores[i]
          return (
            <div key={i}
              className={`h-1 flex-1 rounded-full min-w-[20px] transition-all
                ${i === chunkIdx ? 'bg-gold' : s !== undefined ? (s >= 8 ? 'bg-teal-soft' : s >= 5 ? 'bg-gold/40' : 'bg-red-400') : 'bg-ink-700'}`}
            />
          )
        })}
      </div>

      {/* Main text card */}
      {currentChunk && (
        <div className="card mb-4">
          {/* Phase label */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {phase === 'listening' && isPlaying && (
                <span className="flex items-center gap-1.5 text-xs text-gold">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                  AI Reading…
                </span>
              )}
              {phase === 'waiting' && (
                <span className="text-xs text-violet-soft">Your turn to repeat</span>
              )}
              {phase === 'recording' && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  Recording…
                </span>
              )}
              {(phase === 'evaluating') && (
                <span className="flex items-center gap-1.5 text-xs text-violet-soft">
                  <span className="spinner w-3 h-3" /> Evaluating…
                </span>
              )}
              {phase === 'feedback' && feedback && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${scoreBg(feedback.score)}`}>
                  {feedback.score >= 8
                    ? <CheckCircle size={12} className="text-teal-soft" />
                    : <XCircle size={12} className="text-red-400" />
                  }
                  <span className={scoreColor(feedback.score)}>{feedback.score}/10 · {feedback.accuracy}% accuracy</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowTrans(t => !t)}
              className="btn-ghost px-2 py-1 text-xs text-gray-500"
              title="Toggle translation"
            >
              {showTranslation ? <EyeOff size={13} /> : <Eye size={13} />}
              {showTranslation ? 'Hide' : 'Translation'}
            </button>
          </div>

          {/* Text */}
          <div className={`text-gray-100 leading-relaxed text-base sm:text-lg mb-4 transition-all
            ${(phase === 'listening' && isPlaying) ? 'text-white' : ''}`}>
            {currentChunk.text}
          </div>

          {/* Translation */}
          {showTranslation && (
            <div className="p-3 bg-ink-800 rounded-xl text-sm text-gray-400 italic border border-white/[0.05] mb-4 animate-slide-up">
              {currentChunk.translation}
            </div>
          )}

          {/* Spoken text preview */}
          {(phase === 'recording' || phase === 'evaluating' || phase === 'feedback') && (
            <div className="p-3 bg-gold/5 border border-gold/15 rounded-xl text-sm text-gray-300 mb-4 animate-slide-up">
              <p className="text-xs text-gold/60 mb-1">Your reading:</p>
              <p className="italic">{spokenText || '…'}</p>
            </div>
          )}

          {/* AI Feedback */}
          {phase === 'feedback' && feedback && (
            <div className={`p-4 rounded-xl border animate-slide-up ${scoreBg(feedback.score)}`}>
              <p className="text-sm text-gray-200 leading-relaxed mb-2">{feedback.feedback}</p>
              {feedback.correction && feedback.correction !== 'Great job!' && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-xs text-gray-500 mb-1">Re-read this part correctly:</p>
                  <p className="text-sm text-gold italic">"{feedback.correction}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Listen / Stop */}
        {phase !== 'recording' && phase !== 'evaluating' && (
          <button
            onClick={isPlaying ? stopSpeaking : () => currentChunk && speakChunk(currentChunk)}
            className={`btn-secondary ${isPlaying ? 'border-gold/30 text-gold' : ''}`}
            disabled={phase === 'evaluating'}
          >
            {isPlaying ? <><VolumeX size={15} /> Stop</> : <><Volume2 size={15} /> Listen</>}
          </button>
        )}

        {/* Record / Stop recording */}
        {(phase === 'waiting' || phase === 'feedback') && (
          <button onClick={startRecording}
            className="btn-secondary border-violet-soft/30 text-violet-soft hover:bg-violet-muted"
          >
            <Mic size={15} /> {phase === 'feedback' ? 'Try Again' : 'Record My Reading'}
          </button>
        )}

        {phase === 'recording' && (
          <button onClick={stopRecording}
            className="btn-primary bg-red-500 hover:opacity-90 border-none animate-pulse"
          >
            <Square size={15} /> Stop & Evaluate
          </button>
        )}

        {/* Retry / Next */}
        {phase === 'feedback' && feedback && (
          <>
            {feedback.score < 6 && (
              <button onClick={handleRetry} className="btn-ghost text-sm">
                <RotateCcw size={13} /> Retry section
              </button>
            )}
            <button onClick={handleNext} className="btn-primary ml-auto">
              {chunkIdx < totalChunks - 1 ? <><ChevronRight size={15} /> Next Section</> : <>Finish 🎉</>}
            </button>
          </>
        )}

        {/* Skip (for waiting phase) */}
        {phase === 'waiting' && (
          <button onClick={handleNext} className="btn-ghost text-sm ml-auto text-gray-600">
            Skip <ChevronRight size={13} />
          </button>
        )}
      </div>

      {/* How it works hint */}
      {phase === 'waiting' && (
        <div className="mt-5 p-3 bg-ink-800 rounded-xl text-xs text-gray-500 flex flex-col gap-1 animate-slide-up">
          <p>🔊 Tap <strong className="text-gray-300">Listen</strong> to hear the AI read again at any time</p>
          <p>🎙️ Tap <strong className="text-gray-300">Record My Reading</strong> to read the text aloud</p>
          <p>✅ Tap <strong className="text-gray-300">Stop & Evaluate</strong> when done — AI will score and correct you</p>
          <p>💡 Toggle <strong className="text-gray-300">Translation</strong> if you need help with meaning</p>
        </div>
      )}
    </div>
  )
}
