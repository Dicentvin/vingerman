import { useState } from 'react'
import { Volume2, Info, Table2, AlignLeft, Eye, EyeOff } from 'lucide-react'
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

type DisplayMode = 'table' | 'prose'

const levelColors: Record<string, string> = {
  A1: 'badge-teal', A2: 'badge-teal',
  B1: 'badge-gold', B2: 'badge-gold',
  C1: 'badge-violet', C2: 'badge-violet',
}

const modeLabel: Record<SpeechMode, string> = {
  learner: '🐢 Slow', moderate: '🚶 Moderate', native: '🏎️ Native',
}

export default function ReadingDisplay({
  content, activeSegmentIdx, onPlaySegment, onPlayWord, currentMode, isSpeaking,
}: Props) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table')
  const [showNote, setShowNote]       = useState<number | null>(null)
  const [hoveredWord, setHoveredWord] = useState<string | null>(null)
  const [hiddenTranslations, setHiddenTranslations] = useState<Set<number>>(new Set())
  const [hideAllTranslations, setHideAllTranslations] = useState(false)

  const toggleTranslation = (idx: number) => {
    setHiddenTranslations(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const isTranslationHidden = (idx: number) =>
    hideAllTranslations || hiddenTranslations.has(idx)

  // Find gloss entry for a word token
  const findGloss = (word: string) => {
    const clean = word.replace(/[^a-zA-ZäöüÄÖÜß]/g, '')
    if (!clean) return null
    return content.glossary.find(
      g => g.de.toLowerCase() === clean.toLowerCase() ||
           g.de.toLowerCase().startsWith(clean.toLowerCase().substring(0, 4))
    ) ?? null
  }

  // Render a German sentence with per-word click-to-hear + hover tooltip
  const renderGermanWords = (text: string, segIdx: number) => {
    const tokens = text.split(/(\s+)/)
    return (
      <span className="leading-8">
        {tokens.map((token, tIdx) => {
          if (/^\s+$/.test(token)) return <span key={tIdx}>{token}</span>
          const gloss    = findGloss(token)
          const hoverKey = `${segIdx}-${tIdx}`
          const isHov    = hoveredWord === hoverKey
          return (
            <span key={tIdx} className="relative inline-block"
              onMouseEnter={() => setHoveredWord(hoverKey)}
              onMouseLeave={() => setHoveredWord(null)}>
              <button
                onClick={() => onPlayWord(token.replace(/[.,!?;:«»"„"]/g, ''))}
                className={`transition-all rounded px-0.5 -mx-0.5 text-left
                  ${gloss
                    ? 'text-gold underline decoration-dotted decoration-gold/40 hover:text-gold hover:bg-gold/10'
                    : 'hover:text-teal-soft hover:bg-teal-muted'
                  }`}
              >
                {token}
              </button>
              {/* Tooltip */}
              {isHov && gloss && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20
                  bg-ink-700 border border-white/15 rounded-xl px-3 py-2.5
                  whitespace-nowrap shadow-2xl pointer-events-none text-left min-w-[120px]">
                  <span className="text-gold font-semibold text-xs block">{gloss.de}</span>
                  <span className="text-gray-300 text-xs block mt-0.5">{gloss.en}</span>
                  {gloss.ipa && <span className="text-violet-soft text-[10px] block mt-0.5">{gloss.ipa}</span>}
                </span>
              )}
            </span>
          )
        })}
      </span>
    )
  }

  // ── TABLE VIEW ──────────────────────────────────────────────────────────────

  const TableView = () => (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-ink-800 border-b border-white/[0.07]">
            <th className="w-8 px-3 py-3 text-left">
              <span className="text-[10px] text-gray-600 uppercase tracking-widest font-medium">#</span>
            </th>
            <th className="px-4 py-3 text-left w-1/2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gold uppercase tracking-widest">🇩🇪 German</span>
              </div>
            </th>
            <th className="px-4 py-3 text-left w-1/2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-soft uppercase tracking-widest">🇬🇧 English</span>
                <button
                  onClick={() => setHideAllTranslations(v => !v)}
                  className="btn-ghost py-0.5 px-2 text-[10px] gap-1 text-gray-500 hover:text-teal-soft"
                  title={hideAllTranslations ? 'Show all translations' : 'Hide all translations (test yourself)'}
                >
                  {hideAllTranslations ? <Eye size={11} /> : <EyeOff size={11} />}
                  {hideAllTranslations ? 'Reveal' : 'Hide all'}
                </button>
              </div>
            </th>
            <th className="w-10 px-2" />
          </tr>
        </thead>
        <tbody>
          {content.segments.map((seg, idx) => {
            const isActive  = activeSegmentIdx === idx
            const isHidden  = isTranslationHidden(idx)

            return (
              <tr
                key={idx}
                className={`border-b border-white/[0.05] last:border-0 transition-all duration-300
                  ${isActive ? 'bg-gold/[0.04]' : 'hover:bg-ink-800/60'}`}
              >
                {/* Row number */}
                <td className="px-3 py-4 align-top">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className={`text-[10px] font-mono w-6 h-6 rounded-full flex items-center justify-center
                      ${isActive ? 'bg-gold text-ink-950 font-bold' : 'bg-ink-700 text-gray-500'}`}>
                      {idx + 1}
                    </span>
                    {/* Play button */}
                    <button
                      onClick={() => onPlaySegment(seg.text, idx)}
                      className={`p-1 rounded-lg transition-colors
                        ${isActive && isSpeaking
                          ? 'text-gold bg-gold/10'
                          : 'text-gray-600 hover:text-gold hover:bg-gold/10'}`}
                      title="Play this line"
                    >
                      <Volume2 size={12} className={isActive && isSpeaking ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                </td>

                {/* German */}
                <td className="px-4 py-4 align-top">
                  <div className={`text-[15px] font-medium transition-all
                    ${isActive ? 'text-gray-50' : 'text-gray-200'}`}>
                    {renderGermanWords(seg.text, idx)}
                  </div>
                  {/* Grammar note */}
                  {seg.note && (
                    <div className="mt-2">
                      <button
                        onClick={() => setShowNote(showNote === idx ? null : idx)}
                        className="text-[10px] text-violet-soft/70 hover:text-violet-soft flex items-center gap-1 transition-colors"
                      >
                        <Info size={10} />
                        Grammar note
                      </button>
                      {showNote === idx && (
                        <p className="mt-1.5 text-[11px] text-violet-soft/90 leading-relaxed
                          bg-violet-muted border border-violet-soft/10 rounded-lg px-3 py-2">
                          {seg.note}
                        </p>
                      )}
                    </div>
                  )}
                </td>

                {/* English translation */}
                <td className="px-4 py-4 align-top">
                  {isHidden ? (
                    <button
                      onClick={() => toggleTranslation(idx)}
                      className="text-[13px] text-gray-700 italic hover:text-teal-soft transition-colors
                        border border-dashed border-white/10 rounded-lg px-3 py-1.5 hover:border-teal-soft/30"
                    >
                      Tap to reveal translation
                    </button>
                  ) : (
                    <div className="group relative">
                      <p className={`text-[14px] leading-relaxed transition-all
                        ${isActive ? 'text-teal-soft' : 'text-gray-400'}`}>
                        {seg.translation || <span className="text-gray-600 italic">No translation available</span>}
                      </p>
                      <button
                        onClick={() => toggleTranslation(idx)}
                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100
                          text-gray-700 hover:text-gray-500 transition-all p-1"
                        title="Hide this translation"
                      >
                        <EyeOff size={10} />
                      </button>
                    </div>
                  )}
                </td>

                {/* Active indicator */}
                <td className="px-2 align-top py-4">
                  {isActive && (
                    <div className="w-0.5 h-6 rounded-full bg-gold mx-auto" />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  // ── PROSE VIEW ──────────────────────────────────────────────────────────────

  const ProseView = () => (
    <div className="space-y-3">
      {content.segments.map((seg, idx) => {
        const isActive = activeSegmentIdx === idx
        const isHidden = isTranslationHidden(idx)

        return (
          <div
            key={idx}
            className={`relative rounded-2xl border p-4 transition-all duration-300
              ${isActive
                ? 'bg-gold/5 border-gold/30 shadow-[0_0_20px_rgba(200,169,110,0.07)]'
                : 'bg-ink-800 border-white/[0.06] hover:border-white/10'}`}
          >
            {isActive && <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-gold" />}

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
              <button
                onClick={() => toggleTranslation(idx)}
                className="btn-ghost py-1 px-2 text-[10px] gap-1 text-gray-600 hover:text-teal-soft ml-auto"
              >
                {isHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                {isHidden ? 'Show EN' : 'Hide EN'}
              </button>
              {seg.note && (
                <button
                  onClick={() => setShowNote(showNote === idx ? null : idx)}
                  className="btn-ghost py-1 px-2 text-[10px] gap-1 text-gray-600 hover:text-violet-soft"
                >
                  <Info size={11} /> Note
                </button>
              )}
            </div>

            {/* German */}
            <div className="text-gray-100 text-[15px]">
              {renderGermanWords(seg.text, idx)}
            </div>

            {/* English */}
            {!isHidden && seg.translation && (
              <div className="mt-3 pt-3 border-t border-white/[0.05] flex gap-2">
                <span className="text-[11px] text-teal-soft/60 shrink-0 mt-0.5">EN</span>
                <p className="text-sm text-gray-400 leading-relaxed italic">{seg.translation}</p>
              </div>
            )}
            {isHidden && (
              <button
                onClick={() => toggleTranslation(idx)}
                className="mt-2 text-xs text-gray-700 italic hover:text-teal-soft transition-colors"
              >
                … tap to show translation
              </button>
            )}

            {/* Grammar note */}
            {showNote === idx && seg.note && (
              <div className="mt-2.5 pt-2.5 border-t border-white/[0.06]">
                <p className="text-[11px] text-violet-soft leading-relaxed">{seg.note}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // ── GLOSSARY ────────────────────────────────────────────────────────────────

  const Glossary = () => (
    <div className="card">
      <h3 className="section-label">Vocabulary Glossary</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium w-1/3">🇩🇪 German</th>
              <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium w-1/3">🇬🇧 English</th>
              <th className="text-left py-2 text-xs text-gray-500 font-medium">Pronunciation</th>
            </tr>
          </thead>
          <tbody>
            {content.glossary.map((g, i) => (
              <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-ink-800/50 transition-colors">
                <td className="py-2.5 pr-4">
                  <button
                    onClick={() => onPlayWord(g.de)}
                    className="text-gold font-semibold hover:underline text-left group flex items-center gap-1.5"
                  >
                    {g.de}
                    <Volume2 size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-gold/60" />
                  </button>
                </td>
                <td className="py-2.5 pr-4 text-gray-300">{g.en}</td>
                <td className="py-2.5 text-violet-soft text-xs font-mono">{g.ipa || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── MAIN RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl text-gray-100">{content.title}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={levelColors[content.level] || 'badge-gold'}>{content.level}</span>
            <span className="text-xs text-gray-500">
              {content.segments.length} lines · {content.fullText.split(' ').length} words
            </span>
            <span className="text-xs text-gray-600">· {modeLabel[currentMode]}</span>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-ink-800 p-1 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => setDisplayMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${displayMode === 'table'
                ? 'bg-gold text-ink-950'
                : 'text-gray-400 hover:text-gray-200'}`}
          >
            <Table2 size={13} /> Table
          </button>
          <button
            onClick={() => setDisplayMode('prose')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${displayMode === 'prose'
                ? 'bg-gold text-ink-950'
                : 'text-gray-400 hover:text-gray-200'}`}
          >
            <AlignLeft size={13} /> Prose
          </button>
        </div>
      </div>

      {/* Practice tip */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-teal-muted border border-teal-soft/15 rounded-xl text-xs text-gray-400">
        <span className="shrink-0 mt-0.5">💡</span>
        <span>
          <span className="text-teal-soft font-medium">Click any German word</span> to hear it spoken.
          Underlined words have a glossary entry — hover to see the translation and pronunciation.
          Use <span className="text-teal-soft font-medium">Hide all</span> on the English column to test your comprehension.
        </span>
      </div>

      {/* Main content */}
      {displayMode === 'table' ? <TableView /> : <ProseView />}

      {/* Glossary */}
      {content.glossary.length > 0 && <Glossary />}
    </div>
  )
}
