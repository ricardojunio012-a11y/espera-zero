/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `mock` (default) or `firestore`. */
  readonly VITE_DATA_SOURCE?: string
  readonly VITE_USE_EMULATOR?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
