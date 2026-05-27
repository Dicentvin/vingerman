import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

export interface CorrectionDiff {
  original: string
  corrected: string
  type: 'grammar' | 'gender' | 'case' | 'word-order' | 'spelling' | 'vocabulary'
  explanation: string
}

export interface WritingCorrection {
  original: string
  corrected: string
  score: number          // 0–100 correctness score
  diffs: CorrectionDiff[]
  summary: string        // one-line overall feedback
  encouragement: string  // motivational closing line
}

export interface WritingHistoryItem {
  _id: string
  original: string
  corrected: string
  score: number
  createdAt: string
}

interface WritingState {
  correction: WritingCorrection | null
  history: WritingHistoryItem[]
  loading: boolean
  error: string | null
}

export const correctWriting = createAsyncThunk(
  'writing/correct',
  async (payload: { text: string; level: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/writing/correct', payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Correction failed')
    }
  }
)

export const fetchWritingHistory = createAsyncThunk(
  'writing/history',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/writing/history')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

const writingSlice = createSlice({
  name: 'writing',
  initialState: {
    correction: null,
    history: [],
    loading: false,
    error: null,
  } as WritingState,
  reducers: {
    clearCorrection: (state) => { state.correction = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(correctWriting.pending, (state) => { state.loading = true; state.error = null })
      .addCase(correctWriting.fulfilled, (state, action) => {
        state.loading = false
        state.correction = action.payload.correction
      })
      .addCase(correctWriting.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchWritingHistory.fulfilled, (state, action) => {
        state.history = action.payload.history
      })
  },
})

export const { clearCorrection } = writingSlice.actions
export default writingSlice.reducer
