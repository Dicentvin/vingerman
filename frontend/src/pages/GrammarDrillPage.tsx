import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import {
  generateWordSet, fetchTodaySet, fetchHistory,
  markPracticed, clearSet,
} from '../store/slices/grammarSlice'
import type { WordCategory, GrammarWord } from '../store/slices/grammarSlice'
import {
  BookOpen, Zap, Volume2, ChevronDown, ChevronUp,
  CheckCircle2, Trophy, RotateCcw, BarChart2,
  Wand2, Filter, Hash,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: WordCategory; label: string; de: string; emoji: string; color: string; bg: string; desc: string }[] = [
  { key: 'mixed',       label: 'Mixed',        de: 'Gemischt',      emoji: '🎲', color: 'text-gold',        bg: 'bg-gold/10 border-gold/30',           desc: 'All word types together' },
  { key: 'noun',        label: 'Nouns',        de: 'Nomen',         emoji: '📦', color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-400/30',    desc: 'With gender & plural' },
  { key: 'verb',        label: 'Verbs',        de: 'Verben',        emoji: '⚡', color: 'text-teal-soft',   bg: 'bg-teal-muted border-teal-soft/30',    desc: 'With all conjugations' },
  { key: 'adjective',   label: 'Adjectives',   de: 'Adjektive',     emoji: '🎨', color: 'text-violet-soft', bg: 'bg-violet-muted border-violet-soft/30',desc: 'With comparative & superlative' },
  { key: 'adverb',      label: 'Adverbs',      de: 'Adverbien',     emoji: '🔄', color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-400/30',desc: 'Time, place, manner, frequency' },
  { key: 'preposition', label: 'Prepositions', de: 'Präpositionen', emoji: '🔗', color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-400/30',    desc: 'With cases (Akk/Dat/Gen)' },
  { key: 'conjunction', label: 'Conjunctions', de: 'Konjunktionen', emoji: '🔀', color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-400/30',    desc: 'Coordinating & subordinating' },
  { key: 'pronoun',     label: 'Pronouns',     de: 'Pronomen',      emoji: '👤', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-400/30', desc: 'Personal, reflexive, relative' },
]

const COUNT_OPTIONS = [10, 20, 30, 50, 100]

const GENDER_COLORS: Record<string, string> = {
  der: 'text-blue-400 bg-blue-500/10 border-blue-400/20',
  die: 'text-pink-400 bg-pink-500/10 border-pink-400/20',
  das: 'text-green-400 bg-green-500/10 border-green-400/20',
}

// ─── Word Card Component ──────────────────────────────────────────────────────

function WordCard({ word, index }: { word: GrammarWord; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const catInfo = CATEGORIES.find(c => c.key === word.category)

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/^(der|die|das)\s/i, ''))
    u.lang = 'de-DE'; u.rate = 0.82
    speechSynthesis.speak(u)
  }

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden
      ${expanded ? 'border-white/15 bg-ink-800/80' : 'border-white/[0.06] bg-ink-900 hover:border-white/10'}`}>

      {/* Header row */}
      <div className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}>

        {/* Index */}
        <span className="text-[10px] font-mono text-gray-700 w-7 shrink-0 text-center">{index + 1}</span>

        {/* Word + gender badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-lg sm:text-xl text-gray-100">{word.de}</span>
            {word.gender && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${GENDER_COLORS[word.gender] || 'text-gray-400 bg-ink-700 border-white/10'}`}>
                {word.gender}
              </span>
            )}
            {catInfo && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${catInfo.bg} ${catInfo.color} hidden sm:inline-flex`}>
                {catInfo.emoji} {catInfo.label}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5 truncate">{word.en}</p>
        </div>

        {/* IPA + speak */}
        <div className="flex items-center gap-2 shrink-0">
          {word.ipa && <span className="text-[10px] text-violet-soft font-mono hidden sm:block">{word.ipa}</span>}
          <button onClick={e => { e.stopPropagation(); speak(word.de) }}
            className="btn-ghost p-1.5 text-gray-600 hover:text-gold">
            <Volume2 size={14}/>
          </button>
          {expanded ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-4 space-y-3 animate-fade-in">

          {/* IPA (mobile) */}
          {word.ipa && (
            <p className="text-sm text-violet-soft font-mono sm:hidden">{word.ipa}</p>
          )}

          {/* NOUN: plural */}
          {word.category === 'noun' && word.plural && (
            <div className="flex items-center gap-3 p-3 bg-ink-800 rounded-xl border border-white/[0.06]">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Plural</p>
                <p className="text-sm font-medium text-gray-200">{word.plural}</p>
              </div>
            </div>
          )}

          {/* VERB: conjugation table */}
          {word.category === 'verb' && word.conjugations && (
            <div className="bg-ink-800 rounded-xl border border-white/[0.06] overflow-hidden">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest px-3 pt-2.5 pb-1.5">
                Present Tense Conjugation
              </p>
              <div className="grid grid-cols-3 gap-px bg-white/[0.04]">
                {[
                  ['ich',  word.conjugations.ich],
                  ['du',   word.conjugations.du],
                  ['er/sie/es', word.conjugations.er],
                  ['wir',  word.conjugations.wir],
                  ['ihr',  word.conjugations.ihr],
                  ['sie/Sie', word.conjugations.sie],
                ].map(([pronoun, form]) => (
                  <div key={pronoun} className="bg-ink-800 px-3 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-600">{pronoun}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-gray-200">{form}</span>
                      <button onClick={() => speak(form as string)} className="text-gray-700 hover:text-gold transition-colors">
                        <Volume2 size={11}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADJECTIVE: comparative / superlative */}
          {word.category === 'adjective' && (word.comparative || word.superlative) && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Base',        value: word.de },
                { label: 'Comparative', value: word.comparative },
                { label: 'Superlative', value: word.superlative },
              ].map(item => item.value && (
                <div key={item.label} className="bg-ink-800 rounded-xl border border-white/[0.06] p-2.5 text-center">
                  <p className="text-[10px] text-gray-500 mb-1">{item.label}</p>
                  <p className="text-sm font-medium text-gray-200">{item.value}</p>
                  <button onClick={() => speak(item.value!)} className="text-gray-700 hover:text-gold mt-1">
                    <Volume2 size={10}/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Example sentence */}
          {word.example && (
            <div className="bg-ink-800 rounded-xl border border-white/[0.06] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-200 leading-relaxed italic">"{word.example}"</p>
                  {word.exampleEn && (
                    <p className="text-xs text-gray-500 mt-1">— {word.exampleEn}</p>
                  )}
                </div>
                <button onClick={() => speak(word.example)} className="btn-ghost p-1 shrink-0 text-gray-600 hover:text-gold">
                  <Volume2 size={13}/>
                </button>
              </div>
            </div>
          )}

          {/* Tip */}
          {word.tip && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-gold/5 border border-gold/15 rounded-xl">
              <span className="text-base shrink-0">💡</span>
              <p className="text-xs text-gray-300 leading-relaxed">{word.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function GrammarDrillPage() {
  const dispatch = useAppDispatch()
  const { todaySet, history, loading, generating } = useAppSelector(s => s.grammar)

  const [category, setCategory] = useState<WordCategory>('mixed')
  const [count, setCount]       = useState(50)
  const [activeTab, setActiveTab] = useState<'words' | 'history'>('words')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCat, setFilterCat] = useState<WordCategory | 'all'>('all')
  const [quizMode, setQuizMode]   = useState(false)
  const [quizIdx, setQuizIdx]     = useState(0)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [quizScore, setQuizScore] = useState(0)
  const [quizDone, setQuizDone]   = useState(false)

  useEffect(() => {
    dispatch(fetchTodaySet(category))
    dispatch(fetchHistory())
  }, [dispatch, category])

  const handleGenerate = async () => {
    const result = await dispatch(generateWordSet({ category, count }))
    if (result.error) toast.error(String(result.payload))
    else toast.success(`${count} ${category} words generated! 🎉`)
  }

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/^(der|die|das)\s/i, ''))
    u.lang = 'de-DE'; u.rate = 0.82
    speechSynthesis.speak(u)
  }

  // ── Filtered word list ──────────────────────────────────────────────────────
  const filteredWords = (todaySet?.words || []).filter(w => {
    const matchSearch = !searchTerm ||
      w.de.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.en.toLowerCase().includes(searchTerm.toLowerCase())
    const matchCat = filterCat === 'all' || w.category === filterCat
    return matchSearch && matchCat
  })

  // ── Category breakdown ──────────────────────────────────────────────────────
  const catBreakdown = CATEGORIES.filter(c => c.key !== 'mixed').map(c => ({
    ...c,
    count: (todaySet?.words || []).filter(w => w.category === c.key).length,
  })).filter(c => c.count > 0)

  // ── Quiz mode ───────────────────────────────────────────────────────────────
  const quizWords = todaySet?.words || []
  const currentQuizWord = quizWords[quizIdx]

  const handleQuizAnswer = async (knew: boolean) => {
    if (knew) setQuizScore(s => s + 1)
    speak(currentQuizWord.de)
    if (quizIdx + 1 >= quizWords.length) {
      const finalScore = Math.round(((quizScore + (knew ? 1 : 0)) / quizWords.length) * 100)
      setQuizDone(true)
      if (todaySet) {
        await dispatch(markPracticed({ setId: todaySet._id, score: finalScore }))
      }
    } else {
      setQuizIdx(i => i + 1)
      setQuizRevealed(false)
    }
  }

  const resetQuiz = () => {
    setQuizMode(false); setQuizIdx(0); setQuizRevealed(false)
    setQuizScore(0); setQuizDone(false)
  }

  // ── Quiz complete screen ────────────────────────────────────────────────────
  if (quizMode && quizDone) {
    const pct = Math.round((quizScore / quizWords.length) * 100)
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="card max-w-sm w-full text-center animate-slide-up">
          <div className="text-5xl mb-4">{pct >= 80 ? '🥇' : pct >= 60 ? '🥈' : '📚'}</div>
          <h2 className="font-display text-2xl text-gray-100 mb-1">Quiz Complete!</h2>
          <p className="text-gray-500 text-sm mb-5">{quizScore} / {quizWords.length} words known</p>
          <div className="card-sm mb-5">
            <p className={`font-display text-4xl ${pct >= 80 ? 'text-teal-soft' : pct >= 60 ? 'text-gold' : 'text-orange-400'}`}>{pct}%</p>
            <div className="h-2 bg-ink-700 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${pct}%` }}/>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-5">
            {pct >= 80 ? 'Excellent! You know most of these words.' : pct >= 60 ? 'Good progress! Keep reviewing the ones you missed.' : 'Keep practising — repetition is key!'}
          </p>
          <div className="flex gap-2">
            <button onClick={resetQuiz} className="btn-primary flex-1 justify-center">
              <BookOpen size={15}/> Back to List
            </button>
            <button onClick={() => { resetQuiz(); setTimeout(() => setQuizMode(true), 100) }}
              className="btn-secondary flex-1 justify-center">
              <RotateCcw size={14}/> Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Quiz active screen ──────────────────────────────────────────────────────
  if (quizMode && currentQuizWord) {
    return (
      <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Word Quiz</p>
            <p className="font-display text-xl text-gray-100">{quizIdx + 1} / {quizWords.length}</p>
          </div>
          <button onClick={resetQuiz} className="btn-ghost text-xs text-gray-600 hover:text-red-400">✕ Exit</button>
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gold rounded-full transition-all"
            style={{ width: `${(quizIdx / quizWords.length) * 100}%` }}/>
        </div>

        {/* Card */}
        <div className="card text-center py-10 sm:py-14 mb-4 cursor-pointer"
          onClick={() => { if (!quizRevealed) { setQuizRevealed(true); speak(currentQuizWord.de) } }}>
          {!quizRevealed ? (
            <>
              <p className="font-display text-4xl sm:text-5xl text-gray-100 mb-3">{currentQuizWord.de}</p>
              {currentQuizWord.ipa && <p className="text-violet-soft font-mono">{currentQuizWord.ipa}</p>}
              <p className="text-gray-600 text-sm mt-4">Tap to reveal meaning</p>
            </>
          ) : (
            <div className="animate-fade-in">
              <p className="font-display text-3xl sm:text-4xl text-gold mb-2">{currentQuizWord.de}</p>
              {currentQuizWord.gender && (
                <span className={`text-xs px-2 py-0.5 rounded-full border mb-3 inline-block ${GENDER_COLORS[currentQuizWord.gender] || ''}`}>
                  {currentQuizWord.gender}
                </span>
              )}
              <p className="text-xl text-gray-200 mb-3">{currentQuizWord.en}</p>
              {currentQuizWord.example && (
                <p className="text-sm text-gray-500 italic mt-2">"{currentQuizWord.example}"</p>
              )}
            </div>
          )}
        </div>

        {quizRevealed ? (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleQuizAnswer(false)}
              className="py-4 rounded-xl border bg-red-500/10 border-red-400/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all">
              😓 Didn't know
            </button>
            <button onClick={() => handleQuizAnswer(true)}
              className="py-4 rounded-xl border bg-teal-muted border-teal-soft/30 text-teal-soft text-sm font-medium hover:bg-teal-soft/20 transition-all">
              ✅ Knew it!
            </button>
          </div>
        ) : (
          <button onClick={() => { setQuizRevealed(true); speak(currentQuizWord.de) }}
            className="btn-primary w-full justify-center py-3">
            <Zap size={15}/> Reveal Answer
          </button>
        )}
      </div>
    )
  }

  // ── Main view ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Grammar Word Drill</h1>
        <p className="text-gray-500 text-sm mt-1">
          Generate up to 100 words by category — nouns with gender, verbs with conjugations, adjectives with comparatives
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-ink-800 p-1 gap-1 mb-5">
        {([['words','📚 Today\'s Words'],['history','📊 History']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all
              ${activeTab === k ? 'bg-gold text-ink-950' : 'text-gray-400 hover:text-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {activeTab === 'words' && (
        <>
          {/* Generator card */}
          <div className="card mb-5">
            {/* Category selector */}
            <label className="section-label">Word Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setCategory(cat.key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all
                    ${category === cat.key ? `${cat.bg} ${cat.color}` : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15'}`}>
                  <span className="text-xl">{cat.emoji}</span>
                  <span>{cat.label}</span>
                  <span className={`text-[9px] opacity-60 ${category === cat.key ? '' : 'text-gray-600'}`}>{cat.de}</span>
                </button>
              ))}
            </div>

            {/* Count + generate */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1">
                <label className="section-label">How many words?</label>
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
            </div>

            <button onClick={handleGenerate} disabled={generating}
              className="btn-primary w-full justify-center mt-4">
              {generating
                ? <><span className="spinner"/> Generating {count} {category} words…</>
                : <><Wand2 size={15}/> Generate {count} {CATEGORIES.find(c=>c.key===category)?.label} Words</>}
            </button>
          </div>

          {/* Loading */}
          {(loading || generating) && (
            <div className="card text-center py-12">
              <div className="spinner w-8 h-8 mx-auto mb-3"/>
              <p className="text-gray-500 text-sm">
                {generating ? `Generating ${count} ${category} words with full grammar details…` : 'Loading…'}
              </p>
            </div>
          )}

          {/* Word set */}
          {!loading && !generating && todaySet && (
            <>
              {/* Set header */}
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-xl text-gray-100 capitalize">{todaySet.category} Words</h2>
                    <span className="badge-gold">{todaySet.words.length} words</span>
                    {todaySet.practiced && (
                      <span className="badge-teal gap-1"><CheckCircle2 size={10}/> Practiced — {todaySet.score}%</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generated {new Date(todaySet.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                  </p>
                </div>
                <button onClick={() => setQuizMode(true)} className="btn-primary gap-2">
                  <Zap size={15}/> Quick Quiz
                </button>
              </div>

              {/* Category breakdown (mixed only) */}
              {todaySet.category === 'mixed' && catBreakdown.length > 0 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  {catBreakdown.map(c => (
                    <span key={c.key} className={`text-[11px] px-3 py-1.5 rounded-full border ${c.bg} ${c.color}`}>
                      {c.emoji} {c.count} {c.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Search + filter */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <input className="input flex-1 text-sm py-2" placeholder="Search words…"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                {todaySet.category === 'mixed' && (
                  <select className="input py-2 text-sm w-auto"
                    value={filterCat} onChange={e => setFilterCat(e.target.value as WordCategory | 'all')}>
                    <option value="all">All types</option>
                    {CATEGORIES.filter(c => c.key !== 'mixed').map(c => (
                      <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Word count */}
              <p className="text-xs text-gray-600 mb-3 flex items-center gap-1.5">
                <Hash size={11}/> Showing {filteredWords.length} of {todaySet.words.length} words
                {searchTerm && ` matching "${searchTerm}"`}
              </p>

              {/* Word cards */}
              <div className="space-y-2">
                {filteredWords.map((word, i) => (
                  <WordCard key={`${word.de}-${i}`} word={word} index={i}/>
                ))}
              </div>

              {filteredWords.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  <p>No words match your search</p>
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!loading && !generating && !todaySet && (
            <div className="card text-center py-16 border-dashed border-2 border-white/[0.05]">
              <BookOpen size={48} className="text-gray-700 mx-auto mb-4"/>
              <h3 className="font-display text-xl text-gray-500 mb-2">No words generated yet</h3>
              <p className="text-gray-600 text-sm max-w-xs mx-auto">
                Pick a category, set how many words you want, then click Generate
              </p>
              <div className="flex justify-center gap-2 mt-5 flex-wrap">
                {CATEGORIES.slice(0,4).map(c => (
                  <span key={c.key} className={`text-xs px-3 py-1.5 rounded-full border ${c.bg} ${c.color}`}>
                    {c.emoji} {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="card text-center py-12">
              <BarChart2 size={36} className="text-gray-700 mx-auto mb-3"/>
              <p className="text-gray-500 text-sm">No history yet — generate your first word set!</p>
            </div>
          ) : (
            history.map(h => {
              const catInfo = CATEGORIES.find(c => c.key === h.category)
              return (
                <div key={h._id} className="card-sm flex items-center gap-3">
                  <span className="text-2xl">{catInfo?.emoji || '📚'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 capitalize">{h.category} words</p>
                    <p className="text-xs text-gray-500">
                      {new Date(h.date).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {h.practiced ? (
                      <div>
                        <p className={`text-sm font-semibold ${h.score >= 80 ? 'text-teal-soft' : h.score >= 60 ? 'text-gold' : 'text-orange-400'}`}>
                          {h.score}%
                        </p>
                        <p className="text-[10px] text-gray-600">quiz score</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600 italic">not quizzed</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
