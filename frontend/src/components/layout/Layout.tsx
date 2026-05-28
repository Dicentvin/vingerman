import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { logoutUser } from '../../store/slices/authSlice'
import {
  LayoutDashboard, Mic2, Languages, Volume2, Mic, BookOpen,
  LogOut, Flame, Headphones, PenLine, CreditCard,
  MessageSquare, Trophy, Menu, X, GraduationCap,
  FolderOpen, Award, ClipboardList,
} from 'lucide-react'

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',       end: true },
  { to: '/podcast',    icon: Mic2,            label: 'File to Podcast'  },
  { to: '/translate',  icon: Languages,       label: 'Translate'        },
  { to: '/pronounce',  icon: Volume2,         label: 'Pronunciation'    },
  { to: '/coach',      icon: Mic,             label: 'Speaking Coach'   },
  { to: '/vocab',      icon: BookOpen,        label: 'Vocabulary'       },
  { to: '/read-aloud', icon: Headphones,      label: 'Read Aloud'       },
  { to: '/writing',    icon: PenLine,         label: 'Writing Corrector'},
  { to: '/flashcards', icon: CreditCard,      label: 'Flashcards'       },
  { to: '/chat',       icon: MessageSquare,   label: 'Conversation'     },
  { to: '/challenge',  icon: Trophy,          label: 'Daily Challenge'  },
  { to: '/materials',  icon: FolderOpen,      label: 'My Materials'     },
  { to: '/syllabus',      icon: Award,          label: 'Goethe Prep A1/A2' },
  { to: '/exam-practice', icon: ClipboardList,   label: 'Exam Practice'     },
]

export default function Layout() {
  const dispatch   = useAppDispatch()
  const navigate   = useNavigate()
  const user       = useAppSelector(s => s.auth.user)
  const [open, setOpen] = useState(false)

  const handleLogout = () => {
    dispatch(logoutUser())
    navigate('/login')
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-ink-700 flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg text-gold tracking-tight leading-tight">Chukwudi Germany Academy</h1>
          <p className="text-xs text-gray-500 mt-0.5 italic">KI-gestützte Lernapp</p>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden btn-ghost p-2">
          <X size={18}/>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
              ${isActive
                ? 'bg-gold/10 text-gold border border-gold/20'
                : 'text-gray-500 hover:bg-ink-800 hover:text-gray-700 border border-transparent'}`
            }>
            <Icon size={17}/>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 pb-4 border-t border-ink-700 pt-4">
        <div className="card-sm mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-sm font-semibold shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.name || 'Learner'}</p>
              <div className="flex items-center gap-1.5">
                <Flame size={11} className="text-orange-400"/>
                <span className="text-xs text-gray-500">{user?.streak || 0} day streak</span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="badge-gold text-[10px]">{user?.level || 'A1'}</span>
            <span className="text-xs text-gray-500">{user?.totalXP || 0} XP</span>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-ghost w-full justify-center text-gray-500 hover:text-red-500">
          <LogOut size={14}/> Logout
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-ink-700 flex-col shrink-0 shadow-sm">
        <SidebarContent/>
      </aside>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)}/>
          <aside className="relative w-72 max-w-[80vw] bg-white flex flex-col z-50 shadow-2xl animate-slide-up">
            <SidebarContent/>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-ink-700 sticky top-0 z-30 shadow-sm">
          <button onClick={() => setOpen(true)} className="btn-ghost p-2">
            <Menu size={20}/>
          </button>
          <span className="font-display text-base text-gold">Chukwudi Germany Academy</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="badge-gold text-[10px]">{user?.level || 'A1'}</span>
            <div className="flex items-center gap-1">
              <Flame size={12} className="text-orange-400"/>
              <span className="text-xs text-gray-500">{user?.streak || 0}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet/>
        </main>
      </div>
    </div>
  )
}
