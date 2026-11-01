import { describe, expect, it } from 'vitest'
import { ptBR } from '../../i18n/pt-BR'
import { atendeAgora, estimarEspera } from '../../services/regras-provisorias'
import type {
  AgendaDia,
  Alerta,
  Checkin,
  DiaSemana,
  Especialidade,
  Unidade,
} from '../../services/tipos-provisorios'
import { horarioDeHoje, situacaoEspecialidade } from './situacao-especialidade'

const MIN = 60_000
// Datas com o construtor local: não dependem do fuso da máquina. 18/10/2026 é domingo.
const local = (dia: number, hora: number, minuto = 0) => new Date(2026, 9, dia, hora, minuto)

const unidade: Unidade = {
  slug: 'leste',
  nome: 'UPA Leste',
  tipo: 'upa',
  endereco: 'Avenida dos Andradas, 7450',
  bairro: 'Vera Cruz',
  regional: 'leste',
  lat: -19.9,
  lng: -43.9,
  especialidades: ['clinica', 'pediatria', 'ortopedia'],
  fontePbh: { id: 'semente-local:leste', atualizadoEm: '2026-09-29' },
}

const DIAS: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
const agenda: AgendaDia[] = DIAS.map((dia) => ({
  dia,
  horarios: { clinica: '24h', pediatria: { de: '07:00', ate: '19:00' }, ortopedia: 'nao' },
  origem: 'grupo',
  atualizadoEm: '2026-10-01T00:00:00.000Z',
}))

const situacao = (especialidade: Especialidade, agora: Date, alertas: Alerta[] = [], ag = agenda) =>
  situacaoEspecialidade({ unidade, agenda: ag, alertas, especialidade, agora })

const aviso = (extra: Partial<Alerta>, agoraMs: number): Alerta => ({
  slug: 'leste',
  tipo: 'sem-profissional',
  criadoEm: new Date(agoraMs - 30 * MIN).toISOString(),
  expiraEm: new Date(agoraMs + 5 * 60 * MIN).toISOString(),
  confirmacoes: 1,
  contestacoes: 0,
  ...extra,
})

describe('atendeAgora (stub)', () => {
  it('início inclusivo, fim exclusivo', () => {
    const h = { de: '07:00', ate: '19:00' }
    expect(atendeAgora(h, local(18, 7, 0))).toBe(true)
    expect(atendeAgora(h, local(18, 18, 59))).toBe(true)
    expect(atendeAgora(h, local(18, 19, 0))).toBe(false)
    expect(atendeAgora(h, local(18, 6, 59))).toBe(false)
  })

  it('intervalo que atravessa a meia-noite vale dos dois lados', () => {
    const h = { de: '22:00', ate: '06:00' }
    expect(atendeAgora(h, local(18, 23, 0))).toBe(true)
    expect(atendeAgora(h, local(18, 3, 0))).toBe(true)
    expect(atendeAgora(h, local(18, 12, 0))).toBe(false)
  })

  it('24h sempre; nao e sem agenda nunca', () => {
    expect(atendeAgora('24h', local(18, 3, 0))).toBe(true)
    expect(atendeAgora('nao', local(18, 12, 0))).toBe(false)
    expect(atendeAgora(undefined, local(18, 12, 0))).toBe(false)
  })
})

describe('situacaoEspecialidade', () => {
  it('24h atende; dentro do horário atende; fora do horário está fechado', () => {
    expect(situacao('clinica', local(18, 3, 0))).toBe('atende')
    expect(situacao('pediatria', local(18, 10, 0))).toBe('atende')
    expect(situacao('pediatria', local(18, 20, 0))).toBe('fechado')
  })

  it('agenda "nao", sem linha de hoje ou especialidade que a UPA não oferece: não atende', () => {
    expect(situacao('ortopedia', local(18, 10, 0))).toBe('nao-atende')
    expect(situacao('odonto', local(18, 10, 0))).toBe('nao-atende')
    expect(situacao('clinica', local(18, 10, 0), [], [])).toBe('nao-atende')
  })

  it('usa a agenda do dia da semana de hoje', () => {
    const soSegunda: AgendaDia[] = [{ ...agenda[1], horarios: { clinica: '24h' } }]
    expect(horarioDeHoje(soSegunda, 'clinica', local(19, 10, 0))).toBe('24h') // segunda
    expect(horarioDeHoje(soSegunda, 'clinica', local(18, 10, 0))).toBeUndefined() // domingo
  })

  it('aviso "sem profissional" ativo tira a especialidade, mesmo com 24h (RN-18)', () => {
    const agora = local(18, 10, 0)
    const alerta = aviso({ especialidade: 'clinica' }, agora.getTime())
    expect(situacao('clinica', agora, [alerta])).toBe('nao-atende')
  })

  it('aviso "tem profissional" liga a especialidade mesmo fora do quadro (RN-18)', () => {
    const agora = local(18, 20, 0)
    const alerta = aviso({ tipo: 'tem-profissional', especialidade: 'pediatria' }, agora.getTime())
    expect(situacao('pediatria', agora, [alerta])).toBe('atende')
    expect(situacao('ortopedia', agora, [aviso({ tipo: 'tem-profissional', especialidade: 'ortopedia' }, agora.getTime())])).toBe('atende')
  })

  it('aviso expirado, contestado demais ou de outra especialidade não conta', () => {
    const agora = local(18, 10, 0)
    const ms = agora.getTime()
    const expirado = aviso({ especialidade: 'clinica', expiraEm: new Date(ms - MIN).toISOString() }, ms)
    const contestado = aviso({ especialidade: 'clinica', contestacoes: 4 }, ms) // 4 >= 1 + 3
    const outra = aviso({ especialidade: 'pediatria' }, ms)
    expect(situacao('clinica', agora, [expirado, contestado, outra])).toBe('atende')
  })

  it('aviso sem especialidade vale para todas as especialidades da UPA', () => {
    const agora = local(18, 10, 0)
    expect(situacao('clinica', agora, [aviso({}, agora.getTime())])).toBe('nao-atende')
    expect(situacao('pediatria', agora, [aviso({}, agora.getTime())])).toBe('nao-atende')
  })

  it('com os dois avisos ativos, vale o mais recente', () => {
    const agora = local(18, 10, 0)
    const ms = agora.getTime()
    const antigo = aviso({ tipo: 'sem-profissional', especialidade: 'clinica', criadoEm: new Date(ms - 60 * MIN).toISOString() }, ms)
    const novo = aviso({ tipo: 'tem-profissional', especialidade: 'clinica', criadoEm: new Date(ms - 5 * MIN).toISOString() }, ms)
    expect(situacao('clinica', agora, [antigo, novo])).toBe('atende')
    expect(situacao('clinica', agora, [novo, { ...antigo, criadoEm: new Date(ms - MIN).toISOString() }])).toBe('nao-atende')
  })
})

describe('estimarEspera (stub) e textos de origem (RN-24)', () => {
  const agoraMs = local(18, 12, 0).getTime()
  const relato = (minutos: number, haMin: number, especialidade: Especialidade = 'clinica'): Checkin => ({
    slug: 'leste',
    especialidade,
    minutos,
    janela: 0,
    criadoEm: new Date(agoraMs - haMin * MIN).toISOString(),
  })

  it('sem relatos: sem dados', () => {
    const e = estimarEspera([], agoraMs, 'clinica')
    expect(e).toMatchObject({ minutos: null, relatos: 0, origem: 'sem-dados', confianca: 'baixa' })
  })

  it('mediana dos relatos da especialidade nas últimas 2 h, com contagem e idade do mais recente', () => {
    const e = estimarEspera(
      [relato(20, 30), relato(40, 5), relato(30, 60), relato(999 % 360, 10, 'pediatria'), relato(90, 121)],
      agoraMs,
      'clinica',
    )
    expect(e).toMatchObject({ minutos: 30, relatos: 3, ultimoHaMin: 5, origem: 'relatos', confianca: 'media' })
  })

  it('um relato: singular e confiança baixa', () => {
    const e = estimarEspera([relato(25, 12)], agoraMs, 'clinica')
    expect(e).toMatchObject({ relatos: 1, ultimoHaMin: 12, confianca: 'baixa' })
    expect(ptBR.relatos(1)).toBe('1 relato')
  })

  it('6 ou mais relatos: confiança alta', () => {
    const lista = [10, 20, 30, 40, 50, 60].map((m, i) => relato(m, i + 1))
    expect(estimarEspera(lista, agoraMs, 'clinica').confianca).toBe('alta')
  })

  it('idade em horas a partir de 60 min', () => {
    expect(ptBR.haMinutos(0)).toBe('agora há pouco')
    expect(ptBR.haMinutos(59)).toBe('há 59 min')
    expect(ptBR.haMinutos(75)).toBe('há 1 h')
  })
})
