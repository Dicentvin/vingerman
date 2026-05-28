import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import {
  generateVocabList, fetchVocabLists, deleteVocabList,
  markWordMastered, setCurrentList,
} from '../store/slices/vocabSlice'
import { BookOpen, Volume2, Trash2, CheckCircle, Circle, Plus } from 'lucide-react'

const PRESET_TOPICS = [
  { key: 'greetings', label: '👋 Greetings' },
  { key: 'food',      label: '🍕 Food' },
  { key: 'travel',    label: '✈️ Travel' },
  { key: 'business',  label: '💼 Business' },
  { key: 'family',    label: '👨‍👩‍👧 Family' },
  { key: 'numbers',   label: '🔢 Numbers' },
  { key: 'colors',    label: '🎨 Colors' },
  { key: 'weather',   label: '⛅ Weather' },
]

export default function VocabPage() {
  const dispatch = useAppDispatch()
  const { lists, currentList, loading } = useAppSelector(s => s.vocab)
  const [selectedTopic, setSelectedTopic] = useState('greetings')
  const [customTopic, setCustomTopic] = useState('')

  useEffect(() => { dispatch(fetchVocabLists()) }, [dispatch])

  const handleGenerate = async () => {
    const topic = customTopic.trim() || selectedTopic
    const result = await dispatch(generateVocabList({ topic, count: 12 }))
    if (result.error) toast.error(String(result.payload))
    else toast.success(`12 words generated for "${topic}" ✅`)
    setCustomTopic('')
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await dispatch(deleteVocabList(id))
    toast.success('List deleted')
  }

  const handleToggleMastered = (wordId: string, mastered: boolean) => {
    if (!currentList) return
    dispatch(markWordMastered({ wordId, mastered: !mastered, listId: currentList._id }))
  }

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'; u.rate = 0.8
    speechSynthesis.speak(u)
  }

  const masteredCount = currentList?.words?.filter(w => w.mastered).length || 0
  const totalCount = currentList?.words?.length || 0

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gray-800">Vocabulary Builder</h1>
        <p className="text-gray-500 text-sm mt-1">Generate topic-based word lists, saved to your account</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Left: generator + saved lists */}
        <div className="md:col-span-1 space-y-4">
          <div className="card">
            <label className="section-label">Choose Topic</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESET_TOPICS.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setSelectedTopic(t.key); setCustomTopic('') }}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all
                    ${selectedTopic === t.key && !customTopic
                      ? 'bg-gold/10 border-gold/30 text-gold'
                      : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-700'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input
              className="input text-sm mb-3"
              placeholder="Or type custom topic…"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            />
            <button onClick={handleGenerate} className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? <span className="spinner" /> : <Plus size={15} />}
              {loading ? 'Generating…' : 'Generate List'}
            </button>
          </div>

          {lists.length > 0 && (
            <div className="card">
              <label className="section-label">Your Lists ({lists.length})</label>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {lists.map(list => (
                  <div
                    key={list._id}
                    onClick={() => dispatch(setCurrentList(list))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all group
                      ${currentList?._id === list._id ? 'bg-gold/10 text-gold' : 'hover:bg-ink-800 text-gray-600'}`}
                  >
                    <BookOpen size={13} className="shrink-0" />
                    <span className="text-sm flex-1 truncate capitalize">{list.topic}</span>
                    <span className="text-xs text-gray-600">{list.words?.length}w</span>
                    <button
                      onClick={(e) => handleDelete(list._id, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: word list */}
        <div className="md:col-span-2">
          {currentList ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-xl text-gray-800 capitalize">{currentList.topic}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{masteredCount}/{totalCount} mastered</p>
                </div>
                <div className="w-24">
                  <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-soft rounded-full transition-all"
                      style={{ width: `${totalCount ? (masteredCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {currentList.words?.map((word, idx) => (
                  <div
                    key={word._id || idx}
                    className={`p-3 rounded-xl border transition-all
                      ${word.mastered ? 'bg-teal-muted border-teal-soft/20' : 'bg-ink-800 border-white/[0.06]'}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleMastered(word._id, word.mastered)}
                        className="mt-0.5 shrink-0 text-gray-600 hover:text-teal-soft transition-colors"
                      >
                        {word.mastered
                          ? <CheckCircle size={16} className="text-teal-soft" />
                          : <Circle size={16} />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800">{word.de}</span>
                          {word.ipa && <span className="text-xs text-violet-soft">{word.ipa}</span>}
                          <button onClick={() => speak(word.de)} className="btn-ghost p-0.5">
                            <Volume2 size={12} className="text-gray-500" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5">🇬🇧 {word.en}</p>
                        {word.example && (
                          <p className="text-xs text-gold/70 mt-1 italic">"{word.example}"</p>
                        )}
                        {word.exampleEn && (
                          <p className="text-xs text-gray-600 mt-0.5">— {word.exampleEn}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <BookOpen size={40} className="text-gray-700 mb-3" />
              <p className="text-gray-500 text-sm">Generate or select a vocabulary list</p>
              <p className="text-gray-600 text-xs mt-1">Your word lists are saved to your account</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
