import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../utils/api'
import type { AuthState, User } from '../../types'

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const registerUser = createAsyncThunk(
  'auth/register',
  async (payload: { name: string; email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/register', payload)
      localStorage.setItem('token', res.data.token)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Registration failed')
    }
  }
)

export const loginUser = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/login', payload)
      localStorage.setItem('token', res.data.token)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Login failed')
    }
  }
)

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  localStorage.removeItem('token')
})

export const restoreSession = createAsyncThunk(
  'auth/restore',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return rejectWithValue('No token')
      const res = await api.get('/auth/me')
      return { user: res.data.user }
    } catch {
      localStorage.removeItem('token')
      return rejectWithValue('Session expired')
    }
  }
)

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data: Partial<User>, { rejectWithValue }) => {
    try {
      const res = await api.put('/auth/profile', data)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Update failed')
    }
  }
)

// ─── Slice ────────────────────────────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  error: null,
  initialized: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null },
    setUser: (state, action: PayloadAction<User | null>) => { state.user = action.payload },
  },
  extraReducers: (builder) => {
    const pending = (state: AuthState) => { state.loading = true; state.error = null }
    const rejected = (state: AuthState, action: { payload: unknown }) => {
      state.loading = false
      state.error = action.payload as string
    }

    builder
      .addCase(registerUser.pending, pending)
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.token = action.payload.token
      })
      .addCase(registerUser.rejected, rejected)

      .addCase(loginUser.pending, pending)
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.token = action.payload.token
      })
      .addCase(loginUser.rejected, rejected)

      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.initialized = true
      })

      .addCase(restoreSession.pending, (state) => { state.loading = true })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.initialized = true
      })
      .addCase(restoreSession.rejected, (state) => {
        state.loading = false
        state.initialized = true
        state.user = null
        state.token = null
      })

      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload.user
      })
  },
})

export const { clearError, setUser } = authSlice.actions
export default authSlice.reducer
