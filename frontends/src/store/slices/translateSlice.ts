import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../utils/api'
import type { TranslateState } from '../../types'

export const translateText = createAsyncThunk(
  'translate/translate',
  async (data: { text: string; direction: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/translate', data)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Translation failed')
    }
  }
)

export const explainGrammar = createAsyncThunk(
  'translate/grammar',
  async (data: { text: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/translate/grammar', data)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

const initialState: TranslateState = {
  translated: '',
  grammar: '',
  direction: 'de-en',
  loading: false,
  grammarLoading: false,
  error: null,
}

const translateSlice = createSlice({
  name: 'translate',
  initialState,
  reducers: {
    setDirection: (state, action: PayloadAction<'de-en' | 'en-de'>) => {
      state.direction = action.payload
      state.translated = ''
    },
    clearTranslation: (state) => {
      state.translated = ''
      state.grammar = ''
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(translateText.pending, (state) => { state.loading = true; state.error = null })
      .addCase(translateText.fulfilled, (state, action) => {
        state.loading = false
        state.translated = action.payload.translated
      })
      .addCase(translateText.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(explainGrammar.pending, (state) => { state.grammarLoading = true })
      .addCase(explainGrammar.fulfilled, (state, action) => {
        state.grammarLoading = false
        state.grammar = action.payload.explanation
      })
      .addCase(explainGrammar.rejected, (state) => { state.grammarLoading = false })
  },
})

export const { setDirection, clearTranslation } = translateSlice.actions
export default translateSlice.reducer
