import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../utils/api'

export interface ReadingSegment {
  text: string
  note?: string        // grammar/cultural tip for this segment
  isHighlighted?: boolean
}

export interface ReadingContent {
  title: string
  level: string        // A1 / A2 / B1 / B2 / C1
  segments: ReadingSegment[]
  fullText: string
  glossary: { de: string; en: string; ipa?: string }[]
}

export interface ReadAloudState {
  content: ReadingContent | null
  loading: boolean
  error: string | null
  history: { id: string; title: string; level: string; createdAt: string }[]
}

export const readFromMaterial = createAsyncThunk(
  'readAloud/readMaterial',
  async (
    payload: { materialId: string; level: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await api.post('/readaloud/material', payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to read material')
    }
  }
)

export const generateReadingContent = createAsyncThunk(
  'readAloud/generate',
  async (
    payload: { topic: string; level: string; type: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await api.post('/readaloud/generate', payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to generate reading content')
    }
  }
)

export const submitCustomText = createAsyncThunk(
  'readAloud/custom',
  async (
    payload: { text: string; level: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await api.post('/readaloud/custom', payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to process text')
    }
  }
)

export const fetchReadAloudHistory = createAsyncThunk(
  'readAloud/history',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/readaloud/history')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

const initialState: ReadAloudState = {
  content: null,
  loading: false,
  error: null,
  history: [],
}

const readAloudSlice = createSlice({
  name: 'readAloud',
  initialState,
  reducers: {
    clearContent: (state) => { state.content = null },
    setContent: (state, action: PayloadAction<ReadingContent>) => {
      state.content = action.payload
    },
  },
  extraReducers: (builder) => {
    const pending = (state: ReadAloudState) => { state.loading = true; state.error = null }
    const rejected = (state: ReadAloudState, action: { payload: unknown }) => {
      state.loading = false
      state.error = action.payload as string
    }

    builder
      .addCase(generateReadingContent.pending, pending)
      .addCase(generateReadingContent.fulfilled, (state, action) => {
        state.loading = false
        state.content = action.payload.content
      })
      .addCase(generateReadingContent.rejected, rejected)

      .addCase(submitCustomText.pending, pending)
      .addCase(submitCustomText.fulfilled, (state, action) => {
        state.loading = false
        state.content = action.payload.content
      })
      .addCase(submitCustomText.rejected, rejected)

      .addCase(fetchReadAloudHistory.fulfilled, (state, action) => {
        state.history = action.payload.history
      })

      .addCase(readFromMaterial.pending, pending)
      .addCase(readFromMaterial.fulfilled, (state, action) => {
        state.loading = false
        state.content = action.payload.content
      })
      .addCase(readFromMaterial.rejected, rejected)
  },
})

export const { clearContent, setContent } = readAloudSlice.actions
export default readAloudSlice.reducer
