import { describe, expect, it } from 'vitest'
import { ServicoErro, type Servicos } from '../index'

/**
 * Testes de contrato da camada services (seções 6.3 e 6.4 do plano).
 * Rodam contra qualquer implementação de `Servicos`: hoje o mock; na T25, o Firestore
 * (emulador). `fabrica` deve devolver uma instância limpa a cada chamada.
 * Só vale aqui o que as DUAS implementações precisam cumprir. O que depende de relógio
 * injetável, de trocar de uid ou de simular falha fica em mock/mock.test.ts.
 */
export function testarContrato(nome: string, fabrica: () => Servicos | Promise<Servicos>) {
  describe(`contrato de Servicos: ${nome}`, () => {
    async function nova() {
      const s = await fabrica()
      const [unidade] = await s.getUnidades()
      return { s, slug: unidade.slug }
    }
    const checkin = (slug: string, minutos: number) => ({
      slug,
      especialidade: 'clinica' as const,
      minutos,
    })
    const rejeicao = (p: Promise<unknown>) =>
      p.then(
        () => null,
        (e: unknown) => e,
      )
    const codigoDe = async (p: Promise<unknown>) => {
      const erro = await rejeicao(p)
      expect(erro).toBeInstanceOf(ServicoErro)
      return (erro as ServicoErro).codigo
    }
    // TODO(contrato): `id` ainda não existe nos tipos Alerta/SugestaoQuadro (ver mock/index.ts).
    const idDe = (x: unknown) => (x as { id?: string }).id

    it('lista unidades e acha uma por slug (null se não existe)', async () => {
      const { s, slug } = await nova()
      expect((await s.getUnidades()).length).toBeGreaterThan(0)
      expect((await s.getUnidade(slug))?.slug).toBe(slug)
      expect(await s.getUnidade('nao-existe')).toBeNull()
    })

    it('devolve a agenda com 7 dias na ordem dom..sab', async () => {
      const { s, slug } = await nova()
      const agenda = await s.getAgenda(slug)
      expect(agenda.map((d) => d.dia)).toEqual(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
    })

    it('garantirSessao devolve sempre o mesmo uid não vazio', async () => {
      const { s } = await nova()
      const uid = await s.garantirSessao()
      expect(uid).not.toBe('')
      expect(await s.garantirSessao()).toBe(uid)
    })

    describe('check-ins', () => {
      it('aceita um check-in válido e o entrega a quem observa', async () => {
        const { s, slug } = await nova()
        const quantidades: number[] = []
        const parar = s.observarCheckins(slug, 0, (l) => quantidades.push(l.length))
        await new Promise((r) => setTimeout(r, 50))
        const antes = quantidades.at(-1)!
        await s.registrarCheckin(checkin(slug, 45))
        await new Promise((r) => setTimeout(r, 50))
        parar()
        expect(quantidades.at(-1)).toBe(antes + 1)
      })

      it.each([-1, 361, 12.5, Number.NaN])('recusa minutos %s com "validacao"', async (minutos) => {
        const { s, slug } = await nova()
        expect(await codigoDe(s.registrarCheckin(checkin(slug, minutos)))).toBe('validacao')
      })

      it.each([0, 360])('aceita o extremo %i', async (minutos) => {
        const { s, slug } = await nova()
        await expect(s.registrarCheckin(checkin(slug, minutos))).resolves.toBeUndefined()
      })

      it('recusa o segundo check-in do mesmo uid na mesma janela com "limite"', async () => {
        const { s, slug } = await nova()
        await s.registrarCheckin(checkin(slug, 30))
        expect(await codigoDe(s.registrarCheckin(checkin(slug, 40)))).toBe('limite')
      })
    })

    describe('alertas', () => {
      it('cria, lista e devolve só alertas não expirados', async () => {
        const { s, slug } = await nova()
        const id = await s.criarAlerta({ slug, tipo: 'raio-x' })
        expect(id).not.toBe('')
        const lista = await s.listarAlertas(slug)
        expect(lista.some((a) => idDe(a) === id)).toBe(true)
        expect(lista.every((a) => Date.parse(a.expiraEm) > Date.now())).toBe(true)
      })

      it.each([
        ['raio-x', 6],
        ['sem-profissional', 12],
      ] as const)('"%s" expira em +%i h', async (tipo, horas) => {
        const { s, slug } = await nova()
        const id = await s.criarAlerta({ slug, tipo })
        const a = (await s.listarAlertas(slug)).find((x) => idDe(x) === id)!
        expect(Date.parse(a.expiraEm) - Date.parse(a.criadoEm)).toBe(horas * 3_600_000)
        expect([a.confirmacoes, a.contestacoes]).toEqual([0, 0])
      })

      it('aceita texto de até 120 caracteres, e só no tipo "outro"', async () => {
        const { s, slug } = await nova()
        await expect(
          s.criarAlerta({ slug, tipo: 'outro', texto: 'a'.repeat(120) }),
        ).resolves.toBeTruthy()
        const longo = s.criarAlerta({ slug, tipo: 'outro', texto: 'a'.repeat(121) })
        expect(await codigoDe(longo)).toBe('validacao')
        const fora = s.criarAlerta({ slug, tipo: 'fila', texto: 'não deveria ter texto' })
        expect(await codigoDe(fora)).toBe('validacao')
      })

      it('permite 1 voto por uid ("limite" no segundo) e conta o voto', async () => {
        const { s, slug } = await nova()
        const id = await s.criarAlerta({ slug, tipo: 'fila' })
        await s.votarAlerta(id, 'confirmo')
        expect(await codigoDe(s.votarAlerta(id, 'contesto'))).toBe('limite')
        const a = (await s.listarAlertas(slug)).find((x) => idDe(x) === id)!
        expect([a.confirmacoes, a.contestacoes]).toEqual([1, 0])
      })

      it('votar em aviso inexistente dá "nao-encontrado"', async () => {
        const { s } = await nova()
        expect(await codigoDe(s.votarAlerta('nao-existe', 'confirmo'))).toBe('nao-encontrado')
      })
    })

    describe('sugestões do quadro', () => {
      it('cria como "pendente" com 0 confirmações e lista', async () => {
        const { s, slug } = await nova()
        const id = await s.criarSugestao({
          slug,
          especialidade: 'pediatria',
          dias: ['seg', 'ter'],
          modo: 'horario',
          de: '08:00',
          ate: '18:00',
        })
        const item = (await s.listarSugestoes(slug)).find((x) => idDe(x) === id)
        expect(item).toMatchObject({ status: 'pendente', confirmacoes: 0, dias: ['seg', 'ter'] })
      })

      it('recusa sugestão sem dias, com horário fora do modo "horario" ou sem horário nele', async () => {
        const { s, slug } = await nova()
        const base = { slug, especialidade: 'clinica' as const }
        const invalidas = [
          { ...base, dias: [], modo: '24h' as const },
          { ...base, dias: ['seg' as const], modo: '24h' as const, de: '08:00' },
          { ...base, dias: ['seg' as const], modo: 'horario' as const },
        ]
        for (const dados of invalidas) {
          expect(await codigoDe(s.criarSugestao(dados))).toBe('validacao')
        }
      })

      it('confirmar sugestão inexistente dá "nao-encontrado"', async () => {
        const { s } = await nova()
        expect(await codigoDe(s.confirmarSugestao('nao-existe'))).toBe('nao-encontrado')
      })
    })

    it('getHistorico devolve a série da unidade, com hora de 0 a 23', async () => {
      const { s, slug } = await nova()
      const h = await s.getHistorico(slug)
      expect(h.every((x) => x.slug === slug && x.hora >= 0 && x.hora <= 23)).toBe(true)
    })
  })
}
