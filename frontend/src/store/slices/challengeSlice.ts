import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

export type ChallengeType = 'translate' | 'fill-blank' | 'pronounce' | 'multiple-choice'

export interface DailyChallenge {
  _id: string
  type: ChallengeType
  question: string
  answer: string
  options?: string[]       // for multiple-choice
  hint?: string
  xpReward: number
  date: string             // YYYY-MM-DD
  completed: boolean
  userAnswer?: string
  score?: number
}

export interface LeaderboardEntry {
  userId: string
  name: string
  xp: number
  streak: number
  rank: number
}

interface ChallengeState {
  today: DailyChallenge | null
  leaderboard: LeaderboardEntry[]
  userRank: number | null
  loading: boolean
  submitting: boolean
  error: string | null
  result: { correct: boolean; score: number; explanation: string } | null
}

export const fetchTodayChallenge = createAsyncThunk(
  'challenge/today',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/challenge/today')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to load challenge')
    }
  }
)

export const submitChallenge = createAsyncThunk(
  'challenge/submit',
  async (payload: { challengeId: string; answer: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/challenge/submit', payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Submission failed')
    }
  }
)

export const fetchLeaderboard = createAsyncThunk(
  'challenge/leaderboard',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/challenge/leaderboard')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

const challengeSlice = createSlice({
  name: 'challenge',
  initialState: {
    today: null,
    leaderboard: [],
    userRank: null,
    loading: false,
    submitting: false,
    error: null,
    result: null,
  } as ChallengeState,
  reducers: {
    clearResult: (state) => { state.result = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodayChallenge.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchTodayChallenge.fulfilled, (state, action) => {
        state.loading = false
        state.today = action.payload.challenge
      })
      .addCase(fetchTodayChallenge.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(submitChallenge.pending, (state) => { state.submitting = true })
      .addCase(submitChallenge.fulfilled, (state, action) => {
        state.submitting = false
        state.result = action.payload.result
        if (state.today) {
          state.today.completed  = true
          state.today.userAnswer = action.payload.userAnswer
          state.today.score      = action.payload.result.score
        }
      })
      .addCase(submitChallenge.rejected, (state) => { state.submitting = false })
      .addCase(fetchLeaderboard.fulfilled, (state, action) => {
        state.leaderboard = action.payload.leaderboard
        state.userRank    = action.payload.userRank
      })
  },
})

export const { clearResult } = challengeSlice.actions
export default challengeSlice.reducer
