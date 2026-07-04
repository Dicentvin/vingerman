import { Link } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import {
  Mic2, Languages, Volume2, Mic, BookOpen, Flame, Star, Zap,
  Headphones, PenLine, CreditCard, MessageSquare, Trophy,
  Folder, ClipboardCheck, Grid, BookMarked, Tag,
  LibraryBig, GraduationCap, Timer, Brain, ChevronRight,
} from 'lucide-react'

const sections = [
  {
    id: 'exam',
    label: '🎯 Exam Preparation',
    desc: 'Simulate real exam conditions and build test-day confidence',
    features: [
      { to: '/mock-exam',        icon: Timer,         label: 'Mock Exam',           desc: 'Full timed Goethe-style paper — all four skills, scored',    color: 'text-red-400',     bg: 'bg-red-500/10',     badge: 'New' },
      { to: '/exam-practice',    icon: ClipboardCheck,label: 'Exam Practice',       desc: 'Hören · Lesen · Schreiben · Sprechen',                       color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { to: '/comprehension',    icon: GraduationCap, label: 'Comprehension',       desc: 'Read 450+ word passages and answer exam-style questions',     color: 'text-violet-400',  bg: 'bg-violet-500/10' },
      { to: '/syllabus',         icon: Star,          label: 'Goethe Prep A1/A2',   desc: 'Structured syllabus with progress tracking',                 color: 'text-amber-400',   bg: 'bg-amber-500/10' },
    ],
  },
  {
    id: 'vocabulary',
    label: '📚 Vocabulary & Grammar',
    desc: 'Build and reinforce the words and structures exams test most',
    features: [
      { to: '/spaced-repetition',icon: Brain,         label: 'Spaced Repetition',   desc: 'Daily review queue from your library — SM-2 algorithm',      color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    badge: 'New' },
      { to: '/grammar-drill',    icon: Grid,          label: 'Grammar Word Drill',  desc: 'Nouns, verbs, adjectives — up to 100 words at once',         color: 'text-lime-400',    bg: 'bg-lime-500/10' },
      { to: '/article-drill',    icon: Tag,           label: 'Article Drill',       desc: 'Master der · die · das with zero repetition',               color: 'text-sky-400',     bg: 'bg-sky-500/10' },
      { to: '/vocab',            icon: BookOpen,      label: 'Vocabulary Builder',  desc: 'Build topic-based word lists',                               color: 'text-blue-400',    bg: 'bg-blue-500/10' },
      { to: '/flashcards',       icon: CreditCard,    label: 'Flashcards',          desc: 'Quick-fire card drills from your word sets',                 color: 'text-teal-400',    bg: 'bg-teal-500/10' },
    ],
  },
  {
    id: 'skills',
    label: '🗣️ Language Skills',
    desc: 'Practice the four core skills: listening, speaking, reading, writing',
    features: [
      { to: '/coach',            icon: Mic,           label: 'Speaking & Pronunciation', desc: 'Record yourself — AI scores fluency and flags errors',  color: 'text-orange-400',  bg: 'bg-orange-500/10',  badge: 'New' },
      { to: '/writing',          icon: PenLine,       label: 'Writing Corrector',   desc: 'AI marks your German like an examiner',                      color: 'text-green-400',   bg: 'bg-green-500/10' },
      { to: '/read-aloud',       icon: Headphones,    label: 'Read Aloud',          desc: 'Listen at learner or native speed',                          color: 'text-pink-400',    bg: 'bg-pink-500/10' },
      { to: '/chat',             icon: MessageSquare, label: 'Conversation',        desc: 'Chat with an AI German tutor',                              color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
      { to: '/pronounce',        icon: Volume2,       label: 'Pronunciation Guide', desc: 'Master every German sound',                                 color: 'text-teal-400',    bg: 'bg-teal-500/10' },
      { to: '/translate',        icon: Languages,     label: 'Translate',           desc: 'German ↔ English with grammar notes',                       color: 'text-violet-400',  bg: 'bg-violet-500/10' },
    ],
  },
  {
    id: 'reading',
    label: '📖 Reading & Stories',
    desc: 'Build reading fluency through graded texts and stories',
    features: [
      { to: '/story',            icon: BookMarked,    label: 'Story Reader',        desc: 'AI stories graded A1 to C1 — no repeats ever',              color: 'text-purple-400',  bg: 'bg-purple-500/10' },
      { to: '/podcast',          icon: Mic2,          label: 'File to Podcast',     desc: 'Convert PDFs & slides to German audio',                     color: 'text-gold',        bg: 'bg-gold/10' },
    ],
  },
  {
    id: 'library',
    label: '🗂️ My Library & Progress',
    desc: 'Everything you have generated — words, stories, and achievements',
    features: [
      { to: '/library',          icon: LibraryBig,    label: 'Word Library',        desc: 'Every generated word — alphabetical, no duplicates',        color: 'text-teal-400',    bg: 'bg-teal-500/10' },
      { to: '/challenge',        icon: Trophy,        label: 'Daily Challenge',     desc: 'Earn XP and climb the leaderboard',                         color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
      { to: '/materials',        icon: Folder,        label: 'My Materials',        desc: 'Manage uploaded PDFs, PPTX & DOCX',                         color: 'text-rose-400',    bg: 'bg-rose-500/10' },
    ],
  },
]

export default function DashboardPage() {
  const user = useAppSelector(s => s.auth.user)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend'

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">

      {/* Greeting */}
      <div>
        <p className="text-gray-500 text-sm mb-1">{greeting},</p>
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">{user?.name || 'Learner'} 👋</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Total XP',      value: user?.totalXP      || 0,    icon: Zap,      color: 'text-gold' },
          { label: 'Day Streak',    value: user?.streak       || 0,    icon: Flame,    color: 'text-orange-400', suffix: '🔥' },
          { label: 'Level',         value: user?.level        || 'A1', icon: Star,     color: 'text-violet-400' },
          { label: 'Words Learned', value: user?.wordsLearned || 0,    icon: BookOpen, color: 'text-teal-400' },
        ].map(({ label, value, icon: Icon, color, suffix }) => (
          <div key={label} className="card-sm text-center">
            <Icon size={16} className={`${color} mx-auto mb-1.5`}/>
            <p className="text-xl sm:text-2xl font-display text-gray-100">{value}{suffix}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick access bar */}
      <div className="p-4 bg-gold/5 border border-gold/15 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gold/70 uppercase tracking-widest font-medium">Quick Access</p>
          <span className="text-xs text-gray-600">Top exam-prep tools</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { to: '/mock-exam',         label: 'Mock Exam',    icon: Timer,         color: 'text-red-400',    bg: 'bg-red-500/10' },
            { to: '/spaced-repetition', label: 'Daily Review', icon: Brain,         color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
            { to: '/comprehension',     label: 'Comprehension',icon: GraduationCap, color: 'text-violet-400', bg: 'bg-violet-500/10' },
          ].map(({ to, label, icon: Icon, color, bg }) => (
            <Link key={to} to={to}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-ink-800 border border-white/[0.06] hover:border-gold/25 transition-all group text-center">
              <div className={`${bg} p-2 rounded-lg`}>
                <Icon size={16} className={color}/>
              </div>
              <span className="text-xs text-gray-300 group-hover:text-white leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Feature sections */}
      {sections.map(section => (
        <div key={section.id} className="space-y-3">
          <div>
            <h2 className="font-display text-base text-gray-100">{section.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{section.desc}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {section.features.map(({ to, icon: Icon, label, desc, color, bg, badge }: any) => (
              <Link key={to} to={to}
                className="card flex items-center gap-3 hover:border-white/15 transition-all hover:-translate-y-0.5 group">
                <div className={`${bg} p-2.5 rounded-xl shrink-0`}>
                  <Icon size={17} className={color}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-100 text-sm group-hover:text-white truncate">{label}</h3>
                    {badge && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/25 font-medium">
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{desc}</p>
                </div>
                <ChevronRight size={14} className="text-gray-700 group-hover:text-gray-400 shrink-0 transition-colors"/>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Daily tip */}
      <div className="p-4 bg-ink-800 border border-white/[0.06] rounded-2xl">
        <p className="text-xs text-gold/70 uppercase tracking-widest mb-1.5">Tipp des Tages</p>
        <p className="text-sm text-gray-300 leading-relaxed">
          In German, all nouns are capitalised —{' '}
          <span className="text-blue-400 font-medium">der</span> Hund,{' '}
          <span className="text-pink-400 font-medium">die</span> Stadt,{' '}
          <span className="text-green-400 font-medium">das</span> Buch.
          Always learn the article <em>with</em> the noun — it is the single biggest shortcut to fluency and correct exam writing.
        </p>
      </div>

    </div>
  )
}
