import { describe, expect, it } from 'vitest'
import type { CheckinLocal } from './checkin-local'
import {
  checkinAbandonado,
  formatarCronometro,
  minutosDesde,
  precisaConfirmar,
  validarAjuste,
} from './tempo'

// Datas montadas com o construtor local: os testes não dependem do fuso da máquina.
const local = (dia: number, hora: number, minuto = 0, segundo = 0) =>
  new Date(2026, 9, dia, hora, minuto, segundo).getTime()
const iso = (ms: number) => new Date(ms).toISOString()

describe('minutosDesde', () => {
  it('conta minutos inteiros, arredondando para baixo', () => {
    expect(minutosDesde(iso(local(18, 13, 0)), local(18, 13, 29, 59))).toBe(29)
  })

  it('nunca devolve negativo', () => {
    expect(minutosDesde(iso(local(18, 14, 0)), local(18, 13, 0))).toBe(0)
  })

  it('data inválida devolve 0', () => {
    expect(minutosDesde('lixo', local(18, 13, 0))).toBe(0)
  })
})

describe('formatarCronometro', () => {
  it('usa mm:ss abaixo de 60 min', () => {
    expect(formatarCronometro(0)).toBe('00:00')
    expect(formatarCronometro(65_000)).toBe('01:05')
    expect(formatarCronometro(59 * 60_000 + 59_000)).toBe('59:59')
  })

  it('usa h:mm:ss a partir de 60 min', () => {
    expect(formatarCronometro(60 * 60_000)).toBe('1:00:00')
    expect(formatarCronometro(125 * 60_000 + 7_000)).toBe('2:05:07')
  })

  it('ms negativo vira 00:00', () => {
    expect(formatarCronometro(-5000)).toBe('00:00')
  })
})

describe('checkinAbandonado', () => {
  const chegada = iso(local(18, 2, 0))

  it('exatamente 12 h ainda não é abandonado', () => {
    expect(checkinAbandonado(chegada, local(18, 14, 0))).toBe(false)
  })

  it('12 h e 1 min é abandonado', () => {
    expect(checkinAbandonado(chegada, local(18, 14, 1))).toBe(true)
  })

  it('data ilegível conta como abandonado', () => {
    expect(checkinAbandonado('lixo', local(18, 14, 0))).toBe(true)
  })
})

describe('precisaConfirmar', () => {
  const base: CheckinLocal = {
    slug: 'oeste',
    especialidade: 'clinica',
    chegadaEm: iso(local(18, 13, 0)),
  }
  const abertoEm = local(18, 14, 0)

  it('sem confirmadoEm, precisa', () => {
    expect(precisaConfirmar(base, abertoEm)).toBe(true)
  })

  it('confirmado antes de o app abrir, precisa (a pessoa voltou)', () => {
    expect(precisaConfirmar({ ...base, confirmadoEm: iso(local(18, 13, 30)) }, abertoEm)).toBe(true)
  })

  it('confirmado depois de o app abrir, não precisa', () => {
    expect(precisaConfirmar({ ...base, confirmadoEm: iso(local(18, 14, 5)) }, abertoEm)).toBe(false)
  })

  it('confirmadoEm ilegível, precisa', () => {
    expect(precisaConfirmar({ ...base, confirmadoEm: 'lixo' }, abertoEm)).toBe(true)
  })
})

describe('validarAjuste', () => {
  describe('hora de chegada', () => {
    it('hora que já passou hoje vale hoje', () => {
      const r = validarAjuste({ horaChegada: '13:30' }, local(18, 14, 0))
      expect(r).toEqual({ ok: true, chegadaEm: iso(local(18, 13, 30)), minutos: 30 })
    })

    it('passou da meia-noite: 23:50 às 00:10 vale ontem', () => {
      const r = validarAjuste({ horaChegada: '23:50' }, local(18, 0, 10))
      expect(r).toEqual({ ok: true, chegadaEm: iso(local(17, 23, 50)), minutos: 20 })
    })

    it('virada de mês: 23:50 às 00:10 do dia 1º vale o último dia do mês anterior', () => {
      const agora = new Date(2026, 10, 1, 0, 10).getTime()
      const r = validarAjuste({ horaChegada: '23:50' }, agora)
      expect(r).toEqual({
        ok: true,
        chegadaEm: iso(new Date(2026, 9, 31, 23, 50).getTime()),
        minutos: 20,
      })
    })

    it('hora futura de hoje vira ontem e é recusada por passar de 12 h', () => {
      const r = validarAjuste({ horaChegada: '15:00' }, local(18, 14, 0))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.motivo).toMatch(/ainda não chegou hoje/)
    })

    it('exatamente 12 h é aceito', () => {
      const r = validarAjuste({ horaChegada: '02:00' }, local(18, 14, 0))
      expect(r).toEqual({ ok: true, chegadaEm: iso(local(18, 2, 0)), minutos: 720 })
    })

    it('12 h e 1 min é recusado', () => {
      const r = validarAjuste({ horaChegada: '02:00' }, local(18, 14, 1))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.motivo).toMatch(/mais de 12 horas/)
    })

    it('aceita hora com um dígito e recusa formato inválido', () => {
      expect(validarAjuste({ horaChegada: '9:05' }, local(18, 10, 0)).ok).toBe(true)
      expect(validarAjuste({ horaChegada: '25:00' }, local(18, 10, 0)).ok).toBe(false)
      expect(validarAjuste({ horaChegada: 'abc' }, local(18, 10, 0)).ok).toBe(false)
      expect(validarAjuste({ horaChegada: '10:7' }, local(18, 10, 0)).ok).toBe(false)
    })
  })

  describe('hora de atendimento', () => {
    it('calcula a espera entre chegada e atendimento', () => {
      const r = validarAjuste({ horaChegada: '13:00', horaAtendimento: '13:45' }, local(18, 14, 0))
      expect(r).toEqual({
        ok: true,
        chegadaEm: iso(local(18, 13, 0)),
        atendidoEm: iso(local(18, 13, 45)),
        minutos: 45,
      })
    })

    it('atendimento igual à chegada dá 0 minuto', () => {
      const r = validarAjuste({ horaChegada: '13:00', horaAtendimento: '13:00' }, local(18, 14, 0))
      expect(r.ok && r.minutos).toBe(0)
    })

    it('atendimento depois da meia-noite: chegada 23:00, atendimento 00:30', () => {
      const r = validarAjuste({ horaChegada: '23:00', horaAtendimento: '00:30' }, local(18, 1, 0))
      expect(r).toEqual({
        ok: true,
        chegadaEm: iso(local(17, 23, 0)),
        atendidoEm: iso(local(18, 0, 30)),
        minutos: 90,
      })
    })

    it('atendimento antes da chegada é recusado', () => {
      const r = validarAjuste({ horaChegada: '13:00', horaAtendimento: '12:00' }, local(18, 14, 0))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.motivo).toMatch(/antes da chegada/)
    })

    it('atendimento no futuro é recusado', () => {
      const r = validarAjuste({ horaChegada: '13:00', horaAtendimento: '14:30' }, local(18, 14, 0))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.motivo).toMatch(/ainda não chegou/)
    })

    it('atendimento ilegível é recusado', () => {
      const r = validarAjuste({ horaChegada: '13:00', horaAtendimento: '99:99' }, local(18, 14, 0))
      expect(r.ok).toBe(false)
    })

    it('exatamente 360 min é aceito; 390 min é recusado', () => {
      const agora = local(18, 20, 0)
      const limite = validarAjuste({ horaChegada: '12:00', horaAtendimento: '18:00' }, agora)
      expect(limite.ok && limite.minutos).toBe(360)

      const acima = validarAjuste({ horaChegada: '12:00', horaAtendimento: '18:30' }, agora)
      expect(acima.ok).toBe(false)
      if (!acima.ok) expect(acima.motivo).toMatch(/6 horas/)
    })

    it('sem atendimento, a espera pode passar de 360 min (nada vai ao banco ainda)', () => {
      const r = validarAjuste({ horaChegada: '12:00' }, local(18, 20, 0))
      expect(r.ok && r.minutos).toBe(480)
    })
  })
})
