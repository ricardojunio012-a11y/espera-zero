import { UNIDADES } from '@espera-zero/shared'
import type { AgendaDia, AgendaPorUnidade, Checkin, DiaSemana, Especialidade, Unidade } from '@espera-zero/shared'
import type { NovoCheckin, Painel, Servicos } from './servicos'

const DIAS: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

/**
 * Simulated weekly board: every specialty the reference file lists for a UPA
 * counts as 24 h. The real board is surveyed by the group (RN-19/RN-20).
 */
export function agendaSimulada(unidades: Unidade[], agora: Date): AgendaPorUnidade {
  const atualizadoEm = agora.toISOString()
  return Object.fromEntries(unidades.map((unidade) => {
    const horarios = Object.fromEntries(unidade.especialidades.map((esp) => [esp, '24h' as const]))
    const dias: AgendaDia[] = DIAS.map((dia) => ({ dia, horarios, origem: 'grupo', atualizadoEm }))
    return [unidade.slug, dias]
  }))
}

// Deterministic per UPA, specialty and hour, so the numbers don't jump on every render.
function semente(texto: string): number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

function gerador(seed: number) {
  let s = seed || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

const ESPERA_BASE: Partial<Record<Especialidade, number>> = {
  clinica: 70,
  pediatria: 45,
  ortopedia: 55,
  'cirurgia-geral': 60,
}

export function checkinsSimulados(unidades: Unidade[], agora: Date): Checkin[] {
  const agoraMs = agora.getTime()
  const hora = Math.floor(agoraMs / 3_600_000)
  return unidades.flatMap((unidade) => unidade.especialidades.flatMap((esp) => {
    const aleatorio = gerador(semente(`${unidade.slug}|${esp}|${hora}`))
    const base = (ESPERA_BASE[esp] ?? 50) * (0.5 + aleatorio())
    const quantos = 2 + Math.floor(aleatorio() * 9)
    return Array.from({ length: quantos }, (): Checkin => {
      const idadeMin = 3 + Math.floor(aleatorio() * 110)
      const criado = agoraMs - idadeMin * 60_000
      return {
        slug: unidade.slug,
        especialidade: esp,
        minutos: Math.max(5, Math.round(base * (0.7 + aleatorio() * 0.6))),
        janela: Math.floor(criado / 1_800_000),
        criadoEm: new Date(criado).toISOString(),
      }
    })
  }))
}

// Check-ins sent during this visit, so the mock answers like the real thing.
const enviados: Checkin[] = []

export const servicosMock: Servicos = {
  async carregarPainel(agora: Date): Promise<Painel> {
    return {
      unidades: UNIDADES,
      checkins: [...checkinsSimulados(UNIDADES, agora), ...enviados],
      agendas: agendaSimulada(UNIDADES, agora),
      alertas: [],
      simulado: true,
    }
  },

  async registrarCheckin(novo: NovoCheckin): Promise<void> {
    const agora = Date.now()
    enviados.push({ ...novo, janela: Math.floor(agora / 1_800_000), criadoEm: new Date(agora).toISOString() })
  },
}
