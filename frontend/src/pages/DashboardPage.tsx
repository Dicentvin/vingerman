import { Link } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import {
  GraduationCap, MessageSquare, BookOpen, Mic, Languages, Volume2, Mic2,
  Flame, Zap, Star, Trophy, ChevronRight, CheckCircle, Clock,
} from 'lucide-react'

const EXAM_LEVELS = ['A1','A2','B1','B2','C1','C2']

const QUICK_ACTIONS = [
  { to: '/goethe',       icon: GraduationCap, label: 'Goethe Course',   desc: 'Structured exam prep',         color: 'text-gold',        bg: 'bg-gold/10' },
  { to: '/conversation', icon: MessageSquare, label: 'AI Conversation', desc: 'Live speaking practice',        color: 'text-violet-soft', bg: 'bg-violet-muted' },
  { to: '/vocab',        icon: BookOpen,      label: 'Vocabulary',      desc: 'Build your word bank',          color: 'text-teal-soft',   bg: 'bg-teal-muted' },
  { to: '/coach',        icon: Mic,           label: 'Speaking Coach',  desc: 'Record & get AI feedback',      color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  { to: '/translate',    icon: Languages,     label: 'Translate',       desc: 'German ↔ English',              color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { to: '/pronounce',    icon: Volume2,       label: 'Pronunciation',   desc: 'Master every sound',            color: 'text-pink-400',    bg: 'bg-pink-500/10' },
  { to: '/podcast',      icon: Mic2,          label: 'File to Podcast', desc: 'Upload PDFs → audio lessons',   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
]

export default function DashboardPage() {
  const user = useAppSelector(s => s.auth.user)
  const examHistory = useAppSelector(s => s.exam?.history || [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend'

  const currentLevelIdx = EXAM_LEVELS.indexOf(user?.level || 'A1')
  const recentTests = examHistory.slice(0, 3)
  const avgScore = examHistory.length
    ? Math.round(examHistory.slice(0, 10).reduce((a, s) => a + (s.totalScore / s.maxScore) * 100, 0) / Math.min(examHistory.length, 10))
    : null

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <p className="text-gray-500 text-sm mb-1">{greeting},</p>
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">{user?.name || 'Learner'} 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Your goal: <span className="text-gold">Pass the Goethe-Zertifikat {user?.level || 'A1'}</span></p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6 md:mb-8">
        {[
          { label: 'Total XP',    value: user?.totalXP || 0,       icon: Zap,     color: 'text-gold' },
          { label: 'Day Streak',  value: `${user?.streak || 0}🔥`,  icon: Flame,   color: 'text-orange-400' },
          { label: 'Level',       value: user?.level || 'A1',       icon: Star,    color: 'text-violet-soft' },
          { label: 'Avg Score',   value: avgScore ? `${avgScore}%` : '—', icon: Trophy, color: avgScore && avgScore >= 60 ? 'text-teal-soft' : 'text-gray-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card-sm">
            <Icon size={15} className={`${color} mb-2`} />
            <p className="text-xl sm:text-2xl font-display text-gray-100">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Left: Quick actions */}
        <div className="lg:col-span-2">
          <h2 className="section-label mb-3">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc, color, bg }) => (
              <Link key={to} to={to}
                className="card flex items-center gap-3 hover:border-white/15 transition-all hover:-translate-y-0.5 group"
              >
                <div className={`${bg} p-2.5 rounded-xl shrink-0`}>
                  <Icon size={18} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-100 text-sm group-hover:text-white">{label}</p>
                  <p className="text-xs text-gray-500 truncate">{desc}</p>
                </div>
                <ChevronRight size={14} className="text-gray-600 shrink-0 ml-auto group-hover:text-gray-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Progress + recent tests */}
        <div className="space-y-4">
          {/* Goethe progress */}
          <div className="card">
            <h3 className="section-label mb-3">Goethe Progress</h3>
            <div className="flex items-center gap-2 mb-3">
              {EXAM_LEVELS.map((lvl, i) => (
                <div key={lvl} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full h-1.5 rounded-full ${i <= currentLevelIdx ? 'bg-gold' : 'bg-ink-700'}`} />
                  <span className={`text-[10px] ${i === currentLevelIdx ? 'text-gold font-medium' : 'text-gray-600'}`}>{lvl}</span>
                </div>
              ))}
            </div>
            <Link to="/goethe" className="btn-primary w-full justify-center text-sm">
              <GraduationCap size={14} /> Continue {user?.level || 'A1'} Prep
            </Link>
          </div>

          {/* Recent exam results */}
          {recentTests.length > 0 && (
            <div className="card">
              <h3 className="section-label mb-3">Recent Tests</h3>
              <div className="space-y-2">
                {recentTests.map(s => {
                  const pct = Math.round((s.totalScore / s.maxScore) * 100)
                  return (
                    <div key={s._id} className="flex items-center gap-3">
                      {s.passed
                        ? <CheckCircle size={14} className="text-teal-soft shrink-0" />
                        : <Clock size={14} className="text-gray-600 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-200 capitalize truncate">{s.section}</p>
                        <p className="text-xs text-gray-500">{s.examLevel}</p>
                      </div>
                      <span className={`text-sm font-medium ${pct >= 60 ? 'text-teal-soft' : 'text-orange-400'}`}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
              <Link to="/goethe" className="btn-ghost w-full justify-center mt-3 text-xs">
                View all →
              </Link>
            </div>
          )}

          {/* Daily tip */}
          <div className="p-4 bg-gold/5 border border-gold/15 rounded-2xl">
            <p className="text-xs text-gold/70 uppercase tracking-widest mb-1.5">Tipp des Tages</p>
            <p className="text-xs text-gray-300 leading-relaxed">
              For the Goethe oral exam, <span className="text-gold">ask the examiner to repeat</span> if needed:
              <span className="text-gold italic"> "Könnten Sie die Frage bitte wiederholen?"</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
