import type { AgendaPorUnidade, Alerta, Checkin, Unidade } from '@espera-zero/shared'
import { servicosMock } from './mock'

/**
 * Everything the screens read goes through here (plano de trabalho, seção 6):
 * a tela nunca fala com o Firestore. The Firestore implementation plugs in
 * behind the same interface, switched by VITE_DATA_SOURCE.
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

export interface Servicos {
  carregarPainel(agora: Date): Promise<Painel>
}

export function obterServicos(): Servicos {
  return servicosMock
}
