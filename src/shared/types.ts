export interface Photo {
  id: number
  /** A photo belongs to exactly one model - there is no library-wide photo pool. */
  modelId: number
  filePath: string
  sha256: string
  perceptualHash: string
  width: number
  height: number
  fileSize: number
  importDate: string
  tags: string[]
  collectionIds: number[]
  platformStatuses: PlatformStatus[]
  thumbnailPath: string | null
  originalExt: string
  convertedPath: string | null
}

export interface PlatformStatus {
  destinationId: number
  destinationName: string
  posted: boolean
  postedAt: string | null
}

export interface PlatformDestination {
  id: number
  name: string
  color: string
  icon: string
}

export interface Collection {
  id: number
  /** Collections group photos inside one model's space, never across models. */
  modelId: number
  name: string
  description: string | null
  createdAt: string
  photoCount: number
}

export type ModelStatus = 'active' | 'archived'

export interface Model {
  id: number
  name: string
  description: string | null
  createdAt: string
  lastOpenedAt: string | null
  status: ModelStatus
  photoCount: number
}

export interface Note {
  id: number
  title: string
  content: string
  collectionId: number | null
  modelId: number | null
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  importMode: 'copy' | 'reference'
  autoConvertHeic: boolean
  heicOutputFormat: 'jpeg' | 'png'
  theme: 'light' | 'dark' | 'system'
  nearDuplicateThreshold: number
  workspaceName: string
}

export interface ImportResult {
  imported: number
  skipped: number
  duplicates: DuplicateInfo[]
  nearDuplicates: NearDuplicateInfo[]
  heicFiles: string[]
}

export interface DuplicateInfo {
  incoming: string
  existing: Photo
}

export interface NearDuplicateInfo {
  incoming: string
  existing: Photo
  distance: number
}

export interface UpdateInfo {
  version: string
  releaseNotes: string
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  /** Version of the running app, shown in the title bar. */
  currentVersion: string
  availableVersion?: string
  releaseNotes?: string
  percent?: number
  error?: string
}

/** Derived files Hearth generates so a photo can actually be displayed. */
export interface PhotoAssets {
  thumbnailPath: string
  convertedPath: string | null
  width: number
  height: number
}

export interface ThumbnailProgress {
  done: number
  total: number
  photoId?: number
  assets?: PhotoAssets
}

export type IpcApi = {
  // photos - always scoped to a model
  importPhotos: (paths: string[], modelId: number) => Promise<ImportResult>
  getPhotos: (filter?: PhotoFilter) => Promise<Photo[]>
  getPhoto: (id: number) => Promise<Photo | null>
  deletePhoto: (id: number) => Promise<void>
  convertHeic: (photoId: number) => Promise<Photo>
  rebuildThumbnails: () => Promise<void>

  // tags
  addTag: (photoIds: number[], tag: string) => Promise<void>
  removeTag: (photoIds: number[], tag: string) => Promise<void>
  getAllTags: () => Promise<string[]>

  // platform status
  setPosted: (photoIds: number[], destinationId: number, posted: boolean) => Promise<void>
  getDestinations: () => Promise<PlatformDestination[]>
  addDestination: (name: string, color: string) => Promise<PlatformDestination>
  deleteDestination: (id: number) => Promise<void>

  // collections - scoped to one model
  getCollections: (modelId?: number) => Promise<Collection[]>
  createCollection: (modelId: number, name: string, description?: string) => Promise<Collection>
  updateCollection: (id: number, name: string, description?: string) => Promise<void>
  deleteCollection: (id: number) => Promise<void>
  addPhotosToCollection: (photoIds: number[], collectionId: number) => Promise<void>
  removePhotosFromCollection: (photoIds: number[], collectionId: number) => Promise<void>

  // models
  getModels: () => Promise<Model[]>
  createModel: (name: string, description?: string) => Promise<Model>
  updateModel: (id: number, name: string, description?: string) => Promise<void>
  setModelStatus: (id: number, status: ModelStatus) => Promise<void>
  deleteModel: (id: number) => Promise<void>
  touchModel: (id: number) => Promise<void>
  /** Reassigns photos to a different model - the fix for a mis-targeted import. */
  movePhotosToModel: (photoIds: number[], modelId: number) => Promise<void>

  // notes
  getNotes: (filter?: { collectionId?: number; modelId?: number }) => Promise<Note[]>
  getNote: (id: number) => Promise<Note | null>
  createNote: (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Note>
  updateNote: (id: number, title: string, content: string) => Promise<Note>
  deleteNote: (id: number) => Promise<void>

  // settings
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>

  // file system
  pickFiles: () => Promise<string[]>
  pickFolder: () => Promise<string | null>
  /** Electron 32+ removed `File.path`; drag-and-drop must resolve paths through webUtils. */
  getPathForFile: (file: File) => string

  // thumbnails
  onThumbnailProgress: (cb: (progress: ThumbnailProgress) => void) => () => void

  // window chrome
  setTitleBarTheme: (theme: 'light' | 'dark') => void

  // updater
  getUpdateState: () => Promise<UpdateState>
  checkForUpdates: () => Promise<UpdateState>
  onUpdateState: (cb: (state: UpdateState) => void) => () => void
  installUpdate: () => void
}

export interface PhotoFilter {
  /** Required in practice - photos are only reachable through their model. */
  modelId?: number
  collectionId?: number
  tags?: string[]
  search?: string
}
