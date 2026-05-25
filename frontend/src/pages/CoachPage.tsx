import { useState, useRef } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { evaluatePronunciation } from '../store/slices/pronounceSlice'
import { Mic, Square, Volume2, RotateCcw, Star } from 'lucide-react'

const DAILY_PHRASES = [
  { de: 'Ich heiße…',                   en: 'My name is…',            ipa: '[ikh HY-seh]' },
  { de: 'Woher kommen Sie?',            en: 'Where are you from?',    ipa: '[vo-HAIR KOM-en zee]' },
  { de: 'Ich komme aus Nigeria',        en: 'I come from Nigeria',    ipa: '[ikh KOM-eh ows nee-GAIR-ee-ah]' },
  { de: 'Auf Wiedersehen',             en: 'Goodbye',                 ipa: '[owf VEE-der-zayn]' },
  { de: 'Bitte sprechen Sie langsamer', en: 'Please speak more slowly', ipa: '[BIT-eh SHPREKH-en zee LANG-zah-mer]' },
  { de: 'Können Sie das wiederholen?', en: 'Can you repeat that?',    ipa: '[KER-nen zee das VEE-der-HOH-len]' },
]

export default function CoachPage() {
  const dispatch = useAppDispatch()
  const { feedback, score, evalLoading } = useAppSelector(s => s.pronounce)

  const [target, setTarget] = useState('Guten Morgen, wie geht es Ihnen?')
  const [spoken, setSpoken] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'; u.rate = 0.8
    speechSynthesis.speak(u)
  }

  const startRecording = () => {
    const SR = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return toast.error('Speech recognition not supported. Use Google Chrome.')

    const recognition = new SR()
    recognition.lang = 'de-DE'
    recognition.continuous = true
    recognition.interimResults = true

    let finalText = ''
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      setSpoken(finalText + interim)
    }
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      toast.error('Microphone error: ' + e.error)
      stopRecording()
    }
    recognition.onend = () => setIsRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setSpoken('')
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  const handleEvaluate = async () => {
    if (!spoken.trim()) return toast.error('Record yourself first')
    const result = await dispatch(evaluatePronunciation({ targetPhrase: target, spokenText: spoken }))
    if (result.error) toast.error(String(result.payload))
  }

  const handleClear = () => {
    stopRecording()
    setSpoken('')
  }

  const scoreColor = score !== null
    ? score >= 8 ? 'text-teal-soft' : score >= 5 ? 'text-gold' : 'text-red-400'
    : ''

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gray-100">Speaking Coach</h1>
        <p className="text-gray-500 text-sm mt-1">Record yourself speaking German and get AI feedback</p>
      </div>

      <div className="card mb-4">
        <label className="section-label">Target Phrase</label>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="Enter a German phrase to practice…"
          />
          <button onClick={() => speak(target)} className="btn-secondary px-3" title="Hear correct pronunciation">
            <Volume2 size={16} />
          </button>
        </div>
      </div>

      <div className="card mb-4 text-center">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center
            border-2 transition-all
            ${isRecording
              ? 'bg-red-500/10 border-red-500 animate-pulse-ring'
              : 'bg-ink-800 border-white/10 hover:border-gold/40 hover:bg-gold/5'
            }`}
        >
          {isRecording
            ? <Square size={28} className="text-red-400" />
            : <Mic size={28} className="text-gray-400" />
          }
        </button>
        <p className="text-sm text-gray-500 mb-3">
          {isRecording ? '🔴 Recording — speak your German phrase…' : 'Tap to start recording'}
        </p>

        <div className="bg-ink-800 rounded-xl p-4 min-h-[60px] text-sm text-left">
          {spoken
            ? <span className="text-gray-200 italic">"{spoken}"</span>
            : <span className="text-gray-600">Your speech will appear here…</span>
          }
        </div>

        <div className="flex gap-2 justify-center mt-4">
          <button onClick={handleEvaluate} className="btn-primary" disabled={evalLoading || !spoken}>
            {evalLoading ? <span className="spinner" /> : <Star size={15} />}
            Evaluate My Pronunciation
          </button>
          <button onClick={handleClear} className="btn-secondary">
            <RotateCcw size={14} /> Clear
          </button>
        </div>
      </div>

      {feedback && (
        <div className="card mb-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-200">AI Feedback</h3>
            {score !== null && (
              <div className={`font-display text-2xl ${scoreColor}`}>
                {score}<span className="text-sm text-gray-500">/10</span>
              </div>
            )}
          </div>
          <div className="bg-ink-800 rounded-xl p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
            {feedback}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-label">Practice Phrases — tap to set as target</h2>
        <div className="space-y-1">
          {DAILY_PHRASES.map(p => (
            <div
              key={p.de}
              className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0
                         cursor-pointer hover:bg-ink-800 rounded-lg px-2 -mx-2 transition-all group"
              onClick={() => setTarget(p.de)}
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200 group-hover:text-gold transition-colors">{p.de}</p>
                <p className="text-xs text-gray-500">{p.en} <span className="text-violet-soft">{p.ipa}</span></p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); speak(p.de) }}
                className="btn-ghost px-2 opacity-0 group-hover:opacity-100"
              >
                <Volume2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
