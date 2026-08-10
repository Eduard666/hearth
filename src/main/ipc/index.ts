import { registerPhotoHandlers } from './photos'
import { registerCollectionHandlers } from './collections'
import { registerModelHandlers } from './models'
import { registerNoteHandlers } from './notes'
import { registerSettingsHandlers } from './settings'
import { registerFileSystemHandlers } from './filesystem'
import { registerTagHandlers } from './tags'

export function registerIpcHandlers(): void {
  registerPhotoHandlers()
  registerCollectionHandlers()
  registerModelHandlers()
  registerTagHandlers()
  registerNoteHandlers()
  registerSettingsHandlers()
  registerFileSystemHandlers()
}
