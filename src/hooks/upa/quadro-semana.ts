import { ptBR } from '../../i18n/pt-BR'
import type {
  AgendaDia,
  DiaSemana,
  Especialidade,
  HorarioEspecialidade,
} from '../../services/tipos-provisorios'

/** Ordem das linhas na tela da UPA (tela 11 do Figma). */
export const ESPECIALIDADES_ORDEM: Especialidade[] = ['clinica', 'pediatria', 'ortopedia', 'odonto']

/** A agenda do contrato vai de dom a sab; o quadro do Figma começa na segunda. */
export const DIAS_SEG_A_DOM: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
const DIAS_DOM_A_SAB: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

/** Dia da semana no relógio LOCAL do aparelho (getDay: 0 = domingo). */
export const diaDe = (agora: Date): DiaSemana => DIAS_DOM_A_SAB[agora.getDay()]

export const horarioDoDia = (
  agenda: AgendaDia[],
  dia: DiaSemana,
  especialidade: Especialidade,
): HorarioEspecialidade | undefined => agenda.find((d) => d.dia === dia)?.horarios[especialidade]

export const atendeNoDia = (agenda: AgendaDia[], dia: DiaSemana, especialidade: Especialidade) => {
  const h = horarioDoDia(agenda, dia, especialidade)
  return h !== undefined && h !== 'nao'
}

/** "07:00" -> "7h"; "07:30" -> "7h30". */
export function horaCurta(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/** "24 horas" ou "7h às 19h". Sem horário (ou 'nao'): null. */
export function textoHorario(horario: HorarioEspecialidade | undefined): string | null {
  if (horario === undefined || horario === 'nao') return null
  if (horario === '24h') return ptBR.horario24h
  return ptBR.horarioDeAte(horaCurta(horario.de), horaCurta(horario.ate))
}

const minutoDoDia = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Quando a especialidade volta a atender, para a linha "Abre às 7h" (UPA fechada agora):
 * hoje mais tarde, ou amanhã. Sem próxima abertura conhecida: null.
 */
export function abreQuando(
  agenda: AgendaDia[],
  especialidade: Especialidade,
  agora: Date,
): string | null {
  const hoje = horarioDoDia(agenda, diaDe(agora), especialidade)
  const minuto = agora.getHours() * 60 + agora.getMinutes()
  if (typeof hoje === 'object' && minuto < minutoDoDia(hoje.de)) {
    return ptBR.abreAs(horaCurta(hoje.de))
  }
  const amanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1)
  const horarioAmanha = horarioDoDia(agenda, diaDe(amanha), especialidade)
  if (typeof horarioAmanha === 'object') return ptBR.abreAmanha(horaCurta(horarioAmanha.de))
  return null
}

function nomeDosDias(dias: DiaSemana[]): string {
  const extenso = dias.map((d) => ptBR.diaExtenso[d])
  if (dias.length === 7) return ptBR.upa.quadro.todosOsDias
  const posicoes = dias.map((d) => DIAS_SEG_A_DOM.indexOf(d))
  const seguidos = posicoes.every((p, i) => i === 0 || p === posicoes[i - 1] + 1)
  if (seguidos && dias.length >= 3) return `${extenso[0]} a ${extenso[extenso.length - 1]}`
  if (extenso.length === 1) return extenso[0]
  return `${extenso.slice(0, -1).join(', ')} e ${extenso[extenso.length - 1]}`
}

/** "segunda a sexta, 7h às 19h"; null se a especialidade não atende em nenhum dia. */
export function resumoEspecialidade(agenda: AgendaDia[], especialidade: Especialidade): string | null {
  const dias = DIAS_SEG_A_DOM.filter((d) => atendeNoDia(agenda, d, especialidade))
  if (dias.length === 0) return null
  const horarios = new Set(dias.map((d) => textoHorario(horarioDoDia(agenda, d, especialidade))))
  const horario = horarios.size === 1 ? [...horarios][0] : ptBR.upa.quadro.horariosVariam
  return `${nomeDosDias(dias)}, ${horario}`
}

/** RN-20: "montado pela comunidade e confirmado por N pessoas; não é informação oficial". */
export function textoOrigemDoQuadro(confirmacoes: number): string {
  const q = ptBR.upa.quadro
  return `${confirmacoes > 0 ? q.confirmada(confirmacoes) : q.semConfirmacoes} ${q.oficial}`
}
