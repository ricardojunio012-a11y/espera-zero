import { ServicoErro } from '../contrato-servicos'
import type { DiaSemana, Especialidade } from '../tipos-provisorios'

export const ESPECIALIDADES: Especialidade[] = ['clinica', 'pediatria', 'ortopedia', 'odonto']
export const TIPOS_ALERTA = [
  'tem-profissional',
  'sem-profissional',
  'raio-x',
  'fila',
  'farmacia',
  'outro',
] as const
export const CORES_RISCO = ['azul', 'verde', 'amarelo', 'laranja', 'vermelho'] as const
export const MODOS = ['24h', 'horario', 'nao'] as const
export const DIAS_VALIDOS: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

export const MAX_TEXTO_ALERTA = 120
export const MIN_MINUTOS = 0
export const MAX_MINUTOS = 360
export const CONFIRMACOES_PARA_VIGORAR = 3

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export function recusar(mensagem: string): never {
  throw new ServicoErro('validacao', mensagem)
}

export function exigirEm<T extends string>(lista: readonly T[], valor: unknown, nome: string): T {
  if (!lista.includes(valor as T)) recusar(`${nome} inválido.`)
  return valor as T
}

export function exigirHora(valor: unknown, nome: string): string {
  if (typeof valor !== 'string' || !HORA.test(valor)) recusar(`${nome} deve ser HH:MM.`)
  return valor
}
