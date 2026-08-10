import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
  type Dispatch
} from 'react'
import type {
  Photo,
  Collection,
  Model,
  PlatformDestination,
  Note,
  PhotoFilter,
  UpdateInfo
} from '../../../shared/types'

interface AppState {
  photos: Photo[]
  collections: Collection[]
  models: Model[]
  destinations: PlatformDestination[]
  notes: Note[]
  selectedPhotoIds: number[]
  activeFilter: PhotoFilter
  activeView: 'gallery' | 'notes'
  activeNoteId: number | null
  updateInfo: UpdateInfo | null
  updateDownloaded: boolean
  loading: boolean
}

type AppAction =
  | { type: 'SET_PHOTOS'; payload: Photo[] }
  | { type: 'SET_COLLECTIONS'; payload: Collection[] }
  | { type: 'SET_MODELS'; payload: Model[] }
  | { type: 'SET_DESTINATIONS'; payload: PlatformDestination[] }
  | { type: 'SET_NOTES'; payload: Note[] }
  | { type: 'SELECT_PHOTOS'; payload: number[] }
  | { type: 'TOGGLE_SELECT'; payload: number }
  | { type: 'SELECT_RANGE'; payload: { from: number; to: number; allIds: number[] } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_FILTER'; payload: PhotoFilter }
  | { type: 'SET_VIEW'; payload: 'gallery' | 'notes' }
  | { type: 'SET_ACTIVE_NOTE'; payload: number | null }
  | { type: 'SET_UPDATE_AVAILABLE'; payload: UpdateInfo }
  | { type: 'SET_UPDATE_DOWNLOADED'; payload: UpdateInfo }
  | { type: 'DISMISS_UPDATE' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'UPDATE_PHOTO'; payload: Photo }
  | { type: 'REMOVE_PHOTO'; payload: number }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'REMOVE_NOTE'; payload: number }

const initialState: AppState = {
  photos: [],
  collections: [],
  models: [],
  destinations: [],
  notes: [],
  selectedPhotoIds: [],
  activeFilter: {},
  activeView: 'gallery',
  activeNoteId: null,
  updateInfo: null,
  updateDownloaded: false,
  loading: false
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PHOTOS':
      return { ...state, photos: action.payload, loading: false }
    case 'SET_COLLECTIONS':
      return { ...state, collections: action.payload }
    case 'SET_MODELS':
      return { ...state, models: action.payload }
    case 'SET_DESTINATIONS':
      return { ...state, destinations: action.payload }
    case 'SET_NOTES':
      return { ...state, notes: action.payload }
    case 'SELECT_PHOTOS':
      return { ...state, selectedPhotoIds: action.payload }
    case 'TOGGLE_SELECT': {
      const id = action.payload
      const sel = state.selectedPhotoIds
      return {
        ...state,
        selectedPhotoIds: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]
      }
    }
    case 'SELECT_RANGE': {
      const { from, to, allIds } = action.payload
      const fi = allIds.indexOf(from)
      const ti = allIds.indexOf(to)
      if (fi === -1 || ti === -1) return state
      const start = Math.min(fi, ti)
      const end = Math.max(fi, ti)
      return { ...state, selectedPhotoIds: allIds.slice(start, end + 1) }
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedPhotoIds: [] }
    case 'SET_FILTER':
      return { ...state, activeFilter: action.payload, selectedPhotoIds: [] }
    case 'SET_VIEW':
      return { ...state, activeView: action.payload }
    case 'SET_ACTIVE_NOTE':
      return { ...state, activeNoteId: action.payload }
    case 'SET_UPDATE_AVAILABLE':
      return { ...state, updateInfo: action.payload }
    case 'SET_UPDATE_DOWNLOADED':
      return { ...state, updateInfo: action.payload, updateDownloaded: true }
    case 'DISMISS_UPDATE':
      return { ...state, updateInfo: null, updateDownloaded: false }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'UPDATE_PHOTO':
      return {
        ...state,
        photos: state.photos.map((p) => (p.id === action.payload.id ? action.payload : p))
      }
    case 'REMOVE_PHOTO':
      return { ...state, photos: state.photos.filter((p) => p.id !== action.payload) }
    case 'ADD_NOTE':
      return { ...state, notes: [action.payload, ...state.notes] }
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.payload.id ? action.payload : n))
      }
    case 'REMOVE_NOTE':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.payload) }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<AppAction>
  loadPhotos: () => Promise<void>
  loadCollections: () => Promise<void>
  loadModels: () => Promise<void>
  loadDestinations: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadPhotos = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    const photos = await window.api.getPhotos(state.activeFilter)
    dispatch({ type: 'SET_PHOTOS', payload: photos })
  }, [state.activeFilter])

  const loadCollections = useCallback(async () => {
    const collections = await window.api.getCollections()
    dispatch({ type: 'SET_COLLECTIONS', payload: collections })
  }, [])

  const loadModels = useCallback(async () => {
    const models = await window.api.getModels()
    dispatch({ type: 'SET_MODELS', payload: models })
  }, [])

  const loadDestinations = useCallback(async () => {
    const destinations = await window.api.getDestinations()
    dispatch({ type: 'SET_DESTINATIONS', payload: destinations })
  }, [])

  useEffect(() => {
    loadPhotos()
    loadCollections()
    loadModels()
    loadDestinations()
  }, [])

  useEffect(() => {
    loadPhotos()
  }, [state.activeFilter])

  useEffect(() => {
    const offAvail = window.api.onUpdateAvailable((info) =>
      dispatch({ type: 'SET_UPDATE_AVAILABLE', payload: info })
    )
    const offDl = window.api.onUpdateDownloaded((info) =>
      dispatch({ type: 'SET_UPDATE_DOWNLOADED', payload: info })
    )
    return () => {
      offAvail()
      offDl()
    }
  }, [])

  return (
    <AppContext.Provider
      value={{ state, dispatch, loadPhotos, loadCollections, loadModels, loadDestinations }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
