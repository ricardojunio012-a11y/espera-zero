import { describe, expect, it } from 'vitest'
import { UNIDADES } from '@espera-zero/shared'
import type { Painel } from '../services/servicos'
import { agendaSimulada, checkinsSimulados } from '../services/mock'
import { ordenarUpas, origemDaEstimativa, porQue } from './upas'

const agora = new Date('2026-10-23T15:00:00-03:00')
const painel: Painel = {
  unidades: UNIDADES,
  checkins: checkinsSimulados(UNIDADES, agora),
  agendas: agendaSimulada(UNIDADES, agora),
  alertas: [],
  simulado: true,
}
const savassi = { lat: -19.9385, lng: -43.9341 }

describe('ordenarUpas', () => {
  it('ordena quem atende pelo tempo total, espera mais trajeto', () => {
    const linhas = ordenarUpas(painel, 'clinica', savassi, agora)
    const totais = linhas.flatMap((l) => (l.atende && l.totalMin !== null ? [l.totalMin] : []))
    expect(totais).toEqual([...totais].sort((a, b) => a - b))
  })

  it('mantém todas as UPAs e manda para o fim as sem a especialidade', () => {
    const linhas = ordenarUpas(painel, 'ortopedia', savassi, agora)
    expect(linhas).toHaveLength(UNIDADES.length)
    const primeiraSem = linhas.findIndex((l) => !l.atende)
    expect(linhas.slice(primeiraSem).every((l) => !l.atende)).toBe(true)
  })

  it('tira da recomendação a UPA com aviso de "sem profissional" vigente (RN-18)', () => {
    const [primeira] = ordenarUpas(painel, 'clinica', savassi, agora)
    const comAviso: Painel = {
      ...painel,
      alertas: [{
        slug: primeira.unidade.slug, tipo: 'sem-profissional', especialidade: 'clinica',
        criadoEm: new Date(agora.getTime() - 60_000).toISOString(),
        expiraEm: new Date(agora.getTime() + 3_600_000).toISOString(),
        confirmacoes: 1, contestacoes: 0,
      }],
    }
    const linha = ordenarUpas(comAviso, 'clinica', savassi, agora).find((l) => l.unidade.slug === primeira.unidade.slug)
    expect(linha?.atende).toBe(false)
  })

  it('sem bairro, explica nada e ordena só pela espera', () => {
    const linhas = ordenarUpas(painel, 'clinica', null, agora)
    expect(linhas.every((l) => !l.atende || l.trajetoMin === null)).toBe(true)
    expect(porQue(linhas, null)).toBeNull()
  })
})

describe('origemDaEstimativa', () => {
  it('diz quantos relatos e quando foi o último (RF-11)', () => {
    expect(origemDaEstimativa({ minutos: 40, relatos: 5, ultimoHaMin: 7, origem: 'relatos', confianca: 'media' }))
      .toBe('5 relatos · há 7 min')
    expect(origemDaEstimativa({ minutos: null, relatos: 0, ultimoHaMin: null, origem: 'sem-dados', confianca: 'baixa' }))
      .toBe('sem informação recente')
  })
})

describe('checkinsSimulados', () => {
  it('é estável dentro da mesma hora e fica na janela de 2 h', () => {
    const outra = new Date(agora.getTime() + 60_000)
    expect(checkinsSimulados(UNIDADES, outra).map((c) => c.minutos))
      .toEqual(checkinsSimulados(UNIDADES, agora).map((c) => c.minutos))
    const idades = painel.checkins.map((c) => agora.getTime() - Date.parse(c.criadoEm))
    expect(Math.max(...idades)).toBeLessThan(2 * 3_600_000)
  })
})
