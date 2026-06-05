import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../utils/api'

export type WordCategory = 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'pronoun' | 'mixed'

export interface GrammarWord {
  de: string
  en: string
  ipa?: string
  category: WordCategory
  gender?: string          // der/die/das — for nouns
  plural?: string          // plural form — for nouns
  conjugations?: {         // present tense — for verbs
    ich: string; du: string; er: string
    wir: string; ihr: string; sie: string
  }
  comparative?: string     // for adjectives
  superlative?: string     // for adjectives
  example: string          // primary example sentence
  exampleEn: string
  sentences?: string[]     // 3-5 usage sentences
  sentencesEn?: string[]   // English translations of sentences
  tip?: string             // memory tip
}

export interface WordSet {
  _id: string
  date: string             // YYYY-MM-DD
  category: WordCategory
  words: GrammarWord[]
  practiced: boolean
  score?: number
  createdAt: string
}

export interface GrammarDrillState {
  todaySet: WordSet | null
  history: { _id: string; date: string; category: WordCategory; score: number; practiced: boolean }[]
  loading: boolean
  generating: boolean
  error: string | null
}

export const generateWordSet = createAsyncThunk(
  'grammar/generate',
  async (payload: { category: WordCategory; count: number }, { rejectWithValue }) => {
    try {
      const res = await api.post('/grammar/generate', payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to generate words')
    }
  }
)

export const fetchTodaySet = createAsyncThunk(
  'grammar/today',
  async (category: WordCategory, { rejectWithValue }) => {
    try {
      const res = await api.get(`/grammar/today?category=${category}`)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

export const fetchHistory = createAsyncThunk(
  'grammar/history',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/grammar/history')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

export const markPracticed = createAsyncThunk(
  'grammar/markPracticed',
  async (payload: { setId: string; score: number }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/grammar/practiced`, payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

const grammarSlice = createSlice({
  name: 'grammar',
  initialState: {
    todaySet: null,
    history: [],
    loading: false,
    generating: false,
    error: null,
  } as GrammarDrillState,
  reducers: {
    clearSet: (state) => { state.todaySet = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateWordSet.pending, (state) => { state.generating = true; state.error = null })
      .addCase(generateWordSet.fulfilled, (state, action) => {
        state.generating = false
        state.todaySet = action.payload.wordSet
      })
      .addCase(generateWordSet.rejected, (state, action) => {
        state.generating = false
        state.error = action.payload as string
      })
      .addCase(fetchTodaySet.pending, (state) => { state.loading = true })
      .addCase(fetchTodaySet.fulfilled, (state, action) => {
        state.loading = false
        state.todaySet = action.payload.wordSet || null
      })
      .addCase(fetchTodaySet.rejected, (state) => { state.loading = false })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.history = action.payload.history
      })
      .addCase(markPracticed.fulfilled, (state, action) => {
        if (state.todaySet) {
          state.todaySet.practiced = true
          state.todaySet.score = action.payload.score
        }
      })
  },
})

export const { clearSet } = grammarSlice.actions
export default grammarSlice.reducer
