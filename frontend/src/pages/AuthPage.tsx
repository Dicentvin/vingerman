import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { loginUser, registerUser, clearError } from '../store/slices/authSlice'

interface Props {
  mode: 'login' | 'register'
}

export default function AuthPage({ mode }: Props) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error, user } = useAppSelector(s => s.auth)
  const isLogin = mode === 'login'

  useEffect(() => {
    if (user) navigate('/', { replace: true })
    return () => { dispatch(clearError()) }
  }, [user, navigate, dispatch])

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const action = isLogin
      ? loginUser({ email: form.email, password: form.password })
      : registerUser(form)
    const result = await dispatch(action)
    if (!('error' in result)) {
      toast.success(isLogin ? 'Welcome back! 🎉' : 'Account created — Viel Erfolg! 🇩🇪')
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-gold mb-2">Deutsch Studio</h1>
          <p className="text-gray-500 text-sm">Your AI-powered German learning companion</p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-teal-muted border border-teal-soft/20 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-soft animate-pulse" />
            <span className="text-xs text-teal-soft">Powered by MongoDB + Groq</span>
          </div>
        </div>

        <div className="card">
          <h2 className="font-display text-2xl text-gray-100 mb-1">
            {isLogin ? 'Willkommen zurück' : 'Fangen wir an'}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {isLogin ? 'Sign in to continue learning' : 'Create your free account'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="section-label block">Full Name</label>
                <input
                  className="input"
                  placeholder="Your name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
            )}
            <div>
              <label className="section-label block">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="section-label block">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                minLength={6}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full justify-center py-3 mt-2"
              disabled={loading}
            >
              {loading && <span className="spinner mr-2" />}
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} className="text-gold hover:underline">
              {isLogin ? 'Register' : 'Sign in'}
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          🔒 Auth secured by JWT + bcrypt
        </p>
      </div>
    </div>
  )
}
