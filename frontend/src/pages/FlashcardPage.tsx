import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { fetchDueCards, rateCard, flipCard, resetSession, syncVocabToCards } from '../store/slices/flashcardSlice'
import { BookOpen, RefreshCw, Volume2, CheckCircle2, Trophy, RotateCcw, Zap } from 'lucide-react'
import type { CardRating } from '../store/slices/flashcardSlice'

const RATING_BUTTONS: { rating: CardRating; label: string; color: string; bg: string; key: string }[] = [
  { rating: 'again', label: 'Again',  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-400/40 hover:bg-red-500/20',   key: '1' },
  { rating: 'hard',  label: 'Hard',   color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-400/40 hover:bg-orange-500/20', key: '2' },
  { rating: 'good',  label: 'Good',   color: 'text-gold',       bg: 'bg-gold/10 border-gold/40 hover:bg-gold/20',            key: '3' },
  { rating: 'easy',  label: 'Easy',   color: 'text-teal-soft',  bg: 'bg-teal-muted border-teal-soft/40 hover:bg-teal-soft/20', key: '4' },
]

export default function FlashcardPage() {
  const dispatch = useAppDispatch()
  const { deck, currentIdx, flipped, loading, submitting, sessionComplete, sessionResults } = useAppSelector(s => s.flashcard)
  const [syncing, setSyncing] = useState(false)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => { dispatch(fetchDueCards()) }, [dispatch])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !flipped) { e.preventDefault(); dispatch(flipCard()) }
      if (flipped) {
        const rb = RATING_BUTTONS.find(b => b.key === e.key)
        if (rb) handleRate(rb.rating)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flipped, deck, currentIdx])

  const handleSync = async () => {
    setSyncing(true)
    const result = await dispatch(syncVocabToCards())
    setSyncing(false)
    if (!result.error) {
      toast.success('Vocab synced to flashcards!')
      dispatch(fetchDueCards())
    }
  }

  const handleRate = async (rating: CardRating) => {
    const card = deck[0]
    if (!card || submitting) return
    await dispatch(rateCard({ cardId: card._id, rating }))
  }

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'; u.rate = 0.85
    speechSynthesis.speak(u)
  }

  const passed  = sessionResults.filter(r => r.rating === 'good' || r.rating === 'easy').length
  const failed  = sessionResults.filter(r => r.rating === 'again' || r.rating === 'hard').length
  const card    = deck[0]

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="spinner w-8 h-8"/>
    </div>
  )

  if (sessionComplete || (deck.length === 0 && !loading)) {
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="card max-w-sm w-full text-center animate-slide-up">
          <Trophy size={48} className="text-gold mx-auto mb-4"/>
          <h2 className="font-display text-2xl text-gray-100 mb-1">
            {sessionResults.length > 0 ? 'Session Complete!' : 'All caught up!'}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {sessionResults.length > 0
              ? `${passed} known · ${failed} to review again`
              : 'No cards due today. Come back tomorrow!'}
          </p>
          {sessionResults.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="card-sm text-center">
                <p className="font-display text-3xl text-teal-soft">{passed}</p>
                <p className="text-xs text-gray-500">Known</p>
              </div>
              <div className="card-sm text-center">
                <p className="font-display text-3xl text-red-400">{failed}</p>
                <p className="text-xs text-gray-500">Review again</p>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button onClick={() => dispatch(resetSession()).then(() => dispatch(fetchDueCards()))}
              className="btn-primary w-full justify-center">
              <RotateCcw size={15}/> New Session
            </button>
            <button onClick={handleSync} className="btn-secondary w-full justify-center" disabled={syncing}>
              {syncing ? <span className="spinner"/> : <RefreshCw size={14}/>}
              Sync vocab lists
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Flashcards</h1>
          <p className="text-gray-500 text-sm">{deck.length} card{deck.length !== 1 ? 's' : ''} due today</p>
        </div>
        <button onClick={handleSync} className="btn-secondary text-xs gap-1.5" disabled={syncing}>
          {syncing ? <span className="spinner"/> : <RefreshCw size={12}/>}
          Sync vocab
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 h-1.5 bg-ink-700 rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all"
            style={{ width: `${sessionResults.length / (sessionResults.length + deck.length) * 100}%` }}/>
        </div>
        <span className="text-xs text-gray-500">{sessionResults.length}/{sessionResults.length + deck.length}</span>
      </div>

      {/* Card */}
      {card && (
        <>
          <div
            onClick={() => !flipped && dispatch(flipCard())}
            className={`card min-h-[260px] sm:min-h-[300px] flex flex-col items-center justify-center text-center cursor-pointer
              transition-all duration-300 select-none relative
              ${flipped ? 'bg-gold/5 border-gold/25' : 'hover:border-white/15 hover:bg-ink-800/80'}`}
          >
            {/* Topic badge */}
            <span className="absolute top-4 left-4 badge-gold text-[10px] capitalize">{card.topic}</span>

            {!flipped ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <p className="font-display text-3xl sm:text-4xl text-gray-100">{card.de}</p>
                  <button onClick={e => { e.stopPropagation(); speak(card.de) }}
                    className="text-gray-600 hover:text-gold transition-colors">
                    <Volume2 size={18}/>
                  </button>
                </div>
                {card.ipa && <p className="text-violet-soft text-sm font-mono">{card.ipa}</p>}
                <p className="text-gray-600 text-sm mt-4">Tap to reveal · Space</p>
              </>
            ) : (
              <div className="animate-fade-in w-full px-2">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <p className="font-display text-2xl sm:text-3xl text-gold">{card.de}</p>
                  <button onClick={e => { e.stopPropagation(); speak(card.de) }}
                    className="text-gold/60 hover:text-gold transition-colors">
                    <Volume2 size={16}/>
                  </button>
                </div>
                <p className="text-gray-200 text-lg sm:text-xl mb-3">{card.en}</p>
                {card.ipa && <p className="text-violet-soft text-xs font-mono mb-3">{card.ipa}</p>}
                {card.example && (
                  <div className="mt-3 pt-3 border-t border-white/[0.07] text-left">
                    <p className="text-xs text-gold/70 italic">"{card.example}"</p>
                    {card.exampleEn && <p className="text-xs text-gray-600 mt-0.5">— {card.exampleEn}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rating buttons */}
          {flipped && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 animate-fade-in">
              {RATING_BUTTONS.map(rb => (
                <button key={rb.rating} onClick={() => handleRate(rb.rating)}
                  disabled={submitting}
                  className={`flex flex-col items-center py-3 rounded-xl border text-xs font-medium
                    transition-all disabled:opacity-40 ${rb.bg} ${rb.color}`}>
                  <span className="text-base mb-0.5">
                    {rb.rating === 'again' ? '😓' : rb.rating === 'hard' ? '😅' : rb.rating === 'good' ? '😊' : '🌟'}
                  </span>
                  {rb.label}
                  <span className="text-[9px] opacity-50 mt-0.5">Press {rb.key}</span>
                </button>
              ))}
            </div>
          )}

          {!flipped && (
            <button onClick={() => dispatch(flipCard())} className="btn-primary w-full justify-center mt-4">
              <Zap size={15}/> Reveal Answer
            </button>
          )}
        </>
      )}
    </div>
  )
}
