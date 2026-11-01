import { useCallback, useEffect, useState } from 'react'
import { ServicoErro, useServicos, type CodigoErro } from '../../services'
import type {
  AgendaDia,
  Alerta,
  Checkin,
  SugestaoQuadro,
  Unidade,
} from '../../services/tipos-provisorios'

const JANELA_RELATOS_MS = 2 * 60 * 60_000
const TICK_MS = 60_000

export type EstadoUpa =
  | { tipo: 'carregando' }
  | { tipo: 'nao-encontrada' }
  | { tipo: 'erro'; codigo: CodigoErro }
  | {
      tipo: 'pronto'
      unidade: Unidade
      agenda: AgendaDia[]
      alertas: Alerta[]
      sugestoes: SugestaoQuadro[]
    }

type Resultado = Exclude<EstadoUpa, { tipo: 'carregando' }>

/**
 * Carrega a UPA (unidade, agenda, avisos e sugestões do quadro) e acompanha os check-ins em tempo real.
 *
 * Decisão de estado: cada resposta guarda a `chave` (slug + tentativa) para a qual foi pedida.
 * Se a chave mudou (outro slug, ou "Tentar de novo"), a resposta antiga é ignorada e o estado
 * derivado volta a ser 'carregando'. Assim o efeito nunca chama setState de forma síncrona e
 * uma resposta que chega atrasada não sobrescreve a UPA nova.
 */
export function useUpa(slug: string) {
  const servicos = useServicos()
  const [tentativa, setTentativa] = useState(0)
  const chave = `${slug}#${tentativa}`

  const [resposta, setResposta] = useState<{ chave: string; resultado: Resultado } | null>(null)
  const [relatos, setRelatos] = useState<{ slug: string; lista: Checkin[] } | null>(null)
  // O relógio anda de minuto em minuto: atualiza "há X min" e a virada de horário da agenda.
  const [agoraMs, setAgoraMs] = useState(() => Date.now())

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const unidade = await servicos.getUnidade(slug)
        if (cancelado) return
        if (!unidade) return setResposta({ chave, resultado: { tipo: 'nao-encontrada' } })
        const [agenda, alertas, sugestoes] = await Promise.all([
          servicos.getAgenda(slug),
          servicos.listarAlertas(slug),
          servicos.listarSugestoes(slug),
        ])
        if (cancelado) return
        setResposta({ chave, resultado: { tipo: 'pronto', unidade, agenda, alertas, sugestoes } })
      } catch (e) {
        if (cancelado) return
        const codigo = e instanceof ServicoErro ? e.codigo : 'desconhecido'
        setResposta({
          chave,
          resultado: codigo === 'nao-encontrado' ? { tipo: 'nao-encontrada' } : { tipo: 'erro', codigo },
        })
      }
    })()
    return () => {
      cancelado = true
    }
  }, [servicos, slug, chave])

  const resultado = resposta?.chave === chave ? resposta.resultado : null
  const unidadeExiste = resultado?.tipo === 'pronto'

  useEffect(() => {
    if (!unidadeExiste) return
    const desdeMs = Date.now() - JANELA_RELATOS_MS
    const cancelar = servicos.observarCheckins(slug, desdeMs, (lista) => {
      setRelatos({ slug, lista })
      // Relato novo é posterior ao último "agora" guardado; sem atualizar, a estimativa o
      // trataria como "do futuro" e o ignoraria até o próximo minuto.
      setAgoraMs(Date.now())
    })
    return cancelar // sem isto o ouvinte continuaria vivo depois de sair da página
  }, [servicos, slug, unidadeExiste])

  useEffect(() => {
    const id = setInterval(() => setAgoraMs(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const recarregar = useCallback(() => setTentativa((n) => n + 1), [])

  const estado: EstadoUpa = resultado ?? { tipo: 'carregando' }
  const checkins = relatos?.slug === slug ? relatos.lista : []
  return { estado, checkins, agoraMs, recarregar }
}
