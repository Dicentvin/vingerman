// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  _id: string
  name: string
  email: string
  level: string
  streak: number
  totalXP: number
  wordsLearned: number
  lastActiveDate?: string
  createdAt?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  error: string | null
  initialized: boolean
}

// ─── Vocab ───────────────────────────────────────────────────────────────────

export interface VocabWord {
  _id: string
  de: string
  en: string
  ipa: string
  example: string
  exampleEn: string
  mastered: boolean
  reviewCount: number
}

export interface VocabList {
  _id: string
  topic: string
  userId: string
  words: VocabWord[]
  createdAt: string
}

export interface VocabState {
  lists: VocabList[]
  currentList: VocabList | null
  loading: boolean
  error: string | null
}

// ─── Podcast ─────────────────────────────────────────────────────────────────

export interface Material {
  _id: string
  title: string
  originalName: string
  fileType: string
  cloudinaryUrl: string
  fileSize: number
  createdAt: string
}

export interface PodcastState {
  script: string
  style: string
  materials: Material[]
  selectedMaterial: Material | null
  loading: boolean
  uploading: boolean
  error: string | null
}

// ─── Pronounce ───────────────────────────────────────────────────────────────

export interface PronounceAttempt {
  _id: string
  targetPhrase: string
  spokenText: string
  score: number | null
  feedback: string
  createdAt: string
}

export interface PronounceState {
  lesson: string
  feedback: string
  score: number | null
  history: PronounceAttempt[]
  loading: boolean
  evalLoading: boolean
  error: string | null
}

// ─── Translate ───────────────────────────────────────────────────────────────

export interface TranslateState {
  translated: string
  grammar: string
  direction: 'de-en' | 'en-de'
  loading: boolean
  grammarLoading: boolean
  error: string | null
}



// ─── Exam ─────────────────────────────────────────────────────────────────────

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

export interface ExamState {
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

export interface RootState {
  auth: AuthState
  vocab: VocabState
  podcast: PodcastState
  pronounce: PronounceState
  translate: TranslateState
  exam: ExamState
}
