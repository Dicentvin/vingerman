import { Link } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { Mic2, Languages, Volume2, Mic, BookOpen, Flame, Star, Zap, Headphones, PenLine, CreditCard, MessageSquare, Trophy, FolderOpen, Award, ClipboardList, Grid3X3 } from 'lucide-react'

const features = [
  { to: '/podcast',    icon: Mic2,          label: 'File to Podcast',    desc: 'Convert PDFs & slides to audio',         color: 'text-gold',        bg: 'bg-gold/10' },
  { to: '/translate',  icon: Languages,     label: 'Translate',           desc: 'German ↔ English + grammar',             color: 'text-violet-soft', bg: 'bg-violet-muted' },
  { to: '/pronounce',  icon: Volume2,       label: 'Pronunciation',       desc: 'Master every German sound',              color: 'text-teal-soft',   bg: 'bg-teal-muted' },
  { to: '/coach',      icon: Mic,           label: 'Speaking Coach',      desc: 'Record yourself & get AI feedback',      color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  { to: '/vocab',      icon: BookOpen,      label: 'Vocabulary',          desc: 'Build topic-based word lists',           color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { to: '/read-aloud', icon: Headphones,    label: 'Read Aloud',          desc: 'Listen at learner or native speed',      color: 'text-pink-400',    bg: 'bg-pink-500/10' },
  { to: '/writing',    icon: PenLine,       label: 'Writing Corrector',   desc: 'AI grammar & gender corrections',        color: 'text-green-400',   bg: 'bg-green-500/10' },
  { to: '/flashcards', icon: CreditCard,    label: 'Flashcards',          desc: 'Spaced repetition drills',               color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  { to: '/chat',       icon: MessageSquare, label: 'Conversation',        desc: 'Chat with an AI German tutor',           color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
  { to: '/challenge',  icon: Trophy,        label: 'Daily Challenge',     desc: 'Earn XP & climb the leaderboard',       color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
  { to: '/materials',  icon: FolderOpen,    label: 'My Materials',        desc: 'Manage uploaded PDFs, PPTX & DOCX',     color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  { to: '/syllabus',      icon: Award,          label: 'Goethe Prep A1/A2',   desc: 'Structured syllabus with progress tracking', color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  { to: '/exam-practice', icon: ClipboardList,  label: 'Exam Practice',       desc: 'Hören · Lesen · Schreiben · Sprechen drills', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { to: '/grammar-drill',  icon: Grid3X3,       label: 'Grammar Word Drill',  desc: 'Nouns, verbs, adjectives — 100 words/day',   color: 'text-lime-400',    bg: 'bg-lime-500/10' },
]

export default function DashboardPage() {
  const user = useAppSelector(s => s.auth.user)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <p className="text-gray-500 text-sm mb-1">{greeting},</p>
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">{user?.name || 'Learner'} 👋</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
        {[
          { label: 'Total XP',      value: user?.totalXP || 0,      icon: Zap,      color: 'text-gold' },
          { label: 'Day Streak',    value: user?.streak || 0,        icon: Flame,    color: 'text-orange-400', suffix: '🔥' },
          { label: 'Level',         value: user?.level || 'A1',      icon: Star,     color: 'text-violet-soft' },
          { label: 'Words Learned', value: user?.wordsLearned || 0,  icon: BookOpen, color: 'text-teal-soft' },
        ].map(({ label, value, icon: Icon, color, suffix }) => (
          <div key={label} className="card-sm">
            <Icon size={16} className={`${color} mb-2`}/>
            <p className="text-xl sm:text-2xl font-display text-gray-100">{value}{suffix}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Modules */}
      <h2 className="section-label mb-3">Modules</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {features.map(({ to, icon: Icon, label, desc, color, bg }) => (
          <Link key={to} to={to}
            className="card flex items-start gap-3 sm:gap-4 hover:border-white/15 transition-all hover:-translate-y-0.5 group">
            <div className={`${bg} p-2 sm:p-2.5 rounded-xl shrink-0`}>
              <Icon size={18} className={color}/>
            </div>
            <div>
              <h3 className="font-medium text-gray-100 text-sm group-hover:text-white">{label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-5 p-4 bg-gold/5 border border-gold/15 rounded-2xl">
        <p className="text-xs text-gold/70 uppercase tracking-widest mb-1">Tipp des Tages</p>
        <p className="text-sm text-gray-300">
          In German, all nouns are capitalized — <span className="text-gold">der Hund</span> (the dog),{' '}
          <span className="text-gold">die Stadt</span> (the city), <span className="text-gold">das Buch</span> (the book).
        </p>
      </div>
    </div>
  )
}
