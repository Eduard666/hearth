/// <reference types="vite/client" />

import type { JSX as ReactJSX } from 'react'
import type { IpcApi } from '../../shared/types'

declare global {
  /** Exposed by the preload bridge via contextBridge. */
  interface Window {
    api: IpcApi
  }

  /**
   * React 19 moved JSX types under the React namespace. The components here use the
   * classic global `JSX.Element` return type, so map it back onto React's.
   */
  namespace JSX {
    type Element = ReactJSX.Element
    type ElementClass = ReactJSX.ElementClass
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>
    type IntrinsicElements = ReactJSX.IntrinsicElements
  }
}

export {}
