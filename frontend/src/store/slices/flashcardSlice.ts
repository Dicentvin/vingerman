import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../utils/api'

export type CardRating = 'again' | 'hard' | 'good' | 'easy'

export interface Flashcard {
  _id: string
  de: string
  en: string
  ipa?: string
  example?: string
  exampleEn?: string
  listId: string
  topic: string
  // SRS fields
  interval: number       // days until next review
  easeFactor: number     // multiplier (starts at 2.5)
  repetitions: number    // times reviewed
  dueDate: string        // ISO date
  lastRating?: CardRating
}

interface FlashcardState {
  deck: Flashcard[]          // today's due cards
  allCards: Flashcard[]
  currentIdx: number
  flipped: boolean
  sessionResults: { cardId: string; rating: CardRating }[]
  loading: boolean
  submitting: boolean
  error: string | null
  sessionComplete: boolean
}

export const fetchDueCards = createAsyncThunk(
  'flashcard/fetchDue',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/flashcard/due')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to load cards')
    }
  }
)

export const rateCard = createAsyncThunk(
  'flashcard/rate',
  async (payload: { cardId: string; rating: CardRating }, { rejectWithValue }) => {
    try {
      const res = await api.post('/flashcard/rate', payload)
      return { ...res.data, cardId: payload.cardId, rating: payload.rating }
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

export const syncVocabToCards = createAsyncThunk(
  'flashcard/sync',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.post('/flashcard/sync')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Sync failed')
    }
  }
)

const flashcardSlice = createSlice({
  name: 'flashcard',
  initialState: {
    deck: [],
    allCards: [],
    currentIdx: 0,
    flipped: false,
    sessionResults: [],
    loading: false,
    submitting: false,
    error: null,
    sessionComplete: false,
  } as FlashcardState,
  reducers: {
    flipCard: (state) => { state.flipped = !state.flipped },
    nextCard:  (state) => {
      state.flipped = false
      if (state.currentIdx + 1 >= state.deck.length) {
        state.sessionComplete = true
      } else {
        state.currentIdx++
      }
    },
    resetSession: (state) => {
      state.currentIdx = 0
      state.flipped = false
      state.sessionResults = []
      state.sessionComplete = false
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDueCards.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchDueCards.fulfilled, (state, action) => {
        state.loading = false
        state.deck = action.payload.cards
        state.currentIdx = 0
        state.flipped = false
        state.sessionComplete = false
        state.sessionResults = []
      })
      .addCase(fetchDueCards.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(rateCard.pending, (state) => { state.submitting = true })
      .addCase(rateCard.fulfilled, (state, action) => {
        state.submitting = false
        state.sessionResults.push({ cardId: action.payload.cardId, rating: action.payload.rating })
        // Remove rated card from deck
        state.deck = state.deck.filter(c => c._id !== action.payload.cardId)
        state.flipped = false
        if (state.deck.length === 0) state.sessionComplete = true
      })
      .addCase(rateCard.rejected, (state) => { state.submitting = false })
      .addCase(syncVocabToCards.fulfilled, (state, action) => {
        // After sync, new cards are available — trigger a re-fetch
        state.allCards = action.payload.cards || []
      })
  },
})

export const { flipCard, nextCard, resetSession } = flashcardSlice.actions
export default flashcardSlice.reducer
