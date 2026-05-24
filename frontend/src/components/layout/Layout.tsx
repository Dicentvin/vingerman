import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { logoutUser } from '../../store/slices/authSlice'
import {
  LayoutDashboard, Mic2, Languages, Volume2, Mic, BookOpen,
  LogOut, Flame, Menu, X, GraduationCap, MessageSquare, FolderOpen,
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Exam Prep',
    items: [
      { to: '/',             icon: LayoutDashboard, label: 'Dashboard',       end: true },
      { to: '/goethe',       icon: GraduationCap,   label: 'Goethe Course',   end: false },
      { to: '/conversation', icon: MessageSquare,   label: 'AI Conversation', end: false },
    ],
  },
  {
    label: 'Materials',
    items: [
      { to: '/materials',  icon: FolderOpen, label: 'My Materials', end: false },
      { to: '/podcast',    icon: Mic2,       label: 'File to Podcast', end: false },
    ],
  },
  {
    label: 'Practice',
    items: [
      { to: '/vocab',     icon: BookOpen, label: 'Vocabulary',     end: false },
      { to: '/coach',     icon: Mic,      label: 'Speaking Coach', end: false },
      { to: '/pronounce', icon: Volume2,  label: 'Pronunciation',  end: false },
      { to: '/translate', icon: Languages,label: 'Translate',      end: false },
    ],
  },
]

export default function Layout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector(s => s.auth.user)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { dispatch(logoutUser()); navigate('/login') }
  const closeSidebar = () => setSidebarOpen(false)

  const SidebarContent = () => (
    <>
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.07] flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-gold tracking-tight">Deutsch Studio</h1>
          <p className="text-xs text-gray-500 mt-0.5 italic">Goethe Exam Prep · AI</p>
        </div>
        <button onClick={closeSidebar} className="md:hidden text-gray-500 hover:text-gray-200 p-1">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-[10px] uppercase tracking-widest text-gray-600 font-medium px-3 mb-1.5">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, end }) => (
                <NavLink key={to} to={to} end={end} onClick={closeSidebar}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-gold/10 text-gold border border-gold/20'
                      : 'text-gray-400 hover:bg-ink-800 hover:text-gray-200 border border-transparent'
                    }`
                  }
                >
                  <Icon size={16} />{label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4 border-t border-white/[0.07] pt-4">
        <div className="card-sm mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-sm font-semibold shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">{user?.name || 'Learner'}</p>
              <div className="flex items-center gap-1.5">
                <Flame size={11} className="text-orange-400" />
                <span className="text-xs text-gray-500">{user?.streak || 0} day streak</span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="badge-gold text-[10px]">{user?.level || 'A1'}</span>
            <span className="text-xs text-gray-500">{user?.totalXP || 0} XP</span>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-ghost w-full justify-center text-gray-500 hover:text-red-400">
          <LogOut size={14} /> Logout
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={closeSidebar} />
      )}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-60 bg-ink-900 border-r border-white/[0.07] flex flex-col shrink-0 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <SidebarContent />
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-ink-900 border-b border-white/[0.07] sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-gray-200 p-1">
            <Menu size={22} />
          </button>
          <h1 className="font-display text-lg text-gold">Deutsch Studio</h1>
        </header>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  )
}
