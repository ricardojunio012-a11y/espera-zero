import { describe, expect, it } from 'vitest'
import type {
  AgendaDia,
  Alerta,
  DiaSemana,
  HorarioEspecialidade as Horario,
  Unidade,
} from '../../services/tipos-provisorios'
import { minutosParaExpirar, tituloDoAviso, tomDoAviso } from './aviso-apresentacao'
import { especialidadeInicial } from './especialidade-inicial'
import { faixaDeEspera, preenchimentoDaBarra } from './faixa-espera'
import {
  abreQuando,
  diaDe,
  horaCurta,
  resumoEspecialidade,
  textoHorario,
  textoOrigemDoQuadro,
} from './quadro-semana'

// Datas com o construtor local: não dependem do fuso da máquina. 18/10/2026 é domingo.
const local = (dia: number, hora: number, minuto = 0) => new Date(2026, 9, dia, hora, minuto)

const DIAS: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
const agendaCom = (porDia: Partial<Record<DiaSemana, Horario>>, esp: 'clinica' | 'ortopedia' = 'clinica') =>
  DIAS.map(
    (dia): AgendaDia => ({
      dia,
      horarios: porDia[dia] === undefined ? {} : { [esp]: porDia[dia] },
      origem: 'grupo',
      atualizadoEm: '2026-10-01T00:00:00.000Z',
    }),
  )
const todosOsDias = (h: Horario): Partial<Record<DiaSemana, Horario>> =>
  Object.fromEntries(DIAS.map((d) => [d, h]))

describe('textos de horário', () => {
  it('horaCurta tira o zero e só mostra minutos quando existem', () => {
    expect(horaCurta('07:00')).toBe('7h')
    expect(horaCurta('19:00')).toBe('19h')
    expect(horaCurta('07:30')).toBe('7h30')
    expect(horaCurta('00:05')).toBe('0h05')
  })

  it('textoHorario', () => {
    expect(textoHorario('24h')).toBe('24 horas')
    expect(textoHorario({ de: '07:00', ate: '19:00' })).toBe('7h às 19h')
    expect(textoHorario('nao')).toBeNull()
    expect(textoHorario(undefined)).toBeNull()
  })

  it('diaDe usa o dia local', () => {
    expect(diaDe(local(18, 12))).toBe('dom')
    expect(diaDe(local(19, 0, 5))).toBe('seg')
    expect(diaDe(local(23, 23, 59))).toBe('sex')
  })
})

describe('resumoEspecialidade (legenda do quadro)', () => {
  it('todos os dias, 24 horas', () => {
    expect(resumoEspecialidade(agendaCom(todosOsDias('24h')), 'clinica')).toBe('todos os dias, 24 horas')
  })

  it('segunda a sexta, 7h às 19h', () => {
    const h = { de: '07:00', ate: '19:00' }
    const agenda = agendaCom({ seg: h, ter: h, qua: h, qui: h, sex: h }, 'ortopedia')
    expect(resumoEspecialidade(agenda, 'ortopedia')).toBe('segunda a sexta, 7h às 19h')
  })

  it('dias soltos viram lista; dois dias seguidos também', () => {
    expect(resumoEspecialidade(agendaCom({ seg: '24h', qua: '24h', sex: '24h' }), 'clinica')).toBe(
      'segunda, quarta e sexta, 24 horas',
    )
    expect(resumoEspecialidade(agendaCom({ sab: '24h', dom: '24h' }), 'clinica')).toBe('sábado e domingo, 24 horas')
    expect(resumoEspecialidade(agendaCom({ ter: '24h' }), 'clinica')).toBe('terça, 24 horas')
  })

  it('horários diferentes entre os dias: "horários variam"', () => {
    const agenda = agendaCom({ seg: '24h', ter: { de: '07:00', ate: '19:00' } })
    expect(resumoEspecialidade(agenda, 'clinica')).toBe('segunda e terça, horários variam')
  })

  it('não atende em nenhum dia: null', () => {
    expect(resumoEspecialidade(agendaCom(todosOsDias('nao')), 'clinica')).toBeNull()
    expect(resumoEspecialidade([], 'clinica')).toBeNull()
  })
})

describe('abreQuando (linha "Abre às 7h")', () => {
  const h = { de: '07:00', ate: '19:00' }
  const agenda = agendaCom(todosOsDias(h))

  it('antes de abrir hoje: "Abre às 7h"', () => {
    expect(abreQuando(agenda, 'clinica', local(18, 5, 0))).toBe('Abre às 7h')
  })

  it('depois de fechar: "Abre amanhã às 7h"', () => {
    expect(abreQuando(agenda, 'clinica', local(18, 20, 0))).toBe('Abre amanhã às 7h')
  })

  it('amanhã não atende: sem próxima abertura conhecida', () => {
    const soHoje = agendaCom({ dom: h })
    expect(abreQuando(soHoje, 'clinica', local(18, 20, 0))).toBeNull()
  })

  it('intervalo que atravessa a meia-noite, fechado de dia: abre hoje à noite', () => {
    const noite = agendaCom(todosOsDias({ de: '22:00', ate: '06:00' }))
    expect(abreQuando(noite, 'clinica', local(18, 12, 0))).toBe('Abre às 22h')
  })
})

describe('RN-20: origem do quadro', () => {
  it('com confirmações', () => {
    expect(textoOrigemDoQuadro(56)).toBe(
      'Escala montada pela comunidade e confirmada por 56 pessoas. Não é informação oficial da prefeitura.',
    )
    expect(textoOrigemDoQuadro(1)).toContain('confirmada por 1 pessoa.')
  })

  it('sem confirmações, diz isso e mantém o aviso de que não é oficial', () => {
    expect(textoOrigemDoQuadro(0)).toBe(
      'Escala montada pela comunidade, ainda sem confirmações. Não é informação oficial da prefeitura.',
    )
  })
})

describe('faixa e barra da espera', () => {
  it('faixas: até 30 curta, até 60 média, acima longa', () => {
    expect(faixaDeEspera(0)).toBe('curta')
    expect(faixaDeEspera(30)).toBe('curta')
    expect(faixaDeEspera(31)).toBe('media')
    expect(faixaDeEspera(60)).toBe('media')
    expect(faixaDeEspera(61)).toBe('longa')
  })

  it('barra proporcional, limitada entre 0 e 1', () => {
    expect(preenchimentoDaBarra(0)).toBe(0)
    expect(preenchimentoDaBarra(75)).toBe(0.5)
    expect(preenchimentoDaBarra(150)).toBe(1)
    expect(preenchimentoDaBarra(360)).toBe(1)
    expect(preenchimentoDaBarra(-5)).toBe(0)
  })
})

describe('avisos', () => {
  const base: Alerta = {
    slug: 'leste',
    tipo: 'raio-x',
    criadoEm: '2026-10-18T10:00:00.000Z',
    expiraEm: '2026-10-18T16:00:00.000Z',
    confirmacoes: 1,
    contestacoes: 0,
  }

  it('títulos iguais aos do sheet "Avisar algo" (tela 15)', () => {
    expect(tituloDoAviso({ ...base, tipo: 'tem-profissional', especialidade: 'ortopedia' })).toBe(
      'Tem ortopedista agora',
    )
    expect(tituloDoAviso({ ...base, tipo: 'sem-profissional', especialidade: 'pediatria' })).toBe(
      'Sem pediatra hoje',
    )
    expect(tituloDoAviso({ ...base, tipo: 'tem-profissional' })).toBe('Tem profissional agora')
    expect(tituloDoAviso({ ...base, tipo: 'raio-x' })).toBe('Raio-x parado')
    expect(tituloDoAviso({ ...base, tipo: 'fila' })).toBe('Fila grande na recepção')
    expect(tituloDoAviso({ ...base, tipo: 'farmacia' })).toBe('Farmácia sem remédio')
    expect(tituloDoAviso({ ...base, tipo: 'outro', texto: 'Recepção tranquila' })).toBe('Recepção tranquila')
    expect(tituloDoAviso({ ...base, tipo: 'outro' })).toBe('Outro aviso')
  })

  it('tom do ícone', () => {
    expect(tomDoAviso({ ...base, tipo: 'tem-profissional' })).toBe('positivo')
    expect(tomDoAviso({ ...base, tipo: 'sem-profissional' })).toBe('problema')
    expect(tomDoAviso({ ...base, tipo: 'raio-x' })).toBe('problema')
    expect(tomDoAviso({ ...base, tipo: 'fila' })).toBe('info')
  })

  it('minutos para expirar, nunca negativos', () => {
    const agora = Date.parse('2026-10-18T10:25:00.000Z')
    expect(minutosParaExpirar(base, agora)).toBe(335)
    expect(minutosParaExpirar(base, Date.parse('2026-10-18T17:00:00.000Z'))).toBe(0)
  })
})

describe('?esp= (especialidade inicial)', () => {
  const unidade = {
    especialidades: ['clinica', 'pediatria', 'ortopedia'],
  } as Unidade

  it('vale quando a UPA oferece', () => {
    expect(especialidadeInicial(unidade, 'ortopedia')).toBe('ortopedia')
  })

  it('ignora o que a UPA não oferece, o inválido e a ausência: cai na primeira', () => {
    expect(especialidadeInicial(unidade, 'odonto')).toBe('clinica')
    expect(especialidadeInicial(unidade, 'xyz')).toBe('clinica')
    expect(especialidadeInicial(unidade, null)).toBe('clinica')
  })

  it('UPA sem especialidades: null', () => {
    expect(especialidadeInicial({ especialidades: [] } as unknown as Unidade, 'clinica')).toBeNull()
  })
})
