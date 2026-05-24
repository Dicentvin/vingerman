import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { fetchStudyGuide } from '../store/slices/examSlice'
import { ChevronLeft, BookOpen, GraduationCap, ChevronRight } from 'lucide-react'

// Simple markdown-ish renderer for the AI-generated guide
function GuideContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return (
          <h2 key={i} className="font-display text-xl text-gray-100 mt-6 mb-2 first:mt-0">{line.replace('## ', '')}</h2>
        )
        if (line.startsWith('### ')) return (
          <h3 key={i} className="font-medium text-gold mt-4 mb-1">{line.replace('### ', '')}</h3>
        )
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} className="flex items-start gap-2 text-sm text-gray-300 py-0.5">
            <span className="text-gold mt-1 shrink-0">·</span>
            <span>{line.replace(/^[-•]\s/, '')}</span>
          </div>
        )
        if (line.match(/^\d+\. /)) return (
          <div key={i} className="flex items-start gap-2 text-sm text-gray-300 py-0.5">
            <span className="text-violet-soft shrink-0 font-medium w-5">{line.match(/^(\d+)/)?.[1]}.</span>
            <span>{line.replace(/^\d+\.\s/, '')}</span>
          </div>
        )
        if (line.startsWith('**') && line.endsWith('**')) return (
          <p key={i} className="font-medium text-gray-100 text-sm mt-3">{line.replace(/\*\*/g, '')}</p>
        )
        if (line.trim() === '') return <div key={i} className="h-2" />
        return <p key={i} className="text-sm text-gray-300 leading-relaxed">{line}</p>
      })}
    </div>
  )
}

const SECTIONS = ['vocabulary','grammar','reading','writing','listening','speaking','culture']
const SECTION_LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary', grammar: 'Grammar', reading: 'Reading',
  writing: 'Writing', listening: 'Listening', speaking: 'Speaking', culture: 'Culture & Context',
}

export default function StudyGuidePage() {
  const { examLevel, section } = useParams<{ examLevel: string; section: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { studyGuide, studyGuideLevel, studyGuideSection, loadingGuide } = useAppSelector(s => s.exam)

  useEffect(() => {
    if (examLevel && section) {
      if (studyGuideLevel !== examLevel || studyGuideSection !== section) {
        dispatch(fetchStudyGuide({ examLevel, section }))
      }
    }
  }, [examLevel, section, dispatch, studyGuideLevel, studyGuideSection])

  const currentSectionIdx = SECTIONS.indexOf(section || '')

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate('/goethe')} className="btn-ghost mb-5 text-sm">
        <ChevronLeft size={15} /> Back to Course
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-gold text-[10px]">{examLevel}</span>
            <span className="text-xs text-gray-500 uppercase tracking-widest">{SECTION_LABELS[section || '']}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-gray-100">Study Guide</h1>
        </div>
        <button
          onClick={() => navigate(`/exam?level=${examLevel}&section=${section}`)}
          className="btn-primary shrink-0"
        >
          <GraduationCap size={15} /> Take Test
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {SECTIONS.map(s => (
          <button
            key={s}
            onClick={() => navigate(`/study-guide/${examLevel}/${s}`)}
            className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all shrink-0
              ${s === section
                ? 'bg-gold/10 border-gold/30 text-gold'
                : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:text-gray-200'
              }`}
          >
            {SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Content */}
      {loadingGuide ? (
        <div className="card py-16 flex flex-col items-center gap-4">
          <span className="spinner w-8 h-8" />
          <p className="text-gray-500 text-sm">Generating your study guide…</p>
        </div>
      ) : studyGuide ? (
        <div className="card">
          <GuideContent content={studyGuide} />
        </div>
      ) : (
        <div className="card py-12 flex flex-col items-center gap-3">
          <BookOpen size={36} className="text-gray-700" />
          <p className="text-gray-500 text-sm">Select a section to load your study guide</p>
        </div>
      )}

      {/* Prev / next section */}
      {studyGuide && (
        <div className="flex justify-between mt-5 gap-3">
          {currentSectionIdx > 0 ? (
            <button
              onClick={() => navigate(`/study-guide/${examLevel}/${SECTIONS[currentSectionIdx - 1]}`)}
              className="btn-secondary text-sm"
            >
              <ChevronLeft size={14} /> {SECTION_LABELS[SECTIONS[currentSectionIdx - 1]]}
            </button>
          ) : <div />}
          {currentSectionIdx < SECTIONS.length - 1 ? (
            <button
              onClick={() => navigate(`/study-guide/${examLevel}/${SECTIONS[currentSectionIdx + 1]}`)}
              className="btn-secondary text-sm"
            >
              {SECTION_LABELS[SECTIONS[currentSectionIdx + 1]]} <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => navigate(`/exam?level=${examLevel}&section=full`)}
              className="btn-primary text-sm"
            >
              <GraduationCap size={14} /> Take Full Mock Exam
            </button>
          )}
        </div>
      )}
    </div>
  )
}
