// TODO(contrato): trocar por `import type { ... } from '@espera-zero/shared'` quando
// packages/shared/src/tipos.ts for mergeado. Copiado da seção 6.2 do plano, sem campos novos.

export type Especialidade = 'clinica' | 'pediatria' | 'ortopedia' | 'odonto'
export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab'
export type Regional =
  | 'barreiro'
  | 'centro-sul'
  | 'leste'
  | 'nordeste'
  | 'noroeste'
  | 'norte'
  | 'oeste'
  | 'pampulha'
  | 'venda-nova'

export interface Unidade {
  slug: string
  nome: string
  tipo: 'upa'
  endereco: string
  bairro: string
  regional: Regional
  lat: number
  lng: number
  telefone?: string
  especialidades: Especialidade[]
  fontePbh: { id: string; atualizadoEm: string }
}

export interface AgendaDia {
  dia: DiaSemana
  horarios: Partial<Record<Especialidade, { de: string; ate: string } | '24h' | 'nao'>>
  origem: 'grupo' | 'comunidade'
  atualizadoEm: string
}

export interface Checkin {
  slug: string
  especialidade: Especialidade
  minutos: number
  janela: number
  risco?: 'azul' | 'verde' | 'amarelo' | 'laranja' | 'vermelho'
  criadoEm: string
}

export interface Alerta {
  slug: string
  tipo: 'tem-profissional' | 'sem-profissional' | 'raio-x' | 'fila' | 'farmacia' | 'outro'
  especialidade?: Especialidade
  texto?: string
  criadoEm: string
  expiraEm: string
  confirmacoes: number
  contestacoes: number
}

export interface SugestaoQuadro {
  slug: string
  especialidade: Especialidade
  dias: DiaSemana[]
  modo: '24h' | 'horario' | 'nao'
  de?: string
  ate?: string
  confirmacoes: number
  status: 'pendente' | 'vigente' | 'rejeitada'
  criadoEm: string
}

export interface Historico {
  slug: string
  dia: DiaSemana
  hora: number
  medianaMin: number
  amostras: number
  atualizadoEm: string
}

// TODO(contrato): GeometriasBairros está no CLAUDE.md mas não na seção 6.2 do plano.
// Forma provisória: id do bairro -> geometria em WKT.
export type GeometriasBairros = Record<string, string>
