import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { sendConversationMessage, addUserMessage, clearConversation } from '../store/slices/examSlice'
import { Mic, Square, Send, ChevronLeft, Volume2, RotateCcw, Sparkles } from 'lucide-react'

declare global {
  interface Window { SpeechRecognition?: any; webkitSpeechRecognition?: any }
}

const SCENARIOS = [
  { key: 'exam_oral',      label: '🎓 Oral Exam',         desc: 'Practice with a mock examiner' },
  { key: 'job_interview',  label: '💼 Job Interview',      desc: 'Interview at a German company' },
  { key: 'at_restaurant',  label: '🍽️ Restaurant',         desc: 'Order food, ask questions' },
  { key: 'at_doctor',      label: '🏥 Doctor Visit',       desc: 'Describe symptoms, understand advice' },
  { key: 'making_friends', label: '👋 Making Friends',     desc: 'Small talk, introductions' },
  { key: 'travel',         label: '✈️ Travel',              desc: 'Directions, tickets, help' },
  { key: 'shopping',       label: '🛍️ Shopping',           desc: 'Buy things, ask prices' },
  { key: 'phone_call',     label: '📞 Phone Call',         desc: 'Formal call to an office' },
]

const LEVEL_STARTERS: Record<string, string> = {
  A1: 'Hallo! Wie heißt du?',
  A2: 'Guten Tag! Woher kommen Sie?',
  B1: 'Guten Tag! Was kann ich für Sie tun?',
  B2: 'Guten Tag! Worüber möchten Sie heute sprechen?',
  C1: 'Guten Tag! Womit kann ich Ihnen behilflich sein?',
  C2: 'Guten Tag! Ich freue mich auf unser Gespräch. Womit darf ich Ihnen dienen?',
}

export default function ConversationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { conversationHistory, loadingConversation } = useAppSelector(s => s.exam)

  const level = searchParams.get('level') || 'A1'
  const [selectedScenario, setScenario] = useState('exam_oral')
  const [phase, setPhase] = useState<'setup' | 'chat'>('setup')
  const [inputText, setInput] = useState('')
  const [isRecording, setRecording] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const recognitionRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationHistory])

  const startChat = async () => {
    dispatch(clearConversation())
    setPhase('chat')
    // Send initial greeting from AI
    const starter = LEVEL_STARTERS[level] || 'Hallo!'
    await dispatch(sendConversationMessage({
      examLevel: level,
      history: [],
      userMessage: `[START CONVERSATION: greet me first as if you are in the scenario: ${selectedScenario}]`,
      scenario: selectedScenario,
    }))
  }

  const sendMessage = async (text: string) => {
    if (!text.trim()) return
    dispatch(addUserMessage(text))
    setInput('')
    setSpokenText('')
    await dispatch(sendConversationMessage({
      examLevel: level,
      history: conversationHistory,
      userMessage: text,
      scenario: selectedScenario,
    }))
  }

  const speak = (text: string) => {
    // Extract only the German part (before 💡)
    const german = text.split('💡')[0].replace(/\(Correction:.*?\)/g, '').trim()
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(german)
    u.lang = 'de-DE'; u.rate = 0.85
    speechSynthesis.speak(u)
  }

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Use Chrome for speech recognition'); return }
    const r = new SR()
    r.lang = 'de-DE'; r.continuous = true; r.interimResults = true
    let final = ''
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      const full = final + interim
      setSpokenText(full)
      setInput(full)
    }
    r.onerror = () => setRecording(false)
    r.onend = () => setRecording(false)
    recognitionRef.current = r
    r.start()
    setRecording(true)
  }

  const stopRecording = () => { recognitionRef.current?.stop(); setRecording(false) }

  // ── Setup screen ───────────────────────────────────────────────────────────
  if (phase === 'setup') return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto animate-fade-in">
      <button onClick={() => navigate('/goethe')} className="btn-ghost mb-5 text-sm">
        <ChevronLeft size={15} /> Back to Course
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-violet-soft" />
          <span className="text-xs text-violet-soft uppercase tracking-widest">AI Speaking Partner</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Conversation Practice</h1>
        <p className="text-gray-500 text-sm mt-1">Level <strong className="text-gray-200">{level}</strong> — speak freely, get corrections in real time</p>
      </div>

      <div className="mb-5">
        <h2 className="section-label mb-3">Choose a Scenario</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCENARIOS.map(s => (
            <button
              key={s.key}
              onClick={() => setScenario(s.key)}
              className={`text-left p-3 rounded-xl border transition-all
                ${selectedScenario === s.key
                  ? 'bg-violet-muted border-violet-soft/30 ring-1 ring-violet-soft/20'
                  : 'bg-ink-900 border-white/[0.07] hover:border-white/15'
                }`}
            >
              <div className="text-sm font-medium text-gray-100">{s.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-ink-800 rounded-xl mb-5 text-sm text-gray-300 space-y-1.5">
        <p>🎙️ <strong className="text-gray-100">Speak or type</strong> in German — the AI will respond naturally</p>
        <p>💡 After each reply, you'll get an English tip about what was said</p>
        <p>✏️ Grammar errors are corrected inline</p>
        <p>🔊 Tap any AI message to hear it spoken aloud</p>
      </div>

      <button onClick={startChat} className="btn-primary w-full sm:w-auto px-8 py-3 text-base justify-center">
        <Mic size={17} /> Start Conversation
      </button>
    </div>
  )

  // ── Chat screen ────────────────────────────────────────────────────────────
  const scenarioLabel = SCENARIOS.find(s => s.key === selectedScenario)?.label || ''

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-0px)] max-w-3xl mx-auto">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-white/[0.07] bg-ink-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { setPhase('setup'); dispatch(clearConversation()) }} className="btn-ghost p-1.5">
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="text-sm font-medium text-gray-100">{scenarioLabel}</div>
            <div className="text-xs text-gray-500">{level} · AI Conversation Partner</div>
          </div>
        </div>
        <button onClick={() => { dispatch(clearConversation()); startChat() }} className="btn-ghost text-xs">
          <RotateCcw size={13} /> Restart
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversationHistory.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">
            <Mic size={36} className="mx-auto mb-3 text-gray-700" />
            Starting conversation…
          </div>
        )}

        {conversationHistory.map((msg, i) => {
          if (msg.role === 'user') return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] bg-gold/10 border border-gold/20 rounded-2xl rounded-tr-sm px-4 py-3">
                <p className="text-sm text-gray-100">{msg.content}</p>
              </div>
            </div>
          )

          // Parse assistant message — split at 💡 tip
          const tipIdx = msg.content.indexOf('💡')
          const mainText = tipIdx >= 0 ? msg.content.slice(0, tipIdx).trim() : msg.content
          const tip = tipIdx >= 0 ? msg.content.slice(tipIdx).trim() : ''

          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] space-y-2">
                <div className="bg-ink-800 border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm text-gray-100 leading-relaxed">{mainText}</p>
                  <button
                    onClick={() => speak(mainText)}
                    className="mt-2 text-xs text-gray-600 hover:text-teal-soft flex items-center gap-1 transition-colors"
                  >
                    <Volume2 size={11} /> Hear this
                  </button>
                </div>
                {tip && (
                  <div className="bg-violet-muted border border-violet-soft/15 rounded-xl px-3 py-2 text-xs text-violet-soft leading-relaxed">
                    {tip}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {loadingConversation && (
          <div className="flex justify-start">
            <div className="bg-ink-800 border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-white/[0.07] bg-ink-900 shrink-0">
        {spokenText && !isRecording && (
          <div className="mb-2 px-3 py-1.5 bg-teal-muted border border-teal-soft/20 rounded-lg text-xs text-teal-soft">
            🎙️ "{spokenText}"
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            className="textarea flex-1 resize-none min-h-[44px] max-h-28 py-2.5 text-sm"
            placeholder="Type in German… (or use the mic)"
            value={inputText}
            onChange={e => setInput(e.target.value)}
            rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText) } }}
          />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2.5 rounded-lg border transition-all shrink-0
              ${isRecording ? 'bg-red-500/10 border-red-500 text-red-400 animate-pulse' : 'bg-ink-800 border-white/10 text-gray-400 hover:border-gold/40'}`}
          >
            {isRecording ? <Square size={18} /> : <Mic size={18} />}
          </button>
          <button
            onClick={() => sendMessage(inputText)}
            className="btn-primary p-2.5 shrink-0"
            disabled={!inputText.trim() || loadingConversation}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
