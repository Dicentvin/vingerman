import { Link } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { Mic2, Languages, Volume2, Mic, BookOpen, Flame, Star, Zap, Headphones } from 'lucide-react'

const features = [
  { to: '/podcast',    icon: Mic2,       label: 'File to Podcast',  desc: 'Convert PDFs & slides to audio lessons',              color: 'text-gold',        bg: 'bg-gold/10' },
  { to: '/translate',  icon: Languages,  label: 'Translate',         desc: 'German ↔ English with grammar explanations',          color: 'text-violet-soft', bg: 'bg-violet-muted' },
  { to: '/pronounce',  icon: Volume2,    label: 'Pronunciation',     desc: 'Master every German sound',                           color: 'text-teal-soft',   bg: 'bg-teal-muted' },
  { to: '/coach',      icon: Mic,        label: 'Speaking Coach',    desc: 'Record yourself & get AI feedback',                   color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  { to: '/vocab',      icon: BookOpen,   label: 'Vocabulary',        desc: 'Build topic-based word lists',                        color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { to: '/read-aloud', icon: Headphones, label: 'Read Aloud',        desc: 'AI texts read at learner, moderate or native speed',  color: 'text-pink-400',    bg: 'bg-pink-500/10' },
]

export default function DashboardPage() {
  const user = useAppSelector(s => s.auth.user)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend'

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-500 text-sm mb-1">{greeting},</p>
        <h1 className="font-display text-3xl text-gray-100">{user?.name || 'Learner'} 👋</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total XP',     value: user?.totalXP || 0,         icon: Zap,      color: 'text-gold' },
          { label: 'Day Streak',   value: user?.streak || 0,          icon: Flame,    color: 'text-orange-400', suffix: '🔥' },
          { label: 'Level',        value: user?.level || 'A1',        icon: Star,     color: 'text-violet-soft' },
          { label: 'Words Learned',value: user?.wordsLearned || 0,    icon: BookOpen, color: 'text-teal-soft' },
        ].map(({ label, value, icon: Icon, color, suffix }) => (
          <div key={label} className="card-sm">
            <Icon size={16} className={`${color} mb-2`} />
            <p className="text-2xl font-display text-gray-100">{value}{suffix}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Features grid */}
      <h2 className="section-label mb-4">Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {features.map(({ to, icon: Icon, label, desc, color, bg }) => (
          <Link
            key={to}
            to={to}
            className="card flex items-start gap-4 hover:border-white/15 transition-all hover:-translate-y-0.5 group"
          >
            <div className={`${bg} p-2.5 rounded-xl shrink-0`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <h3 className="font-medium text-gray-100 text-sm group-hover:text-white">{label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Tip of the day */}
      <div className="mt-6 p-4 bg-gold/5 border border-gold/15 rounded-2xl">
        <p className="text-xs text-gold/70 uppercase tracking-widest mb-1">Tipp des Tages</p>
        <p className="text-sm text-gray-300">
          In German, all nouns are capitalized — <span className="text-gold">der Hund</span> (the dog),{' '}
          <span className="text-gold">die Stadt</span> (the city),{' '}
          <span className="text-gold">das Buch</span> (the book).
        </p>
      </div>
    </div>
  )
}
