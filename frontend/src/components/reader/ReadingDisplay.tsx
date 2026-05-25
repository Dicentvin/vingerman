import { useState } from 'react'
import { Volume2, Info } from 'lucide-react'
import type { ReadingContent } from '../../store/slices/readAloudSlice'
import type { SpeechMode } from '../../hooks/useGermanTTS'

interface Props {
  content: ReadingContent
  activeSegmentIdx: number | null
  onPlaySegment: (text: string, idx: number) => void
  onPlayWord: (word: string) => void
  currentMode: SpeechMode
  isSpeaking: boolean
}

const levelColors: Record<string, string> = {
  A1: 'badge-teal',
  A2: 'badge-teal',
  B1: 'badge-gold',
  B2: 'badge-gold',
  C1: 'badge-violet',
  C2: 'badge-violet',
}

export default function ReadingDisplay({
  content,
  activeSegmentIdx,
  onPlaySegment,
  onPlayWord,
  currentMode,
  isSpeaking,
}: Props) {
  const [hoveredWord, setHoveredWord] = useState<string | null>(null)
  const [showNote, setShowNote] = useState<number | null>(null)

  // Find gloss for a word
  const findGloss = (word: string) => {
    const clean = word.replace(/[^a-zA-ZäöüÄÖÜß]/g, '')
    return content.glossary.find(
      g => g.de.toLowerCase() === clean.toLowerCase() ||
           g.de.toLowerCase().includes(clean.toLowerCase())
    )
  }

  const modeLabel: Record<SpeechMode, string> = {
    learner:  '🐢 Slow',
    moderate: '🚶 Moderate',
    native:   '🏎️ Native',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl text-gray-100">{content.title}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`${levelColors[content.level] || 'badge-gold'}`}>{content.level}</span>
            <span className="text-xs text-gray-500">
              {content.segments.length} segment{content.segments.length !== 1 ? 's' : ''} ·{' '}
              {content.fullText.split(' ').length} words
            </span>
            <span className="text-xs text-gray-600">· Playing at {modeLabel[currentMode]}</span>
          </div>
        </div>
      </div>

      {/* Segments */}
      <div className="space-y-3">
        {content.segments.map((seg, idx) => {
          const isActive = activeSegmentIdx === idx
          const words = seg.text.split(/(\s+)/)

          return (
            <div
              key={idx}
              className={`relative rounded-2xl border p-4 transition-all duration-300
                ${isActive
                  ? 'bg-gold/5 border-gold/30 shadow-[0_0_20px_rgba(200,169,110,0.08)]'
                  : 'bg-ink-800 border-white/[0.06] hover:border-white/10'
                }`}
            >
              {/* Segment number + play button */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full
                  ${isActive ? 'bg-gold/20 text-gold' : 'bg-ink-700 text-gray-600'}`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <button
                  onClick={() => onPlaySegment(seg.text, idx)}
                  className={`btn-ghost py-1 px-2 text-xs gap-1.5
                    ${isActive && isSpeaking ? 'text-gold' : 'text-gray-500 hover:text-gold'}`}
                >
                  <Volume2 size={12} className={isActive && isSpeaking ? 'animate-pulse' : ''} />
                  {isActive && isSpeaking ? 'Playing…' : 'Play'}
                </button>
                {seg.note && (
                  <button
                    onClick={() => setShowNote(showNote === idx ? null : idx)}
                    className="btn-ghost py-1 px-2 text-xs gap-1.5 text-gray-600 hover:text-violet-soft ml-auto"
                  >
                    <Info size={11} />
                    Note
                  </button>
                )}
              </div>

              {/* Clickable words */}
              <p className="text-gray-100 leading-8 text-[15px] font-sans">
                {words.map((chunk, wIdx) => {
                  if (/^\s+$/.test(chunk)) return <span key={wIdx}>{chunk}</span>
                  const gloss = findGloss(chunk)
                  const isHovered = hoveredWord === `${idx}-${wIdx}`

                  return (
                    <span
                      key={wIdx}
                      className="relative inline-block"
                      onMouseEnter={() => setHoveredWord(`${idx}-${wIdx}`)}
                      onMouseLeave={() => setHoveredWord(null)}
                    >
                      <button
                        onClick={() => onPlayWord(chunk.replace(/[.,!?;:«»"]/g, ''))}
                        className={`transition-colors rounded px-0.5 -mx-0.5
                          ${gloss
                            ? 'text-gold/90 underline decoration-dotted decoration-gold/40 hover:text-gold'
                            : 'hover:text-teal-soft hover:bg-teal-muted'
                          }`}
                      >
                        {chunk}
                      </button>

                      {/* Word tooltip */}
                      {isHovered && gloss && (
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10
                          bg-ink-700 border border-white/10 rounded-lg px-3 py-2 text-xs
                          whitespace-nowrap shadow-xl pointer-events-none">
                          <span className="text-gold font-medium block">{gloss.de}</span>
                          <span className="text-gray-300">{gloss.en}</span>
                          {gloss.ipa && (
                            <span className="text-violet-soft block">{gloss.ipa}</span>
                          )}
                        </span>
                      )}
                    </span>
                  )
                })}
              </p>

              {/* Expandable grammar/cultural note */}
              {showNote === idx && seg.note && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <p className="text-xs text-violet-soft leading-relaxed">{seg.note}</p>
                </div>
              )}

              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-gold" />
              )}
            </div>
          )
        })}
      </div>

      {/* Glossary */}
      {content.glossary.length > 0 && (
        <div className="card mt-2">
          <h3 className="section-label">Vocabulary Glossary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {content.glossary.map((g, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
                <span className="text-gold font-medium text-sm w-28 shrink-0 truncate">{g.de}</span>
                <span className="text-gray-400 text-sm flex-1 truncate">{g.en}</span>
                {g.ipa && <span className="text-violet-soft text-xs shrink-0">{g.ipa}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
