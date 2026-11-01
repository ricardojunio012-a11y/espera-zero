import type { Servicos } from './contrato-servicos'
import { criarServicosFirestore } from './firestore'
import { criarServicosMock } from './mock'

/** Latência do mock no navegador, para a interface mostrar o estado de carregamento. */
const LATENCIA_DEV_MS = 300

export function criarServicosPadrao(): Servicos {
  const fonte = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
  if (fonte === 'mock') return criarServicosMock({ latenciaMs: LATENCIA_DEV_MS })
  if (fonte === 'firestore') return criarServicosFirestore()
  throw new Error(`VITE_DATA_SOURCE inválido: "${fonte}". Use "mock" ou "firestore".`)
}
