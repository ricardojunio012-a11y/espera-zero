// TODO(T13/T14): trocar pelas funções do shared quando existirem.
import type { Alerta } from './tipos-provisorios'

export const JANELA_MS = 1_800_000

/** Número da janela de 30 min em que `epochMs` cai (parte do id do check-in). */
export function janelaDe(epochMs: number): number {
  return Math.floor(epochMs / JANELA_MS)
}

/** RN-10/11: não expirado e contestações abaixo de confirmações + 3. */
export function alertaAtivo(a: Alerta, agoraMs: number): boolean {
  return Date.parse(a.expiraEm) > agoraMs && a.contestacoes < a.confirmacoes + 3
}
