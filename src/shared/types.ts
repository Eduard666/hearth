export interface Photo {
  id: number
  filePath: string
  sha256: string
  perceptualHash: string
  width: number
  height: number
  fileSize: number
  importDate: string
  tags: string[]
  collectionIds: number[]
  modelIds: number[]
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
  name: string
  description: string | null
  createdAt: string
  photoCount: number
}

export interface Model {
  id: number
  name: string
  description: string | null
  createdAt: string
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

export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children: FileTreeNode[]
  photoCount?: number
}

export interface UpdateInfo {
  version: string
  releaseNotes: string
}

export type IpcApi = {
  // photos
  importPhotos: (paths: string[]) => Promise<ImportResult>
  getPhotos: (filter?: PhotoFilter) => Promise<Photo[]>
  getPhoto: (id: number) => Promise<Photo | null>
  deletePhoto: (id: number) => Promise<void>
  convertHeic: (photoId: number, format: 'jpeg' | 'png') => Promise<Photo>

  // tags
  addTag: (photoIds: number[], tag: string) => Promise<void>
  removeTag: (photoIds: number[], tag: string) => Promise<void>
  getAllTags: () => Promise<string[]>

  // platform status
  setPosted: (photoIds: number[], destinationId: number, posted: boolean) => Promise<void>
  getDestinations: () => Promise<PlatformDestination[]>
  addDestination: (name: string, color: string) => Promise<PlatformDestination>
  deleteDestination: (id: number) => Promise<void>

  // collections
  getCollections: () => Promise<Collection[]>
  createCollection: (name: string, description?: string) => Promise<Collection>
  updateCollection: (id: number, name: string, description?: string) => Promise<void>
  deleteCollection: (id: number) => Promise<void>
  addPhotosToCollection: (photoIds: number[], collectionId: number) => Promise<void>
  removePhotosFromCollection: (photoIds: number[], collectionId: number) => Promise<void>

  // models
  getModels: () => Promise<Model[]>
  createModel: (name: string, description?: string) => Promise<Model>
  updateModel: (id: number, name: string, description?: string) => Promise<void>
  deleteModel: (id: number) => Promise<void>
  addPhotosToModel: (photoIds: number[], modelId: number) => Promise<void>
  removePhotosFromModel: (photoIds: number[], modelId: number) => Promise<void>

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
  getFileTree: (rootPath?: string) => Promise<FileTreeNode[]>

  // updater
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => () => void
  onUpdateDownloaded: (cb: (info: UpdateInfo) => void) => () => void
  installUpdate: () => void
  dismissUpdate: () => void
}

export interface PhotoFilter {
  collectionId?: number
  modelId?: number
  tags?: string[]
  folderPath?: string
  search?: string
}
