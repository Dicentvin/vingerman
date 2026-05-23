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

const initialState: PodcastState = {
  script: '',
  style: 'educational',
  materials: [],
  selectedMaterial: null,
  loading: false,
  uploading: false,
  error: null,
}

const podcastSlice = createSlice({
  name: 'podcast',
  initialState,
  reducers: {
    setStyle: (state, action: PayloadAction<string>) => { state.style = action.payload },
    clearScript: (state) => { state.script = '' },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generatePodcast.pending, (state) => { state.loading = true; state.error = null })
      .addCase(generatePodcast.fulfilled, (state, action) => {
        state.loading = false
        state.script = action.payload.script
      })
      .addCase(generatePodcast.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(uploadMaterial.pending, (state) => { state.uploading = true })
      .addCase(uploadMaterial.fulfilled, (state, action) => {
        state.uploading = false
        state.materials.unshift(action.payload.material)
        state.selectedMaterial = action.payload.material
      })
      .addCase(uploadMaterial.rejected, (state, action) => {
        state.uploading = false
        state.error = action.payload as string
      })
      .addCase(fetchMaterials.fulfilled, (state, action) => {
        state.materials = action.payload.materials
      })
  },
})

export const { setStyle, clearScript } = podcastSlice.actions
export default podcastSlice.reducer
