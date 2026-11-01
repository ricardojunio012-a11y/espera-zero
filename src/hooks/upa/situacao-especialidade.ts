import { alertaAtivo, atendeAgora } from '../../services/regras-provisorias'
import type {
  AgendaDia,
  Alerta,
  Especialidade,
  HorarioEspecialidade,
  Unidade,
} from '../../services/tipos-provisorios'
import { diaDe, horarioDoDia } from './quadro-semana'

export type Situacao = 'atende' | 'nao-atende' | 'fechado'

/** Horário da especialidade na agenda de hoje (dia da semana do relógio local). */
export function horarioDeHoje(
  agenda: AgendaDia[],
  especialidade: Especialidade,
  agora: Date,
): HorarioEspecialidade | undefined {
  return horarioDoDia(agenda, diaDe(agora), especialidade)
}

/**
 * Situação de uma especialidade agora:
 * - 'nao-atende': a UPA não oferece, a agenda de hoje diz 'nao'/não tem linha, ou há aviso
 *   ativo "sem profissional" (RN-18);
 * - 'atende': aviso ativo "tem profissional" (vale mesmo fora do quadro, RN-18) ou dentro do horário;
 * - 'fechado': tem horário hoje, mas agora está fora dele.
 * Aviso sem especialidade vale para todas. Com os dois tipos ativos, vale o mais recente
 * (precedência ainda em aberto no contrato).
 */
export function situacaoEspecialidade(args: {
  unidade: Unidade
  agenda: AgendaDia[]
  alertas: Alerta[]
  especialidade: Especialidade
  agora: Date
}): Situacao {
  const { unidade, agenda, alertas, especialidade, agora } = args
  if (!unidade.especialidades.includes(especialidade)) return 'nao-atende'

  const aviso = alertas
    .filter(
      (a) =>
        (a.tipo === 'sem-profissional' || a.tipo === 'tem-profissional') &&
        (a.especialidade === undefined || a.especialidade === especialidade) &&
        alertaAtivo(a, agora.getTime()),
    )
    .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))[0]
  if (aviso?.tipo === 'sem-profissional') return 'nao-atende'
  if (aviso?.tipo === 'tem-profissional') return 'atende'

  const horario = horarioDeHoje(agenda, especialidade, agora)
  if (horario === undefined || horario === 'nao') return 'nao-atende'
  return atendeAgora(horario, agora) ? 'atende' : 'fechado'
}
