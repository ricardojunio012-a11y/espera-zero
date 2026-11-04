import { desprojetarXY, estimarEspera, recomendar } from '@espera-zero/shared'
import type { BairroCentro, Especialidade, Estimativa, Posicao, Recomendacao, Unidade } from '@espera-zero/shared'
import type { Painel } from '../services/servicos'

/** The four specialties of the pilot scope, in the order of the tabs. */
export const ESPECIALIDADES: { id: Especialidade; nome: string }[] = [
  { id: 'clinica', nome: 'Clínica' },
  { id: 'pediatria', nome: 'Pediatria' },
  { id: 'ortopedia', nome: 'Ortopedia' },
  { id: 'odonto', nome: 'Odonto' },
]

export function nomeEspecialidade(id: Especialidade): string {
  return ESPECIALIDADES.find((e) => e.id === id)?.nome ?? id
}

export function posicaoDoBairro(bairro: BairroCentro): Posicao {
  const [lat, lng] = desprojetarXY(bairro.centroX, bairro.centroY)
  return { lat, lng }
}

export type LinhaUpa =
  | ({ atende: true } & Recomendacao)
  | { atende: false; unidade: Unidade }

/**
 * RF-08: UPAs that serve the specialty now, ordered by wait + travel (RN-10),
 * then the ones that don't, at the end and marked.
 */
export function ordenarUpas(painel: Painel, esp: Especialidade, posicao: Posicao | null, agora: Date): LinhaUpa[] {
  const estimativas: Record<string, Estimativa> = {}
  for (const unidade of painel.unidades) {
    const daUnidade = painel.checkins.filter((c) => c.slug === unidade.slug)
    estimativas[unidade.slug] = estimarEspera(daUnidade, agora.getTime(), esp)
  }
  const atendem = recomendar(painel.unidades, esp, posicao, estimativas, painel.agendas, painel.alertas, agora)
  const slugs = new Set(atendem.map((r) => r.unidade.slug))
  const naoAtendem = painel.unidades
    .filter((u) => !slugs.has(u.slug))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return [
    ...atendem.map((r): LinhaUpa => ({ atende: true, ...r })),
    ...naoAtendem.map((unidade): LinhaUpa => ({ atende: false, unidade })),
  ]
}

/** RF-11: every estimate says where it came from. */
export function origemDaEstimativa(estimativa: Estimativa): string {
  if (estimativa.origem === 'sem-dados') return 'sem informação recente'
  if (estimativa.origem === 'historico') return 'estimativa pelo histórico'
  const relatos = estimativa.relatos === 1 ? '1 relato' : `${estimativa.relatos} relatos`
  return estimativa.ultimoHaMin === null ? relatos : `${relatos} · há ${estimativa.ultimoHaMin} min`
}

export function precisaConfirmar(estimativa: Estimativa): boolean {
  return estimativa.relatos < 6 || (estimativa.ultimoHaMin !== null && estimativa.ultimoHaMin > 30)
}

export function linkComoChegar(unidade: Pick<Unidade, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${unidade.lat},${unidade.lng}`
}

/**
 * RF-21 / RN-22: only UPA, address and specialty go in the message, never
 * symptoms or risk colour. wa.me opens WhatsApp with the text filled in.
 */
export function mensagemFamilia(unidade: Pick<Unidade, 'nome' | 'endereco' | 'bairro'>, esp: Especialidade): string {
  return `Estou indo para a ${unidade.nome} (${unidade.endereco}, ${unidade.bairro}), atendimento de ${nomeEspecialidade(esp).toLowerCase()}. Aviso quando for atendido.`
}

export function linkWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

/**
 * RF-09: one sentence on why this one. When the closest UPA isn't the
 * recommended one, say why.
 */
export function porQue(linhas: LinhaUpa[], posicao: Posicao | null): string | null {
  const [primeira] = linhas
  if (!primeira?.atende || posicao === null) return null
  const comTrajeto = linhas.filter((l): l is Extract<LinhaUpa, { atende: true }> => l.atende && l.trajetoMin !== null)
  const maisPerto = [...comTrajeto].sort((a, b) => (a.trajetoMin ?? 0) - (b.trajetoMin ?? 0))[0]
  if (!maisPerto || maisPerto.unidade.slug === primeira.unidade.slug) {
    return 'É a mais perto e tem o menor tempo total agora.'
  }
  const espera = maisPerto.estimativa.minutos
  return espera === null
    ? `A ${maisPerto.unidade.nome} está mais perto (${maisPerto.trajetoMin} min), mas não tem informação recente de espera.`
    : `A ${maisPerto.unidade.nome} está mais perto (${maisPerto.trajetoMin} min), mas a espera lá é de ${espera} min.`
}
