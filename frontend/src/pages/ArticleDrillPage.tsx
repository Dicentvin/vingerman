import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import {
  Volume2, Wand2, CheckCircle2, XCircle, RotateCcw,
  Trophy, BookOpen, ChevronRight, Zap, BarChart2,
} from 'lucide-react'
import api from '../utils/api'
import { useAppSelector } from '../hooks/redux'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticleWord {
  de: string           // noun WITHOUT article e.g. "Hund"
  en: string           // English meaning
  gender: 'der' | 'die' | 'das'
  plural: string       // e.g. "die Hunde"
  ipa?: string
  category: string     // e.g. "animals"
  tip?: string         // memory trick for the gender
  example: string      // sentence using the noun
  exampleEn: string
}

interface ArticleSet {
  words: ArticleWord[]
  topic: string
  count: number
}

interface QuizResult {
  word: ArticleWord
  chosen: string
  correct: boolean
}

type ViewMode = 'learn' | 'quiz' | 'results' | 'tables'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPICS = [
  { key: 'mixed',       label: '🎲 Mixed',          desc: 'All categories' },
  { key: 'animals',     label: '🐾 Animals',         desc: 'Tiere' },
  { key: 'food',        label: '🍎 Food & Drink',    desc: 'Essen & Trinken' },
  { key: 'body',        label: '👤 Body Parts',      desc: 'Körperteile' },
  { key: 'household',   label: '🏠 Household',       desc: 'Haushalt' },
  { key: 'clothes',     label: '👕 Clothes',         desc: 'Kleidung' },
  { key: 'nature',      label: '🌿 Nature',          desc: 'Natur' },
  { key: 'transport',   label: '🚗 Transport',       desc: 'Verkehr' },
  { key: 'professions', label: '💼 Professions',     desc: 'Berufe' },
  { key: 'school',      label: '📚 School',          desc: 'Schule' },
]

const COUNT_OPTIONS = [10, 20, 30, 50]

const GENDER_CONFIG = {
  der: { color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-400/40',  label: 'der',  full: 'Masculine' },
  die: { color: 'text-pink-400',  bg: 'bg-pink-500/10',  border: 'border-pink-400/40',  label: 'die',  full: 'Feminine' },
  das: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-400/40', label: 'das',  full: 'Neuter' },
}

// ─── Article declension tables (reference) ────────────────────────────────────

const DEFINITE_TABLE = {
  headers: ['', 'Masculine (der)', 'Feminine (die)', 'Neuter (das)', 'Plural (die)'],
  rows: [
    ['Nominative', 'der', 'die', 'das', 'die'],
    ['Accusative', 'den', 'die', 'das', 'die'],
    ['Dative',     'dem', 'der', 'dem', 'den'],
    ['Genitive',   'des', 'der', 'des', 'der'],
  ],
}

const INDEFINITE_TABLE = {
  headers: ['', 'Masculine (ein)', 'Feminine (eine)', 'Neuter (ein)', 'Plural (keine)'],
  rows: [
    ['Nominative', 'ein',    'eine',   'ein',    'keine'],
    ['Accusative', 'einen',  'eine',   'ein',    'keine'],
    ['Dative',     'einem',  'einer',  'einem',  'keinen'],
    ['Genitive',   'eines',  'einer',  'eines',  'keiner'],
  ],
}

const GENDER_RULES = [
  { rule: 'Masculine (der)',  color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-400/20', tips: [
    'Male persons & professions: der Mann, der Arzt, der Lehrer',
    'Days, months, seasons: der Montag, der März, der Winter',
    'Most nouns ending -er, -el, -en: der Lehrer, der Schlüssel',
    'Car brands & alcoholic drinks: der BMW, der Wein',
  ]},
  { rule: 'Feminine (die)',   color: 'text-pink-400',  bg: 'bg-pink-500/10 border-pink-400/20', tips: [
    'Female persons: die Frau, die Lehrerin, die Ärztin',
    'Nouns ending -ung, -heit, -keit: die Zeitung, die Freiheit',
    'Nouns ending -schaft, -tion, -tät: die Freundschaft, die Nation',
    'Most nouns ending -e: die Lampe, die Blume, die Schule',
  ]},
  { rule: 'Neuter (das)',     color: 'text-green-400', bg: 'bg-green-500/10 border-green-400/20', tips: [
    'Diminutives -chen, -lein: das Mädchen, das Büchlein',
    'Infinitives used as nouns: das Laufen, das Schlafen',
    'Most nouns ending -um: das Museum, das Datum',
    'Young animals & people: das Kind, das Baby, das Kalb',
  ]},
]

// ─── Speak helper — always with article ──────────────────────────────────────

function speakDE(text: string) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = 0.82
  speechSynthesis.speak(u)
}

// ─── Article Table Component ──────────────────────────────────────────────────

function DeclensionTable({ data, title }: { data: typeof DEFINITE_TABLE; title: string }) {
  return (
    <div className="card overflow-x-auto">
      <p className="section-label">{title}</p>
      <table className="w-full text-sm border-collapse min-w-[420px]">
        <thead>
          <tr className="border-b border-white/[0.07]">
            {data.headers.map((h, i) => (
              <th key={i} className={`text-left py-2 px-3 text-xs font-medium
                ${i === 0 ? 'text-gray-500' : i === 1 ? 'text-blue-400' : i === 2 ? 'text-pink-400' : i === 3 ? 'text-green-400' : 'text-gray-400'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/[0.04] last:border-0 hover:bg-ink-800/40 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className={`py-2.5 px-3
                  ${ci === 0 ? 'text-xs text-gray-500 font-medium' :
                    cell.startsWith('ein') || cell.startsWith('kein') ? 'text-teal-soft font-semibold' :
                    cell === 'der' || cell === 'den' || cell === 'dem' || cell === 'des' ? 'text-blue-400 font-semibold' :
                    cell === 'die' ? 'text-pink-400 font-semibold' :
                    cell === 'das' ? 'text-green-400 font-semibold' :
                    'text-gold font-semibold'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ArticleDrillPage() {
  const user = useAppSelector(s => s.auth.user)

  const [topic, setTopic]       = useState('mixed')
  const [count, setCount]       = useState(20)
  const [wordSet, setWordSet]   = useState<ArticleSet | null>(null)
  const [loading, setLoading]   = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('learn')
  const [activeTab, setActiveTab] = useState<'drill' | 'tables' | 'rules'>('drill')

  // Learn mode
  const [learnIdx, setLearnIdx]     = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)

  // Quiz mode
  const [quizIdx, setQuizIdx]       = useState(0)
  const [chosen, setChosen]         = useState<string | null>(null)
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [quizDone, setQuizDone]     = useState(false)

  // History
  const [history, setHistory]       = useState<{ date: string; topic: string; score: number }[]>([])
  const [seenByTopic, setSeenByTopic] = useState<Record<string, number>>({})
  const [resetting, setResetting]     = useState(false)

  useEffect(() => {
    api.get('/article/history')
      .then(r => {
        setHistory(r.data.history || [])
        setSeenByTopic(r.data.seenByTopic || {})
      })
      .catch(() => {})
  }, [])

  // ── Generate ────────────────────────────────────────────────────────────────

  const handleReset = async (topicKey: string) => {
    if (!confirm(`Reset all seen words for "${topicKey}"? You will see them again as new.`)) return
    setResetting(true)
    try {
      await api.delete(`/article/reset/${topicKey}`)
      setSeenByTopic(prev => ({ ...prev, [topicKey]: 0 }))
      toast.success(`Reset done — "${topicKey}" words will appear again!`)
    } catch { toast.error('Reset failed') }
    setResetting(false)
  }

  const handleGenerate = async () => {
    setLoading(true)
    setWordSet(null); setLearnIdx(0); setShowAnswer(false)
    setQuizIdx(0); setChosen(null); setQuizResults([]); setQuizDone(false)
    try {
      const res = await api.post('/article/generate', { topic, count })
      if (res.data.allSeen) {
        toast.info(res.data.message || 'All words seen — resetting this topic!')
        setLoading(false)
        return
      }
      setWordSet(res.data.wordSet)
      if (res.data.totalSeen !== undefined) {
        setSeenByTopic(prev => ({ ...prev, [topic]: res.data.totalSeen }))
      }
      setViewMode('learn')
      toast.success(`${res.data.wordSet.words.length} new nouns generated! 🎯`)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e?.response?.data?.message || 'Generation failed')
    }
    setLoading(false)
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────────

  const handleQuizChoice = (choice: string) => {
    if (chosen) return
    setChosen(choice)
    const word = wordSet!.words[quizIdx]
    const correct = choice === word.gender
    // Speak the full noun WITH correct article
    speakDE(`${word.gender} ${word.de}`)
    setQuizResults(prev => [...prev, { word, chosen: choice, correct }])
    setTimeout(() => {
      if (quizIdx + 1 >= wordSet!.words.length) {
        setQuizDone(true)
        const score = Math.round(
          ([...quizResults, { word, chosen: choice, correct }].filter(r => r.correct).length /
          wordSet!.words.length) * 100
        )
        api.post('/article/practiced', { topic: wordSet!.topic, count: wordSet!.count, score })
          .then(() => api.get('/article/history').then(r => setHistory(r.data.history || [])))
          .catch(() => {})
      } else {
        setQuizIdx(i => i + 1)
        setChosen(null)
      }
    }, 1200)
  }

  const passedCount = quizResults.filter(r => r.correct).length
  const words = wordSet?.words || []
  const currentLearnWord = words[learnIdx]
  const currentQuizWord  = words[quizIdx]
  const quizScore = words.length > 0 ? Math.round((passedCount / words.length) * 100) : 0

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Article Drill</h1>
        <p className="text-gray-500 text-sm mt-1">
          Master <span className="text-blue-400 font-semibold">der</span> ·{' '}
          <span className="text-pink-400 font-semibold">die</span> ·{' '}
          <span className="text-green-400 font-semibold">das</span> with AI-generated noun sets, declension tables and gender rules
        </p>
      </div>

      {/* Main tabs */}
      <div className="flex rounded-xl bg-ink-800 p-1 gap-1 mb-5">
        {([
          ['drill',  '🎯 Article Drill'],
          ['tables', '📋 Declension Tables'],
          ['rules',  '📖 Gender Rules'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`flex-1 py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all
              ${activeTab === k ? 'bg-gold text-ink-950' : 'text-gray-400 hover:text-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── DRILL TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'drill' && (
        <>
          {/* Generator */}
          <div className="card mb-5 space-y-4">
            <div>
              <label className="section-label">Topic Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TOPICS.map(t => (
                  <button key={t.key} onClick={() => setTopic(t.key)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-xs transition-all
                      ${topic === t.key
                        ? 'bg-gold/10 border-gold/40 text-gold'
                        : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15 hover:text-gray-200'}`}>
                    <span className="font-medium">{t.label}</span>
                    <span className="opacity-60 mt-0.5">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="section-label">How many nouns?</label>
              <div className="flex gap-2 flex-wrap">
                {COUNT_OPTIONS.map(n => (
                  <button key={n} onClick={() => setCount(n)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all
                      ${count === n ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {seenByTopic[topic] > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-ink-800 rounded-xl border border-white/[0.06] text-xs">
                <span className="text-gray-500">
                  <span className="text-gold font-medium">{seenByTopic[topic]}</span> words already seen in "{topic}"
                </span>
                <button onClick={() => handleReset(topic)} disabled={resetting}
                  className="text-gray-600 hover:text-orange-400 transition-colors flex items-center gap-1">
                  <RotateCcw size={11}/> Reset
                </button>
              </div>
            )}
            <button onClick={handleGenerate} disabled={loading} className="btn-primary w-full justify-center">
              {loading
                ? <><span className="spinner"/> Generating {count} nouns…</>
                : <><Wand2 size={15}/> Generate {count} Nouns to Practice</>}
            </button>
          </div>

          {loading && (
            <div className="card text-center py-12">
              <div className="spinner w-8 h-8 mx-auto mb-3"/>
              <p className="text-gray-500 text-sm">Generating nouns with genders and memory tips…</p>
            </div>
          )}

          {/* Word set view */}
          {!loading && wordSet && (
            <>
              {/* Mode switcher */}
              <div className="flex gap-2 mb-5">
                <button onClick={() => { setViewMode('learn'); setLearnIdx(0); setShowAnswer(false) }}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all
                    ${viewMode === 'learn' ? 'bg-teal-muted border-teal-soft/40 text-teal-soft' : 'bg-ink-800 border-white/[0.07] text-gray-400 hover:text-gray-200'}`}>
                  📖 Learn Mode
                </button>
                <button onClick={() => { setViewMode('quiz'); setQuizIdx(0); setChosen(null); setQuizResults([]); setQuizDone(false) }}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all
                    ${viewMode === 'quiz' ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-ink-800 border-white/[0.07] text-gray-400 hover:text-gray-200'}`}>
                  ⚡ Quiz Mode
                </button>
              </div>

              {/* ── LEARN MODE ─────────────────────────────────────────── */}
              {viewMode === 'learn' && currentLearnWord && (
                <div className="space-y-4 animate-fade-in">
                  {/* Progress */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-ink-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full transition-all"
                        style={{ width: `${((learnIdx + 1) / words.length) * 100}%` }}/>
                    </div>
                    <span className="text-xs text-gray-500 font-mono shrink-0">{learnIdx + 1}/{words.length}</span>
                  </div>

                  {/* Word card */}
                  <div className={`card border-2 transition-all duration-300
                    ${showAnswer ? GENDER_CONFIG[currentLearnWord.gender].border + ' bg-' + currentLearnWord.gender + '/5' : 'border-white/[0.07]'}`}>

                    {/* Noun without article first */}
                    <div className="text-center py-6">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                        What is the article for…
                      </p>
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <p className="font-display text-4xl sm:text-5xl text-gray-100">
                          {currentLearnWord.de}
                        </p>
                        <button
                          onClick={() => speakDE(`${currentLearnWord.gender} ${currentLearnWord.de}`)}
                          className="btn-ghost p-2 text-gray-600 hover:text-gold">
                          <Volume2 size={18}/>
                        </button>
                      </div>
                      {currentLearnWord.ipa && (
                        <p className="text-violet-soft font-mono text-sm">{currentLearnWord.ipa}</p>
                      )}
                      <p className="text-gray-400 mt-2">{currentLearnWord.en}</p>
                    </div>

                    {/* Answer */}
                    {!showAnswer ? (
                      <button onClick={() => { setShowAnswer(true); speakDE(`${currentLearnWord.gender} ${currentLearnWord.de}`) }}
                        className="btn-primary w-full justify-center mb-2">
                        <Zap size={15}/> Reveal Article
                      </button>
                    ) : (
                      <div className="space-y-3 animate-fade-in">
                        {/* Big article reveal */}
                        <div className={`rounded-2xl p-5 text-center border ${GENDER_CONFIG[currentLearnWord.gender].bg} ${GENDER_CONFIG[currentLearnWord.gender].border}`}>
                          <p className={`font-display text-5xl font-bold ${GENDER_CONFIG[currentLearnWord.gender].color}`}>
                            {currentLearnWord.gender}
                          </p>
                          <p className={`font-display text-2xl mt-1 ${GENDER_CONFIG[currentLearnWord.gender].color}`}>
                            {currentLearnWord.gender} {currentLearnWord.de}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{GENDER_CONFIG[currentLearnWord.gender].full}</p>
                          {/* Plural */}
                          {currentLearnWord.plural && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <span className="text-[10px] text-gray-500">Plural: </span>
                              <button onClick={() => speakDE(currentLearnWord.plural)}
                                className="text-sm text-gray-300 hover:text-gold ml-1">{currentLearnWord.plural}</button>
                            </div>
                          )}
                        </div>

                        {/* Memory tip */}
                        {currentLearnWord.tip && (
                          <div className="flex gap-2.5 p-3 bg-gold/5 border border-gold/15 rounded-xl">
                            <span className="text-base shrink-0">💡</span>
                            <p className="text-sm text-gray-300 leading-relaxed">{currentLearnWord.tip}</p>
                          </div>
                        )}

                        {/* Example sentence */}
                        {currentLearnWord.example && (
                          <div className="p-3 bg-ink-800 border border-white/[0.06] rounded-xl">
                            <button onClick={() => speakDE(currentLearnWord.example)}
                              className="text-sm text-gray-200 italic text-left hover:text-gold transition-colors flex items-start gap-2 group">
                              <span>"{currentLearnWord.example}"</span>
                              <Volume2 size={12} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-60"/>
                            </button>
                            {currentLearnWord.exampleEn && (
                              <p className="text-xs text-gray-500 mt-1">— {currentLearnWord.exampleEn}</p>
                            )}
                          </div>
                        )}

                        {/* Nav buttons */}
                        <div className="flex gap-2">
                          <button onClick={() => { setLearnIdx(i => Math.max(0, i - 1)); setShowAnswer(false) }}
                            disabled={learnIdx === 0}
                            className="btn-secondary flex-1 justify-center disabled:opacity-30">
                            ← Previous
                          </button>
                          {learnIdx < words.length - 1 ? (
                            <button onClick={() => { setLearnIdx(i => i + 1); setShowAnswer(false) }}
                              className="btn-primary flex-1 justify-center">
                              Next <ChevronRight size={15}/>
                            </button>
                          ) : (
                            <button onClick={() => { setViewMode('quiz'); setQuizIdx(0); setChosen(null); setQuizResults([]); setQuizDone(false) }}
                              className="btn-primary flex-1 justify-center">
                              <Zap size={15}/> Start Quiz!
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* All words overview — paginated */}
                  {(() => {
                    const totalPages = Math.ceil(words.length / WORDS_PER_PAGE)
                    const pageWords  = words.slice((overviewPage - 1) * WORDS_PER_PAGE, overviewPage * WORDS_PER_PAGE)
                    return (
                      <div className="card">
                        <div className="flex items-center justify-between mb-3">
                          <p className="section-label">All {words.length} Nouns</p>
                          {totalPages > 1 && (
                            <span className="text-xs text-gray-600">Page {overviewPage}/{totalPages}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {pageWords.map((w, localIdx) => {
                            const i = (overviewPage - 1) * WORDS_PER_PAGE + localIdx
                            const gc = GENDER_CONFIG[w.gender]
                            return (
                              <button key={i} onClick={() => { setLearnIdx(i); setShowAnswer(false) }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-xs
                                  ${learnIdx === i ? 'bg-gold/10 border border-gold/25' : 'bg-ink-800 border border-white/[0.05] hover:border-white/10'}`}>
                                <span className={`font-bold shrink-0 ${gc.color}`}>{w.gender}</span>
                                <span className="text-gray-200 truncate flex-1">{w.de}</span>
                                <span className="text-gray-600 truncate max-w-[80px] hidden sm:block">{w.en}</span>
                              </button>
                            )
                          })}
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-white/[0.06]">
                            <button onClick={() => setOverviewPage(p => Math.max(1, p - 1))} disabled={overviewPage === 1}
                              className="btn-ghost px-2 py-1 text-xs disabled:opacity-30">‹ Prev</button>
                            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(p => (
                              <button key={p} onClick={() => setOverviewPage(p)}
                                className={`w-7 h-7 rounded-lg text-xs font-medium transition-all
                                  ${p === overviewPage ? 'bg-gold/10 text-gold border border-gold/30' : 'btn-ghost text-gray-500'}`}>
                                {p}
                              </button>
                            ))}
                            <button onClick={() => setOverviewPage(p => Math.min(totalPages, p + 1))} disabled={overviewPage === totalPages}
                              className="btn-ghost px-2 py-1 text-xs disabled:opacity-30">Next ›</button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ── QUIZ MODE ──────────────────────────────────────────── */}
              {viewMode === 'quiz' && !quizDone && currentQuizWord && (
                <div className="space-y-4 animate-fade-in">
                  {/* Progress */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-ink-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full transition-all"
                        style={{ width: `${(quizIdx / words.length) * 100}%` }}/>
                    </div>
                    <span className="text-xs text-gray-500 font-mono shrink-0">
                      {quizIdx}/{words.length} · ✅{passedCount}
                    </span>
                  </div>

                  {/* Question card */}
                  <div className="card text-center py-8">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">
                      Choose the correct article
                    </p>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <p className="font-display text-4xl sm:text-5xl text-gray-100">{currentQuizWord.de}</p>
                      <button onClick={() => speakDE(currentQuizWord.de)}
                        className="text-gray-600 hover:text-gold">
                        <Volume2 size={18}/>
                      </button>
                    </div>
                    {currentQuizWord.ipa && <p className="text-violet-soft font-mono text-sm">{currentQuizWord.ipa}</p>}
                    <p className="text-gray-400 mt-2">{currentQuizWord.en}</p>
                  </div>

                  {/* Article choice buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    {(['der', 'die', 'das'] as const).map(article => {
                      const gc = GENDER_CONFIG[article]
                      const isChosen  = chosen === article
                      const isCorrect = article === currentQuizWord.gender
                      const showResult = !!chosen

                      return (
                        <button key={article}
                          onClick={() => handleQuizChoice(article)}
                          disabled={!!chosen}
                          className={`py-5 rounded-2xl border-2 font-display text-3xl font-bold transition-all
                            ${showResult
                              ? isCorrect
                                ? 'bg-teal-muted border-teal-soft text-teal-soft scale-105'
                                : isChosen
                                ? 'bg-red-500/15 border-red-400 text-red-400'
                                : 'opacity-30 border-white/10 text-gray-600'
                              : `${gc.bg} border-transparent ${gc.color} hover:border-current hover:scale-102 active:scale-95 cursor-pointer`
                            }`}>
                          {article}
                        </button>
                      )
                    })}
                  </div>

                  {/* Answer feedback */}
                  {chosen && (
                    <div className={`flex items-start gap-3 p-4 rounded-2xl border animate-slide-up
                      ${chosen === currentQuizWord.gender
                        ? 'bg-teal-muted border-teal-soft/30'
                        : 'bg-red-500/10 border-red-400/30'}`}>
                      {chosen === currentQuizWord.gender
                        ? <CheckCircle2 size={20} className="text-teal-soft shrink-0"/>
                        : <XCircle size={20} className="text-red-400 shrink-0"/>}
                      <div>
                        <p className={`font-medium text-sm ${chosen === currentQuizWord.gender ? 'text-teal-soft' : 'text-red-400'}`}>
                          {chosen === currentQuizWord.gender ? 'Richtig! 🎉' : `Falsch — it's ${currentQuizWord.gender} ${currentQuizWord.de}`}
                        </p>
                        {currentQuizWord.tip && (
                          <p className="text-xs text-gray-400 mt-1">💡 {currentQuizWord.tip}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── QUIZ DONE ─────────────────────────────────────────── */}
              {viewMode === 'quiz' && quizDone && (
                <div className="card text-center py-8 space-y-4 animate-slide-up">
                  <div className="text-5xl">{quizScore >= 80 ? '🥇' : quizScore >= 60 ? '🥈' : '📚'}</div>
                  <div>
                    <h2 className="font-display text-2xl text-gray-100">Quiz Complete!</h2>
                    <p className="text-gray-500 text-sm mt-1">{passedCount}/{words.length} correct</p>
                  </div>
                  <div className="card-sm">
                    <p className={`font-display text-4xl ${quizScore >= 80 ? 'text-teal-soft' : quizScore >= 60 ? 'text-gold' : 'text-orange-400'}`}>
                      {quizScore}%
                    </p>
                    <div className="h-2 bg-ink-700 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${quizScore}%` }}/>
                    </div>
                  </div>

                  {/* Mistakes review */}
                  {quizResults.filter(r => !r.correct).length > 0 && (
                    <div className="text-left">
                      <p className="section-label">Review Mistakes</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {quizResults.filter(r => !r.correct).map((r, i) => {
                          const gc = GENDER_CONFIG[r.word.gender]
                          return (
                            <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-ink-800 rounded-xl border border-red-400/10">
                              <XCircle size={13} className="text-red-400 shrink-0"/>
                              <span className="text-sm text-gray-300 flex-1">{r.word.de}</span>
                              <span className="text-xs text-red-400 line-through">{r.chosen}</span>
                              <span className="text-xs mx-1 text-gray-600">→</span>
                              <span className={`text-sm font-bold ${gc.color}`}>{r.word.gender}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => { setViewMode('learn'); setLearnIdx(0); setShowAnswer(false) }}
                      className="btn-secondary flex-1 justify-center">
                      <BookOpen size={14}/> Review
                    </button>
                    <button onClick={() => { setViewMode('quiz'); setQuizIdx(0); setChosen(null); setQuizResults([]); setQuizDone(false) }}
                      className="btn-primary flex-1 justify-center">
                      <RotateCcw size={14}/> Retry
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* History */}
          {history.length > 0 && !wordSet && !loading && (
            <div className="card">
              <p className="section-label flex items-center gap-2"><BarChart2 size={13}/> Recent Sessions</p>
              <div className="space-y-1.5">
                {history.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                    <span className="text-xs text-gray-400 capitalize flex-1">{h.topic}</span>
                    <span className={`text-sm font-semibold ${h.score >= 80 ? 'text-teal-soft' : h.score >= 60 ? 'text-gold' : 'text-orange-400'}`}>
                      {h.score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TABLES TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          <div className="flex gap-3 p-3 bg-gold/5 border border-gold/15 rounded-xl text-xs text-gray-400">
            <span className="shrink-0">📌</span>
            <p>These tables show how articles change depending on grammatical case. Nominative = subject, Accusative = direct object, Dative = indirect object, Genitive = possession.</p>
          </div>
          <DeclensionTable data={DEFINITE_TABLE}   title="Definite Articles (der/die/das)"/>
          <DeclensionTable data={INDEFINITE_TABLE} title="Indefinite Articles (ein/eine/ein)"/>

          {/* Colour coding key */}
          <div className="card">
            <p className="section-label">Colour Key</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(GENDER_CONFIG).map(([g, cfg]) => (
                <div key={g} className={`p-3 rounded-xl border text-center ${cfg.bg} ${cfg.border}`}>
                  <p className={`font-display text-2xl font-bold ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-xs text-gray-400 mt-1">{cfg.full}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── RULES TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex gap-3 p-3 bg-teal-muted border border-teal-soft/20 rounded-xl text-xs text-gray-300">
            <span className="shrink-0">💡</span>
            <p>German gender is mostly memorised, but these patterns cover the majority of nouns. Learn the exceptions as you go.</p>
          </div>
          {GENDER_RULES.map(g => (
            <div key={g.rule} className={`card border ${g.bg}`}>
              <h3 className={`font-display text-xl mb-3 ${g.color}`}>{g.rule}</h3>
              <ul className="space-y-2">
                {g.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <ChevronRight size={14} className={`${g.color} shrink-0 mt-0.5`}/>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
