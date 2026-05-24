import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import {
  GraduationCap, BookOpen, FileText, Headphones, Mic, PenLine,
  ChevronRight, Trophy, BarChart3, Star, Clock, CheckCircle,
} from 'lucide-react'

const EXAM_LEVELS = [
  { level: 'A1', name: 'Start Deutsch 1', desc: 'Complete beginner — daily phrases, numbers, greetings', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { level: 'A2', name: 'Start Deutsch 2', desc: 'Elementary — family, work, shopping, travel basics', color: 'text-teal-soft', bg: 'bg-teal-muted', border: 'border-teal-soft/20' },
  { level: 'B1', name: 'Zertifikat Deutsch', desc: 'Intermediate — work, opinions, past events, media', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' },
  { level: 'B2', name: 'Goethe-Zertifikat B2', desc: 'Upper-intermediate — complex topics, nuanced expression', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { level: 'C1', name: 'Goethe-Zertifikat C1', desc: 'Advanced — academic, professional, spontaneous speech', color: 'text-violet-soft', bg: 'bg-violet-muted', border: 'border-violet-soft/20' },
  { level: 'C2', name: 'Goethe-Zertifikat C2', desc: 'Mastery — near-native, complex literature & discourse', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
]

const SECTIONS = [
  { key: 'vocabulary', icon: BookOpen,    label: 'Vocabulary',  desc: 'Words & phrases for this level' },
  { key: 'grammar',    icon: FileText,    label: 'Grammar',     desc: 'Rules, cases, conjugation' },
  { key: 'reading',    icon: BookOpen,    label: 'Reading',     desc: 'Comprehension passages' },
  { key: 'writing',    icon: PenLine,     label: 'Writing',     desc: 'Letters, essays, summaries' },
  { key: 'listening',  icon: Headphones,  label: 'Listening',   desc: 'Dialogues & announcements' },
  { key: 'speaking',   icon: Mic,         label: 'Speaking',    desc: 'Oral expression & interaction' },
]

export default function GoetheCoursePage() {
  const navigate = useNavigate()
  const user = useAppSelector(s => s.auth.user)
  const examHistory = useAppSelector(s => s.exam?.history || [])
  const [selectedLevel, setSelectedLevel] = useState(user?.level || 'A1')

  const levelHistory = examHistory.filter(s => s.examLevel === selectedLevel)
  const avgScore = levelHistory.length
    ? Math.round(levelHistory.reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) / levelHistory.length)
    : null
  const passRate = levelHistory.length
    ? Math.round((levelHistory.filter(s => s.passed).length / levelHistory.length) * 100)
    : null

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap size={20} className="text-gold" />
          <span className="text-xs text-gold uppercase tracking-widest font-medium">Goethe-Zertifikat Prep</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Exam Course</h1>
        <p className="text-gray-500 text-sm mt-1">Structured study + AI-powered practice tests to pass your Goethe exam</p>
      </div>

      {/* Level selector */}
      <div className="mb-6">
        <h2 className="section-label mb-3">Select Your Target Level</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {EXAM_LEVELS.map(({ level, name, desc, color, bg, border }) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`text-left p-3 sm:p-4 rounded-2xl border transition-all
                ${selectedLevel === level
                  ? `${bg} ${border} ring-1 ring-offset-1 ring-offset-ink-950 ring-gold/40`
                  : 'bg-ink-900 border-white/[0.07] hover:border-white/15'
                }`}
            >
              <div className={`font-display text-2xl sm:text-3xl font-bold ${color} mb-1`}>{level}</div>
              <div className="text-xs font-medium text-gray-200">{name}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-tight hidden sm:block">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Stats for selected level */}
      {levelHistory.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
          {[
            { label: 'Tests Taken', value: levelHistory.length, icon: BarChart3, color: 'text-gold' },
            { label: 'Avg Score', value: `${avgScore}%`, icon: Star, color: 'text-violet-soft' },
            { label: 'Pass Rate', value: `${passRate}%`, icon: Trophy, color: passRate! >= 60 ? 'text-teal-soft' : 'text-orange-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card-sm text-center">
              <Icon size={16} className={`${color} mx-auto mb-1.5`} />
              <div className="font-display text-xl text-gray-100">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Study sections */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-label">Study & Practice — {selectedLevel}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {SECTIONS.map(({ key, icon: Icon, label, desc }) => (
            <div key={key} className="card flex items-center gap-4 group hover:border-white/15 transition-all">
              <div className="bg-gold/10 p-2.5 rounded-xl shrink-0">
                <Icon size={18} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-100 text-sm">{label}</div>
                <div className="text-xs text-gray-500">{desc}</div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => navigate(`/study-guide/${selectedLevel}/${key}`)}
                  className="btn-ghost text-xs px-2.5 py-1.5"
                  title="Study Guide"
                >
                  <BookOpen size={13} /> Study
                </button>
                <button
                  onClick={() => navigate(`/exam?level=${selectedLevel}&section=${key}`)}
                  className="btn-secondary text-xs px-2.5 py-1.5"
                  title="Practice Test"
                >
                  <ChevronRight size={13} /> Test
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full exam + special features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => navigate(`/exam?level=${selectedLevel}&section=full`)}
          className="card text-left hover:border-gold/30 transition-all group"
        >
          <Trophy size={22} className="text-gold mb-3" />
          <div className="font-medium text-gray-100">Full Mock Exam</div>
          <div className="text-xs text-gray-500 mt-1">All sections · 40 questions · Timed</div>
          <div className="mt-3 text-xs text-gold group-hover:underline flex items-center gap-1">
            Start now <ChevronRight size={12} />
          </div>
        </button>
        <button
          onClick={() => navigate('/conversation?level=' + selectedLevel)}
          className="card text-left hover:border-violet-soft/30 transition-all group"
        >
          <Mic size={22} className="text-violet-soft mb-3" />
          <div className="font-medium text-gray-100">AI Conversation</div>
          <div className="text-xs text-gray-500 mt-1">Live speaking practice with a native AI partner</div>
          <div className="mt-3 text-xs text-violet-soft group-hover:underline flex items-center gap-1">
            Start chat <ChevronRight size={12} />
          </div>
        </button>
        <button
          onClick={() => navigate('/exam-history')}
          className="card text-left hover:border-teal-soft/30 transition-all group"
        >
          <BarChart3 size={22} className="text-teal-soft mb-3" />
          <div className="font-medium text-gray-100">My Progress</div>
          <div className="text-xs text-gray-500 mt-1">Scores, weak areas, improvement over time</div>
          <div className="mt-3 text-xs text-teal-soft group-hover:underline flex items-center gap-1">
            View all <ChevronRight size={12} />
          </div>
        </button>
      </div>

      {/* Recent history */}
      {levelHistory.length > 0 && (
        <div>
          <h2 className="section-label mb-3">Recent Tests — {selectedLevel}</h2>
          <div className="space-y-2">
            {levelHistory.slice(0, 5).map(s => {
              const pct = Math.round((s.totalScore / s.maxScore) * 100)
              return (
                <div key={s._id} className="card-sm flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.passed ? 'bg-teal-soft' : 'bg-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-200 capitalize">{s.section}</span>
                    <span className="text-xs text-gray-500 ml-2">{s.examLevel}</span>
                  </div>
                  <div className={`font-display text-lg ${pct >= 60 ? 'text-teal-soft' : 'text-orange-400'}`}>{pct}%</div>
                  {s.passed ? <CheckCircle size={14} className="text-teal-soft shrink-0" /> : <Clock size={14} className="text-gray-600 shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Goethe exam info */}
      <div className="mt-6 p-4 bg-violet-muted border border-violet-soft/20 rounded-2xl">
        <p className="text-xs text-violet-soft uppercase tracking-widest mb-2">About the Goethe-Zertifikat</p>
        <p className="text-sm text-gray-300 leading-relaxed">
          The Goethe-Zertifikat is an internationally recognized German language certificate issued by the Goethe-Institut.
          It covers six levels (A1–C2) aligned with the Common European Framework (CEFR).
          Each exam tests <span className="text-violet-soft">reading, listening, writing, and speaking</span>.
          A score of <span className="text-violet-soft">60% or higher</span> in each module is required to pass.
        </p>
      </div>
    </div>
  )
}
