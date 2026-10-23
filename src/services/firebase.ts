import { initializeApp } from 'firebase/app'
import type { FirebaseApp, FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

export interface ConexaoFirebase {
  app: FirebaseApp
  db: Firestore
  auth: Auth
}

const usarEmulador = import.meta.env.VITE_USE_EMULATOR === 'true'

/**
 * Explicit VITE_FIREBASE_* wins; otherwise Firebase Hosting serves the
 * project's web config at /__/firebase/init.json, so production needs no keys
 * in the repository.
 */
async function lerConfiguracao(): Promise<FirebaseOptions> {
  const env = import.meta.env
  if (env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY || 'demo-api-key',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    }
  }
  const resposta = await fetch('/__/firebase/init.json')
  if (!resposta.ok) throw new Error('Configuração do Firebase indisponível.')
  return resposta.json()
}

let conexao: Promise<ConexaoFirebase> | null = null

export function conectar(): Promise<ConexaoFirebase> {
  conexao ??= lerConfiguracao().then((config) => {
    const app = initializeApp(config)
    const db = getFirestore(app)
    const auth = getAuth(app)
    if (usarEmulador) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080)
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    }
    return { app, db, auth }
  })
  return conexao
}

/** ADR-005: one anonymous uid per device, no e-mail or phone. */
export async function garantirUid(auth: Auth): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid
  const credencial = await signInAnonymously(auth)
  return credencial.user.uid
}
