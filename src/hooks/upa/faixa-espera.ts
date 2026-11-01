export type FaixaEspera = 'curta' | 'media' | 'longa'

// TODO(T15): limites estimados a partir do protótipo (30 min verde, 50 min âmbar); confirmar com o Victor.
const LIMITE_CURTA_MIN = 30
const LIMITE_MEDIA_MIN = 60
/** Espera que enche a barra por completo (no Figma, 50 min enchem cerca de um terço). */
const ESCALA_BARRA_MIN = 150

export function faixaDeEspera(minutos: number): FaixaEspera {
  if (minutos <= LIMITE_CURTA_MIN) return 'curta'
  if (minutos <= LIMITE_MEDIA_MIN) return 'media'
  return 'longa'
}

/** Quanto da barra preencher, de 0 a 1. */
export function preenchimentoDaBarra(minutos: number): number {
  return Math.min(1, Math.max(0, minutos / ESCALA_BARRA_MIN))
}
