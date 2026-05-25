import { useState, useCallback, useRef, useEffect } from 'react'

export type SpeechMode = 'learner' | 'moderate' | 'native'

export interface SpeechModeConfig {
  key: SpeechMode
  label: string
  emoji: string
  rate: number
  pitch: number
  description: string
}

export const SPEECH_MODES: SpeechModeConfig[] = [
  {
    key: 'learner',
    label: 'Learner',
    emoji: '🐢',
    rate: 0.55,
    pitch: 1.0,
    description: 'Very slow & clear — perfect for beginners',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    emoji: '🚶',
    rate: 0.82,
    pitch: 1.0,
    description: 'Conversational pace — intermediate learners',
  },
  {
    key: 'native',
    label: 'Native',
    emoji: '🏎️',
    rate: 1.1,
    pitch: 1.02,
    description: 'Natural native speed — advanced learners',
  },
]

interface UseGermanTTSOptions {
  defaultMode?: SpeechMode
}

interface UseGermanTTSReturn {
  speak: (text: string, mode?: SpeechMode) => void
  stop: () => void
  isSpeaking: boolean
  isPaused: boolean
  pause: () => void
  resume: () => void
  currentMode: SpeechMode
  setMode: (mode: SpeechMode) => void
  availableVoices: SpeechSynthesisVoice[]
  selectedVoice: SpeechSynthesisVoice | null
  setVoice: (voice: SpeechSynthesisVoice) => void
  supported: boolean
}

const GERMAN_LANG_CODES = ['de-DE', 'de-AT', 'de-CH', 'de']

/** Pick the best German voice available */
function pickBestGermanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const german = voices.filter(v =>
    GERMAN_LANG_CODES.some(code => v.lang.startsWith(code))
  )
  if (!german.length) return null

  // Prefer: de-DE, then de-AT, then de-CH, then any
  // Within each, prefer non-default (often higher quality), then local
  const priority = ['de-DE', 'de-AT', 'de-CH']
  for (const lang of priority) {
    const match = german.filter(v => v.lang.startsWith(lang))
    // Prefer voices with "Google" or "Microsoft" or "Natural" in name (higher quality)
    const hq = match.find(v =>
      /google|microsoft|natural|neural|premium/i.test(v.name)
    )
    if (hq) return hq
    if (match.length) return match[0]
  }
  return german[0]
}

export function useGermanTTS({
  defaultMode = 'learner',
}: UseGermanTTSOptions = {}): UseGermanTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentMode, setCurrentMode] = useState<SpeechMode>(defaultMode)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Load voices (they load async in most browsers)
  useEffect(() => {
    if (!supported) return

    const loadVoices = () => {
      const voices = speechSynthesis.getVoices()
      const germanVoices = voices.filter(v =>
        GERMAN_LANG_CODES.some(code => v.lang.startsWith(code))
      )
      setAvailableVoices(germanVoices)
      if (!selectedVoice) {
        setSelectedVoice(pickBestGermanVoice(voices))
      }
    }

    loadVoices()
    speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [supported, selectedVoice])

  const stop = useCallback(() => {
    speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }, [])

  const pause = useCallback(() => {
    speechSynthesis.pause()
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    speechSynthesis.resume()
    setIsPaused(false)
  }, [])

  const speak = useCallback(
    (text: string, overrideMode?: SpeechMode) => {
      if (!supported || !text.trim()) return

      speechSynthesis.cancel()

      const mode = SPEECH_MODES.find(m => m.key === (overrideMode ?? currentMode))!
      const utterance = new SpeechSynthesisUtterance(text)

      utterance.lang  = selectedVoice?.lang ?? 'de-DE'
      utterance.rate  = mode.rate
      utterance.pitch = mode.pitch
      utterance.volume = 1

      if (selectedVoice) {
        utterance.voice = selectedVoice
      }

      utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false) }
      utterance.onend   = () => { setIsSpeaking(false); setIsPaused(false) }
      utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false) }
      utterance.onpause = () => setIsPaused(true)
      utterance.onresume = () => setIsPaused(false)

      utteranceRef.current = utterance
      speechSynthesis.speak(utterance)
    },
    [supported, currentMode, selectedVoice]
  )

  return {
    speak,
    stop,
    isSpeaking,
    isPaused,
    pause,
    resume,
    currentMode,
    setMode: setCurrentMode,
    availableVoices,
    selectedVoice,
    setVoice: setSelectedVoice,
    supported,
  }
}
