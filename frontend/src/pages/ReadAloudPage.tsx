import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'react-toastify'
import {
  BookOpen, Wand2, AlignLeft, ChevronDown, ChevronUp,
  FileText, Upload, RefreshCw, Loader2, FileWarning,
  GraduationCap, Eye,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import {
  generateReadingContent,
  submitCustomText,
  clearContent,
  readFromMaterial,
} from '../store/slices/readAloudSlice'
import { fetchMaterials } from '../store/slices/podcastSlice'
import { useGermanTTS } from '../hooks/useGermanTTS'
import SpeedModeSelector from '../components/reader/SpeedModeSelector'
import VoiceSelector from '../components/reader/VoiceSelector'
import ReadingDisplay from '../components/reader/ReadingDisplay'
import PlaybackControls from '../components/reader/PlaybackControls'
import TutorSession from '../components/reader/TutorSession'
import api from '../utils/api'
import type { Material } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']

const CONTENT_TYPES = [
  { key: 'story',       label: '📖 Short Story',      desc: 'Simple narrative with dialogue' },
  { key: 'dialogue',    label: '💬 Dialogue',          desc: 'Real conversation between two people' },
  { key: 'news',        label: '📰 News Article',      desc: 'Current events style writing' },
  { key: 'poem',        label: '🎭 Poem / Song Verse', desc: 'Rhythmic text for musical learners' },
  { key: 'description', label: '🏙️ Description',       desc: 'Vivid descriptive paragraph' },
]

const TOPICS = [
  'daily life', 'travel in Germany', 'food & cooking', 'work & career',
  'family & relationships', 'nature & environment', 'German culture',
  'technology', 'sports', 'history',
]

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', pptx: '📊', docx: '📝', doc: '📝', txt: '📃',
}

function fileIcon(type: string) { return FILE_ICONS[type?.toLowerCase()] || '📎' }
function fileSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

type TabKey = 'generate' | 'materials' | 'custom'
type ViewMode = 'reader' | 'tutor'

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReadAloudPage() {
  const dispatch = useAppDispatch()
  const { content, loading } = useAppSelector(s => s.readAloud)
  const { materials } = useAppSelector(s => s.podcast)

  const {
    speak, stop, pause, resume,
    isSpeaking, isPaused,
    currentMode, setMode,
    availableVoices, selectedVoice, setVoice,
    supported,
  } = useGermanTTS({ defaultMode: 'learner' })

  // Source panel state
  const [tab, setTab]               = useState<TabKey>('generate')
  const [level, setLevel]           = useState('B1')
  const [type, setType]             = useState('story')
  const [topic, setTopic]           = useState('daily life')
  const [customTopic, setCustomTopic] = useState('')
  const [customText, setCustomText] = useState('')
  const [showVoices, setShowVoices] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [extractingId, setExtractingId] = useState<string | null>(null)

  // Reader/tutor view
  const [viewMode, setViewMode]         = useState<ViewMode>('reader')
  const [activeSegmentIdx, setActiveSegmentIdx] = useState<number | null>(null)
  const playAllRef = useRef(false)

  useEffect(() => {
    if (tab === 'materials') dispatch(fetchMaterials())
  }, [tab, dispatch])

  // Switch back to reader if content is cleared
  useEffect(() => {
    if (!content) { setViewMode('reader'); setActiveSegmentIdx(null) }
  }, [content])

  // ─── Playback (reader mode) ───────────────────────────────────────────────

  const playSegment = useCallback((text: string, idx: number) => {
    setActiveSegmentIdx(idx)
    speak(text)
  }, [speak])

  const playWord = useCallback((word: string) => {
    stop(); speak(word)
  }, [speak, stop])

  const playAll = useCallback(() => {
    if (!content) return
    playAllRef.current = true
    let idx = 0
    const playNext = () => {
      if (!playAllRef.current || idx >= content.segments.length) {
        setActiveSegmentIdx(null); playAllRef.current = false; return
      }
      setActiveSegmentIdx(idx)
      const u = new SpeechSynthesisUtterance(content.segments[idx].text)
      u.lang  = selectedVoice?.lang ?? 'de-DE'
      u.voice = selectedVoice ?? null
      const cfg = currentMode === 'learner' ? { rate: 0.55, pitch: 1.0 }
        : currentMode === 'moderate'        ? { rate: 0.82, pitch: 1.0 }
        :                                     { rate: 1.1,  pitch: 1.02 }
      u.rate = cfg.rate; u.pitch = cfg.pitch
      u.onend   = () => { idx++; setTimeout(playNext, 400) }
      u.onerror = () => { setActiveSegmentIdx(null); playAllRef.current = false }
      speechSynthesis.cancel(); speechSynthesis.speak(u)
    }
    playNext()
  }, [content, currentMode, selectedVoice])

  const handleStop = useCallback(() => {
    playAllRef.current = false; stop(); setActiveSegmentIdx(null)
  }, [stop])

  const handlePrev = () => {
    if (activeSegmentIdx === null || !content) return
    playSegment(content.segments[Math.max(0, activeSegmentIdx - 1)].text, Math.max(0, activeSegmentIdx - 1))
  }
  const handleNext = () => {
    if (!content) return
    const start = activeSegmentIdx === null ? 0 : activeSegmentIdx + 1
    if (start < content.segments.length) playSegment(content.segments[start].text, start)
  }

  // ─── Content actions ──────────────────────────────────────────────────────

  const handleGenerate = async () => {
    handleStop()
    const t = customTopic.trim() || topic
    const result = await dispatch(generateReadingContent({ topic: t, level, type }))
    if (result.error) toast.error(String(result.payload))
    else { toast.success('Reading content ready! 📖'); setViewMode('reader') }
  }

  const handleCustom = async () => {
    if (!customText.trim()) return toast.error('Please paste some text first')
    handleStop()
    const result = await dispatch(submitCustomText({ text: customText, level }))
    if (result.error) toast.error(String(result.payload))
    else { toast.success('Text processed! ✅'); setViewMode('reader') }
  }

  const handleReadMaterial = async (mat: Material) => {
    handleStop()
    setSelectedMaterial(mat)
    setExtractingId(mat._id)
    const result = await dispatch(readFromMaterial({ materialId: mat._id, level }))
    setExtractingId(null)
    if (result.error) {
      toast.error(String(result.payload))
    } else {
      const { hasMore, totalChunks } = result.payload as { hasMore?: boolean; totalChunks?: number }
      if (hasMore && totalChunks)
        toast.info(`Showing first section — long documents are split into sections.`)
      else
        toast.success(`"${mat.title}" ready! Choose Reader or Tutor mode below. 🎧`)
      setViewMode('reader')
    }
  }

  const handleClear = () => {
    handleStop()
    setSelectedMaterial(null)
    setViewMode('reader')
    dispatch(clearContent())
  }

  const startTutor = () => {
    handleStop()
    setViewMode('tutor')
  }

  // ─── Shared sub-components ────────────────────────────────────────────────

  const LevelPicker = () => (
    <div>
      <label className="section-label">Your CEFR Level</label>
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
  )

  // ─── Right-panel content ──────────────────────────────────────────────────

  const renderRightPanel = () => {
    if (!content) {
      return (
        <div className="card flex flex-col items-center justify-center py-20 text-center border-dashed border-2 border-white/[0.05]">
          <BookOpen size={48} className="text-gray-700 mb-4" />
          <h3 className="font-display text-xl text-gray-500 mb-2">Nothing to read yet</h3>
          <p className="text-gray-600 text-sm max-w-xs">
            Generate an AI text, pick one of your uploaded files, or paste your own German
          </p>
          <div className="mt-6 flex gap-2 text-xs text-gray-700 flex-wrap justify-center">
            {['📄 PDF','📊 PPTX','📝 DOCX','📃 TXT'].map(l => (
              <span key={l} className="px-3 py-1.5 bg-ink-800 rounded-full">{l}</span>
            ))}
          </div>
          <div className="mt-3 flex gap-2 text-xs flex-wrap justify-center">
            <span className="px-3 py-1.5 bg-teal-muted rounded-full text-teal-soft">🐢 Learner</span>
            <span className="px-3 py-1.5 bg-gold/10 rounded-full text-gold">🚶 Moderate</span>
            <span className="px-3 py-1.5 bg-violet-muted rounded-full text-violet-soft">🏎️ Native</span>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {/* Material badge */}
        {selectedMaterial && (
          <div className="flex items-center gap-2 px-3 py-2 bg-teal-muted border border-teal-soft/20 rounded-xl text-xs text-teal-soft">
            <FileText size={13} />
            Reading from: <span className="font-medium">{selectedMaterial.title}</span>
            <span className="text-gray-600 ml-auto">{selectedMaterial.fileType?.toUpperCase()}</span>
          </div>
        )}

        {/* Mode toggle — Reader vs Tutor */}
        <div className="flex gap-2">
          <button
            onClick={() => { handleStop(); setViewMode('reader') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all
              ${viewMode === 'reader'
                ? 'bg-gold/10 border-gold/40 text-gold'
                : 'bg-ink-800 border-white/[0.07] text-gray-400 hover:text-gray-200 hover:border-white/15'}`}
          >
            <Eye size={15} /> Free Read
          </button>
          <button
            onClick={startTutor}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all
              ${viewMode === 'tutor'
                ? 'bg-violet-muted border-violet-soft/40 text-violet-soft'
                : 'bg-ink-800 border-white/[0.07] text-gray-400 hover:text-gray-200 hover:border-white/15'}`}
          >
            <GraduationCap size={15} /> Tutor Mode
          </button>
        </div>

        {/* Tutor mode description banner */}
        {viewMode === 'tutor' && (
          <div className="flex gap-3 px-4 py-3 bg-violet-muted border border-violet-soft/20 rounded-xl">
            <span className="text-xl shrink-0">👨‍🏫</span>
            <div className="text-xs text-gray-300 leading-relaxed">
              <p className="font-medium text-violet-soft mb-0.5">How Tutor Mode works</p>
              I'll read each line aloud, then give you a 3-second countdown. Repeat exactly what I said —
              I'll score your pronunciation and give feedback. Pass a line to move on,
              or I'll keep coaching you until you get it right.
            </div>
          </div>
        )}

        {/* READER MODE */}
        {viewMode === 'reader' && (
          <>
            <PlaybackControls
              isSpeaking={isSpeaking}
              isPaused={isPaused}
              onPlayAll={playAll}
              onPause={pause}
              onResume={resume}
              onStop={handleStop}
              onPrev={handlePrev}
              onNext={handleNext}
              canPrev={activeSegmentIdx !== null && activeSegmentIdx > 0}
              canNext={activeSegmentIdx === null || activeSegmentIdx < content.segments.length - 1}
              currentMode={currentMode}
              segmentIdx={activeSegmentIdx}
              totalSegments={content.segments.length}
            />
            <ReadingDisplay
              content={content}
              activeSegmentIdx={activeSegmentIdx}
              onPlaySegment={playSegment}
              onPlayWord={playWord}
              currentMode={currentMode}
              isSpeaking={isSpeaking}
            />
            <button onClick={handleClear} className="btn-ghost text-xs text-gray-600 hover:text-red-400">
              ✕ Clear and start over
            </button>
          </>
        )}

        {/* TUTOR MODE */}
        {viewMode === 'tutor' && (
          <TutorSession
            segments={content.segments}
            title={content.title}
            selectedVoice={selectedVoice}
            currentMode={currentMode}
            glossary={content.glossary}
            onExit={() => setViewMode('reader')}
          />
        )}
      </div>
    )
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gray-100">German Read Aloud</h1>
        <p className="text-gray-500 text-sm mt-1">
          Load your material then choose{' '}
          <span className="text-gold">Free Read</span> to listen,
          or <span className="text-violet-soft">Tutor Mode</span> to practise line-by-line with coaching
        </p>
      </div>

      {!supported && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          ⚠️ Speech synthesis not supported in this browser. Please use Chrome or Edge.
        </div>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">

        {/* ── LEFT: source + speed controls ──────────────────────────────── */}
        <div className="space-y-4">

          {/* Speed — hidden during active tutor session so it doesn't confuse */}
          {viewMode !== 'tutor' && (
            <div className="card">
              <label className="section-label">Reading Speed</label>
              <SpeedModeSelector current={currentMode} onChange={setMode} disabled={isSpeaking && !isPaused} />
            </div>
          )}

          {/* Source tabs */}
          <div className="card space-y-4">
            <div className="flex rounded-xl bg-ink-800 p-1 gap-1">
              {([
                { key: 'generate',  label: '✨ Generate' },
                { key: 'materials', label: '📁 My Files' },
                { key: 'custom',    label: '📋 Paste' },
              ] as { key: TabKey; label: string }[]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 py-2 text-[11px] font-medium rounded-lg transition-all
                    ${tab === t.key ? 'bg-gold text-ink-950' : 'text-gray-400 hover:text-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Generate ──────────────────────────────────────────── */}
            {tab === 'generate' && (
              <div className="space-y-3">
                <LevelPicker />
                <div>
                  <label className="section-label">Content Type</label>
                  <div className="space-y-1">
                    {CONTENT_TYPES.map(ct => (
                      <button key={ct.key} onClick={() => setType(ct.key)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all
                          ${type === ct.key
                            ? 'bg-gold/10 border-gold/30 text-gold'
                            : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200 hover:border-white/10'}`}>
                        <span className="font-medium">{ct.label}</span>
                        <span className="text-gray-600 ml-2">{ct.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="section-label">Topic</label>
                  <div className="flex flex-wrap gap-1 mb-2">
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
                  <input className="input text-sm" placeholder="Or enter custom topic…"
                    value={customTopic} onChange={e => setCustomTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()} />
                </div>
                <button onClick={handleGenerate} className="btn-primary w-full justify-center" disabled={loading}>
                  {loading ? <span className="spinner" /> : <Wand2 size={15} />}
                  {loading ? 'Generating…' : 'Generate Text'}
                </button>
              </div>
            )}

            {/* ── My Files ──────────────────────────────────────────── */}
            {tab === 'materials' && (
              <div className="space-y-3">
                <LevelPicker />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="section-label mb-0">Uploaded Files</label>
                    <button onClick={() => dispatch(fetchMaterials())} className="btn-ghost py-1 px-2 text-xs gap-1">
                      <RefreshCw size={11} /> Refresh
                    </button>
                  </div>

                  {materials.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">
                      <Upload size={28} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No files uploaded yet.</p>
                      <p className="text-xs mt-1">
                        Upload in the <span className="text-gold">File to Podcast</span> section.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {materials.map((mat: Material) => {
                        const isActive    = selectedMaterial?._id === mat._id && !!content
                        const isExtracting = extractingId === mat._id
                        return (
                          <div key={mat._id}
                            className={`rounded-xl border p-3 transition-all
                              ${isActive ? 'bg-gold/5 border-gold/30' : 'bg-ink-800 border-white/[0.06] hover:border-white/15'}`}>
                            <div className="flex items-start gap-2.5">
                              <span className="text-lg shrink-0 mt-0.5">{fileIcon(mat.fileType)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-200 truncate">{mat.title}</p>
                                <p className="text-[10px] text-gray-600 mt-0.5">
                                  {mat.fileType?.toUpperCase()} · {fileSize(mat.fileSize)}
                                  {mat.hasText && <span className="ml-2 text-teal-soft">✓ ready</span>}
                                </p>
                              </div>
                            </div>
                            {/* Status messages */}
                            {!mat.hasText && !isExtracting && (
                              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-500/80">
                                <FileWarning size={11} />
                                Click Load — text will be extracted from your file
                              </div>
                            )}
                            <div className="flex gap-1.5 mt-2.5">
                              {/* Load for reading */}
                              <button
                                onClick={() => handleReadMaterial(mat)}
                                disabled={loading || !!extractingId}
                                className={`btn-secondary flex-1 text-xs justify-center py-1.5
                                  ${isActive ? 'border-gold/30 text-gold' : ''}`}>
                                {isExtracting
                                  ? <><Loader2 size={12} className="animate-spin" /> Extracting…</>
                                  : isActive
                                  ? <><RefreshCw size={12} /> Reload</>
                                  : <><FileText size={12} /> Load</>}
                              </button>
                              {/* Load + immediately start tutor */}
                              {!isActive && (
                                <button
                                  onClick={async () => {
                                    handleStop()
                                    setSelectedMaterial(mat)
                                    setExtractingId(mat._id)
                                    const result = await dispatch(readFromMaterial({ materialId: mat._id, level }))
                                    setExtractingId(null)
                                    if (!result.error) setViewMode('tutor')
                                    else toast.error(String(result.payload))
                                  }}
                                  disabled={loading || !!extractingId}
                                  className="btn-secondary flex-1 text-xs justify-center py-1.5 border-violet-soft/30 text-violet-soft hover:bg-violet-muted">
                                  <GraduationCap size={12} /> Tutor
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-700 leading-relaxed border-t border-white/[0.05] pt-2">
                  Supports PDF (text-based), PPTX, DOCX & TXT. Scanned/image PDFs cannot be read — use Paste Text instead.
                </p>
              </div>
            )}

            {/* ── Paste text ────────────────────────────────────────── */}
            {tab === 'custom' && (
              <div className="space-y-3">
                <LevelPicker />
                <div>
                  <label className="section-label">Paste German Text</label>
                  <textarea className="textarea text-sm" rows={8}
                    placeholder="Paste any German text — news, book excerpt, lesson notes…"
                    value={customText} onChange={e => setCustomText(e.target.value)} />
                  <p className="text-[10px] text-gray-600 mt-1">Non-German text will still be annotated.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCustom} className="btn-primary flex-1 justify-center"
                    disabled={loading || !customText.trim()}>
                    {loading ? <span className="spinner" /> : <AlignLeft size={15} />}
                    {loading ? 'Processing…' : 'Load & Read'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!customText.trim()) return toast.error('Please paste some text first')
                      handleStop()
                      const result = await dispatch(submitCustomText({ text: customText, level }))
                      if (!result.error) setViewMode('tutor')
                      else toast.error(String(result.payload))
                    }}
                    disabled={loading || !customText.trim()}
                    className="btn-secondary px-3 border-violet-soft/30 text-violet-soft hover:bg-violet-muted">
                    <GraduationCap size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Voice selector — hidden during tutor (less noise) */}
          {viewMode !== 'tutor' && (
            <div className="card">
              <button className="w-full flex items-center justify-between text-left"
                onClick={() => setShowVoices(v => !v)}>
                <span className="section-label mb-0">
                  German Voice
                  {selectedVoice && (
                    <span className="ml-2 text-gold normal-case font-normal text-[10px]">
                      ({selectedVoice.name.split(' ').slice(0, 2).join(' ')})
                    </span>
                  )}
                </span>
                {showVoices
                  ? <ChevronUp size={14} className="text-gray-500" />
                  : <ChevronDown size={14} className="text-gray-500" />}
              </button>
              {showVoices && (
                <div className="mt-3">
                  <VoiceSelector voices={availableVoices} selected={selectedVoice} onSelect={setVoice} />
                </div>
              )}
            </div>
          )}

          {/* Tutor speed reminder */}
          {viewMode === 'tutor' && content && (
            <div className="card-sm">
              <label className="section-label">Tutor Reading Speed</label>
              <SpeedModeSelector current={currentMode} onChange={setMode} disabled={false} />
              <p className="text-[10px] text-gray-600 mt-2">
                The tutor reads at this speed. Start with Learner if you're having trouble.
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT: reader / tutor ────────────────────────────────────────── */}
        <div>
          {renderRightPanel()}
        </div>
      </div>
    </div>
  )
}
