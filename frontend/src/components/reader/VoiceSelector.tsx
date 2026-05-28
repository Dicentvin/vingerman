import { Mic2 } from 'lucide-react'

interface Props {
  voices: SpeechSynthesisVoice[]
  selected: SpeechSynthesisVoice | null
  onSelect: (v: SpeechSynthesisVoice) => void
}

function qualityBadge(voice: SpeechSynthesisVoice) {
  if (/neural|natural|premium/i.test(voice.name)) return { label: 'Neural', cls: 'badge-teal' }
  if (/google/i.test(voice.name))                  return { label: 'Google', cls: 'badge-gold' }
  if (/microsoft/i.test(voice.name))               return { label: 'Microsoft', cls: 'badge-violet' }
  return null
}

export default function VoiceSelector({ voices, selected, onSelect }: Props) {
  if (!voices.length) {
    return (
      <div className="text-xs text-gray-600 flex items-center gap-1.5 px-1">
        <Mic2 size={12} />
        No German voices installed. Use Chrome or install a German TTS voice for best results.
      </div>
    )
  }

  return (
    <div>
      <label className="section-label">German Voice</label>
      <div className="grid gap-1.5 max-h-48 overflow-y-auto pr-1">
        {voices.map(v => {
          const badge = qualityBadge(v)
          const isSelected = selected?.name === v.name
          return (
            <button
              key={v.name}
              onClick={() => onSelect(v)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                ${isSelected
                  ? 'bg-gold/10 border-gold/30 text-gold'
                  : 'bg-ink-800 border-white/[0.06] text-gray-600 hover:border-white/15 hover:text-gray-800'
                }`}
            >
              <Mic2 size={13} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{v.name}</p>
                <p className="text-[10px] text-gray-500">{v.lang}</p>
              </div>
              {badge && <span className={`${badge.cls} text-[9px]`}>{badge.label}</span>}
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
