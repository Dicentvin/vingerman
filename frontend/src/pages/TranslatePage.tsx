import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { translateText, explainGrammar, setDirection } from '../store/slices/translateSlice'
import { ArrowLeftRight, BookOpen, Volume2 } from 'lucide-react'

export default function TranslatePage() {
  const dispatch = useAppDispatch()
  const { translated, grammar, direction, loading, grammarLoading } = useAppSelector(s => s.translate)
  const [text, setText] = useState('')
  const [from, to] = direction === 'de-en' ? ['🇩🇪 German', '🇬🇧 English'] : ['🇬🇧 English', '🇩🇪 German']

  const handleTranslate = async () => {
    if (!text.trim()) return toast.error('Please enter text to translate')
    const result = await dispatch(translateText({ text, direction }))
    if (result.error) toast.error(String(result.payload))
  }
  const handleGrammar = async () => {
    if (!text.trim()) return toast.error('Please enter German text first')
    await dispatch(explainGrammar({ text }))
  }
  const speakText = (t: string, lang: string) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(t)
    u.lang = lang; speechSynthesis.speak(u)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-800">Translate</h1>
        <p className="text-gray-500 text-sm mt-1">German ↔ English with grammar explanations</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-gray-600">{from}</span>
        <button onClick={() => dispatch(setDirection(direction === 'de-en' ? 'en-de' : 'de-en'))} className="btn-ghost p-2">
          <ArrowLeftRight size={16} className="text-gold"/>
        </button>
        <span className="text-sm font-medium text-gray-600">{to}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="section-label">{from}</label>
          <textarea className="textarea min-h-[160px] sm:min-h-[180px]"
            placeholder={`Type ${direction === 'de-en' ? 'German' : 'English'} text…`}
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleTranslate() }}/>
          {text && (
            <button onClick={() => speakText(text, direction === 'de-en' ? 'de-DE' : 'en-US')} className="btn-ghost mt-1 text-xs">
              <Volume2 size={13}/> Hear original
            </button>
          )}
        </div>
        <div>
          <label className="section-label">{to}</label>
          <div className="textarea min-h-[160px] sm:min-h-[180px] text-sm leading-relaxed">
            {loading
              ? <span className="text-gray-500 flex items-center gap-2"><span className="spinner"/> Translating…</span>
              : translated
              ? <span className="text-gray-700">{translated}</span>
              : <span className="text-gray-600">Translation appears here…</span>}
          </div>
          {translated && (
            <button onClick={() => speakText(translated, direction === 'de-en' ? 'en-US' : 'de-DE')} className="btn-ghost mt-1 text-xs">
              <Volume2 size={13}/> Hear translation
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={handleTranslate} className="btn-primary flex-1 sm:flex-none justify-center" disabled={loading}>
          {loading ? <span className="spinner"/> : <ArrowLeftRight size={15}/>} Translate
        </button>
        <button onClick={handleGrammar} className="btn-secondary flex-1 sm:flex-none justify-center" disabled={grammarLoading}>
          {grammarLoading ? <span className="spinner"/> : <BookOpen size={15}/>} Explain Grammar
        </button>
      </div>

      {grammar && (
        <div className="mt-5 card animate-slide-up">
          <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
            <BookOpen size={15} className="text-violet-soft"/> Grammar Breakdown
          </h3>
          <div className="bg-ink-800 rounded-xl p-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
            {grammar}
          </div>
        </div>
      )}
    </div>
  )
}
