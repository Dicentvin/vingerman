import { Play, Pause, Square, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import type { SpeechMode } from '../../hooks/useGermanTTS'

interface Props {
  isSpeaking: boolean
  isPaused: boolean
  onPlayAll: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  currentMode: SpeechMode
  segmentIdx: number | null
  totalSegments: number
}

const modeColor: Record<SpeechMode, string> = {
  learner:  'text-teal-soft',
  moderate: 'text-gold',
  native:   'text-violet-soft',
}

const modeEmoji: Record<SpeechMode, string> = {
  learner:  '🐢',
  moderate: '🚶',
  native:   '🏎️',
}

export default function PlaybackControls({
  isSpeaking, isPaused,
  onPlayAll, onPause, onResume, onStop,
  onPrev, onNext, canPrev, canNext,
  currentMode, segmentIdx, totalSegments,
}: Props) {
  return (
    <div className="card-sm flex items-center gap-3 flex-wrap">
      {/* Transport */}
      <div className="flex items-center gap-1">
        <button onClick={onPrev} disabled={!canPrev} className="btn-ghost px-2 disabled:opacity-30">
          <SkipBack size={15} />
        </button>

        {isSpeaking && !isPaused ? (
          <button onClick={onPause} className="btn-primary px-3 py-1.5">
            <Pause size={15} /> Pause
          </button>
        ) : isPaused ? (
          <button onClick={onResume} className="btn-primary px-3 py-1.5">
            <Play size={15} /> Resume
          </button>
        ) : (
          <button onClick={onPlayAll} className="btn-primary px-3 py-1.5">
            <Play size={15} /> Play All
          </button>
        )}

        <button onClick={onNext} disabled={!canNext} className="btn-ghost px-2 disabled:opacity-30">
          <SkipForward size={15} />
        </button>

        {(isSpeaking || isPaused) && (
          <button onClick={onStop} className="btn-ghost px-2 text-red-400 hover:text-red-300">
            <Square size={15} />
          </button>
        )}
      </div>

      {/* Progress */}
      {segmentIdx !== null && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Volume2 size={12} className={`${modeColor[currentMode]} animate-pulse`} />
          Segment {segmentIdx + 1} / {totalSegments}
        </div>
      )}

      {/* Mode badge */}
      <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
        <span>{modeEmoji[currentMode]}</span>
        <span className={modeColor[currentMode]}>
          {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} speed
        </span>
      </div>
    </div>
  )
}
