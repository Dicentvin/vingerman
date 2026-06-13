import { configureStore } from '@reduxjs/toolkit'
import authReducer       from './slices/authSlice'
import podcastReducer    from './slices/podcastSlice'
import translateReducer  from './slices/translateSlice'
import pronounceReducer  from './slices/pronounceSlice'
import vocabReducer      from './slices/vocabSlice'
import readAloudReducer  from './slices/readAloudSlice'
import writingReducer    from './slices/writingSlice'
import flashcardReducer  from './slices/flashcardSlice'
import chatReducer       from './slices/chatSlice'
import challengeReducer  from './slices/challengeSlice'
import grammarReducer    from './slices/grammarSlice'
import storyReducer      from './slices/storySlice'

export const store = configureStore({
  reducer: {
    auth:       authReducer,
    podcast:    podcastReducer,
    translate:  translateReducer,
    pronounce:  pronounceReducer,
    vocab:      vocabReducer,
    readAloud:  readAloudReducer,
    writing:    writingReducer,
    flashcard:  flashcardReducer,
    chat:       chatReducer,
    challenge:  challengeReducer,
    grammar:    grammarReducer,
    story:      storyReducer,
  },
})

export type AppDispatch  = typeof store.dispatch
export type AppRootState = ReturnType<typeof store.getState>
export default store
