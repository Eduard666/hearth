import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcApi, PhotoFilter, ThumbnailProgress, UpdateState } from '../shared/types'

const api: IpcApi = {
  // photos
  importPhotos: (paths, modelId) => ipcRenderer.invoke('photos:import', paths, modelId),
  getPhotos: (filter?: PhotoFilter) => ipcRenderer.invoke('photos:get', filter),
  getPhoto: (id) => ipcRenderer.invoke('photos:getOne', id),
  deletePhoto: (id) => ipcRenderer.invoke('photos:delete', id),
  convertHeic: (photoId) => ipcRenderer.invoke('photos:convertHeic', photoId),
  rebuildThumbnails: () => ipcRenderer.invoke('photos:rebuildThumbnails'),

  // tags
  getTags: () => ipcRenderer.invoke('tags:get'),
  createTag: (name, color) => ipcRenderer.invoke('tags:create', name, color),
  updateTag: (id, name, color) => ipcRenderer.invoke('tags:update', id, name, color),
  deleteTag: (id) => ipcRenderer.invoke('tags:delete', id),

  // posting records
  markPosted: (photoIds, tagId) => ipcRenderer.invoke('posts:mark', photoIds, tagId),
  unmarkPosted: (photoIds, tagId) => ipcRenderer.invoke('posts:unmark', photoIds, tagId),

  // collections
  getCollections: (modelId) => ipcRenderer.invoke('collections:get', modelId),
  createCollection: (modelId, name, description) =>
    ipcRenderer.invoke('collections:create', modelId, name, description),
  updateCollection: (id, name, description) =>
    ipcRenderer.invoke('collections:update', id, name, description),
  deleteCollection: (id) => ipcRenderer.invoke('collections:delete', id),
  addPhotosToCollection: (photoIds, collectionId) =>
    ipcRenderer.invoke('collections:addPhotos', photoIds, collectionId),
  removePhotosFromCollection: (photoIds, collectionId) =>
    ipcRenderer.invoke('collections:removePhotos', photoIds, collectionId),

  // models
  getModels: () => ipcRenderer.invoke('models:get'),
  createModel: (name, description) => ipcRenderer.invoke('models:create', name, description),
  updateModel: (id, name, description) => ipcRenderer.invoke('models:update', id, name, description),
  setModelStatus: (id, status) => ipcRenderer.invoke('models:setStatus', id, status),
  deleteModel: (id) => ipcRenderer.invoke('models:delete', id),
  touchModel: (id) => ipcRenderer.invoke('models:touch', id),
  movePhotosToModel: (photoIds, modelId) =>
    ipcRenderer.invoke('models:movePhotos', photoIds, modelId),

  // notes
  getNotes: (filter) => ipcRenderer.invoke('notes:get', filter),
  getNote: (id) => ipcRenderer.invoke('notes:getOne', id),
  createNote: (data) => ipcRenderer.invoke('notes:create', data),
  updateNote: (id, title, content) => ipcRenderer.invoke('notes:update', id, title, content),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', id),

  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  // file system
  pickFiles: () => ipcRenderer.invoke('fs:pickFiles'),
  pickFolder: () => ipcRenderer.invoke('fs:pickFolder'),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // thumbnails
  onThumbnailProgress: (cb: (progress: ThumbnailProgress) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: ThumbnailProgress): void =>
      cb(progress)
    ipcRenderer.on('thumbnails:progress', handler)
    return () => ipcRenderer.removeListener('thumbnails:progress', handler)
  },

  // window chrome
  setTitleBarTheme: (colors) => ipcRenderer.send('window:setTitleBarTheme', colors),

  // updater
  getUpdateState: () => ipcRenderer.invoke('update:getState'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  onUpdateState: (cb: (state: UpdateState) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: UpdateState): void => cb(state)
    ipcRenderer.on('update:state', handler)
    return () => ipcRenderer.removeListener('update:state', handler)
  },
  installUpdate: () => ipcRenderer.send('install-update')
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: IpcApi
  }
}
