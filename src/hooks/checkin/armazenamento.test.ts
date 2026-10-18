import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apagarCheckin, lerCheckin, salvarCheckin } from './armazenamento'
import type { CheckinLocal } from './checkin-local'

const checkin: CheckinLocal = {
  slug: 'oeste',
  especialidade: 'pediatria',
  chegadaEm: '2026-10-18T16:00:00.000Z',
  risco: 'amarelo',
  confirmadoEm: '2026-10-18T16:05:00.000Z',
}

const bloqueado = () => {
  throw new DOMException('bloqueado', 'SecurityError')
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('armazenamento do check-in', () => {
  it('grava e lê de volta', () => {
    expect(salvarCheckin(checkin)).toBe(true)
    expect(lerCheckin()).toEqual(checkin)
  })

  it('aceita check-in sem campos opcionais', () => {
    const minimo: CheckinLocal = { slug: 'oeste', especialidade: 'clinica', chegadaEm: checkin.chegadaEm }
    salvarCheckin(minimo)
    expect(lerCheckin()).toEqual(minimo)
  })

  it('armazenamento vazio devolve null', () => {
    expect(lerCheckin()).toBeNull()
  })

  it('apagar remove o check-in', () => {
    salvarCheckin(checkin)
    apagarCheckin()
    expect(lerCheckin()).toBeNull()
  })

  describe('lixo no armazenamento vira null', () => {
    it('JSON corrompido', () => {
      localStorage.setItem('ez.checkin', '{nao-e-json')
      expect(lerCheckin()).toBeNull()
    })

    it.each([
      ['não é objeto', '"texto"'],
      ['null', 'null'],
      ['sem slug', JSON.stringify({ ...checkin, slug: undefined })],
      ['slug vazio', JSON.stringify({ ...checkin, slug: '' })],
      ['especialidade desconhecida', JSON.stringify({ ...checkin, especialidade: 'dermato' })],
      ['chegadaEm ilegível', JSON.stringify({ ...checkin, chegadaEm: 'ontem' })],
      ['risco desconhecido', JSON.stringify({ ...checkin, risco: 'roxo' })],
      ['confirmadoEm ilegível', JSON.stringify({ ...checkin, confirmadoEm: 'lixo' })],
    ])('formato inválido: %s', (_nome, texto) => {
      localStorage.setItem('ez.checkin', texto)
      expect(lerCheckin()).toBeNull()
    })

    it('ignora campos desconhecidos', () => {
      localStorage.setItem('ez.checkin', JSON.stringify({ ...checkin, nome: 'Fulano' }))
      expect(lerCheckin()).toEqual(checkin)
    })
  })

  describe('armazenamento bloqueado', () => {
    it('lerCheckin devolve null quando getItem lança', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(bloqueado)
      expect(lerCheckin()).toBeNull()
    })

    it('salvarCheckin devolve false quando setItem lança', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(bloqueado)
      expect(salvarCheckin(checkin)).toBe(false)
    })

    it('apagarCheckin falha em silêncio quando removeItem lança', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(bloqueado)
      expect(() => apagarCheckin()).not.toThrow()
    })

    it('funciona sem localStorage nenhum', () => {
      vi.stubGlobal('localStorage', undefined)
      expect(lerCheckin()).toBeNull()
      expect(salvarCheckin(checkin)).toBe(false)
      expect(() => apagarCheckin()).not.toThrow()
    })
  })
})
