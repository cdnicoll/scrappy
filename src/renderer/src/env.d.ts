/// <reference types="vite/client" />
import type { ScrappyApi } from '../../shared/ipc'

declare global {
  interface Window {
    scrappy: ScrappyApi
  }
}
