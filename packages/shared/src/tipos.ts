/** Tipos compartilhados do Espera Zero. Contrato base derivado da seção 6 do Plano de Trabalho. */
/** Categorias gerais do domínio; sua presença no enum não implica oferta em uma UPA. */
export type Especialidade = 'clinica' | 'pediatria' | 'ortopedia' | 'odonto' | 'cirurgia-geral';
export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';
export type Regional = 'barreiro' | 'centro-sul' | 'leste' | 'nordeste' | 'noroeste' | 'norte' | 'oeste' | 'pampulha' | 'venda-nova';
export type CorRisco = 'azul' | 'verde' | 'amarelo' | 'laranja' | 'vermelho';
export type OrigemEstimativa = 'relatos' | 'historico' | 'sem-dados';
export type Confianca = 'alta' | 'media' | 'baixa';

export interface Unidade {
  slug: string;
  nome: string;
  tipo: 'upa';
  endereco: string;
  bairro: string;
  regional: Regional;
  lat: number;
  lng: number;
  telefone?: string;
  /** Especialidades listadas para esta unidade no arquivo de referência; ainda precisam de confirmação e não indicam disponibilidade hoje. */
  especialidades: Especialidade[];
  fontePbh: { id: string; atualizadoEm: string };
  /** Campo auxiliar dos dados fornecidos. Não precisa ir para o Firestore. */
  fonteCoordenadas?: string;
  /** Campo copiado da tabela enviada; requer validação da PBH antes de uso operacional. */
  especialidadesFonte?: string[];
  /** Notas de serviços informadas no arquivo atualizado; não substituem agenda do dia. */
  servicosEspecificos?: string[];
  /** false indica endereço/coordenada pendente de confirmação; ausente = status não documentado. */
  coordenadasConfirmadas?: boolean;
}

export type HorarioEspecialidade = { de: string; ate: string } | '24h' | 'nao';
export interface AgendaDia {
  dia: DiaSemana;
  horarios: Partial<Record<Especialidade, HorarioEspecialidade>>;
  origem: 'grupo' | 'comunidade';
  atualizadoEm: string;
}

export interface Checkin {
  slug: string;
  especialidade: Especialidade;
  minutos: number;
  janela: number;
  risco?: CorRisco;
  criadoEm: string;
}

export type TipoAlerta = 'tem-profissional' | 'sem-profissional' | 'raio-x' | 'fila' | 'farmacia' | 'outro';
export interface Alerta {
  slug: string;
  tipo: TipoAlerta;
  especialidade?: Especialidade;
  texto?: string;
  criadoEm: string;
  expiraEm: string;
  confirmacoes: number;
  contestacoes: number;
}

export interface SugestaoQuadro {
  slug: string;
  especialidade: Especialidade;
  dias: DiaSemana[];
  modo: '24h' | 'horario' | 'nao';
  de?: string;
  ate?: string;
  confirmacoes: number;
  status: 'pendente' | 'vigente' | 'rejeitada';
  criadoEm: string;
}

export interface Historico {
  slug: string;
  /** Obrigatória: cada série histórica pertence a uma especialidade específica. */
  especialidade: Especialidade;
  dia: DiaSemana;
  hora: number;
  medianaMin: number;
  amostras: number;
  atualizadoEm: string;
}

/** Centro leve usado para cálculo de proximidade; não inclui WKT. */
export interface BairroCentro {
  id: string;
  codigo: string;
  nome: string;
  areaKm2: number;
  perimetroM: number;
  regional: Regional;
  regionalFonte?: string;
  idLinhaFonte?: number;
  centroX: number;
  centroY: number;
}

/** Geometria isolada, baixada sob demanda após consentimento de localização. */
export interface GeometriaBairro {
  id: string;
  geometriaWkt: string;
}

export interface Estimativa {
  minutos: number | null;
  relatos: number;
  ultimoHaMin: number | null;
  origem: OrigemEstimativa;
  confianca: Confianca;
}

export interface RespostasTriagem {
  paraQuem: 'eu' | 'crianca' | 'idoso' | 'outro';
  sinaisAlerta: string[];
  sintoma: string;
  tempo: 'agora' | 'hoje' | 'dias' | 'semanas';
}

export interface ResultadoTriagem {
  destino: 'samu' | 'upa' | 'centro-saude' | 'teleconsulta';
  especialidade?: Especialidade;
  motivos: string[];
}

export interface Recomendacao {
  unidade: Unidade;
  estimativa: Estimativa;
  trajetoMin: number | null;
  totalMin: number | null;
  motivo: string;
  atendeAgora: boolean;
}

export interface Bairro {
  id: string;
  codigo: string;
  nome: string;
  areaKm2: number;
  perimetroM: number;
  /** WKT em coordenadas métricas; a fonte oficial da PBH indica EPSG:31983 (SIRGAS 2000 / UTM zona 23S). */
  geometriaWkt: string;
  /** Regional administrativa importada do arquivo atualizado. */
  regional: Regional;
  /** Valor textual original fornecido no JSON, para auditoria. */
  regionalFonte?: string;
  /** _id/ordem da linha no arquivo fonte. */
  idLinhaFonte?: number;
}
