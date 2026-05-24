import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

export interface ExamQuestion {
  _id: string
  type: 'mcq' | 'fill' | 'translate' | 'speaking' | 'writing' | 'listening'
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  userAnswer: string
  isCorrect: boolean | null
  score: number | null
  aiFeedback: string
}

export interface ExamSession {
  _id: string
  examLevel: string
  section: string
  questions: ExamQuestion[]
  totalScore: number
  maxScore: number
  passed: boolean
  completedAt?: string
  timeSpentSeconds?: number
}

interface ExamState {
  currentSession: ExamSession | null
  history: ExamSession[]
  studyGuide: string
  studyGuideLevel: string
  studyGuideSection: string
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  generating: boolean
  submitting: boolean
  loadingGuide: boolean
  loadingConversation: boolean
  error: string | null
}

const initialState: ExamState = {
  currentSession: null,
  history: [],
  studyGuide: '',
  studyGuideLevel: '',
  studyGuideSection: '',
  conversationHistory: [],
  generating: false,
  submitting: false,
  loadingGuide: false,
  loadingConversation: false,
  error: null,
}

export const generateExam = createAsyncThunk(
  'exam/generate',
  async (payload: { examLevel: string; section: string; questionCount: number }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/exam/generate', payload)
      return data.session as ExamSession
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to generate exam')
    }
  }
)

export const submitAnswers = createAsyncThunk(
  'exam/submit',
  async (payload: { sessionId: string; answers: { questionId: string; userAnswer: string }[]; timeSpentSeconds: number }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/exam/submit', payload)
      return data as { session: ExamSession; xpEarned: number; percentage: number }
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to submit')
    }
  }
)

export const fetchExamHistory = createAsyncThunk(
  'exam/history',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/exam/history')
      return data.sessions as ExamSession[]
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to fetch history')
    }
  }
)

export const fetchStudyGuide = createAsyncThunk(
  'exam/studyGuide',
  async (payload: { examLevel: string; section: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/exam/study/${payload.examLevel}/${payload.section}`)
      return data as { content: string; examLevel: string; section: string }
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Failed to load guide')
    }
  }
)

export const sendConversationMessage = createAsyncThunk(
  'exam/conversation',
  async (payload: { examLevel: string; history: any[]; userMessage: string; scenario: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/exam/conversation', payload)
      return data.reply as string
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.message || 'Conversation error')
    }
  }
)

const examSlice = createSlice({
  name: 'exam',
  initialState,
  reducers: {
    clearSession: (state) => { state.currentSession = null },
    clearConversation: (state) => { state.conversationHistory = [] },
    addUserMessage: (state, action) => {
      state.conversationHistory.push({ role: 'user', content: action.payload })
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateExam.pending, (s) => { s.generating = true; s.error = null })
      .addCase(generateExam.fulfilled, (s, a) => { s.generating = false; s.currentSession = a.payload })
      .addCase(generateExam.rejected, (s, a) => { s.generating = false; s.error = a.payload as string })

      .addCase(submitAnswers.pending, (s) => { s.submitting = true })
      .addCase(submitAnswers.fulfilled, (s, a) => { s.submitting = false; s.currentSession = a.payload.session })
      .addCase(submitAnswers.rejected, (s, a) => { s.submitting = false; s.error = a.payload as string })

      .addCase(fetchExamHistory.fulfilled, (s, a) => { s.history = a.payload })

      .addCase(fetchStudyGuide.pending, (s) => { s.loadingGuide = true; s.studyGuide = '' })
      .addCase(fetchStudyGuide.fulfilled, (s, a) => {
        s.loadingGuide = false
        s.studyGuide = a.payload.content
        s.studyGuideLevel = a.payload.examLevel
        s.studyGuideSection = a.payload.section
      })
      .addCase(fetchStudyGuide.rejected, (s) => { s.loadingGuide = false })

      .addCase(sendConversationMessage.pending, (s) => { s.loadingConversation = true })
      .addCase(sendConversationMessage.fulfilled, (s, a) => {
        s.loadingConversation = false
        s.conversationHistory.push({ role: 'assistant', content: a.payload })
      })
      .addCase(sendConversationMessage.rejected, (s) => { s.loadingConversation = false })
  },
})

export const { clearSession, clearConversation, addUserMessage } = examSlice.actions
export default examSlice.reducer
