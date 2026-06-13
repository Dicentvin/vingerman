import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import {
  generateStory, fetchStoryHistory, loadStory, clearStory,
} from '../store/slices/storySlice'
import type { StoryLine } from '../store/slices/storySlice'
import {
  BookOpen, Play, Pause, Square, SkipBack, SkipForward,
  Volume2, Wand2, Eye, EyeOff, Info, RotateCcw,
  History, BookMarked, ChevronRight,
} from 'lucide-react'

// ─── Learner modes ────────────────────────────────────────────────────────────

const LEARNER_MODES = [
  {
    key: 'beginner',
    label: '🐢 Beginner',
    sublabel: 'A1 / A2',
    desc: 'Very slow · word by word · full support',
    rate: 0.48,
    pitch: 1.0,
    pauseMs: 2000,
    color: 'text-teal-soft',
    bg: 'bg-teal-muted border-teal-soft/40',
    inactive: 'bg-ink-800 border-white/[0.07] text-gray-400 hover:border-teal-soft/20',
    features: [
      '🔊 Each line read 3× before moving on',
      '🇬🇧 English translation always visible',
      '💡 Grammar notes shown automatically',
      '⏸️ Long pause between lines',
    ],
  },
  {
    key: 'intermediate',
    label: '🚶 Intermediate',
    sublabel: 'B1 / B2',
    desc: 'Conversational pace · line by line · tap to see translation',
    rate: 0.85,
    pitch: 1.0,
    pauseMs: 900,
    color: 'text-gold',
    bg: 'bg-gold/10 border-gold/40',
    inactive: 'bg-ink-800 border-white/[0.07] text-gray-400 hover:border-gold/20',
    features: [
      '🔊 Each line read once clearly',
      '🇬🇧 Tap any line to reveal English',
      '💡 Grammar notes on demand',
      '⏱️ Normal pause between lines',
    ],
  },
  {
    key: 'native',
    label: '🏎️ Native',
    sublabel: 'C1 / C2',
    desc: 'Full speed · German only · no scaffolding',
    rate: 1.1,
    pitch: 1.02,
    pauseMs: 400,
    color: 'text-violet-soft',
    bg: 'bg-violet-muted border-violet-soft/40',
    inactive: 'bg-ink-800 border-white/[0.07] text-gray-400 hover:border-violet-soft/20',
    features: [
      '🔊 Native natural speed',
      '🇩🇪 German only — no translations',
      '📖 Vocabulary tab for reference',
      '⚡ Minimal pause between lines',
    ],
  },
]

// ─── Genre / Level / Topic options ────────────────────────────────────────────

const GENRES = [
  { key: 'story',      label: '📖 Short Story',  desc: 'Narrative with characters' },
  { key: 'dialogue',   label: '💬 Dialogue',       desc: 'Two-person conversation' },
  { key: 'adventure',  label: '🏔️ Adventure',      desc: 'Exciting travel story' },
  { key: 'humor',      label: '😄 Humor',          desc: 'Funny with a twist' },
  { key: 'fairy_tale', label: '🧚 Fairy Tale',     desc: 'Märchen style' },
  { key: 'news',       label: '📰 News Article',   desc: 'Journalistic style' },
]

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']

const TOPICS = [
  'daily life', 'travel in Germany', 'food & cooking', 'work & office',
  'family', 'nature & weather', 'city & transport', 'health',
  'school', 'technology', 'German culture', 'sports',
]

const GENDER_TOPIC_MAP: Record<string, string> = {
  beginner:     'A1',
  intermediate: 'B1',
  native:       'C1',
}

// ─── Line Row Component ───────────────────────────────────────────────────────

function LineRow({
  line, isActive, isSpeaking, mode, revealedLines, onReveal, openNotes, onToggleNote, onSpeak,
}: {
  line: StoryLine
  isActive: boolean
  isSpeaking: boolean
  mode: string
  revealedLines: Set<number>
  onReveal: (n: number) => void
  openNotes: Set<number>
  onToggleNote: (n: number) => void
  onSpeak: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [isActive])

  const showEn = mode === 'beginner' || revealedLines.has(line.line)
  const showNoteAuto = mode === 'beginner' && !!line.note
  const noteOpen = openNotes.has(line.line) || showNoteAuto

  return (
    <div
      ref={ref}
      className={`rounded-2xl border transition-all duration-300
        ${isActive
          ? 'border-gold/35 bg-gold/[0.04] shadow-[0_0_20px_rgba(200,169,110,0.07)]'
          : 'border-white/[0.06] bg-ink-900 hover:border-white/10'}`}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        {/* Line number */}
        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono mt-0.5
          ${isActive ? 'bg-gold text-ink-950 font-bold' : 'bg-ink-700 text-gray-500'}`}>
          {line.line}
        </div>

        <div className="flex-1 min-w-0">
          {/* German text */}
          <p className={`text-sm sm:text-[15px] leading-relaxed font-medium
            ${isActive ? 'text-gray-50' : 'text-gray-200'}`}>
            {line.de}
          </p>

          {/* English — always shown for beginner, reveal on tap for intermediate, hidden for native */}
          {mode !== 'native' && (
            <>
              {showEn ? (
                <p className={`text-xs sm:text-sm mt-1 leading-relaxed italic
                  ${isActive ? 'text-teal-soft/80' : 'text-gray-400'}`}>
                  {line.en}
                </p>
              ) : (
                <button onClick={() => onReveal(line.line)}
                  className="text-[11px] text-gray-600 hover:text-teal-soft mt-1 transition-colors">
                  Tap to reveal English →
                </button>
              )}
            </>
          )}

          {/* Grammar note */}
          {line.note && noteOpen && (
            <div className="mt-2 px-3 py-2 bg-violet-muted border border-violet-soft/20 rounded-xl animate-fade-in">
              <p className="text-[11px] text-violet-soft leading-relaxed">💡 {line.note}</p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onSpeak}
            className={`btn-ghost p-1.5 ${isActive && isSpeaking ? 'text-gold' : 'text-gray-600 hover:text-gold'}`}>
            <Volume2 size={14} className={isActive && isSpeaking ? 'animate-pulse' : ''}/>
          </button>
          {line.note && mode !== 'beginner' && (
            <button onClick={() => onToggleNote(line.line)}
              className={`btn-ghost p-1.5 ${openNotes.has(line.line) ? 'text-violet-soft' : 'text-gray-700 hover:text-violet-soft'}`}>
              <Info size={13}/>
            </button>
          )}
        </div>
      </div>
      {isActive && <div className="h-0.5 bg-gold w-full rounded-b-2xl"/>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StoryPage() {
  const dispatch = useAppDispatch()
  const { current: story, history, loading } = useAppSelector(s => s.story)

  // Generator
  const [genre, setGenre]   = useState('story')
  const [level, setLevel]   = useState('A2')
  const [topic, setTopic]   = useState('daily life')
  const [customTopic, setCustomTopic] = useState('')

  // Learner mode
  const [modeKey, setModeKey] = useState('beginner')

  // Playback
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null)
  const [isSpeaking, setIsSpeaking]       = useState(false)
  const [isPaused, setIsPaused]           = useState(false)

  // UI
  const [revealedLines, setRevealedLines] = useState<Set<number>>(new Set())
  const [openNotes, setOpenNotes]         = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab]         = useState<'read' | 'vocab' | 'history'>('read')
  const [showGenerator, setShowGenerator] = useState(true)

  const playAllRef = useRef(false)
  const isMounted  = useRef(true)

  useEffect(() => {
    isMounted.current = true
    dispatch(fetchStoryHistory())
    return () => { isMounted.current = false; speechSynthesis.cancel() }
  }, [dispatch])

  // Auto-set level suggestion when mode changes
  useEffect(() => {
    setLevel(GENDER_TOPIC_MAP[modeKey] || 'A2')
  }, [modeKey])

  const mode = LEARNER_MODES.find(m => m.key === modeKey) || LEARNER_MODES[0]

  // ── TTS ─────────────────────────────────────────────────────────────────────

  const getVoice = () => {
    const voices = speechSynthesis.getVoices()
    return (
      voices.find(v => v.lang === 'de-DE' && /google|neural|natural/i.test(v.name)) ||
      voices.find(v => v.lang === 'de-DE') || null
    )
  }

  const speakLine = useCallback((text: string): Promise<void> => {
    return new Promise(resolve => {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'de-DE'; u.voice = getVoice()
      u.rate = mode.rate; u.pitch = mode.pitch; u.volume = 1
      u.onend = () => resolve()
      u.onerror = () => resolve()
      speechSynthesis.speak(u)
    })
  }, [mode])

  // ── Play all ────────────────────────────────────────────────────────────────

  const playAll = useCallback(async (startFrom = 0) => {
    if (!story) return
    playAllRef.current = true
    setIsSpeaking(true); setIsPaused(false)

    for (let i = startFrom; i < story.lines.length; i++) {
      if (!playAllRef.current || !isMounted.current) break
      setActiveLineIdx(i)

      // Beginner: read each line 3×
      const reps = modeKey === 'beginner' ? 3 : 1
      for (let r = 0; r < reps; r++) {
        if (!playAllRef.current || !isMounted.current) break
        await speakLine(story.lines[i].de)
        if (r < reps - 1) await new Promise(res => setTimeout(res, 600))
      }

      if (!playAllRef.current || !isMounted.current) break
      await new Promise(res => setTimeout(res, mode.pauseMs))
    }

    if (isMounted.current) {
      setIsSpeaking(false); setActiveLineIdx(null)
      playAllRef.current = false
    }
  }, [story, speakLine, modeKey, mode.pauseMs])

  const handlePlay = () => {
    if (isSpeaking) return
    playAll(activeLineIdx ?? 0)
  }

  const handlePause = () => {
    playAllRef.current = false
    speechSynthesis.pause()
    setIsPaused(true); setIsSpeaking(false)
  }

  const handleResume = () => {
    speechSynthesis.resume()
    setIsPaused(false); setIsSpeaking(true)
    playAll(activeLineIdx ?? 0)
  }

  const handleStop = useCallback(() => {
    playAllRef.current = false
    speechSynthesis.cancel()
    setIsSpeaking(false); setIsPaused(false); setActiveLineIdx(null)
  }, [])

  const handlePrev = () => {
    if (!story) return
    const prev = Math.max(0, (activeLineIdx ?? 0) - 1)
    handleStop()
    setTimeout(() => {
      setActiveLineIdx(prev)
      setIsSpeaking(true)
      speakLine(story.lines[prev].de).then(() => { if (isMounted.current) setIsSpeaking(false) })
    }, 100)
  }

  const handleNext = () => {
    if (!story) return
    const next = Math.min(story.lines.length - 1, (activeLineIdx ?? -1) + 1)
    handleStop()
    setTimeout(() => {
      setActiveLineIdx(next)
      setIsSpeaking(true)
      speakLine(story.lines[next].de).then(() => { if (isMounted.current) setIsSpeaking(false) })
    }, 100)
  }

  const speakSingle = (text: string, idx: number) => {
    playAllRef.current = false
    speechSynthesis.cancel()
    setActiveLineIdx(idx); setIsSpeaking(true)
    speakLine(text).then(() => { if (isMounted.current) setIsSpeaking(false) })
  }

  // ── Generate ────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    handleStop(); dispatch(clearStory())
    setActiveLineIdx(null); setRevealedLines(new Set())
    const t = customTopic.trim() || topic
    const result = await dispatch(generateStory({ level, topic: t, genre }))
    if (result.error) toast.error(String(result.payload))
    else { toast.success('Story ready! 📖'); setActiveTab('read'); setShowGenerator(false) }
  }

  const progress = story && activeLineIdx !== null
    ? Math.round(((activeLineIdx + 1) / story.lines.length) * 100) : 0

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">German Story Reader</h1>
        <p className="text-gray-500 text-sm mt-1">
          AI-generated 20-line stories — read at beginner, intermediate or native speed
        </p>
      </div>

      {/* ── LEARNER MODE TABS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {LEARNER_MODES.map(m => (
          <button key={m.key}
            onClick={() => { handleStop(); setModeKey(m.key) }}
            className={`flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-2xl border transition-all
              ${modeKey === m.key ? m.bg + ' ' + m.color : m.inactive}`}>
            <span className="text-2xl">{m.label.split(' ')[0]}</span>
            <span className="text-xs font-semibold leading-tight text-center">
              {m.label.split(' ').slice(1).join(' ')}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full
              ${modeKey === m.key ? 'bg-black/20' : 'bg-ink-700'}`}>
              {m.sublabel}
            </span>
          </button>
        ))}
      </div>

      {/* Mode description card */}
      <div className={`flex gap-3 p-4 rounded-2xl border mb-5 ${mode.bg}`}>
        <div className="flex-1">
          <p className={`text-sm font-semibold mb-2 ${mode.color}`}>{mode.label} Mode</p>
          <ul className="space-y-1">
            {mode.features.map((f, i) => (
              <li key={i} className="text-xs text-gray-300">{f}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── GENERATOR ─────────────────────────────────────────────────────── */}
      <div className="card mb-5">
        <button
          onClick={() => setShowGenerator(v => !v)}
          className="w-full flex items-center justify-between">
          <span className="section-label mb-0 flex items-center gap-2">
            <Wand2 size={13}/> Generate New Story
          </span>
          {showGenerator
            ? <span className="text-gray-500 text-xs">▲ Hide</span>
            : <span className="text-gray-500 text-xs">▼ Show</span>}
        </button>

        {showGenerator && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {/* Genre */}
            <div>
              <label className="section-label">Genre</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GENRES.map(g => (
                  <button key={g.key} onClick={() => setGenre(g.key)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-xs transition-all
                      ${genre === g.key
                        ? 'bg-gold/10 border-gold/40 text-gold'
                        : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15 hover:text-gray-200'}`}>
                    <span className="font-medium">{g.label}</span>
                    <span className="opacity-60 mt-0.5">{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Level */}
              <div>
                <label className="section-label">
                  CEFR Level
                  <span className="text-gray-600 normal-case font-normal ml-1">
                    (suggested: {GENDER_TOPIC_MAP[modeKey]})
                  </span>
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {CEFR_LEVELS.map(l => (
                    <button key={l} onClick={() => setLevel(l)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                        ${level === l
                          ? 'bg-gold/10 border-gold/40 text-gold'
                          : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="section-label">Topic</label>
                <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto">
                  {TOPICS.map(t => (
                    <button key={t} onClick={() => { setTopic(t); setCustomTopic('') }}
                      className={`text-[11px] px-2 py-1 rounded-md border transition-all capitalize
                        ${topic === t && !customTopic
                          ? 'bg-teal-muted border-teal-soft/30 text-teal-soft'
                          : 'bg-ink-800 border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <input className="input text-xs py-2" placeholder="Or custom topic…"
                  value={customTopic} onChange={e => setCustomTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}/>
              </div>
            </div>

            <button onClick={handleGenerate} className="btn-primary w-full justify-center" disabled={loading}>
              {loading
                ? <><span className="spinner"/> Generating {level} {genre}…</>
                : <><Wand2 size={15}/> Generate 20-Line {level} Story</>}
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="card text-center py-12">
          <div className="spinner w-8 h-8 mx-auto mb-3"/>
          <p className="text-gray-500 text-sm">Writing your story…</p>
          <p className="text-gray-600 text-xs mt-1">Generating 20 lines with translations</p>
        </div>
      )}

      {/* ── STORY CONTENT ─────────────────────────────────────────────────── */}
      {!loading && story && (
        <>
          {/* Title */}
          <div className="card mb-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1">
                <h2 className="font-display text-2xl text-gray-100">{story.title}</h2>
                {story.titleEn && modeKey !== 'native' && (
                  <p className="text-gray-500 text-sm italic mt-0.5">{story.titleEn}</p>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="badge-gold text-[10px]">{story.level}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${mode.bg} ${mode.color}`}>
                    {mode.label}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink-700 text-gray-400 border border-white/[0.06] capitalize">
                    {story.genre.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-gray-600 self-center">{story.lines.length} lines</span>
                </div>
              </div>
              <button onClick={() => { handleStop(); dispatch(clearStory()); setShowGenerator(true) }}
                className="btn-ghost text-xs text-gray-600 hover:text-red-400 shrink-0">
                ✕ Clear
              </button>
            </div>

            {/* Progress */}
            {activeLineIdx !== null && (
              <div className="mt-3">
                <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500
                    ${modeKey === 'beginner' ? 'bg-teal-soft' : modeKey === 'intermediate' ? 'bg-gold' : 'bg-violet-soft'}`}
                    style={{ width: `${progress}%` }}/>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">
                  Line {activeLineIdx + 1} of {story.lines.length}
                  {modeKey === 'beginner' && ' · reading 3×'}
                </p>
              </div>
            )}
          </div>

          {/* Transport */}
          <div className={`card-sm flex items-center gap-2 mb-4 flex-wrap border ${
            modeKey === 'beginner' ? 'border-teal-soft/20' :
            modeKey === 'intermediate' ? 'border-gold/20' : 'border-violet-soft/20'}`}>

            <button onClick={handlePrev}
              disabled={activeLineIdx === null || activeLineIdx === 0}
              className="btn-ghost px-2 disabled:opacity-30">
              <SkipBack size={16}/>
            </button>

            {isSpeaking && !isPaused ? (
              <button onClick={handlePause} className="btn-primary px-4 gap-2">
                <Pause size={15}/> Pause
              </button>
            ) : isPaused ? (
              <button onClick={handleResume} className="btn-primary px-4 gap-2">
                <Play size={15}/> Resume
              </button>
            ) : (
              <button onClick={handlePlay} className="btn-primary px-4 gap-2">
                <Play size={15}/>
                {activeLineIdx !== null && activeLineIdx > 0 ? 'Continue' : 'Play All'}
              </button>
            )}

            <button onClick={handleNext}
              disabled={!story || activeLineIdx === story.lines.length - 1}
              className="btn-ghost px-2 disabled:opacity-30">
              <SkipForward size={16}/>
            </button>

            {(isSpeaking || isPaused || activeLineIdx !== null) && (
              <button onClick={handleStop} className="btn-ghost px-2 text-red-400 hover:text-red-300">
                <Square size={15}/>
              </button>
            )}

            <button onClick={() => { handleStop(); setActiveLineIdx(null) }}
              className="btn-ghost px-2 text-gray-600" title="Restart">
              <RotateCcw size={13}/>
            </button>

            {/* Translation toggle — not for native */}
            {modeKey === 'intermediate' && (
              <button
                onClick={() => setRevealedLines(prev =>
                  prev.size === story.lines.length
                    ? new Set()
                    : new Set(story.lines.map(l => l.line))
                )}
                className="btn-ghost text-xs gap-1 ml-auto text-gray-500 hover:text-teal-soft">
                {revealedLines.size === story.lines.length
                  ? <><EyeOff size={12}/> Hide all EN</>
                  : <><Eye size={12}/> Show all EN</>}
              </button>
            )}

            {/* Speed label */}
            <span className={`text-[10px] font-medium ml-auto ${mode.color}`}>
              {mode.label} · {mode.rate}× speed
              {modeKey === 'beginner' && ' · 3 reps'}
            </span>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-ink-800 p-1 gap-1 mb-4">
            {([
              ['read',    '📖 Read'],
              ['vocab',   '📚 Vocab'],
              ['history', '🕘 History'],
            ] as const).map(([k, l]) => (
              <button key={k} onClick={() => setActiveTab(k)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all
                  ${activeTab === k ? 'bg-gold text-ink-950' : 'text-gray-400 hover:text-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* ── READ TAB ────────────────────────────────────────────────── */}
          {activeTab === 'read' && (
            <div className="space-y-2">
              {story.lines.map((line, idx) => (
                <LineRow
                  key={line.line}
                  line={line}
                  isActive={activeLineIdx === idx}
                  isSpeaking={isSpeaking}
                  mode={modeKey}
                  revealedLines={revealedLines}
                  onReveal={n => setRevealedLines(prev => new Set([...prev, n]))}
                  openNotes={openNotes}
                  onToggleNote={n => setOpenNotes(prev => {
                    const next = new Set(prev)
                    next.has(n) ? next.delete(n) : next.add(n)
                    return next
                  })}
                  onSpeak={() => speakSingle(line.de, idx)}
                />
              ))}
              <div className="text-center py-4">
                <p className="text-gray-600 text-xs">End of story · {story.lines.length} lines</p>
                <button onClick={() => { handleStop(); setActiveLineIdx(null); setTimeout(() => playAll(0), 100) }}
                  className="btn-ghost text-xs gap-1.5 text-gray-500 hover:text-gold mt-2">
                  <RotateCcw size={12}/> Read again from start
                </button>
              </div>
            </div>
          )}

          {/* ── VOCAB TAB ───────────────────────────────────────────────── */}
          {activeTab === 'vocab' && (
            <div className="card">
              <p className="section-label">Story Vocabulary ({story.vocabulary.length} words)</p>
              {story.vocabulary.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">Regenerate to get vocabulary</p>
              ) : (
                <div className="space-y-0.5">
                  {story.vocabulary.map((v, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                      <button onClick={() => {
                        speechSynthesis.cancel()
                        const u = new SpeechSynthesisUtterance(v.de)
                        u.lang = 'de-DE'; u.rate = 0.82
                        speechSynthesis.speak(u)
                      }}
                        className="font-semibold text-gold hover:underline text-sm flex items-center gap-1.5 group">
                        {v.de}
                        <Volume2 size={11} className="opacity-0 group-hover:opacity-60"/>
                      </button>
                      <span className="text-gray-400 text-sm flex-1">{v.en}</span>
                      {v.ipa && <span className="text-violet-soft text-xs font-mono shrink-0">{v.ipa}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ─────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="card text-center py-10">
                  <History size={32} className="text-gray-700 mx-auto mb-3"/>
                  <p className="text-gray-500 text-sm">No stories yet</p>
                </div>
              ) : history.map(h => (
                <div key={h._id}
                  onClick={() => { dispatch(loadStory(h._id)); setActiveTab('read') }}
                  className="card-sm flex items-start gap-3 cursor-pointer hover:border-white/15 transition-all">
                  <BookMarked size={16} className="text-gray-600 mt-0.5 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{h.title}</p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-gold">{h.level}</span>
                      <span className="text-[10px] text-gray-600 capitalize">{h.genre?.replace('_', ' ')}</span>
                      <span className="text-[10px] text-gray-600">
                        {new Date(h.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-600 shrink-0 mt-0.5"/>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !story && (
        <div className="card text-center py-16 border-dashed border-2 border-white/[0.05]">
          <BookOpen size={48} className="text-gray-700 mx-auto mb-4"/>
          <h3 className="font-display text-xl text-gray-500 mb-2">No story yet</h3>
          <p className="text-gray-600 text-sm max-w-xs mx-auto">
            Pick your learner mode, choose a genre and topic, then click Generate
          </p>
          <div className="flex justify-center gap-2 mt-5 flex-wrap">
            {LEARNER_MODES.map(m => (
              <span key={m.key} className={`text-xs px-3 py-1.5 rounded-full border ${m.bg} ${m.color}`}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
