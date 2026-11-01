import { ServicoErro, type CodigoErro, type Servicos } from '../contrato-servicos'
import { alertaAtivo, janelaDe } from '../regras-provisorias'
import type {
  AgendaDia,
  Alerta,
  Checkin,
  GeometriasBairros,
  SugestaoQuadro,
} from '../tipos-provisorios'
import {
  UNIDADES,
  agendaInicial,
  alertasIniciais,
  checkinsIniciais,
  historicoInicial,
} from './dados'
import {
  CONFIRMACOES_PARA_VIGORAR,
  CORES_RISCO,
  DIAS_VALIDOS,
  ESPECIALIDADES,
  MAX_MINUTOS,
  MAX_TEXTO_ALERTA,
  MIN_MINUTOS,
  MODOS,
  TIPOS_ALERTA,
  exigirEm,
  exigirHora,
  recusar,
} from './validacao'

const HORA_MS = 3_600_000

// TODO(contrato): Alerta e SugestaoQuadro não têm `id` no plano, mas votarAlerta(id) e
// confirmarSugestao(id) precisam dele e a tela só o conhece pela listagem. Enquanto o contrato
// não define isso, as listagens devolvem `id` em tempo de execução (o tipo ainda não o expõe).

/** Operação que ficaria na fila ez.filaOffline (seção 6.7 do plano). */
export interface OperacaoOffline {
  tipo: 'registrarCheckin' | 'criarAlerta'
  dados: unknown
  em: string
}

export interface OpcoesMock {
  /** Relógio injetável; os testes avançam o tempo sem esperar. */
  agora?: () => number
  latenciaMs?: number
  uid?: string
  fetchFn?: typeof fetch
  urlGeometrias?: string
  /**
   * TODO(T32): gravar `op` em ez.filaOffline e reenviar ao voltar a conexão (RNF-05).
   * Hoje o mock só avisa este gancho quando a operação falha com 'offline'.
   */
  aoFalharOffline?: (op: OperacaoOffline) => void | Promise<void>
}

/** Controles que existem só no mock; as telas continuam enxergando `Servicos`. */
export interface ServicosMock extends Servicos {
  /** Faz toda chamada seguinte rejeitar com esse código, até `null`. */
  simularErro(codigo: CodigoErro | null): void
  definirLatencia(ms: number): void
  /** Muda "quem" está logado, para testar regras de 1 voto por uid. */
  trocarUid(uid: string): void
}

interface Observador {
  slug: string
  desdeMs: number
  cb: (lista: Checkin[]) => void
  ativo: boolean
}

export function criarServicosMock(opcoes: OpcoesMock = {}): ServicosMock {
  const agora = opcoes.agora ?? (() => Date.now())
  const fetchFn = opcoes.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const urlGeometrias = opcoes.urlGeometrias ?? '/bairros-geo.json'
  let latenciaMs = opcoes.latenciaMs ?? 0
  let uid = opcoes.uid ?? 'mock-uid-1'
  let erroSimulado: CodigoErro | null = null

  // Todo o estado vive aqui dentro: cada criarServicosMock() nasce zerado.
  const t0 = agora()
  const checkins = checkinsIniciais(t0)
  const alertas = new Map<string, Alerta>(alertasIniciais(t0).map((a, i) => [`alerta-semente-${i}`, a]))
  const votosAlerta = new Map<string, Set<string>>()
  const sugestoes = new Map<string, { sugestao: SugestaoQuadro; autor: string }>()
  const votosSugestao = new Map<string, Set<string>>()
  const agendas = new Map<string, AgendaDia[]>(UNIDADES.map((u) => [u.slug, agendaInicial(t0)]))
  const observadores = new Set<Observador>()
  let contador = 0
  let geometrias: Promise<GeometriasBairros> | null = null

  const iso = (ms: number) => new Date(ms).toISOString()

  /**
   * Toda chamada passa por aqui: espera a latência, aplica o erro simulado e só então roda
   * `corpo`. O corpo é síncrono de propósito: depois do `await` não há outro ponto de
   * interrupção, então "checar e gravar" é atômico, como numa transação do Firestore.
   */
  async function executar<T>(corpo: () => T | Promise<T>, offline?: () => OperacaoOffline): Promise<T> {
    try {
      if (latenciaMs > 0) await new Promise((r) => setTimeout(r, latenciaMs))
      if (erroSimulado) throw new ServicoErro(erroSimulado, `Erro simulado: ${erroSimulado}.`)
      return await corpo()
    } catch (e) {
      const erro = e instanceof ServicoErro ? e : new ServicoErro('desconhecido', String(e))
      if (offline && erro.codigo === 'offline') await opcoes.aoFalharOffline?.(offline())
      throw erro
    }
  }

  const exigirUnidade = (slug: string) => {
    if (!UNIDADES.some((u) => u.slug === slug)) {
      throw new ServicoErro('nao-encontrado', `Unidade "${slug}" não existe.`)
    }
  }

  function listaPara(o: Observador): Checkin[] {
    return [...checkins.values()]
      .filter((c) => c.slug === o.slug && Date.parse(c.criadoEm) >= o.desdeMs)
      .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))
      .map((c) => ({ ...c }))
  }

  function notificar(o: Observador) {
    if (!o.ativo) return
    try {
      o.cb(listaPara(o))
    } catch (e) {
      // Um ouvinte que quebra não pode impedir os outros de receber a lista.
      console.error('Erro em callback de observarCheckins:', e)
    }
  }

  function aplicarNaAgenda(s: SugestaoQuadro) {
    // TODO(contrato): "substitui a linha inteira da especialidade" (RN-19) foi lido como:
    // os dias sugeridos recebem o horário e os demais dias ficam 'nao'. Confirmar com o Davi.
    const valor = s.modo === '24h' ? '24h' : s.modo === 'nao' ? 'nao' : { de: s.de!, ate: s.ate! }
    for (const dia of agendas.get(s.slug) ?? []) {
      dia.horarios[s.especialidade] = s.dias.includes(dia.dia) ? valor : 'nao'
      dia.origem = 'comunidade'
      dia.atualizadoEm = iso(agora())
    }
  }

  async function baixarGeometrias(): Promise<GeometriasBairros> {
    let resp: Response
    try {
      resp = await fetchFn(urlGeometrias)
    } catch {
      throw new ServicoErro('offline', 'Sem conexão para baixar os bairros.')
    }
    if (resp.status === 404) throw new ServicoErro('nao-encontrado', 'Arquivo de bairros não encontrado.')
    if (!resp.ok) throw new ServicoErro('desconhecido', `Falha ao baixar os bairros (${resp.status}).`)
    try {
      return (await resp.json()) as GeometriasBairros
    } catch {
      throw new ServicoErro('desconhecido', 'Arquivo de bairros inválido.')
    }
  }

  return {
    simularErro: (codigo) => {
      erroSimulado = codigo
    },
    definirLatencia: (ms) => {
      latenciaMs = ms
    },
    trocarUid: (novo) => {
      uid = novo
    },

    garantirSessao: () => executar(() => uid),

    getUnidades: () => executar(() => structuredClone(UNIDADES)),

    getUnidade: (slug) =>
      executar(() => {
        const u = UNIDADES.find((x) => x.slug === slug)
        return u ? structuredClone(u) : null
      }),

    getAgenda: (slug) => executar(() => structuredClone(agendas.get(slug) ?? [])),

    observarCheckins(slug, desdeMs, cb) {
      const obs: Observador = { slug, desdeMs, cb, ativo: true }
      observadores.add(obs)
      // Microtask, não chamada direta: o Firestore também entrega o 1º snapshot de forma
      // assíncrona, e assim o chamador já tem o `unsubscribe` na mão quando o callback roda.
      queueMicrotask(() => notificar(obs))
      return () => {
        obs.ativo = false // cobre o caso de cancelar antes do 1º callback
        observadores.delete(obs)
      }
    },

    registrarCheckin: (dados) =>
      executar(
        () => {
          exigirEm(ESPECIALIDADES, dados.especialidade, 'Especialidade')
          if (dados.risco !== undefined) exigirEm(CORES_RISCO, dados.risco, 'Cor de risco')
          if (!Number.isInteger(dados.minutos) || dados.minutos < MIN_MINUTOS || dados.minutos > MAX_MINUTOS) {
            recusar(`Minutos deve ser inteiro entre ${MIN_MINUTOS} e ${MAX_MINUTOS}.`)
          }
          exigirUnidade(dados.slug)

          const agoraMs = agora()
          const janela = janelaDe(agoraMs)
          const id = `${dados.slug}_${uid}_${janela}`
          if (checkins.has(id)) {
            throw new ServicoErro('limite', 'Já existe um check-in seu nesta janela de 30 minutos.')
          }
          checkins.set(id, { ...dados, janela, criadoEm: iso(agoraMs) })
          observadores.forEach((o) => o.slug === dados.slug && notificar(o))
        },
        () => ({ tipo: 'registrarCheckin', dados, em: iso(agora()) }),
      ),

    listarAlertas: (slug) =>
      executar(() =>
        [...alertas.entries()]
          .filter(([, a]) => a.slug === slug && alertaAtivo(a, agora()))
          .map(([id, a]) => ({ ...a, id }) as Alerta),
      ),

    criarAlerta: (dados) =>
      executar(
        () => {
          exigirEm(TIPOS_ALERTA, dados.tipo, 'Tipo de alerta')
          if (dados.especialidade !== undefined) exigirEm(ESPECIALIDADES, dados.especialidade, 'Especialidade')
          if (dados.texto !== undefined) {
            if (dados.tipo !== 'outro') recusar('Texto só é permitido no tipo "outro".')
            if (dados.texto.length > MAX_TEXTO_ALERTA) recusar(`Texto passa de ${MAX_TEXTO_ALERTA} caracteres.`)
          }
          exigirUnidade(dados.slug)

          const criadoMs = agora()
          const horas = dados.tipo === 'sem-profissional' ? 12 : 6
          const id = `alerta-${++contador}`
          alertas.set(id, {
            ...dados,
            criadoEm: iso(criadoMs),
            expiraEm: iso(criadoMs + horas * HORA_MS),
            confirmacoes: 0,
            contestacoes: 0,
          })
          return id
        },
        () => ({ tipo: 'criarAlerta', dados, em: iso(agora()) }),
      ),

    votarAlerta: (id, voto) =>
      executar(() => {
        exigirEm(['confirmo', 'contesto'], voto, 'Voto')
        const alerta = alertas.get(id)
        if (!alerta) throw new ServicoErro('nao-encontrado', 'Aviso não encontrado.')
        const votantes = votosAlerta.get(id) ?? new Set<string>()
        if (votantes.has(uid)) throw new ServicoErro('limite', 'Você já votou neste aviso.')
        votantes.add(uid)
        votosAlerta.set(id, votantes)
        if (voto === 'confirmo') alerta.confirmacoes += 1
        else alerta.contestacoes += 1
      }),

    listarSugestoes: (slug) =>
      executar(() =>
        [...sugestoes.entries()]
          .filter(([, s]) => s.sugestao.slug === slug && s.sugestao.status !== 'rejeitada')
          .map(([id, s]) => ({ ...s.sugestao, dias: [...s.sugestao.dias], id }) as SugestaoQuadro),
      ),

    criarSugestao: (dados) =>
      executar(() => {
        exigirEm(ESPECIALIDADES, dados.especialidade, 'Especialidade')
        exigirEm(MODOS, dados.modo, 'Modo')
        if (!dados.dias.length) recusar('Escolha ao menos um dia.')
        dados.dias.forEach((d) => exigirEm(DIAS_VALIDOS, d, 'Dia'))
        if (dados.modo === 'horario') {
          exigirHora(dados.de, 'Hora de início')
          exigirHora(dados.ate, 'Hora de fim')
        } else if (dados.de !== undefined || dados.ate !== undefined) {
          recusar('Horário só vale no modo "horario".')
        }
        exigirUnidade(dados.slug)

        const id = `sugestao-${++contador}`
        sugestoes.set(id, {
          autor: uid,
          sugestao: {
            ...dados,
            dias: [...dados.dias],
            confirmacoes: 0,
            status: 'pendente',
            criadoEm: iso(agora()),
          },
        })
        return id
      }),

    confirmarSugestao: (id) =>
      executar(() => {
        const item = sugestoes.get(id)
        if (!item) throw new ServicoErro('nao-encontrado', 'Sugestão não encontrada.')
        // RN-19: confirmam "pessoas diferentes de quem sugeriu".
        if (item.autor === uid) throw new ServicoErro('permissao', 'Quem sugeriu não pode confirmar.')
        const votantes = votosSugestao.get(id) ?? new Set<string>()
        if (votantes.has(uid)) throw new ServicoErro('limite', 'Você já confirmou esta sugestão.')
        votantes.add(uid)
        votosSugestao.set(id, votantes)

        const s = item.sugestao
        s.confirmacoes += 1
        // No Firestore quem promove é o Admin SDK (plano 6.3); o mock faz na hora.
        if (s.status === 'pendente' && s.confirmacoes >= CONFIRMACOES_PARA_VIGORAR) {
          s.status = 'vigente'
          aplicarNaAgenda(s)
        }
      }),

    getHistorico: (slug) =>
      executar(() => (UNIDADES.some((u) => u.slug === slug) ? historicoInicial(slug, t0) : [])),

    getGeometriasBairros: () =>
      executar(() => {
        // Guarda a Promise (não o resultado): duas chamadas seguidas dividem o mesmo download.
        // Se falhar, limpa o cache para a próxima chamada tentar de novo.
        geometrias ??= baixarGeometrias().catch((e) => {
          geometrias = null
          throw e
        })
        return geometrias
      }),
  }
}
