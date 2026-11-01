import type {
  AgendaDia,
  Alerta,
  Checkin,
  GeometriasBairros,
  Historico,
  SugestaoQuadro,
  Unidade,
} from './tipos-provisorios'

export type CodigoErro =
  | 'offline'
  | 'permissao'
  | 'limite'
  | 'validacao'
  | 'nao-encontrado'
  | 'desconhecido'

// O plano usa `constructor(public codigo ...)`, mas o tsconfig tem erasableSyntaxOnly,
// que proíbe parameter properties. O campo é declarado à mão; o comportamento é o mesmo.
export class ServicoErro extends Error {
  readonly codigo: CodigoErro

  constructor(codigo: CodigoErro, mensagem: string) {
    super(mensagem)
    this.name = 'ServicoErro'
    this.codigo = codigo
  }
}

export interface Servicos {
  getUnidades(): Promise<Unidade[]>
  getUnidade(slug: string): Promise<Unidade | null>
  getAgenda(slug: string): Promise<AgendaDia[]> // 7 dias, ordem dom..sab
  observarCheckins(slug: string, desdeMs: number, cb: (lista: Checkin[]) => void): () => void // tempo real; devolve unsubscribe
  registrarCheckin(dados: Omit<Checkin, 'criadoEm' | 'janela'>): Promise<void>
  listarAlertas(slug: string): Promise<Alerta[]> // só não expirados
  criarAlerta(
    dados: Omit<Alerta, 'criadoEm' | 'expiraEm' | 'confirmacoes' | 'contestacoes'>,
  ): Promise<string>
  votarAlerta(id: string, voto: 'confirmo' | 'contesto'): Promise<void>
  listarSugestoes(slug: string): Promise<SugestaoQuadro[]> // pendentes + vigentes
  criarSugestao(
    dados: Omit<SugestaoQuadro, 'criadoEm' | 'confirmacoes' | 'status'>,
  ): Promise<string>
  confirmarSugestao(id: string): Promise<void>
  getHistorico(slug: string): Promise<Historico[]>
  getGeometriasBairros(): Promise<GeometriasBairros> // baixa public/bairros-geo.json uma vez
  garantirSessao(): Promise<string> // uid anônimo; no mock, uid fixo
}
