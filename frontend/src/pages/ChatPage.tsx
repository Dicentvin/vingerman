import { useState, useRef, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { startConversation, sendMessage, clearChat, fetchChatSessions } from '../store/slices/chatSlice'
import { Send, Volume2, MessageSquare, Plus, AlertCircle, ChevronDown } from 'lucide-react'

const CEFR_LEVELS = ['A1','A2','B1','B2','C1']
const TOPIC_STARTERS = [
  { emoji: '🛒', topic: 'Beim Einkaufen',     label: 'Shopping' },
  { emoji: '🍽️', topic: 'Im Restaurant',       label: 'At a restaurant' },
  { emoji: '🚂', topic: 'Reisen in Deutschland', label: 'Travelling' },
  { emoji: '💼', topic: 'Im Büro',             label: 'At the office' },
  { emoji: '🏠', topic: 'Zuhause',             label: 'At home' },
  { emoji: '👋', topic: 'Sich vorstellen',     label: 'Introductions' },
  { emoji: '🌍', topic: 'Über Hobbys sprechen', label: 'Hobbies' },
  { emoji: '🩺', topic: 'Beim Arzt',           label: 'At the doctor' },
]

export default function ChatPage() {
  const dispatch = useAppDispatch()
  const { messages, sessionId, topic, level, sessions, loading, sending } = useAppSelector(s => s.chat)
  const [input, setInput]           = useState('')
  const [setupLevel, setSetupLevel] = useState('A2')
  const [showSessions, setShowSessions] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => { dispatch(fetchChatSessions()) }, [dispatch])

  const handleStart = async (topicText: string) => {
    const result = await dispatch(startConversation({ topic: topicText, level: setupLevel }))
    if (result.error) toast.error(String(result.payload))
  }

  const handleSend = async () => {
    if (!input.trim() || !sessionId || sending) return
    const msg = input.trim()
    setInput('')
    const result = await dispatch(sendMessage({ sessionId, message: msg, level }))
    if (result.error) toast.error('Could not send message')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const speak = (text: string, lang = 'de-DE') => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang; u.rate = 0.88
    speechSynthesis.speak(u)
  }

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!sessionId) return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">German Conversation</h1>
        <p className="text-gray-500 text-sm mt-1">Chat with an AI tutor that speaks only German and corrects your mistakes</p>
      </div>

      <div className="card mb-4">
        <label className="section-label">Your Level</label>
        <div className="flex gap-1.5 flex-wrap">
          {CEFR_LEVELS.map(l => (
            <button key={l} onClick={() => setSetupLevel(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                ${setupLevel === l ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <label className="section-label">Choose a Topic</label>
        <div className="grid grid-cols-2 gap-2">
          {TOPIC_STARTERS.map(t => (
            <button key={t.topic} onClick={() => handleStart(t.topic)} disabled={loading}
              className="flex items-center gap-3 p-3 bg-ink-800 border border-white/[0.06] rounded-xl
                hover:border-gold/30 hover:bg-gold/5 transition-all text-left group">
              <span className="text-2xl">{t.emoji}</span>
              <div>
                <p className="text-xs font-medium text-gray-200 group-hover:text-gold transition-colors">{t.label}</p>
                <p className="text-[10px] text-gray-600">{t.topic}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="card mt-4">
          <button onClick={() => setShowSessions(v => !v)} className="w-full flex items-center justify-between">
            <span className="section-label mb-0">Previous Conversations</span>
            <ChevronDown size={14} className={`text-gray-500 transition-transform ${showSessions ? 'rotate-180' : ''}`}/>
          </button>
          {showSessions && (
            <div className="mt-3 space-y-1.5 max-h-52 overflow-y-auto">
              {sessions.map(s => (
                <div key={s._id} className="flex items-center gap-3 p-3 bg-ink-800 rounded-xl">
                  <MessageSquare size={13} className="text-gray-600 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-300 truncate">{s.topic}</p>
                    <p className="text-[10px] text-gray-600">{s.messages.length} messages · {s.level}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ── Chat screen ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-ink-900 border-b border-white/[0.07] shrink-0">
        <button onClick={() => dispatch(clearChat())} className="btn-ghost p-2">
          <Plus size={16} className="rotate-45"/>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{topic}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-soft animate-pulse"/>
            <span className="text-[10px] text-gray-500">Tutor active · {level}</span>
          </div>
        </div>
        <button onClick={() => dispatch(clearChat())} className="btn-secondary text-xs px-3 py-1.5 gap-1.5">
          <Plus size={12}/> New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2 animate-fade-in`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gold/15 flex items-center justify-center shrink-0 mt-0.5 text-sm">👨‍🏫</div>
            )}
            <div className={`max-w-[85%] sm:max-w-[75%] space-y-1.5`}>
              {/* Correction bubble */}
              {msg.role === 'user' && msg.correction && msg.correction !== msg.content && (
                <div className="flex items-start gap-1.5 px-3 py-2 bg-orange-500/10 border border-orange-400/20 rounded-xl rounded-tr-sm">
                  <AlertCircle size={12} className="text-orange-400 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-[10px] text-orange-400 font-medium mb-0.5">Correction</p>
                    <p className="text-xs text-orange-200">{msg.correction}</p>
                    {msg.correctionNote && <p className="text-[10px] text-gray-500 mt-1">{msg.correctionNote}</p>}
                  </div>
                </div>
              )}
              {/* Main bubble */}
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-gold/10 border border-gold/20 text-gray-100 rounded-tr-sm'
                  : 'bg-ink-800 border border-white/[0.07] text-gray-200 rounded-tl-sm'}`}>
                {msg.content}
              </div>
              {/* Speak button for assistant */}
              {msg.role === 'assistant' && (
                <button onClick={() => speak(msg.content)} className="btn-ghost text-[10px] px-2 py-1 gap-1 text-gray-600">
                  <Volume2 size={10}/> Hear
                </button>
              )}
            </div>
          </div>
        ))}
        {(loading || sending) && (
          <div className="flex gap-2 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-gold/15 flex items-center justify-center text-sm">👨‍🏫</div>
            <div className="px-4 py-3 bg-ink-800 border border-white/[0.07] rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce"
                    style={{ animationDelay: `${i*0.15}s` }}/>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-ink-900 border-t border-white/[0.07] shrink-0">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            className="flex-1 input resize-none text-sm py-2.5 min-h-[44px] max-h-28"
            placeholder="Schreibe auf Deutsch…"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          />
          <button onClick={handleSend} disabled={sending || !input.trim()}
            className="btn-primary px-4 py-2.5 shrink-0 self-end disabled:opacity-40">
            <Send size={16}/>
          </button>
        </div>
        <p className="text-[10px] text-gray-700 text-center mt-1.5">Write in German — the tutor corrects mistakes inline</p>
      </div>
    </div>
  )
}
