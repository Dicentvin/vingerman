import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { teachPronunciation } from '../store/slices/pronounceSlice'
import { Volume2, Search } from 'lucide-react'

const PHONEMES = [
  { de: 'ä', ipa: '/ɛ/', en: "like 'e' in bed" },
  { de: 'ö', ipa: '/ø/', en: "like French 'eu'" },
  { de: 'ü', ipa: '/y/', en: "like French 'u'" },
  { de: 'ß', ipa: '/s/', en: "double 's' sound" },
  { de: 'ch', ipa: '/x/', en: "like Scottish 'loch'" },
  { de: 'ei', ipa: '/aɪ/', en: "like 'eye'" },
  { de: 'ie', ipa: '/iː/', en: "like 'ee' in see" },
  { de: 'eu', ipa: '/ɔɪ/', en: "like 'oy' in boy" },
  { de: 'w',  ipa: '/v/', en: "like English 'v'" },
  { de: 'v',  ipa: '/f/', en: "like English 'f'" },
  { de: 'z',  ipa: '/ts/', en: "like 'ts' in cats" },
  { de: 'sp', ipa: '/ʃp/', en: "'shp' at word start" },
]

const PHRASES = [
  { de: 'Guten Morgen',           en: 'Good morning',        ipa: '[GOO-ten MOR-gen]' },
  { de: 'Wie geht es Ihnen?',     en: 'How are you?',        ipa: '[vee gayt es EE-nen]' },
  { de: 'Danke schön',            en: 'Thank you very much', ipa: '[DAHN-keh shern]' },
  { de: 'Entschuldigung',         en: 'Excuse me',           ipa: '[ent-SHOOL-dee-goong]' },
  { de: 'Ich verstehe nicht',     en: "I don't understand",  ipa: '[ikh fer-SHTAY-eh nikht]' },
]

export default function PronouncePage() {
  const dispatch = useAppDispatch()
  const { lesson, loading } = useAppSelector(s => s.pronounce)
  const [word, setWord] = useState('')

  const handleTeach = async () => {
    if (!word.trim()) return toast.error('Enter a German word or phrase')
    const result = await dispatch(teachPronunciation({ word }))
    if (result.error) toast.error(String(result.payload))
  }

  const speak = (text: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'; u.rate = 0.8
    speechSynthesis.speak(u)
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gray-100">Pronunciation Guide</h1>
        <p className="text-gray-500 text-sm mt-1">Master every German sound with AI coaching</p>
      </div>

      <div className="card mb-5">
        <label className="section-label">Teach me how to say…</label>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="e.g. Ich heiße… or Entschuldigung"
            value={word}
            onChange={e => setWord(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTeach()}
          />
          <button onClick={() => speak(word)} className="btn-secondary px-3" title="Hear it">
            <Volume2 size={16} />
          </button>
          <button onClick={handleTeach} className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : <Search size={15} />}
            Teach Me
          </button>
        </div>

        {lesson && (
          <div className="mt-4 bg-ink-800 rounded-xl p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap animate-slide-up">
            {lesson}
          </div>
        )}
      </div>

      <div className="card mb-5">
        <h2 className="section-label">German Sound Reference — click to hear</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PHONEMES.map(p => (
            <button
              key={p.de}
              onClick={() => speak(p.de)}
              className="text-left p-3 bg-ink-800 rounded-xl border border-white/[0.06]
                         hover:border-violet-soft/40 hover:bg-violet-muted transition-all group"
            >
              <div className="font-display text-2xl text-gray-100 group-hover:text-violet-soft">{p.de}</div>
              <div className="text-xs text-violet-soft mt-0.5">{p.ipa}</div>
              <div className="text-xs text-gray-500">{p.en}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="section-label">Common Phrases</h2>
        <div className="space-y-1">
          {PHRASES.map(p => (
            <div key={p.de} className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-200">{p.de}</p>
                <p className="text-xs text-gray-500">{p.en} <span className="text-violet-soft ml-2">{p.ipa}</span></p>
              </div>
              <button onClick={() => speak(p.de)} className="btn-ghost px-2">
                <Volume2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
