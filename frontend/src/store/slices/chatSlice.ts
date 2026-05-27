import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../utils/api'

export interface ChatMessage {
  _id?: string
  role: 'user' | 'assistant'
  content: string
  correction?: string       // AI-corrected version of user's German
  correctionNote?: string   // brief explanation of what was wrong
  timestamp: string
}

export interface ConversationSession {
  _id: string
  topic: string
  level: string
  messages: ChatMessage[]
  createdAt: string
}

interface ChatState {
  messages: ChatMessage[]
  sessionId: string | null
  topic: string
  level: string
  sessions: ConversationSession[]
  loading: boolean       // AI is replying
  sending: boolean       // message being sent
  error: string | null
}

export const startConversation = createAsyncThunk(
  'chat/start',
  async (payload: { topic: string; level: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/chat/start', payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to start conversation')
    }
  }
)

export const sendMessage = createAsyncThunk(
  'chat/send',
  async (
    payload: { sessionId: string; message: string; level: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await api.post('/chat/message', payload)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed to send message')
    }
  }
)

export const fetchChatSessions = createAsyncThunk(
  'chat/sessions',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/chat/sessions')
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

export const loadSession = createAsyncThunk(
  'chat/loadSession',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      const res = await api.get(`/chat/sessions/${sessionId}`)
      return res.data
    } catch (err: unknown) {
      const e = err as { message?: string }
      return rejectWithValue(e?.message || 'Failed')
    }
  }
)

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    messages: [],
    sessionId: null,
    topic: '',
    level: 'A2',
    sessions: [],
    loading: false,
    sending: false,
    error: null,
  } as ChatState,
  reducers: {
    clearChat: (state) => {
      state.messages = []
      state.sessionId = null
      state.topic = ''
    },
    setLevel: (state, action: PayloadAction<string>) => {
      state.level = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Start conversation
      .addCase(startConversation.pending, (state) => {
        state.loading = true; state.error = null
      })
      .addCase(startConversation.fulfilled, (state, action) => {
        state.loading = false
        state.sessionId = action.payload.sessionId
        state.topic     = action.payload.topic
        state.messages  = [action.payload.opening]
      })
      .addCase(startConversation.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Send message
      .addCase(sendMessage.pending, (state) => { state.sending = true })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sending = false
        // Replace optimistic user message with server version (has correction)
        const withoutLast = state.messages.filter(m => m.role !== 'user' ||
          m.content !== action.payload.userMessage.content)
        state.messages = [
          ...withoutLast,
          action.payload.userMessage,
          action.payload.reply,
        ]
      })
      .addCase(sendMessage.rejected, (state) => { state.sending = false })
      // Sessions list
      .addCase(fetchChatSessions.fulfilled, (state, action) => {
        state.sessions = action.payload.sessions
      })
      // Load a session
      .addCase(loadSession.fulfilled, (state, action) => {
        state.sessionId = action.payload.session._id
        state.topic     = action.payload.session.topic
        state.level     = action.payload.session.level
        state.messages  = action.payload.session.messages
      })
  },
})

export const { clearChat, setLevel } = chatSlice.actions
export default chatSlice.reducer
