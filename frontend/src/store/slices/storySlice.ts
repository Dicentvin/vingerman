import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

export interface StoryLine {
  line: number
  de: string
  en: string
  note?: string
}

export interface Story {
  _id: string
  title: string
  titleEn: string
  level: string
  topic: string
  genre: string
  lines: StoryLine[]
  vocabulary: { de: string; en: string; ipa?: string }[]
  createdAt: string
}

export interface StoryState {
  current: Story | null
  history: { _id: string; title: string; level: string; genre: string; topic: string; createdAt: string }[]
  loading: boolean
  error: string | null
}

export const generateStory = createAsyncThunk(
  'story/generate',
  async (payload: { level: string; topic: string; genre: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/story/generate', payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to generate story')
    }
  }
)

export const fetchStoryHistory = createAsyncThunk(
  'story/history',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/story/history')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

export const loadStory = createAsyncThunk(
  'story/load',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await api.get(`/story/${id}`)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

const storySlice = createSlice({
  name: 'story',
  initialState: { current: null, history: [], loading: false, error: null } as StoryState,
  reducers: {
    clearStory: (state) => { state.current = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateStory.pending,   (state) => { state.loading = true; state.error = null })
      .addCase(generateStory.fulfilled, (state, action) => { state.loading = false; state.current = action.payload.story })
      .addCase(generateStory.rejected,  (state, action) => { state.loading = false; state.error = action.payload as string })
      .addCase(fetchStoryHistory.fulfilled, (state, action) => { state.history = action.payload.history })
      .addCase(loadStory.fulfilled,     (state, action) => { state.current = action.payload.story })
  },
})

export const { clearStory } = storySlice.actions
export default storySlice.reducer
