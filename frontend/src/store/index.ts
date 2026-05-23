import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import podcastReducer from './slices/podcastSlice'
import translateReducer from './slices/translateSlice'
import pronounceReducer from './slices/pronounceSlice'
import vocabReducer from './slices/vocabSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    podcast: podcastReducer,
    translate: translateReducer,
    pronounce: pronounceReducer,
    vocab: vocabReducer,
  },
})

export type AppDispatch = typeof store.dispatch
export type AppRootState = ReturnType<typeof store.getState>
export default store
