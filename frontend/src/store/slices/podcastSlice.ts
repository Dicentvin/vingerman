import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../utils/api'
import type { PodcastState } from '../../types'

export const generatePodcast = createAsyncThunk(
  'podcast/generate',
  async (data: { materialId?: string; style: string; customText?: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/podcast/generate', data)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to generate podcast')
    }
  }
)

export const fetchMaterials = createAsyncThunk(
  'podcast/materials',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/upload')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to fetch materials')
    }
  }
)

export const uploadMaterial = createAsyncThunk(
  'podcast/upload',
  async (formData: FormData, { rejectWithValue }) => {
    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Upload failed')
    }
  }
)

export const deleteMaterial = createAsyncThunk(
  'podcast/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/upload/${id}`)
      return id
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Delete failed')
    }
  }
)

export const fetchReadableChunks = createAsyncThunk(
  'podcast/chunks',
  async (materialId: string, { rejectWithValue }) => {
    try {
      const res = await api.get(`/upload/${materialId}/chunks`)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to load chunks')
    }
  }
)

export const evaluateReading = createAsyncThunk(
  'podcast/evaluateReading',
  async (data: { originalText: string; spokenText: string; chunkId: number }, { rejectWithValue }) => {
    try {
      const res = await api.post('/upload/evaluate-reading', data)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Evaluation failed')
    }
  }
)

export interface ReadChunk {
  id: number
  text: string
  translation: string
}

export interface ReadingEval {
  score: number
  accuracy: number
  feedback: string
  correction: string
  chunkId: number
}

interface ExtendedPodcastState extends PodcastState {
  readChunks: ReadChunk[]
  readTitle: string
  readLanguage: string
  loadingChunks: boolean
  readingEval: ReadingEval | null
  evaluating: boolean
}

const initialState: ExtendedPodcastState = {
  script: '',
  style: 'educational',
  materials: [],
  selectedMaterial: null,
  loading: false,
  uploading: false,
  error: null,
  readChunks: [],
  readTitle: '',
  readLanguage: 'de',
  loadingChunks: false,
  readingEval: null,
  evaluating: false,
}

const podcastSlice = createSlice({
  name: 'podcast',
  initialState,
  reducers: {
    setStyle: (state, action: PayloadAction<string>) => { state.style = action.payload },
    clearScript: (state) => { state.script = '' },
    clearChunks: (state) => { state.readChunks = []; state.readingEval = null },
    clearEval: (state) => { state.readingEval = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generatePodcast.pending, (state) => { state.loading = true; state.error = null })
      .addCase(generatePodcast.fulfilled, (state, action) => {
        state.loading = false; state.script = action.payload.script
      })
      .addCase(generatePodcast.rejected, (state, action) => {
        state.loading = false; state.error = action.payload as string
      })
      .addCase(uploadMaterial.pending, (state) => { state.uploading = true })
      .addCase(uploadMaterial.fulfilled, (state, action) => {
        state.uploading = false
        state.materials.unshift(action.payload.material)
        state.selectedMaterial = action.payload.material
      })
      .addCase(uploadMaterial.rejected, (state, action) => {
        state.uploading = false; state.error = action.payload as string
      })
      .addCase(fetchMaterials.fulfilled, (state, action) => {
        state.materials = action.payload.materials
      })
      .addCase(deleteMaterial.fulfilled, (state, action) => {
        state.materials = state.materials.filter(m => m._id !== action.payload)
      })
      .addCase(fetchReadableChunks.pending, (state) => {
        state.loadingChunks = true; state.readChunks = []; state.readingEval = null
      })
      .addCase(fetchReadableChunks.fulfilled, (state, action) => {
        state.loadingChunks = false
        state.readChunks = action.payload.chunks
        state.readTitle = action.payload.title
        state.readLanguage = action.payload.language
      })
      .addCase(fetchReadableChunks.rejected, (state) => { state.loadingChunks = false })
      .addCase(evaluateReading.pending, (state) => { state.evaluating = true; state.readingEval = null })
      .addCase(evaluateReading.fulfilled, (state, action) => {
        state.evaluating = false; state.readingEval = action.payload
      })
      .addCase(evaluateReading.rejected, (state) => { state.evaluating = false })
  },
})

export const { setStyle, clearScript, clearChunks, clearEval } = podcastSlice.actions
export default podcastSlice.reducer
