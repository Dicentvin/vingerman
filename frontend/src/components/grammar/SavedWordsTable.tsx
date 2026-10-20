import { useEffect, useState, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../../utils/api'
import type { SavedWord, SavedWordsResponse } from '../../store/slices/grammarSlice'
import { Volume2, ChevronDown, ChevronUp, Trash2, Search, Download } from 'lucide-react'

const FILTERS: { key: string; label: string; emoji: string }[] = [
  { key: 'all',         label: 'All',          emoji: '📚' },
  { key: 'noun',        label: 'Nouns',        emoji: '📦' },
  { key: 'verb',        label: 'Verbs',        emoji: '⚡' },
  { key: 'adjective',   label: 'Adjectives',   emoji: '🎨' },
  { key: 'adverb',      label: 'Adverbs',      emoji: '🔄' },
  { key: 'preposition', label: 'Prepositions', emoji: '🔗' },
  { key: 'conjunction', label: 'Conjunctions', emoji: '🔀' },
  { key: 'pronoun',     label: 'Pronouns',     emoji: '👤' },
]

const GENDER_COLORS: Record<string, string> = {
  der: 'text-blue-400 bg-blue-500/10 border-blue-400/20',
  die: 'text-pink-400 bg-pink-500/10 border-pink-400/20',
  das: 'text-green-400 bg-green-500/10 border-green-400/20',
}

function speak(text: string) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = 0.82
  speechSynthesis.speak(u)
}

// Grammar details that depend on the word type, shown in one compact cell
function formsOf(w: SavedWord): string {
  if (w.category === 'noun' && w.plural) return `Pl: ${w.plural}`
  if (w.category === 'verb' && w.conjugations) {
    const c = w.conjugations
    return `ich ${c.ich} · du ${c.du} · er ${c.er} · wir ${c.wir} · ihr ${c.ihr} · sie ${c.sie}`
  }
  if (w.category === 'adjective' && (w.comparative || w.superlative))
    return `${w.comparative || '—'} · ${w.superlative || '—'}`
  return w.tip || '—'
}

const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

export default function SavedWordsTable() {
  const navigate = useNavigate()
  const [filter, setFilter]   = useState('all')
  const [query, setQuery]     = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage]       = useState(1)
  const [data, setData]       = useState<SavedWordsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [query])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/grammar/words', { params: { category: filter, q: debounced, page, limit: 25 } })
      setData(res.data)
    } catch {
      toast.error('Could not load saved words.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [filter, debounced, page]) // eslint-disable-line

  const remove = async (w: SavedWord) => {
    if (!confirm(`Delete "${w.de}" from your saved words?`)) return
    try {
      await api.delete(`/grammar/words/${w._id}`)
      toast.success('Deleted')
      load()
    } catch { toast.error('Could not delete.') }
  }

  // Download everything that matches the current filter as a CSV (opens in Excel / Sheets)
  const exportCsv = async () => {
    try {
      const rows: SavedWord[] = []
      let p = 1, pages = 1
      do {
        const res = await api.get('/grammar/words', { params: { category: filter, q: debounced, page: p, limit: 100 } })
        rows.push(...res.data.words); pages = res.data.pages; p++
      } while (p <= pages)
      const header = ['German', 'Article', 'English', 'Type', 'Plural / Forms', 'IPA', 'Example', 'Example (EN)', 'Usage 1', 'Usage 2', 'Usage 3', 'Tip']
      const lines = rows.map(w => [
        w.de, w.gender || '', w.en, w.category, formsOf(w), w.ipa || '', w.example || '', w.exampleEn || '',
        w.sentences?.[0] || '', w.sentences?.[1] || '', w.sentences?.[2] || '', w.tip || '',
      ].map(csvEscape).join(','))
      const blob = new Blob(['\ufeff' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = 'saved-german-words.csv'; a.click()
      URL.revokeObjectURL(a.href)
    } catch { toast.error('Export failed.') }
  }

  const words = data?.words || []

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all
                ${filter === f.key ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'}`}>
              {f.emoji} {f.label}
              <span className="ml-1.5 opacity-60">{data?.counts?.[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/>
            <input className="input text-sm pl-9" placeholder="Search German or English…"
              value={query} onChange={e => setQuery(e.target.value)}/>
          </div>
          <button onClick={exportCsv} className="btn-secondary px-3 text-xs gap-1.5" title="Download as CSV">
            <Download size={14}/> CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-gray-500 bg-ink-800">
                <th className="px-3 py-2.5 w-10">#</th>
                <th className="px-3 py-2.5">German</th>
                <th className="px-3 py-2.5">English</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Forms</th>
                <th className="px-3 py-2.5">Usage</th>
                <th className="px-3 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading && words.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading…</td></tr>
              )}
              {!loading && words.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">
                  {data?.counts?.all ? 'No words match your search.' : 'Nothing saved yet — generate a word set and it will appear here.'}
                </td></tr>
              )}
              {words.map((w, i) => {
                const isOpen = open === w._id
                const usage = w.example || w.sentences?.[0]
                const rowNo = ((data?.page || 1) - 1) * 25 + i + 1
                return (
                  <Fragment key={w._id}>
                    <tr className="hover:bg-white/[0.02] cursor-pointer align-top"
                      onClick={() => setOpen(isOpen ? null : w._id)}>
                      <td className="px-3 py-3 text-xs font-mono text-gray-600">{rowNo}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {w.gender && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${GENDER_COLORS[w.gender] || ''}`}>{w.gender}</span>
                          )}
                          <span className="font-semibold text-gray-100">{w.de}</span>
                        </div>
                        {w.ipa && <p className="text-[11px] text-violet-soft font-mono mt-0.5">{w.ipa}</p>}
                      </td>
                      <td className="px-3 py-3 text-gray-300">{w.en || '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-400 capitalize">{w.category}</td>
                      <td className="px-3 py-3 text-xs text-gray-400 max-w-[200px]">{formsOf(w)}</td>
                      <td className="px-3 py-3 text-xs text-gray-400 max-w-[220px]">
                        {usage ? <span className="line-clamp-2">{usage}</span> : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={e => { e.stopPropagation(); speak(w.de) }}
                            className="btn-ghost p-1.5 text-gray-600 hover:text-gold" title="Listen"><Volume2 size={14}/></button>
                          <button onClick={e => { e.stopPropagation(); remove(w) }}
                            className="btn-ghost p-1.5 text-gray-700 hover:text-red-400" title="Delete"><Trash2 size={14}/></button>
                          {isOpen ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-600"/>}
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-ink-900/60">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="space-y-3 max-w-2xl">
                            {w.tip && <p className="text-xs text-gray-400">💡 {w.tip}</p>}
                            <div className="space-y-2">
                              {[
                                ...(w.example ? [{ de: w.example, en: w.exampleEn }] : []),
                                ...(w.sentences || []).map((s, k) => ({ de: s, en: w.sentencesEn?.[k] })),
                              ].map((s, k) => (
                                <div key={k} className="flex items-start gap-2">
                                  <button onClick={() => speak(s.de)} className="text-gray-600 hover:text-gold mt-0.5 shrink-0">
                                    <Volume2 size={12}/>
                                  </button>
                                  <div>
                                    <p className="text-sm text-gray-200">{s.de}</p>
                                    {s.en && <p className="text-xs text-teal-soft/80 italic">{s.en}</p>}
                                  </div>
                                </div>
                              ))}
                              {!usage && <p className="text-xs text-gray-600">No usage sentences saved for this word.</p>}
                            </div>
                            {w.category === 'verb' && (
                              <button onClick={() => navigate('/tenses', { state: { verb: w.de } })}
                                className="btn-primary text-xs">
                                🕐 {w.tenseExamples ? 'Open saved' : 'See'} Present · Past · Future tenses
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-30"
            disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
          <span className="text-xs text-gray-500">Page {data.page} / {data.pages} · {data.total} words</span>
          <button className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-30"
            disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
        </div>
      )}
    </div>
  )
}
