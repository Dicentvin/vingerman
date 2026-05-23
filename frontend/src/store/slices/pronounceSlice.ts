import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'
import type { PronounceState } from '../../types'

export const teachPronunciation = createAsyncThunk(
  'pronounce/teach',
  async (data: { word: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/pronounce/teach', data)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

export const evaluatePronunciation = createAsyncThunk(
  'pronounce/evaluate',
  async (data: { targetPhrase: string; spokenText: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/pronounce/evaluate', data)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

export const fetchPronounceHistory = createAsyncThunk(
  'pronounce/history',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/pronounce/history')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

const initialState: PronounceState = {
  lesson: '',
  feedback: '',
  score: null,
  history: [],
  loading: false,
  evalLoading: false,
  error: null,
}

const pronounceSlice = createSlice({
  name: 'pronounce',
  initialState,
  reducers: {
    clearLesson: (state) => {
      state.lesson = ''
      state.feedback = ''
      state.score = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(teachPronunciation.pending, (state) => { state.loading = true })
      .addCase(teachPronunciation.fulfilled, (state, action) => {
        state.loading = false
        state.lesson = action.payload.lesson
      })
      .addCase(teachPronunciation.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(evaluatePronunciation.pending, (state) => { state.evalLoading = true })
      .addCase(evaluatePronunciation.fulfilled, (state, action) => {
        state.evalLoading = false
        state.feedback = action.payload.feedback
        state.score = action.payload.score
      })
      .addCase(evaluatePronunciation.rejected, (state) => { state.evalLoading = false })
      .addCase(fetchPronounceHistory.fulfilled, (state, action) => {
        state.history = action.payload.attempts
      })
  },
})

export const { clearLesson } = pronounceSlice.actions
export default pronounceSlice.reducer
