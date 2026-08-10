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
  PhotoAssets,
  Collection,
  Model,
  PlatformDestination,
  UpdateState
} from '../../../shared/types'

/** Sections inside a model's space. There is no view outside a model. */
export type ModelTab = 'photos' | 'collections' | 'notes'

interface AppState {
  photos: Photo[]
  collections: Collection[]
  models: Model[]
  destinations: PlatformDestination[]
  /** The model whose space is open; null means the onboarding/picker screen. */
  activeModelId: number | null
  activeCollectionId: number | null
  activeTab: ModelTab
  workspaceName: string
  selectedPhotoIds: number[]
  update: UpdateState | null
  /** Set when the user dismisses the update toast, so it stops nagging for that version. */
  dismissedUpdateVersion: string | null
  loading: boolean
  /** Whether models have been fetched at least once, so onboarding does not flash. */
  ready: boolean
  /** Progress of the background pass that generates thumbnails; null when idle. */
  thumbnailProgress: { done: number; total: number } | null
}

type AppAction =
  | { type: 'SET_PHOTOS'; payload: Photo[] }
  | { type: 'SET_COLLECTIONS'; payload: Collection[] }
  | { type: 'SET_MODELS'; payload: Model[] }
  | { type: 'SET_DESTINATIONS'; payload: PlatformDestination[] }
  | { type: 'SET_WORKSPACE_NAME'; payload: string }
  | { type: 'OPEN_MODEL'; payload: number }
  | { type: 'CLOSE_MODEL' }
  | { type: 'SET_TAB'; payload: ModelTab }
  | { type: 'SET_COLLECTION'; payload: number | null }
  | { type: 'SELECT_PHOTOS'; payload: number[] }
  | { type: 'TOGGLE_SELECT'; payload: number }
  | { type: 'SELECT_RANGE'; payload: { from: number; to: number; allIds: number[] } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_UPDATE'; payload: UpdateState }
  | { type: 'DISMISS_UPDATE' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_READY' }
  | {
      type: 'THUMBNAIL_PROGRESS'
      payload: { done: number; total: number; photoId?: number; assets?: PhotoAssets }
    }

const initialState: AppState = {
  photos: [],
  collections: [],
  models: [],
  destinations: [],
  activeModelId: null,
  activeCollectionId: null,
  activeTab: 'photos',
  workspaceName: 'My agency',
  selectedPhotoIds: [],
  update: null,
  dismissedUpdateVersion: null,
  loading: false,
  ready: false,
  thumbnailProgress: null
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
    case 'SET_WORKSPACE_NAME':
      return { ...state, workspaceName: action.payload }
    case 'OPEN_MODEL':
      return {
        ...state,
        activeModelId: action.payload,
        activeCollectionId: null,
        activeTab: 'photos',
        selectedPhotoIds: [],
        photos: state.activeModelId === action.payload ? state.photos : []
      }
    case 'CLOSE_MODEL':
      return {
        ...state,
        activeModelId: null,
        activeCollectionId: null,
        photos: [],
        collections: [],
        selectedPhotoIds: []
      }
    case 'SET_TAB':
      return { ...state, activeTab: action.payload }
    case 'SET_COLLECTION':
      return {
        ...state,
        activeCollectionId: action.payload,
        activeTab: 'photos',
        selectedPhotoIds: []
      }
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
    case 'SET_UPDATE':
      return { ...state, update: action.payload }
    case 'DISMISS_UPDATE':
      return { ...state, dismissedUpdateVersion: state.update?.availableVersion ?? null }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_READY':
      return { ...state, ready: true }
    case 'THUMBNAIL_PROGRESS': {
      const { done, total, photoId, assets } = action.payload
      const progress = done >= total ? null : { done, total }
      if (photoId == null || !assets) return { ...state, thumbnailProgress: progress }
      return {
        ...state,
        thumbnailProgress: progress,
        photos: state.photos.map((p) =>
          p.id === photoId
            ? {
                ...p,
                thumbnailPath: assets.thumbnailPath,
                convertedPath: assets.convertedPath,
                width: assets.width,
                height: assets.height
              }
            : p
        )
      }
    }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<AppAction>
  activeModel: Model | null
  loadPhotos: () => Promise<void>
  loadCollections: () => Promise<void>
  loadModels: () => Promise<Model[]>
  loadDestinations: () => Promise<void>
  openModel: (id: number) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { activeModelId, activeCollectionId } = state

  const loadPhotos = useCallback(async () => {
    if (activeModelId == null) {
      dispatch({ type: 'SET_PHOTOS', payload: [] })
      return
    }
    dispatch({ type: 'SET_LOADING', payload: true })
    const photos = await window.api.getPhotos({
      modelId: activeModelId,
      collectionId: activeCollectionId ?? undefined
    })
    dispatch({ type: 'SET_PHOTOS', payload: photos })
  }, [activeModelId, activeCollectionId])

  const loadCollections = useCallback(async () => {
    if (activeModelId == null) {
      dispatch({ type: 'SET_COLLECTIONS', payload: [] })
      return
    }
    const collections = await window.api.getCollections(activeModelId)
    dispatch({ type: 'SET_COLLECTIONS', payload: collections })
  }, [activeModelId])

  const loadModels = useCallback(async () => {
    const models = await window.api.getModels()
    dispatch({ type: 'SET_MODELS', payload: models })
    return models
  }, [])

  const loadDestinations = useCallback(async () => {
    const destinations = await window.api.getDestinations()
    dispatch({ type: 'SET_DESTINATIONS', payload: destinations })
  }, [])

  const openModel = useCallback((id: number) => {
    dispatch({ type: 'OPEN_MODEL', payload: id })
    // Recorded so the next launch reopens whatever was last worked on.
    void window.api.touchModel(id).then(loadModels)
  }, [loadModels])

  // Landing behaviour: resume the most recently opened model, or fall through to the
  // onboarding screen when the workspace has no models at all.
  useEffect(() => {
    void (async () => {
      const [models] = await Promise.all([loadModels(), loadDestinations()])
      const settings = await window.api.getSettings()
      dispatch({ type: 'SET_WORKSPACE_NAME', payload: settings.workspaceName })

      const mostRecent = [...models]
        .filter((m) => m.status === 'active')
        .sort((a, b) => (b.lastOpenedAt ?? b.createdAt).localeCompare(a.lastOpenedAt ?? a.createdAt))[0]

      if (mostRecent) dispatch({ type: 'OPEN_MODEL', payload: mostRecent.id })
      dispatch({ type: 'SET_READY' })
    })()
  }, [])

  useEffect(() => {
    void loadPhotos()
  }, [loadPhotos])

  useEffect(() => {
    void loadCollections()
  }, [loadCollections])

  useEffect(() => {
    void window.api.getUpdateState().then((update) => dispatch({ type: 'SET_UPDATE', payload: update }))

    const offUpdate = window.api.onUpdateState((update) =>
      dispatch({ type: 'SET_UPDATE', payload: update })
    )
    const offThumbs = window.api.onThumbnailProgress((progress) =>
      dispatch({ type: 'THUMBNAIL_PROGRESS', payload: progress })
    )
    return () => {
      offUpdate()
      offThumbs()
    }
  }, [])

  const activeModel = state.models.find((m) => m.id === state.activeModelId) ?? null

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        activeModel,
        loadPhotos,
        loadCollections,
        loadModels,
        loadDestinations,
        openModel
      }}
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
