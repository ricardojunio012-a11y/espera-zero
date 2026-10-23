import type { AgendaPorUnidade, Alerta, Checkin, CorRisco, Especialidade, Unidade } from '@espera-zero/shared'
import { servicosMock } from './mock'

/**
 * Everything the screens read goes through here (plano de trabalho, seção 6):
 * a tela nunca fala com o Firestore. VITE_DATA_SOURCE picks the implementation.
 */
export interface Painel {
  unidades: Unidade[]
  /** Completed check-ins of the last 2 hours, every UPA and specialty. */
  checkins: Checkin[]
  agendas: AgendaPorUnidade
  alertas: Alerta[]
  /** True while the numbers are simulated, so the screen can say so (RN-24). */
  simulado: boolean
}

export interface NovoCheckin {
  slug: string
  especialidade: Especialidade
  /** Whole wait, arrival to being seen (RN-13). */
  minutos: number
  risco?: CorRisco
}

export interface Servicos {
  carregarPainel(agora: Date): Promise<Painel>
  registrarCheckin(novo: NovoCheckin): Promise<void>
}

// The Firebase SDK is loaded only when Firestore is the source, so the mock
// build stays light on a slow 4G connection (RNF-01).
function servicosFirestore(): Servicos {
  const pronto = import('./firestore').then((m) => m.criarServicosFirestore())
  return {
    carregarPainel: (agora) => pronto.then((s) => s.carregarPainel(agora)),
    registrarCheckin: (novo) => pronto.then((s) => s.registrarCheckin(novo)),
  }
}

let servicos: Servicos | null = null

export function obterServicos(): Servicos {
  servicos ??= import.meta.env.VITE_DATA_SOURCE === 'firestore' ? servicosFirestore() : servicosMock
  return servicos
}
