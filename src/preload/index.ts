import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi, PhotoFilter, UpdateInfo } from '../shared/types'

const api: IpcApi = {
  // photos
  importPhotos: (paths) => ipcRenderer.invoke('photos:import', paths),
  getPhotos: (filter?: PhotoFilter) => ipcRenderer.invoke('photos:get', filter),
  getPhoto: (id) => ipcRenderer.invoke('photos:getOne', id),
  deletePhoto: (id) => ipcRenderer.invoke('photos:delete', id),
  convertHeic: (photoId, format) => ipcRenderer.invoke('photos:convertHeic', photoId, format),

  // tags
  addTag: (photoIds, tag) => ipcRenderer.invoke('tags:add', photoIds, tag),
  removeTag: (photoIds, tag) => ipcRenderer.invoke('tags:remove', photoIds, tag),
  getAllTags: () => ipcRenderer.invoke('tags:getAll'),

  // platform status
  setPosted: (photoIds, destinationId, posted) =>
    ipcRenderer.invoke('platform:setPosted', photoIds, destinationId, posted),
  getDestinations: () => ipcRenderer.invoke('platform:getDestinations'),
  addDestination: (name, color) => ipcRenderer.invoke('platform:addDestination', name, color),
  deleteDestination: (id) => ipcRenderer.invoke('platform:deleteDestination', id),

  // collections
  getCollections: () => ipcRenderer.invoke('collections:get'),
  createCollection: (name, description) =>
    ipcRenderer.invoke('collections:create', name, description),
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
  deleteModel: (id) => ipcRenderer.invoke('models:delete', id),
  addPhotosToModel: (photoIds, modelId) =>
    ipcRenderer.invoke('models:addPhotos', photoIds, modelId),
  removePhotosFromModel: (photoIds, modelId) =>
    ipcRenderer.invoke('models:removePhotos', photoIds, modelId),

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
  getFileTree: (rootPath) => ipcRenderer.invoke('fs:getFileTree', rootPath),

  // updater
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: UpdateInfo): void => cb(info)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },
  onUpdateDownloaded: (cb: (info: UpdateInfo) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: UpdateInfo): void => cb(info)
    ipcRenderer.on('update-downloaded', handler)
    return () => ipcRenderer.removeListener('update-downloaded', handler)
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  dismissUpdate: () => {}
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: IpcApi
  }
}
