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
  hasText?: boolean   // true when text has been extracted and cached
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

// ─── ReadAloud ────────────────────────────────────────────────────────────────

export interface ReadingGlossaryItem {
  de: string
  en: string
  ipa?: string
}

export interface ReadingSegment {
  text: string
  note?: string
}

export interface ReadingContent {
  title: string
  level: string
  segments: ReadingSegment[]
  fullText: string
  glossary: ReadingGlossaryItem[]
}

export interface ReadAloudState {
  content: ReadingContent | null
  loading: boolean
  error: string | null
  history: { id: string; title: string; level: string; createdAt: string }[]
}

// ─── RootState ───────────────────────────────────────────────────────────────

export interface RootState {
  auth: AuthState
  vocab: VocabState
  podcast: PodcastState
  pronounce: PronounceState
  translate: TranslateState
}
