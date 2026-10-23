// TODO: importar Especialidade e CorRisco de packages/shared quando o monorepo existir.
export const ESPECIALIDADES = ['clinica', 'pediatria', 'ortopedia', 'odonto'] as const
export type Especialidade = (typeof ESPECIALIDADES)[number]

export const CORES_RISCO = ['azul', 'verde', 'amarelo', 'laranja', 'vermelho'] as const
export type CorRisco = (typeof CORES_RISCO)[number]

/** Check-in em andamento, guardado só no aparelho (chave ez.checkin). */
export interface CheckinLocal {
  slug: string
  especialidade: Especialidade
  /** Instante de chegada em ISO 8601 (UTC). */
  chegadaEm: string
  risco?: CorRisco
  /** Última vez em que a pessoa confirmou que o tempo está certo (ISO 8601). */
  confirmadoEm?: string
}
