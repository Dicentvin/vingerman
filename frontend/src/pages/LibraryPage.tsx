import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import {
  Library, Search, Trash2, Volume2, ChevronLeft, ChevronRight,
  BookOpen, Zap, Tag, Filter, X, BarChart2, RefreshCw, BookMarked,
} from 'lucide-react'
import api from '../utils/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LibraryWord {
  _id: string
  de: string
  en: string
  ipa?: string
  source: 'article' | 'grammar' | 'vocab'
  partOfSpeech: string
  gender?: string
  plural?: string
  conjugations?: { ich: string; du: string; er: string; wir: string; ihr: string; sie: string }
  comparative?: string
  superlative?: string
  example?: string
  exampleEn?: string
  tip?: string
  category?: string
  volume: number
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface Stats {
  total: number
  byPartOfSpeech: { _id: string; count: number }[]
  bySource: { _id: string; count: number }[]
}

interface StoryEntry {
  _id: string
  title: string
  titleEn: string
  level: string
  topic: string
  genre: string
  source: 'story' | 'comprehension'
  generatedCount: number
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  noun:        { label: 'Noun',        emoji: '📦', color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-400/30' },
  verb:        { label: 'Verb',        emoji: '⚡', color: 'text-teal-400',    bg: 'bg-teal-500/10 border-teal-400/30' },
  adjective:   { label: 'Adjective',   emoji: '🎨', color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-400/30' },
  adverb:      { label: 'Adverb',      emoji: '🔄', color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-400/30' },
  preposition: { label: 'Preposition', emoji: '🔗', color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-400/30' },
  conjunction: { label: 'Conjunction', emoji: '🔀', color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-400/30' },
  pronoun:     { label: 'Pronoun',     emoji: '👤', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-400/30' },
  mixed:       { label: 'Mixed',       emoji: '🎲', color: 'text-gold',        bg: 'bg-gold/10 border-gold/30' },
  unknown:     { label: 'Other',       emoji: '❓', color: 'text-gray-400',    bg: 'bg-gray-500/10 border-gray-400/30' },
}

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  article:       { label: 'Article Drill',  color: 'text-blue-400' },
  grammar:       { label: 'Grammar Drill',  color: 'text-gold' },
  vocab:         { label: 'Vocabulary',     color: 'text-teal-400' },
  story:         { label: 'Story Reader',   color: 'text-purple-400' },
  comprehension: { label: 'Comprehension',  color: 'text-violet-400' },
}

const LEVEL_COLORS: Record<string, string> = {
  A1: 'text-teal-400', A2: 'text-blue-400', B1: 'text-gold',
  B2: 'text-orange-400', C1: 'text-red-400',
}

const GENRE_EMOJI: Record<string, string> = {
  story: '📖', news: '📰', dialogue: '💬', letter: '✉️',
  description: '🏙️', opinion: '💭', adventure: '⚡', humor: '😄', fairy_tale: '🧚',
}

const GENDER_COLORS: Record<string, string> = {
  der: 'text-blue-400',
  die: 'text-pink-400',
  das: 'text-green-400',
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az',     label: 'A → Z' },
  { value: 'za',     label: 'Z → A' },
  { value: 'volume', label: 'Most generated' },
]

const LIMIT_OPTIONS = [20, 30, 50]

function speakDE(text: string) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = 0.82; u.pitch = 1.0
  speechSynthesis.speak(u)
}

function posInfo(pos: string) {
  return POS_CONFIG[pos] || POS_CONFIG.unknown
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ─── Expanded row detail ──────────────────────────────────────────────────────

function WordDetail({ word, onClose }: { word: LibraryWord; onClose: () => void }) {
  const pos = posInfo(word.partOfSpeech)
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <div className="relative w-full max-w-lg card space-y-4 max-h-[80vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${pos.bg} ${pos.color}`}>
                {pos.emoji} {pos.label}
              </span>
              {word.source && (
                <span className={`text-xs ${SOURCE_CONFIG[word.source]?.color || 'text-gray-500'}`}>
                  {SOURCE_CONFIG[word.source]?.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-3xl text-gray-100">{word.de}</h2>
              <button onClick={() => speakDE(word.de)} className="btn-ghost p-1.5 text-gray-500 hover:text-gold">
                <Volume2 size={16}/>
              </button>
            </div>
            {word.ipa && <p className="text-violet-400 font-mono text-sm">{word.ipa}</p>}
            <p className="text-gray-400 mt-0.5">{word.en}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-gray-600 hover:text-gray-300">
            <X size={18}/>
          </button>
        </div>

        {/* Noun info */}
        {word.gender && (
          <div className="flex gap-3 text-sm">
            <span className={`font-bold ${GENDER_COLORS[word.gender] || 'text-gray-400'}`}>
              {word.gender} {word.de.replace(/^(der|die|das)\s+/i, '')}
            </span>
            {word.plural && <span className="text-gray-500">Plural: <span className="text-gray-300">{word.plural}</span></span>}
          </div>
        )}

        {/* Verb conjugations */}
        {word.conjugations && Object.values(word.conjugations).some(Boolean) && (
          <div>
            <p className="section-label mb-2">Conjugations (Present)</p>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(word.conjugations).map(([pro, form]) => (
                <div key={pro} className="bg-ink-800 rounded-lg px-3 py-1.5 text-xs">
                  <span className="text-gray-500">{pro} </span>
                  <span className="text-gray-200 font-medium">{form}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adjective forms */}
        {(word.comparative || word.superlative) && (
          <div className="flex gap-4 text-sm">
            {word.comparative && <span className="text-gray-400">Comp: <span className="text-gray-200">{word.comparative}</span></span>}
            {word.superlative && <span className="text-gray-400">Superl: <span className="text-gray-200">{word.superlative}</span></span>}
          </div>
        )}

        {/* Example */}
        {word.example && (
          <div className="p-3 bg-ink-800 border border-white/[0.06] rounded-xl">
            <button onClick={() => speakDE(word.example!)}
              className="text-sm text-gray-200 italic text-left hover:text-gold transition-colors flex gap-2 group w-full">
              <span>"{word.example}"</span>
              <Volume2 size={12} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-60"/>
            </button>
            {word.exampleEn && <p className="text-xs text-gray-500 mt-1">— {word.exampleEn}</p>}
          </div>
        )}

        {word.tip && (
          <div className="flex gap-2.5 p-3 bg-gold/5 border border-gold/15 rounded-xl">
            <span>💡</span>
            <p className="text-sm text-gray-300">{word.tip}</p>
          </div>
        )}

        <p className="text-xs text-gray-600">
          Added {formatDate(word.createdAt)} · Generated {word.volume}×
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [activeTab, setActiveTab]     = useState<'words' | 'stories'>('words')
  const [words, setWords]             = useState<LibraryWord[]>([])
  const [stories, setStories]         = useState<StoryEntry[]>([])
  const [storyTotal, setStoryTotal]   = useState(0)
  const [storyPage, setStoryPage]     = useState(1)
  const [storySearch, setStorySearch] = useState('')
  const [debouncedStorySearch, setDebouncedStorySearch] = useState('')
  const [storySourceFilter, setStorySourceFilter] = useState('')
  const [storyLoading, setStoryLoading] = useState(false)
  const [pagination, setPagination]   = useState<Pagination | null>(null)
  const [stats, setStats]             = useState<Stats | null>(null)
  const [loading, setLoading]         = useState(false)
  const [selected, setSelected]       = useState<LibraryWord | null>(null)

  // Filters
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterPos, setFilterPos]     = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [sort, setSort]               = useState('az')
  const [page, setPage]               = useState(1)
  const [limit, setLimit]             = useState(30)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedStorySearch(storySearch); setStoryPage(1) }, 400)
    return () => clearTimeout(t)
  }, [storySearch])

  const fetchWords = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit, sort }
      if (debouncedSearch) params.search = debouncedSearch
      if (filterPos)       params.partOfSpeech = filterPos
      if (filterSource)    params.source = filterSource
      const res = await api.get('/library', { params })
      setWords(res.data.words)
      setPagination(res.data.pagination)
    } catch {
      toast.error('Failed to load library')
    } finally {
      setLoading(false)
    }
  }, [page, limit, sort, debouncedSearch, filterPos, filterSource])

  const fetchStories = useCallback(async () => {
    setStoryLoading(true)
    try {
      const params: Record<string, string | number> = { page: storyPage, limit: 20 }
      if (debouncedStorySearch) params.search = debouncedStorySearch
      if (storySourceFilter)    params.source  = storySourceFilter
      const res = await api.get('/library/stories', { params })
      setStories(res.data.stories)
      setStoryTotal(res.data.pagination.total)
    } catch {
      toast.error('Failed to load story library')
    } finally {
      setStoryLoading(false)
    }
  }, [storyPage, debouncedStorySearch, storySourceFilter])

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/library/stats')
      setStats(res.data)
    } catch {}
  }, [])

  useEffect(() => { fetchWords() }, [fetchWords])
  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { if (activeTab === 'stories') fetchStories() }, [fetchStories, activeTab])

  const handleStoryDelete = async (id: string) => {
    try {
      await api.delete(`/library/stories/${id}`)
      setStories(prev => prev.filter(s => s._id !== id))
      setStoryTotal(t => t - 1)
      toast.success('Removed from library')
    } catch {
      toast.error('Failed to remove story')
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.delete(`/library/${id}`)
      setWords(prev => prev.filter(w => w._id !== id))
      if (stats) setStats(s => s ? { ...s, total: s.total - 1 } : s)
      toast.success('Removed from library')
    } catch {
      toast.error('Failed to remove word')
    }
  }

  const clearFilters = () => {
    setSearch(''); setFilterPos(''); setFilterSource(''); setSort('newest'); setPage(1)
  }

  const hasFilters = search || filterPos || filterSource || sort !== 'az'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-gold flex items-center gap-2">
            <Library size={22}/> Word Library
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Every word you've generated — no duplicates, tracked by type & frequency
          </p>
        </div>
        <button onClick={() => { fetchWords(); fetchStats() }}
          className="btn-ghost p-2 text-gray-500 hover:text-gold" title="Refresh">
          <RefreshCw size={16}/>
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 bg-ink-800 rounded-xl border border-white/[0.07] w-fit">
        <button onClick={() => setActiveTab('words')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${activeTab === 'words' ? 'bg-gold/10 text-gold border border-gold/30' : 'text-gray-500 hover:text-gray-300'}`}>
          <BookOpen size={15}/> Words
          {stats && <span className="text-xs opacity-60">({stats.total})</span>}
        </button>
        <button onClick={() => setActiveTab('stories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${activeTab === 'stories' ? 'bg-gold/10 text-gold border border-gold/30' : 'text-gray-500 hover:text-gray-300'}`}>
          <BookMarked size={15}/> Stories
          {storyTotal > 0 && <span className="text-xs opacity-60">({storyTotal})</span>}
        </button>
      </div>

      {activeTab === 'words' && <>
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-sm text-center">
            <p className="text-2xl font-display text-gold">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Words</p>
          </div>
          {stats.bySource.map(s => (
            <div key={s._id} className="card-sm text-center">
              <p className={`text-xl font-display ${SOURCE_CONFIG[s._id]?.color || 'text-gray-300'}`}>{s.count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{SOURCE_CONFIG[s._id]?.label || s._id}</p>
            </div>
          ))}
        </div>
      )}

      {/* Part-of-speech pills */}
      {stats && stats.byPartOfSpeech.length > 0 && (
        <div className="card py-3 px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 flex items-center gap-1 mr-1">
              <BarChart2 size={12}/> By type:
            </span>
            {stats.byPartOfSpeech.map(s => {
              const p = posInfo(s._id)
              return (
                <button key={s._id}
                  onClick={() => { setFilterPos(filterPos === s._id ? '' : s._id); setPage(1) }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-all
                    ${filterPos === s._id ? `${p.bg} ${p.color} border-current` : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15'}`}>
                  {p.emoji} {p.label} <span className="opacity-60">({s.count})</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search words…"
            className="w-full pl-8 pr-3 py-2 bg-ink-800 border border-white/[0.07] rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gold/40"
          />
        </div>

        {/* Source filter */}
        <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1) }}
          className="bg-ink-800 border border-white/[0.07] rounded-xl text-sm text-gray-400 px-3 py-2 focus:outline-none focus:border-gold/40">
          <option value="">All sources</option>
          <option value="article">Article Drill</option>
          <option value="grammar">Grammar Drill</option>
          <option value="vocab">Vocabulary</option>
        </select>

        {/* Sort */}
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}
          className="bg-ink-800 border border-white/[0.07] rounded-xl text-sm text-gray-400 px-3 py-2 focus:outline-none focus:border-gold/40">
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Per page */}
        <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
          className="bg-ink-800 border border-white/[0.07] rounded-xl text-sm text-gray-400 px-3 py-2 focus:outline-none focus:border-gold/40">
          {LIMIT_OPTIONS.map(n => <option key={n} value={n}>{n} per page</option>)}
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost px-3 py-2 text-xs text-gray-500 hover:text-orange-400 flex items-center gap-1">
            <X size={12}/> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="py-16 text-center">
            <div className="spinner w-7 h-7 mx-auto mb-3"/>
            <p className="text-gray-500 text-sm">Loading library…</p>
          </div>
        ) : words.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <BookOpen size={36} className="mx-auto text-gray-700"/>
            <p className="text-gray-400 font-medium">
              {hasFilters ? 'No words match your filters' : 'Your library is empty'}
            </p>
            <p className="text-gray-600 text-sm">
              {hasFilters
                ? 'Try adjusting your search or filters'
                : 'Generate words in Grammar Drill or Article Drill to start building your library'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-ink-900">
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider">Word</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider">Meaning</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider hidden sm:table-cell">Part of Speech</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider hidden md:table-cell">Source</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider hidden lg:table-cell">Date Added</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider hidden lg:table-cell">Time</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium uppercase tracking-wider">
                    <span className="flex items-center justify-center gap-1"><Zap size={11}/> Vol</span>
                  </th>
                  <th className="px-4 py-3 w-16"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {words.map(word => {
                  const pos = posInfo(word.partOfSpeech)
                  const src = SOURCE_CONFIG[word.source]
                  return (
                    <tr key={word._id}
                      onClick={() => setSelected(word)}
                      className="hover:bg-ink-800/60 cursor-pointer transition-colors group">
                      {/* Word */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {word.gender && (
                            <span className={`text-xs font-bold shrink-0 ${GENDER_COLORS[word.gender] || 'text-gray-400'}`}>
                              {word.gender}
                            </span>
                          )}
                          <span className="text-gray-100 font-medium">
                            {word.gender ? word.de.replace(/^(der|die|das)\s+/i, '') : word.de}
                          </span>
                          <button onClick={e => { e.stopPropagation(); speakDE(word.de) }}
                            className="text-gray-700 hover:text-gold opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            <Volume2 size={13}/>
                          </button>
                        </div>
                        {word.ipa && <p className="text-[10px] text-violet-400 font-mono mt-0.5">{word.ipa}</p>}
                      </td>

                      {/* Meaning */}
                      <td className="px-4 py-3 text-gray-400 max-w-[140px] truncate">{word.en}</td>

                      {/* Part of speech */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${pos.bg} ${pos.color}`}>
                          {pos.emoji} {pos.label}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-xs ${src?.color || 'text-gray-500'}`}>{src?.label || word.source}</span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                        {formatDate(word.createdAt)}
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-600 text-xs">
                        {formatTime(word.createdAt)}
                      </td>

                      {/* Volume */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-mono font-bold ${
                          word.volume >= 3 ? 'text-gold' : word.volume >= 2 ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          ×{word.volume}
                        </span>
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3 text-right">
                        <button onClick={e => handleDelete(word._id, e)}
                          className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1">
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-gray-600">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} words
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="btn-ghost px-2 py-1 text-xs disabled:opacity-30">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-ghost px-2 py-1 disabled:opacity-30">
                <ChevronLeft size={15}/>
              </button>
              {/* Page number pills */}
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                const startPage = Math.max(1, Math.min(page - 2, pagination.pages - 4))
                const p = startPage + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all
                      ${p === page ? 'bg-gold/10 text-gold border border-gold/30' : 'btn-ghost text-gray-500 hover:text-gray-200'}`}>
                    {p}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                className="btn-ghost px-2 py-1 disabled:opacity-30">
                <ChevronRight size={15}/>
              </button>
              <button onClick={() => setPage(pagination.pages)} disabled={page === pagination.pages}
                className="btn-ghost px-2 py-1 text-xs disabled:opacity-30">»</button>
            </div>
          </div>
        )}
      </div>

      </>
      }

      {/* ── STORIES TAB ─────────────────────────────────────── */}
      {activeTab === 'stories' && (
        <div className="space-y-4">
          {/* Story filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/>
              <input value={storySearch} onChange={e => setStorySearch(e.target.value)}
                placeholder="Search stories…"
                className="w-full pl-8 pr-3 py-2 bg-ink-800 border border-white/[0.07] rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gold/40"/>
            </div>
            <select value={storySourceFilter} onChange={e => { setStorySourceFilter(e.target.value); setStoryPage(1) }}
              className="bg-ink-800 border border-white/[0.07] rounded-xl text-sm text-gray-400 px-3 py-2 focus:outline-none focus:border-gold/40">
              <option value="">All sources</option>
              <option value="story">Story Reader</option>
              <option value="comprehension">Comprehension</option>
            </select>
            {(storySearch || storySourceFilter) && (
              <button onClick={() => { setStorySearch(''); setStorySourceFilter(''); setStoryPage(1) }}
                className="btn-ghost px-3 py-2 text-xs text-gray-500 hover:text-orange-400 flex items-center gap-1">
                <X size={12}/> Clear
              </button>
            )}
          </div>

          {/* Story list */}
          <div className="card overflow-hidden p-0">
            {storyLoading ? (
              <div className="py-16 text-center">
                <div className="spinner w-7 h-7 mx-auto mb-3"/>
                <p className="text-gray-500 text-sm">Loading stories…</p>
              </div>
            ) : stories.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <BookMarked size={36} className="mx-auto text-gray-700"/>
                <p className="text-gray-400 font-medium">No stories yet</p>
                <p className="text-gray-600 text-sm">Generate stories in Story Reader or Comprehension to build your library</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-ink-900">
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider">Story</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider hidden sm:table-cell">Level</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider hidden md:table-cell">Source</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider hidden lg:table-cell">Date</th>
                      <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium uppercase tracking-wider">
                        <span className="flex items-center justify-center gap-1"><Zap size={11}/> Gen</span>
                      </th>
                      <th className="px-4 py-3 w-12"/>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {stories.map(s => {
                      const emoji = GENRE_EMOJI[s.genre] || '📖'
                      const src   = SOURCE_CONFIG[s.source]
                      return (
                        <tr key={s._id} className="hover:bg-ink-800/60 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg shrink-0">{emoji}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-200 truncate">{s.title}</p>
                                {s.titleEn && <p className="text-xs text-gray-600 italic truncate">{s.titleEn}</p>}
                                <p className="text-xs text-gray-600 mt-0.5 sm:hidden capitalize">{s.topic}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={`text-sm font-bold ${LEVEL_COLORS[s.level] || 'text-gray-400'}`}>{s.level}</span>
                            <p className="text-xs text-gray-600 mt-0.5 capitalize">{s.topic}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-xs ${src?.color || 'text-gray-500'}`}>{src?.label || s.source}</span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                            {new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-mono font-bold ${s.generatedCount >= 2 ? 'text-gold' : 'text-gray-600'}`}>
                              ×{s.generatedCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleStoryDelete(s._id)}
                              className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1">
                              <Trash2 size={13}/>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Story pagination */}
            {Math.ceil(storyTotal / 20) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                <p className="text-xs text-gray-600">
                  {storyTotal} stories total
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setStoryPage(p => Math.max(1, p - 1))} disabled={storyPage === 1}
                    className="btn-ghost px-2 py-1 disabled:opacity-30"><ChevronLeft size={15}/></button>
                  <span className="text-xs text-gray-500 px-2">{storyPage} / {Math.ceil(storyTotal / 20)}</span>
                  <button onClick={() => setStoryPage(p => Math.min(Math.ceil(storyTotal / 20), p + 1))} disabled={storyPage === Math.ceil(storyTotal / 20)}
                    className="btn-ghost px-2 py-1 disabled:opacity-30"><ChevronRight size={15}/></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Word detail modal — always rendered when active */}
      {selected && <WordDetail word={selected} onClose={() => setSelected(null)}/>}
    </div>
  )
}
