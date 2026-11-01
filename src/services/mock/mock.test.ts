import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServicoErro } from '../index'
import { testarContrato } from '../contrato/testes-de-contrato'
import type { Checkin } from '../tipos-provisorios'
import { criarServicosMock, type OpcoesMock, type OperacaoOffline } from './index'

const T0 = Date.parse('2026-11-01T15:10:00.000Z')
const MIN = 60_000
const HORA = 60 * MIN

testarContrato('mock', () => criarServicosMock())

/** Mock com relógio que o teste controla. */
function comRelogio(extra: OpcoesMock = {}) {
  let agora = T0
  const s = criarServicosMock({ agora: () => agora, ...extra })
  return {
    s,
    avancar: (ms: number) => {
      agora += ms
    },
  }
}
const idDe = (x: unknown) => (x as { id: string }).id
const ids = (lista: unknown[]) => lista.map(idDe)
const codigo = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: ServicoErro) => e.codigo,
  )
const dadosCheckin = { slug: 'leste', especialidade: 'clinica' as const, minutos: 30 }

afterEach(() => vi.useRealTimers())

describe('mock: dados de exemplo', () => {
  it('tem 3 unidades e uma especialidade em cada modo na agenda', async () => {
    const { s } = comRelogio()
    expect(await s.getUnidades()).toHaveLength(3)
    const seg = (await s.getAgenda('leste')).find((d) => d.dia === 'seg')!
    expect(seg.horarios).toEqual({
      clinica: '24h',
      pediatria: { de: '07:00', ate: '19:00' },
      ortopedia: 'nao',
    })
  })

  it('traz check-ins das últimas 2 h, mais recente primeiro', async () => {
    const { s } = comRelogio()
    const entregas: Checkin[][] = []
    s.observarCheckins('barreiro', T0 - 2 * HORA, (l) => entregas.push(l))
    await Promise.resolve()
    const tempos = entregas[0].map((c) => Date.parse(c.criadoEm))
    expect(tempos.length).toBeGreaterThanOrEqual(5)
    expect(tempos).toEqual([...tempos].sort((a, b) => b - a))
    expect(tempos.every((t) => t >= T0 - 2 * HORA && t <= T0)).toBe(true)
  })

  it('devolve cópias: mexer no resultado não altera o mock', async () => {
    const { s } = comRelogio()
    const [u] = await s.getUnidades()
    u.nome = 'alterado'
    expect((await s.getUnidades())[0].nome).not.toBe('alterado')
  })
})

describe('mock: observarCheckins', () => {
  it('chama o callback logo de início e de novo a cada check-in novo do slug', async () => {
    const { s } = comRelogio()
    const cb = vi.fn()
    s.observarCheckins('leste', 0, cb)
    expect(cb).not.toHaveBeenCalled() // a 1ª entrega é assíncrona (microtask)
    await Promise.resolve()
    expect(cb).toHaveBeenCalledTimes(1)
    const antes = cb.mock.calls[0][0].length

    await s.registrarCheckin(dadosCheckin)
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb.mock.calls[1][0]).toHaveLength(antes + 1)

    await s.registrarCheckin({ ...dadosCheckin, slug: 'barreiro' })
    expect(cb).toHaveBeenCalledTimes(2) // outro slug não dispara
  })

  it('o unsubscribe para as entregas, mesmo se chamado antes da 1ª', async () => {
    const { s } = comRelogio()
    const cb = vi.fn()
    const parar = s.observarCheckins('leste', 0, cb)
    await Promise.resolve()
    parar()
    await s.registrarCheckin(dadosCheckin)
    expect(cb).toHaveBeenCalledTimes(1)

    const cb2 = vi.fn()
    s.observarCheckins('leste', 0, cb2)()
    await Promise.resolve()
    expect(cb2).not.toHaveBeenCalled()
  })

  it('respeita desdeMs, e um ouvinte que quebra não atrapalha os outros', async () => {
    const { s } = comRelogio()
    const recentes = vi.fn()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    s.observarCheckins('leste', T0 + 1, recentes) // nada tão recente
    s.observarCheckins('leste', 0, () => {
      throw new Error('ouvinte ruim')
    })
    const ok = vi.fn()
    s.observarCheckins('leste', 0, ok)
    await Promise.resolve()
    expect(recentes.mock.calls[0][0]).toEqual([])
    expect(ok).toHaveBeenCalled()
    log.mockRestore()
  })
})

describe('mock: check-ins e janela de 30 min', () => {
  it('libera novo check-in na janela seguinte', async () => {
    const { s, avancar } = comRelogio()
    await s.registrarCheckin(dadosCheckin)
    expect(await codigo(s.registrarCheckin(dadosCheckin))).toBe('limite')
    avancar(30 * MIN)
    await expect(s.registrarCheckin(dadosCheckin)).resolves.toBeUndefined()
  })

  it('outro uid pode registrar na mesma janela', async () => {
    const { s } = comRelogio()
    await s.registrarCheckin(dadosCheckin)
    s.trocarUid('outra-pessoa')
    await expect(s.registrarCheckin(dadosCheckin)).resolves.toBeUndefined()
  })

  it('recusa slug inexistente e cor de risco inválida', async () => {
    const { s } = comRelogio()
    expect(await codigo(s.registrarCheckin({ ...dadosCheckin, slug: 'x' }))).toBe('nao-encontrado')
    const risco = { ...dadosCheckin, risco: 'rosa' as never }
    expect(await codigo(s.registrarCheckin(risco))).toBe('validacao')
  })
})

describe('mock: alertas', () => {
  it('some depois de expirar (+6 h; +12 h para sem-profissional)', async () => {
    const { s, avancar } = comRelogio()
    const seis = await s.criarAlerta({ slug: 'leste', tipo: 'fila' })
    const doze = await s.criarAlerta({ slug: 'leste', tipo: 'sem-profissional' })
    avancar(6 * HORA + 1)
    const ativos = ids(await s.listarAlertas('leste'))
    expect(ativos).not.toContain(seis)
    expect(ativos).toContain(doze)
    avancar(6 * HORA)
    expect(ids(await s.listarAlertas('leste'))).not.toContain(doze)
  })

  it('some com 3 contestações de pessoas diferentes (RN-17)', async () => {
    const { s } = comRelogio()
    const id = await s.criarAlerta({ slug: 'leste', tipo: 'fila' })
    for (const uid of ['a', 'b']) {
      s.trocarUid(uid)
      await s.votarAlerta(id, 'contesto')
    }
    expect(ids(await s.listarAlertas('leste'))).toContain(id)
    s.trocarUid('c')
    await s.votarAlerta(id, 'contesto')
    expect(ids(await s.listarAlertas('leste'))).not.toContain(id)
  })

  it('outro uid vota no mesmo aviso', async () => {
    const { s } = comRelogio()
    const id = await s.criarAlerta({ slug: 'leste', tipo: 'fila' })
    await s.votarAlerta(id, 'confirmo')
    s.trocarUid('outra-pessoa')
    await expect(s.votarAlerta(id, 'confirmo')).resolves.toBeUndefined()
  })
})

describe('mock: sugestões', () => {
  const sugestao = {
    slug: 'leste',
    especialidade: 'ortopedia' as const,
    dias: ['seg' as const, 'ter' as const],
    modo: '24h' as const,
  }
  const achar = async (s: ReturnType<typeof comRelogio>['s'], id: string) =>
    (await s.listarSugestoes('leste')).find((x) => idDe(x) === id)!

  it('quem sugeriu não confirma; 3 pessoas diferentes colocam em vigor', async () => {
    const { s } = comRelogio()
    const id = await s.criarSugestao(sugestao)
    expect(await codigo(s.confirmarSugestao(id))).toBe('permissao')

    for (const uid of ['a', 'b']) {
      s.trocarUid(uid)
      await s.confirmarSugestao(id)
    }
    expect(await achar(s, id)).toMatchObject({ status: 'pendente', confirmacoes: 2 })

    s.trocarUid('a')
    expect(await codigo(s.confirmarSugestao(id))).toBe('limite')

    s.trocarUid('c')
    await s.confirmarSugestao(id)
    expect(await achar(s, id)).toMatchObject({ status: 'vigente', confirmacoes: 3 })
  })

  it('sugestão em vigor reescreve a linha da especialidade na agenda', async () => {
    const { s } = comRelogio()
    const id = await s.criarSugestao(sugestao)
    for (const uid of ['a', 'b', 'c']) {
      s.trocarUid(uid)
      await s.confirmarSugestao(id)
    }
    const agenda = await s.getAgenda('leste')
    const orto = Object.fromEntries(agenda.map((d) => [d.dia, d.horarios.ortopedia]))
    expect(orto).toMatchObject({ seg: '24h', ter: '24h', qua: 'nao', dom: 'nao' })
    expect(agenda[0].origem).toBe('comunidade')
    expect(agenda[0].horarios.clinica).toBe('24h') // outras especialidades intactas
  })
})

describe('mock: erros simulados e latência', () => {
  it.each(['offline', 'permissao', 'limite', 'validacao', 'nao-encontrado', 'desconhecido'] as const)(
    'simularErro("%s") faz as chamadas rejeitarem com ServicoErro; null desliga',
    async (c) => {
      const { s } = comRelogio()
      s.simularErro(c)
      const erro = await s.getUnidades().catch((e: unknown) => e)
      expect(erro).toBeInstanceOf(ServicoErro)
      expect((erro as ServicoErro).codigo).toBe(c)
      s.simularErro(null)
      await expect(s.getUnidades()).resolves.toHaveLength(3)
    },
  )

  it('não grava nada quando a chamada falha por erro simulado', async () => {
    const { s } = comRelogio()
    s.simularErro('offline')
    await codigo(s.registrarCheckin(dadosCheckin))
    s.simularErro(null)
    await expect(s.registrarCheckin(dadosCheckin)).resolves.toBeUndefined()
  })

  it('aplica a latência configurada', async () => {
    vi.useFakeTimers()
    const s = criarServicosMock({ latenciaMs: 500 })
    const fim = vi.fn()
    void s.getUnidades().then(fim)
    await vi.advanceTimersByTimeAsync(499)
    expect(fim).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fim).toHaveBeenCalled()
  })

  it('avisa o gancho da fila offline só quando o erro é "offline" (TODO T32)', async () => {
    const ops: OperacaoOffline[] = []
    const { s } = comRelogio({ aoFalharOffline: (op) => void ops.push(op) })
    s.simularErro('limite')
    await codigo(s.registrarCheckin(dadosCheckin))
    expect(ops).toHaveLength(0)
    s.simularErro('offline')
    await codigo(s.registrarCheckin(dadosCheckin))
    await codigo(s.criarAlerta({ slug: 'leste', tipo: 'fila' }))
    expect(ops.map((o) => o.tipo)).toEqual(['registrarCheckin', 'criarAlerta'])
    expect(ops[0].dados).toEqual(dadosCheckin)
  })
})

describe('mock: getGeometriasBairros', () => {
  const resposta = (status: number, corpo = '{"b1":"POLYGON((0 0))"}') =>
    new Response(corpo, { status })

  it('baixa uma só vez, mesmo com chamadas simultâneas, e guarda em cache', async () => {
    const fetchFn = vi.fn(async () => resposta(200))
    const s = criarServicosMock({ fetchFn })
    const [a, b] = await Promise.all([s.getGeometriasBairros(), s.getGeometriasBairros()])
    await s.getGeometriasBairros()
    expect(a).toEqual({ b1: 'POLYGON((0 0))' })
    expect(b).toBe(a)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledWith('/bairros-geo.json')
  })

  it('traduz falhas para ServicoErro e tenta de novo na chamada seguinte', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(resposta(404))
      .mockResolvedValueOnce(resposta(500))
      .mockResolvedValueOnce(resposta(200, 'não é json'))
      .mockResolvedValueOnce(resposta(200))
    const s = criarServicosMock({ fetchFn })
    expect(await codigo(s.getGeometriasBairros())).toBe('offline')
    expect(await codigo(s.getGeometriasBairros())).toBe('nao-encontrado')
    expect(await codigo(s.getGeometriasBairros())).toBe('desconhecido')
    expect(await codigo(s.getGeometriasBairros())).toBe('desconhecido')
    await expect(s.getGeometriasBairros()).resolves.toEqual({ b1: 'POLYGON((0 0))' })
    expect(fetchFn).toHaveBeenCalledTimes(5)
  })
})
