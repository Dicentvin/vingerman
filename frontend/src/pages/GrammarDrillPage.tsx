import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import {
  generateWordSet, fetchTodaySet, fetchHistory, markPracticed,
} from '../store/slices/grammarSlice'
import type { WordCategory, GrammarWord } from '../store/slices/grammarSlice'
import {
  BookOpen, Zap, Volume2, ChevronDown, ChevronUp,
  CheckCircle2, Trophy, RotateCcw, BarChart2,
  Wand2, ChevronLeft, ChevronRight, Hash,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: {
  key: WordCategory; label: string; de: string
  emoji: string; color: string; bg: string; desc: string
}[] = [
  { key: 'mixed',       label: 'Mixed',        de: 'Gemischt',      emoji: '🎲', color: 'text-gold',        bg: 'bg-gold/10 border-gold/30',            desc: 'All word types together' },
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

// ─── Core speak helper — reads text AS-IS, article included ──────────────────
// NOTE: we deliberately do NOT strip der/die/das so nouns are read with article

function speakGerman(text: string, rate = 0.82) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)   // ← NO .replace() — article kept
  u.lang = 'de-DE'
  u.rate = rate
  u.pitch = 1.0
  speechSynthesis.speak(u)
}

// ─── Single Word Detail Page ──────────────────────────────────────────────────

function WordDetail({
  word, globalIndex, total, onPrev, onNext, isFirst, isLast,
}: {
  word: GrammarWord; globalIndex: number; total: number
  onPrev: () => void; onNext: () => void
  isFirst: boolean; isLast: boolean
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const catInfo = CATEGORIES.find(c => c.key === word.category)

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [globalIndex])

  const progress = Math.round(((globalIndex + 1) / total) * 100)

  return (
    <div ref={cardRef} className="space-y-4 animate-fade-in">

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-ink-700 rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}/>
        </div>
        <span className="text-xs text-gray-500 shrink-0 font-mono">{globalIndex + 1} / {total}</span>
      </div>

      {/* Main word card */}
      <div className="card">

        {/* Category + gender badges */}
        {catInfo && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${catInfo.bg} ${catInfo.color}`}>
              {catInfo.emoji} {catInfo.label}
            </span>
            {word.gender && (
              <span className={`text-xs px-3 py-1.5 rounded-full border font-bold ${GENDER_COLORS[word.gender]}`}>
                {word.gender}
              </span>
            )}
          </div>
        )}

        {/* German word — reads WITH article (e.g. "der Hund") */}
        <div className="flex items-start gap-3 mb-2">
          <div className="flex-1">
            <h2 className="font-display text-3xl sm:text-4xl text-gray-100 leading-tight">{word.de}</h2>
            {word.ipa && <p className="text-violet-soft font-mono text-sm mt-1">{word.ipa}</p>}
          </div>
          {/* Speak button — passes full word.de which includes the article */}
          <button
            onClick={() => speakGerman(word.de)}
            className="btn-secondary p-3 shrink-0 text-gold border-gold/30 hover:bg-gold/10"
            title={`Hear: ${word.de}`}>
            <Volume2 size={20}/>
          </button>
        </div>

        <p className="text-xl text-gray-300 mb-4 pb-4 border-b border-white/[0.07]">{word.en}</p>

        {/* NOUN: singular → plural */}
        {word.category === 'noun' && word.plural && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-ink-800 rounded-xl border border-white/[0.06]">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Singular</p>
              <button onClick={() => speakGerman(word.de)}
                className="text-sm font-semibold text-gray-200 hover:text-gold flex items-center gap-1 group">
                {word.de}
                <Volume2 size={11} className="opacity-0 group-hover:opacity-60"/>
              </button>
            </div>
            <div className="text-gray-600 text-lg">→</div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Plural</p>
              <button onClick={() => speakGerman(word.plural!)}
                className="text-sm font-semibold text-gray-200 hover:text-gold flex items-center gap-1 group">
                {word.plural}
                <Volume2 size={11} className="opacity-0 group-hover:opacity-60"/>
              </button>
            </div>
          </div>
        )}

        {/* VERB: conjugation table */}
        {word.category === 'verb' && word.conjugations && (
          <div className="mb-4 rounded-xl border border-white/[0.07] overflow-hidden">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest px-3 pt-2.5 pb-1.5 bg-ink-800">
              Present Tense — Präsens
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/[0.04]">
              {([
                ['ich',       word.conjugations.ich],
                ['du',        word.conjugations.du],
                ['er/sie/es', word.conjugations.er],
                ['wir',       word.conjugations.wir],
                ['ihr',       word.conjugations.ihr],
                ['sie/Sie',   word.conjugations.sie],
              ] as [string, string][]).map(([pronoun, form]) => (
                <div key={pronoun} className="bg-ink-900 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{pronoun}</span>
                  <button onClick={() => speakGerman(`${pronoun} ${form}`)}
                    className="flex items-center gap-1.5 group">
                    <span className="text-sm font-semibold text-gray-200 group-hover:text-gold transition-colors">{form}</span>
                    <Volume2 size={11} className="text-gray-700 group-hover:text-gold transition-colors"/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADJECTIVE: comparative table */}
        {word.category === 'adjective' && (word.comparative || word.superlative) && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Positiv',    value: word.de,          color: 'text-gray-200' },
              { label: 'Komparativ', value: word.comparative, color: 'text-gold' },
              { label: 'Superlativ', value: word.superlative, color: 'text-teal-soft' },
            ].filter(i => i.value).map(item => (
              <div key={item.label} className="bg-ink-800 rounded-xl border border-white/[0.06] p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{item.label}</p>
                <button onClick={() => speakGerman(item.value!)}
                  className={`text-base font-semibold ${item.color} flex items-center justify-center gap-1 mx-auto group`}>
                  {item.value}
                  <Volume2 size={11} className="opacity-0 group-hover:opacity-60"/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tip */}
        {word.tip && (
          <div className="flex items-start gap-2.5 p-3 bg-gold/5 border border-gold/15 rounded-xl mb-4">
            <span className="text-base shrink-0">💡</span>
            <p className="text-sm text-gray-300 leading-relaxed">{word.tip}</p>
          </div>
        )}
      </div>

      {/* Example sentences */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-200 flex items-center gap-2">
            <BookOpen size={15} className="text-gold"/> Usage Examples
          </h3>
          <span className="text-xs text-gray-500">
            {(word.sentences?.length || 0) + (word.example ? 1 : 0)} sentences
          </span>
        </div>

        <div className="space-y-3">
          {/* Primary example */}
          {word.example && (
            <SentenceCard index={0} sentence={word.example} translation={word.exampleEn} isPrimary/>
          )}
          {/* Additional sentences */}
          {word.sentences?.map((sentence, i) => (
            <SentenceCard
              key={i} index={i + 1}
              sentence={sentence}
              translation={word.sentencesEn?.[i]}
            />
          ))}
          {(!word.sentences || word.sentences.length === 0) && !word.example && (
            <p className="text-center text-gray-600 text-sm py-4">
              Regenerate the word set to get example sentences
            </p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={onPrev} disabled={isFirst}
          className="btn-secondary flex-1 justify-center py-3 gap-2 disabled:opacity-30">
          <ChevronLeft size={18}/> Previous
        </button>
        <div className="text-center shrink-0">
          <p className="text-xs text-gray-600 font-mono">{globalIndex + 1}/{total}</p>
        </div>
        <button onClick={onNext} disabled={isLast}
          className="btn-primary flex-1 justify-center py-3 gap-2 disabled:opacity-30">
          Next <ChevronRight size={18}/>
        </button>
      </div>

      {isLast && (
        <div className="text-center py-3 px-4 bg-teal-muted border border-teal-soft/20 rounded-xl">
          <p className="text-teal-soft text-sm font-medium">🎉 You've reached the last word!</p>
          <p className="text-gray-500 text-xs mt-0.5">Switch to List view or start the Quiz</p>
        </div>
      )}
    </div>
  )
}

// ─── Sentence Card ────────────────────────────────────────────────────────────

function SentenceCard({
  index, sentence, translation, isPrimary,
}: {
  index: number; sentence: string; translation?: string; isPrimary?: boolean
}) {
  const [showTrans, setShowTrans] = useState(false)

  return (
    <div className={`rounded-xl border p-4 ${isPrimary ? 'bg-gold/5 border-gold/20' : 'bg-ink-800 border-white/[0.06]'}`}>
      <div className="flex items-start gap-3">
        <span className={`text-[10px] font-mono w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5
          ${isPrimary ? 'bg-gold/20 text-gold' : 'bg-ink-700 text-gray-600'}`}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed font-medium ${isPrimary ? 'text-gray-100' : 'text-gray-200'}`}>
            {sentence}
          </p>
          {translation && (
            showTrans ? (
              <p className="text-xs text-teal-soft/80 mt-1.5 italic leading-relaxed">{translation}</p>
            ) : (
              <button onClick={() => setShowTrans(true)}
                className="text-[11px] text-gray-600 hover:text-teal-soft mt-1 transition-colors">
                Tap to see translation →
              </button>
            )
          )}
        </div>
        {/* Speaks the full sentence — no article stripping */}
        <button onClick={() => speakGerman(sentence)}
          className="btn-ghost p-1.5 shrink-0 text-gray-600 hover:text-gold">
          <Volume2 size={14}/>
        </button>
      </div>
    </div>
  )
}

// ─── Word List Row ─────────────────────────────────────────────────────────────

function WordListRow({ word, index, onClick, isActive }: {
  word: GrammarWord; index: number; onClick: () => void; isActive: boolean
}) {
  const catInfo = CATEGORIES.find(c => c.key === word.category)
  return (
    <div onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all
        ${isActive ? 'bg-gold/10 border border-gold/25' : 'bg-ink-800 border border-white/[0.05] hover:border-white/10'}`}>
      <span className="text-[10px] font-mono text-gray-600 w-7 text-center shrink-0">{index + 1}</span>
      {/* Full word including article */}
      <span className="text-sm font-medium text-gray-200 flex-1 truncate">{word.de}</span>
      <span className="text-xs text-gray-500 truncate max-w-[100px] hidden sm:block">{word.en}</span>
      {word.gender && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${GENDER_COLORS[word.gender]}`}>
          {word.gender}
        </span>
      )}
      <span className="text-base shrink-0">{catInfo?.emoji}</span>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function GrammarDrillPage() {
  const dispatch = useAppDispatch()
  const { todaySet, history, loading, generating } = useAppSelector(s => s.grammar)

  const [category, setCategory] = useState<WordCategory>('mixed')
  const [count, setCount]       = useState(20)
  const [activeTab, setActiveTab] = useState<'study' | 'list' | 'quiz' | 'history'>('study')
  const [currentPage, setCurrentPage] = useState(0)
  const [listPage, setListPage]         = useState(1)
  const LIST_PER_PAGE = 15
  const [searchTerm, setSearchTerm]   = useState('')

  // Quiz
  const [quizIdx, setQuizIdx]           = useState(0)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [quizScore, setQuizScore]       = useState(0)
  const [quizDone, setQuizDone]         = useState(false)

  useEffect(() => {
    dispatch(fetchTodaySet(category))
    dispatch(fetchHistory())
  }, [dispatch, category])

  useEffect(() => { setCurrentPage(0) }, [todaySet])

  const handleGenerate = async () => {
    setCurrentPage(0)
    const result = await dispatch(generateWordSet({ category, count }))
    if (result.error) toast.error(String(result.payload))
    else { toast.success(`${count} ${category} words ready! 🎉`); setActiveTab('study') }
  }

  const words         = todaySet?.words || []
  // Reset list page on search
  useEffect(() => { setListPage(1) }, [searchTerm])

  const filteredWords = words.filter(w =>
    !searchTerm ||
    w.de.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.en.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const currentWord = words[currentPage]

  const handleQuizAnswer = async (knew: boolean) => {
    if (knew) setQuizScore(s => s + 1)
    // Speak the full word with article on reveal
    speakGerman(words[quizIdx].de)
    if (quizIdx + 1 >= words.length) {
      const finalScore = Math.round(((quizScore + (knew ? 1 : 0)) / words.length) * 100)
      setQuizDone(true)
      if (todaySet) await dispatch(markPracticed({ setId: todaySet._id, score: finalScore }))
    } else {
      setQuizIdx(i => i + 1)
      setQuizRevealed(false)
    }
  }

  const resetQuiz = () => {
    setQuizIdx(0); setQuizRevealed(false)
    setQuizScore(0); setQuizDone(false)
    setActiveTab('study')
  }

  // ── QUIZ complete ───────────────────────────────────────────────────────────
  if (activeTab === 'quiz' && quizDone) {
    const pct = Math.round((quizScore / words.length) * 100)
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="card max-w-sm w-full text-center animate-slide-up">
          <div className="text-6xl mb-4">{pct >= 80 ? '🥇' : pct >= 60 ? '🥈' : '📚'}</div>
          <h2 className="font-display text-3xl text-gray-100 mb-1">Quiz Complete!</h2>
          <p className="text-gray-500 text-sm mb-5">{quizScore} / {words.length} words known</p>
          <div className="card-sm mb-5 text-center">
            <p className={`font-display text-5xl ${pct >= 80 ? 'text-teal-soft' : pct >= 60 ? 'text-gold' : 'text-orange-400'}`}>{pct}%</p>
            <div className="h-2 bg-ink-700 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${pct}%` }}/>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={resetQuiz} className="btn-primary flex-1 justify-center">
              <BookOpen size={15}/> Back to Study
            </button>
            <button onClick={() => { setQuizIdx(0); setQuizRevealed(false); setQuizScore(0); setQuizDone(false) }}
              className="btn-secondary flex-1 justify-center">
              <RotateCcw size={14}/> Retry Quiz
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── QUIZ active ─────────────────────────────────────────────────────────────
  if (activeTab === 'quiz' && words.length > 0) {
    const qWord = words[quizIdx]
    return (
      <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Quick Quiz</p>
            <p className="font-display text-xl text-gray-100">{quizIdx + 1} / {words.length}</p>
          </div>
          <button onClick={resetQuiz} className="btn-ghost text-xs text-gray-600 hover:text-red-400">✕ Exit</button>
        </div>
        <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gold rounded-full transition-all"
            style={{ width: `${(quizIdx / words.length) * 100}%` }}/>
        </div>

        <div className="card text-center py-12 mb-4 cursor-pointer"
          onClick={() => { if (!quizRevealed) { setQuizRevealed(true); speakGerman(qWord.de) } }}>
          {!quizRevealed ? (
            <>
              {/* Show full word with article in quiz too */}
              <p className="font-display text-5xl text-gray-100 mb-2">{qWord.de}</p>
              {qWord.ipa && <p className="text-violet-soft font-mono">{qWord.ipa}</p>}
              <p className="text-gray-600 text-sm mt-4">Tap to reveal</p>
            </>
          ) : (
            <div className="animate-fade-in">
              <p className="font-display text-3xl text-gold mb-1">{qWord.de}</p>
              {qWord.gender && (
                <span className={`text-xs px-2 py-0.5 rounded-full border mb-2 inline-block ${GENDER_COLORS[qWord.gender]}`}>
                  {qWord.gender}
                </span>
              )}
              <p className="text-xl text-gray-200 mb-3">{qWord.en}</p>
              {qWord.example && <p className="text-sm text-gray-500 italic">"{qWord.example}"</p>}
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
          <button onClick={() => { setQuizRevealed(true); speakGerman(qWord.de) }}
            className="btn-primary w-full justify-center py-3">
            <Zap size={15}/> Reveal Answer
          </button>
        )}
      </div>
    )
  }

  // ── MAIN VIEW ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Grammar Word Drill</h1>
        <p className="text-gray-500 text-sm mt-1">
          Generate up to 100 words — nouns read with <span className="text-gold">der/die/das</span> article
        </p>
      </div>

      {/* Generator */}
      <div className="card mb-5">
        <label className="section-label">Word Category</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setCategory(cat.key)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all
                ${category === cat.key ? `${cat.bg} ${cat.color}` : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15'}`}>
              <span className="text-xl">{cat.emoji}</span>
              <span>{cat.label}</span>
              <span className="text-[9px] opacity-60">{cat.de}</span>
            </button>
          ))}
        </div>

        <label className="section-label">How many words?</label>
        <div className="flex gap-2 flex-wrap mb-4">
          {COUNT_OPTIONS.map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all
                ${count === n ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'}`}>
              {n}
            </button>
          ))}
        </div>

        <button onClick={handleGenerate} disabled={generating} className="btn-primary w-full justify-center">
          {generating
            ? <><span className="spinner"/> Generating {count} {category} words…</>
            : <><Wand2 size={15}/> Generate {count} {CATEGORIES.find(c => c.key === category)?.label} Words</>}
        </button>
      </div>

      {/* Loading */}
      {(loading || generating) && (
        <div className="card text-center py-12">
          <div className="spinner w-8 h-8 mx-auto mb-3"/>
          <p className="text-gray-500 text-sm">Generating words with grammar details and sentences…</p>
        </div>
      )}

      {/* Word set */}
      {!loading && !generating && todaySet && words.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl text-gray-100 capitalize">{todaySet.category} Words</h2>
              <span className="badge-gold">{words.length} words</span>
              {todaySet.practiced && (
                <span className="badge-teal gap-1"><CheckCircle2 size={10}/> {todaySet.score}%</span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-ink-800 p-1 gap-1 mb-5">
            {([
              ['study',   '📖 Study'],
              ['list',    '📋 List'],
              ['quiz',    '⚡ Quiz'],
              ['history', '📊 History'],
            ] as const).map(([k, l]) => (
              <button key={k}
                onClick={() => {
                  setActiveTab(k)
                  if (k === 'quiz') { setQuizIdx(0); setQuizRevealed(false); setQuizScore(0); setQuizDone(false) }
                }}
                className={`flex-1 py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all
                  ${activeTab === k ? 'bg-gold text-ink-950' : 'text-gray-400 hover:text-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* STUDY — one word per page */}
          {activeTab === 'study' && currentWord && (
            <WordDetail
              word={currentWord}
              globalIndex={currentPage}
              total={words.length}
              onPrev={() => setCurrentPage(p => Math.max(0, p - 1))}
              onNext={() => setCurrentPage(p => Math.min(words.length - 1, p + 1))}
              isFirst={currentPage === 0}
              isLast={currentPage === words.length - 1}
            />
          )}

          {/* LIST — searchable + paginated */}
          {activeTab === 'list' && (() => {
            const listTotalPages = Math.ceil(filteredWords.length / LIST_PER_PAGE)
            const pagedWords = filteredWords.slice((listPage - 1) * LIST_PER_PAGE, listPage * LIST_PER_PAGE)
            return (
              <div className="space-y-3">
                <input className="input text-sm" placeholder="Search words…"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <Hash size={11}/> {filteredWords.length} words{searchTerm && ` matching "${searchTerm}"`}
                  </p>
                  {listTotalPages > 1 && (
                    <span className="text-xs text-gray-600">Page {listPage}/{listTotalPages}</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {pagedWords.map((w, i) => {
                    const realIdx = words.indexOf(w)
                    return (
                      <WordListRow key={`${w.de}-${i}`} word={w} index={realIdx}
                        isActive={currentPage === realIdx}
                        onClick={() => { setCurrentPage(realIdx); setActiveTab('study') }}/>
                    )
                  })}
                </div>
                {listTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 pt-2 border-t border-white/[0.06]">
                    <button onClick={() => setListPage(p => Math.max(1, p - 1))} disabled={listPage === 1}
                      className="btn-ghost px-2 py-1 text-xs disabled:opacity-30">‹ Prev</button>
                    {Array.from({ length: Math.min(7, listTotalPages) }, (_, idx) => {
                      const start = Math.max(1, Math.min(listPage - 3, listTotalPages - 6))
                      return start + idx
                    }).map(p => (
                      <button key={p} onClick={() => setListPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-all
                          ${p === listPage ? 'bg-gold/10 text-gold border border-gold/30' : 'btn-ghost text-gray-500'}`}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setListPage(p => Math.min(listTotalPages, p + 1))} disabled={listPage === listTotalPages}
                      className="btn-ghost px-2 py-1 text-xs disabled:opacity-30">Next ›</button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="card text-center py-12">
                  <BarChart2 size={32} className="text-gray-700 mx-auto mb-3"/>
                  <p className="text-gray-500 text-sm">No history yet</p>
                </div>
              ) : history.map(h => {
                const catInfo = CATEGORIES.find(c => c.key === h.category)
                return (
                  <div key={h._id} className="card-sm flex items-center gap-3">
                    <span className="text-2xl">{catInfo?.emoji || '📚'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 capitalize">{h.category} words</p>
                      <p className="text-xs text-gray-500">
                        {new Date(h.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    {h.practiced
                      ? <p className={`text-sm font-semibold shrink-0 ${h.score >= 80 ? 'text-teal-soft' : h.score >= 60 ? 'text-gold' : 'text-orange-400'}`}>{h.score}%</p>
                      : <span className="text-xs text-gray-600 italic shrink-0">not quizzed</span>}
                  </div>
                )
              })}
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
        </div>
      )}
    </div>
  )
}
