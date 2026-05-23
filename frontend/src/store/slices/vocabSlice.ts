import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../utils/api'
import type { VocabState, VocabList } from '../../types'

export const generateVocabList = createAsyncThunk(
  'vocab/generate',
  async (data: { topic: string; count: number }, { rejectWithValue }) => {
    try {
      const res = await api.post('/vocab/generate', data)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to generate vocab list')
    }
  }
)

export const fetchVocabLists = createAsyncThunk(
  'vocab/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/vocab')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to fetch vocab lists')
    }
  }
)

export const markWordMastered = createAsyncThunk(
  'vocab/markMastered',
  async (data: { wordId: string; mastered: boolean; listId: string }, { rejectWithValue }) => {
    try {
      const res = await api.put('/vocab/word/mastered', data)
      return { ...res.data, listId: data.listId }
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

export const deleteVocabList = createAsyncThunk(
  'vocab/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/vocab/${id}`)
      return id
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

const initialState: VocabState = {
  lists: [],
  currentList: null,
  loading: false,
  error: null,
}

const vocabSlice = createSlice({
  name: 'vocab',
  initialState,
  reducers: {
    setCurrentList: (state, action: PayloadAction<VocabList | null>) => {
      state.currentList = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateVocabList.pending, (state) => { state.loading = true; state.error = null })
      .addCase(generateVocabList.fulfilled, (state, action) => {
        state.loading = false
        state.lists.unshift(action.payload.list)
        state.currentList = action.payload.list
      })
      .addCase(generateVocabList.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchVocabLists.fulfilled, (state, action) => {
        state.lists = action.payload.lists
      })
      .addCase(markWordMastered.fulfilled, (state, action) => {
        const list = state.lists.find(l => l._id === action.payload.listId)
        if (list) {
          const word = list.words.find(w => w._id === action.payload.word._id)
          if (word) word.mastered = action.payload.word.mastered
        }
        if (state.currentList?._id === action.payload.listId) {
          const word = state.currentList.words.find(w => w._id === action.payload.word._id)
          if (word) word.mastered = action.payload.word.mastered
        }
      })
      .addCase(deleteVocabList.fulfilled, (state, action) => {
        state.lists = state.lists.filter(l => l._id !== action.payload)
        if (state.currentList?._id === action.payload) state.currentList = null
      })
  },
})

export const { setCurrentList } = vocabSlice.actions
export default vocabSlice.reducer
