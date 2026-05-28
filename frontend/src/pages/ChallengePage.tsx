import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { fetchTodayChallenge, submitChallenge, fetchLeaderboard } from '../store/slices/challengeSlice'
import { Trophy, Flame, Star, CheckCircle2, XCircle, Volume2, Clock, Medal } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  translate:       '🌍 Translation',
  'fill-blank':    '📝 Fill in the Blank',
  pronounce:       '🎤 Pronunciation',
  'multiple-choice':'🎯 Multiple Choice',
}

const MEDAL_ICONS = ['🥇','🥈','🥉']

export default function ChallengePage() {
  const dispatch = useAppDispatch()
  const { today, leaderboard, userRank, loading, submitting, result } = useAppSelector(s => s.challenge)
  const user = useAppSelector(s => s.auth.user)
  const [answer, setAnswer] = useState('')
  const [activeTab, setActiveTab] = useState<'challenge'|'leaderboard'>('challenge')

  useEffect(() => {
    dispatch(fetchTodayChallenge())
    dispatch(fetchLeaderboard())
  }, [dispatch])

  const handleSubmit = async () => {
    if (!today || !answer.trim()) return toast.error('Please enter your answer')
    const res = await dispatch(submitChallenge({ challengeId: today._id, answer }))
    if (res.error) toast.error(String(res.payload))
  }

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'; u.rate = 0.85
    speechSynthesis.speak(u)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="spinner w-8 h-8"/>
    </div>
  )

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Daily Challenge</h1>
        <p className="text-gray-500 text-sm mt-1">One challenge per day — earn bonus XP and climb the leaderboard</p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl bg-ink-800 p-1 gap-1 mb-5">
        {([['challenge','⚡ Today\'s Challenge'],['leaderboard','🏆 Leaderboard']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all
              ${activeTab === k ? 'bg-gold text-ink-950' : 'text-gray-400 hover:text-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Challenge tab ── */}
      {activeTab === 'challenge' && (
        <div className="space-y-4">
          {!today ? (
            <div className="card text-center py-12">
              <Clock size={40} className="text-gray-700 mx-auto mb-3"/>
              <p className="text-gray-400 font-medium">No challenge available</p>
              <p className="text-gray-600 text-sm mt-1">Check back tomorrow!</p>
            </div>
          ) : (
            <>
              {/* XP badge + type */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge-gold gap-1.5"><Star size={11}/> {today.xpReward} XP reward</span>
                <span className="badge bg-ink-700 text-gray-400 border border-white/[0.06]">
                  {TYPE_LABELS[today.type] || today.type}
                </span>
                {today.completed && <span className="badge-teal gap-1"><CheckCircle2 size={10}/> Completed</span>}
              </div>

              {/* Question card */}
              <div className="card">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                    <span className="text-gold text-lg">❓</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-100 text-base sm:text-lg font-medium leading-relaxed">{today.question}</p>
                    {today.hint && !today.completed && (
                      <p className="text-xs text-gray-600 mt-2 italic">💡 Hint: {today.hint}</p>
                    )}
                  </div>
                </div>
                {today.type === 'pronounce' && (
                  <button onClick={() => speak(today.question)} className="btn-ghost text-xs gap-1.5 mt-3">
                    <Volume2 size={13}/> Hear the phrase
                  </button>
                )}
              </div>

              {/* Multiple choice */}
              {today.type === 'multiple-choice' && today.options && !today.completed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {today.options.map(opt => (
                    <button key={opt} onClick={() => setAnswer(opt)}
                      className={`p-3 rounded-xl border text-sm text-left transition-all
                        ${answer === opt ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-ink-800 border-white/[0.06] text-gray-300 hover:border-white/15'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Text answer */}
              {today.type !== 'multiple-choice' && !today.completed && (
                <div className="card">
                  <label className="section-label">Your Answer</label>
                  <input className="input text-sm" placeholder="Type your answer…"
                    value={answer} onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}/>
                </div>
              )}

              {/* Submit */}
              {!today.completed && (
                <button onClick={handleSubmit} className="btn-primary w-full justify-center" disabled={submitting || !answer.trim()}>
                  {submitting ? <span className="spinner"/> : <Flame size={15}/>}
                  {submitting ? 'Checking…' : 'Submit Answer'}
                </button>
              )}

              {/* Result */}
              {result && (
                <div className={`card animate-slide-up ${result.correct ? 'border-teal-soft/30 bg-teal-muted' : 'border-red-400/20 bg-red-500/5'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    {result.correct
                      ? <CheckCircle2 size={24} className="text-teal-soft"/>
                      : <XCircle size={24} className="text-red-400"/>}
                    <div>
                      <p className={`font-medium ${result.correct ? 'text-teal-soft' : 'text-red-400'}`}>
                        {result.correct ? 'Richtig! 🎉' : 'Not quite!'}
                      </p>
                      <p className="text-xs text-gray-500">{result.correct ? `+${today?.xpReward} XP earned!` : `Correct answer: ${today?.answer}`}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className={`font-display text-2xl ${result.correct ? 'text-teal-soft' : 'text-red-400'}`}>{result.score}</p>
                      <p className="text-[10px] text-gray-600">/100</p>
                    </div>
                  </div>
                  {result.explanation && (
                    <div className="flex gap-2.5 pt-3 border-t border-white/[0.07]">
                      <span className="text-base shrink-0">👨‍🏫</span>
                      <p className="text-sm text-gray-300 leading-relaxed">{result.explanation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Already completed */}
              {today.completed && !result && (
                <div className="card border-teal-soft/20 bg-teal-muted text-center py-6">
                  <CheckCircle2 size={32} className="text-teal-soft mx-auto mb-2"/>
                  <p className="text-teal-soft font-medium">Already completed today!</p>
                  <p className="text-gray-500 text-sm mt-1">You scored {today.score}/100 · Come back tomorrow</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Leaderboard tab ── */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-3">
          {userRank && (
            <div className="card-sm flex items-center gap-3 border-gold/20 bg-gold/5">
              <Medal size={18} className="text-gold"/>
              <div>
                <p className="text-xs text-gray-400">Your rank this week</p>
                <p className="font-display text-xl text-gold">#{userRank}</p>
              </div>
            </div>
          )}

          <div className="card">
            <p className="section-label flex items-center gap-2"><Trophy size={14}/> Weekly Top 10</p>
            {leaderboard.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <Trophy size={32} className="mx-auto mb-2 opacity-30"/>
                <p className="text-sm">No entries yet — complete today's challenge!</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {leaderboard.map((entry, idx) => {
                  const isMe = entry.userId === user?._id
                  return (
                    <div key={entry.userId}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                        ${isMe ? 'bg-gold/10 border border-gold/25' : 'bg-ink-800 border border-transparent'}`}>
                      <span className="text-lg w-7 text-center shrink-0">
                        {idx < 3 ? MEDAL_ICONS[idx] : <span className="text-xs text-gray-500 font-mono">#{idx+1}</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isMe ? 'text-gold' : 'text-gray-200'}`}>
                          {entry.name} {isMe && '(you)'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Flame size={10} className="text-orange-400"/>
                          <span className="text-[10px] text-gray-500">{entry.streak} day streak</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${isMe ? 'text-gold' : 'text-gray-300'}`}>{entry.xp.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-600">XP</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
