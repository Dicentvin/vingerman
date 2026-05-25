import { SPEECH_MODES, SpeechMode, SpeechModeConfig } from '../../hooks/useGermanTTS'

interface Props {
  current: SpeechMode
  onChange: (mode: SpeechMode) => void
  disabled?: boolean
}

const modeColors: Record<SpeechMode, string> = {
  learner:  'border-teal-soft/50 bg-teal-muted text-teal-soft',
  moderate: 'border-gold/50 bg-gold/10 text-gold',
  native:   'border-violet-soft/50 bg-violet-muted text-violet-soft',
}

const modeInactive =
  'border-white/[0.07] bg-ink-800 text-gray-400 hover:border-white/20 hover:text-gray-200'

export default function SpeedModeSelector({ current, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {SPEECH_MODES.map((m: SpeechModeConfig) => (
        <button
          key={m.key}
          disabled={disabled}
          onClick={() => onChange(m.key)}
          className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
            text-left disabled:opacity-40 disabled:cursor-not-allowed
            ${current === m.key ? modeColors[m.key] : modeInactive}`}
        >
          <span className="text-xl">{m.emoji}</span>
          <div>
            <p className="text-sm font-medium leading-tight">{m.label}</p>
            <p className="text-[11px] opacity-70 mt-0.5 leading-tight">{m.description}</p>
          </div>
          {current === m.key && (
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider opacity-80">
              Active
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
