import type {
  AgendaDia,
  Alerta,
  Checkin,
  DiaSemana,
  Especialidade,
  Historico,
  Unidade,
} from '../tipos-provisorios'
import unidadesJson from './dados/unidades.json'

const MIN = 60_000

// TODO(T10): trocar por packages/shared/data/unidades.json (9 UPAs) quando existir.
export const UNIDADES = unidadesJson as Unidade[]

export const DIAS: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

/** Mesma agenda para todas as unidades: uma especialidade em cada modo. */
export function agendaInicial(agoraMs: number): AgendaDia[] {
  return DIAS.map((dia) => ({
    dia,
    horarios: {
      clinica: '24h',
      pediatria: { de: '07:00', ate: '19:00' },
      ortopedia: 'nao',
    },
    origem: 'grupo',
    atualizadoEm: new Date(agoraMs).toISOString(),
  }))
}

const ESPERAS: Record<string, Partial<Record<Especialidade, number[]>>> = {
  barreiro: { clinica: [35, 50, 40, 65, 45], pediatria: [20, 30] },
  'centro-sul': { clinica: [90, 110, 75, 100], pediatria: [45, 60, 50] },
  leste: { clinica: [25, 30, 20], pediatria: [15, 25, 35], ortopedia: [60, 80] },
}

/** Relatos espalhados nas últimas ~2 h, para estimarEspera ter o que mediar. */
export function checkinsIniciais(agoraMs: number): Map<string, Checkin> {
  const mapa = new Map<string, Checkin>()
  let n = 0
  for (const [slug, porEsp] of Object.entries(ESPERAS)) {
    for (const [esp, lista] of Object.entries(porEsp)) {
      lista.forEach((minutos, i) => {
        const criadoMs = agoraMs - (5 + i * 17) * MIN
        const janela = Math.floor(criadoMs / 1_800_000)
        mapa.set(`${slug}_semente-${n++}_${janela}`, {
          slug,
          especialidade: esp as Especialidade,
          minutos,
          janela,
          criadoEm: new Date(criadoMs).toISOString(),
        })
      })
    }
  }
  return mapa
}

export function alertasIniciais(agoraMs: number): Alerta[] {
  const criadoMs = agoraMs - 40 * MIN
  return [
    {
      slug: 'leste',
      tipo: 'raio-x',
      criadoEm: new Date(criadoMs).toISOString(),
      expiraEm: new Date(criadoMs + 6 * 60 * MIN).toISOString(),
      confirmacoes: 2,
      contestacoes: 0,
    },
  ]
}

/** Valores determinísticos (sem aleatório) para os testes não oscilarem. */
export function historicoInicial(slug: string, agoraMs: number): Historico[] {
  const semente = [...slug].reduce((soma, c) => soma + c.charCodeAt(0), 0)
  const atualizadoEm = new Date(agoraMs).toISOString()
  return DIAS.flatMap((dia, d) =>
    Array.from({ length: 17 }, (_, i) => {
      const hora = 6 + i
      return {
        slug,
        dia,
        hora,
        medianaMin: 20 + ((hora * 7 + d * 11 + semente) % 70),
        amostras: 5 + (hora % 7),
        atualizadoEm,
      }
    }),
  )
}
