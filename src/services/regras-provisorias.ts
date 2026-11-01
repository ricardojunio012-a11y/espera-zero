// TODO(T13/T14): trocar pelas funções do shared quando existirem.
import type {
  Alerta,
  Checkin,
  Especialidade,
  Estimativa,
  Historico,
  HorarioEspecialidade,
} from './tipos-provisorios'

export const JANELA_MS = 1_800_000

/** Número da janela de 30 min em que `epochMs` cai (parte do id do check-in). */
export function janelaDe(epochMs: number): number {
  return Math.floor(epochMs / JANELA_MS)
}

/** RN-10/11: não expirado e contestações abaixo de confirmações + 3. */
export function alertaAtivo(a: Alerta, agoraMs: number): boolean {
  return Date.parse(a.expiraEm) > agoraMs && a.contestacoes < a.confirmacoes + 3
}

function minutosDoDia(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * TODO(T14): trocar pelo atendeAgora do shared.
 * O horário vale no relógio local de `agora`. Início inclusivo, fim exclusivo; intervalo que
 * atravessa a meia-noite (de > ate) vale nos dois lados da virada. Sem agenda ou 'nao': false.
 * Não olha a agenda de ontem para a madrugada de hoje (o shared deve tratar isso).
 */
export function atendeAgora(horario: HorarioEspecialidade | undefined, agora: Date): boolean {
  if (horario === undefined || horario === 'nao') return false
  if (horario === '24h') return true
  const minuto = agora.getHours() * 60 + agora.getMinutes()
  const de = minutosDoDia(horario.de)
  const ate = minutosDoDia(horario.ate)
  return de <= ate ? minuto >= de && minuto < ate : minuto >= de || minuto < ate
}

const MAX_IDADE_MS = 2 * 60 * 60_000

/**
 * TODO(T13): trocar pelo estimarEspera do shared (mesma assinatura).
 * Aproximação provisória: mediana simples dos relatos da especialidade nas últimas 2 h.
 * Não aplica o decaimento por idade nem usa o histórico.
 */
export function estimarEspera(
  checkins: Checkin[],
  agoraMs: number,
  especialidade: Especialidade,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO(T13): ainda não usado
  _historico: Historico[] = [],
): Estimativa {
  const recentes = checkins.filter((c) => {
    const idade = agoraMs - Date.parse(c.criadoEm)
    return c.especialidade === especialidade && idade >= 0 && idade <= MAX_IDADE_MS
  })
  if (recentes.length === 0) {
    return { minutos: null, relatos: 0, ultimoHaMin: null, origem: 'sem-dados', confianca: 'baixa' }
  }
  const ordenados = recentes.map((c) => c.minutos).sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  const mediana =
    ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2
  const maisRecenteMs = Math.max(...recentes.map((c) => Date.parse(c.criadoEm)))
  return {
    minutos: Math.round(mediana),
    relatos: recentes.length,
    ultimoHaMin: Math.floor((agoraMs - maisRecenteMs) / 60_000),
    origem: 'relatos',
    confianca: recentes.length < 3 ? 'baixa' : recentes.length < 6 ? 'media' : 'alta',
  }
}
