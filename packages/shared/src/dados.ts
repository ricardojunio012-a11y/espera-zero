import unidadesJson from '../data/unidades.json';
import bairrosCentrosJson from '../data/bairros-centros.json';
import type { BairroCentro, Regional, Unidade } from './tipos';

/** Dados de referência normalizados dos arquivos atualizados enviados para o projeto. */
export const UNIDADES = unidadesJson.unidades as Unidade[];
export const BAIRROS_CENTROS = bairrosCentrosJson.bairros as BairroCentro[];
export const METADADOS_UNIDADES = unidadesJson.metadados;
export const METADADOS_BAIRROS = bairrosCentrosJson.metadados;

export const REGIONAIS_VALIDAS: Regional[] = [
  'barreiro', 'centro-sul', 'leste', 'nordeste', 'noroeste', 'norte', 'oeste', 'pampulha', 'venda-nova',
];

/** Conflitos conhecidos para a integração; não são falhas de formato do JSON. */
export const ALERTAS_COMPATIBILIDADE_DADOS = [
  'O enum global inclui odonto para triagem/escopo, mas o arquivo atualizado não lista odontologia em nenhuma UPA; não recomendar unidades para esse serviço sem confirmação oficial.',
  'O arquivo atualizado lista cirurgia geral, que não aparece entre as quatro especialidades descritas no escopo do piloto.',
  'As especialidades fornecidas ainda precisam ser confirmadas com a PBH antes de uso operacional.',
  'O CRS de referência das geometrias dos bairros é EPSG:31983 conforme a fonte oficial da PBH; as coordenadas e o endereço das UPAs Barreiro e Oeste ainda precisam de confirmação.',
] as const;

/** Validações estruturais para CI; valida estrutura, não comprova a veracidade operacional dos dados. */
export function validarDadosReferencia(): string[] {
  const erros: string[] = [];
  if (UNIDADES.length !== 9) erros.push(`Esperadas 9 UPAs, recebidas ${UNIDADES.length}.`);
  if (BAIRROS_CENTROS.length !== 493) erros.push(`Esperados 493 centros de bairros, recebidos ${BAIRROS_CENTROS.length}.`);
  const slugs = new Set<string>();
  for (const unidade of UNIDADES) {
    if (!unidade.slug || slugs.has(unidade.slug)) erros.push(`Slug de UPA ausente ou duplicado: ${unidade.slug}`);
    slugs.add(unidade.slug);
    if (!Number.isFinite(unidade.lat) || !Number.isFinite(unidade.lng)) erros.push(`Coordenadas inválidas: ${unidade.slug}`);
    if (!REGIONAIS_VALIDAS.includes(unidade.regional)) erros.push(`Regional de UPA inválida: ${unidade.slug} (${unidade.regional})`);
    if (!Array.isArray(unidade.especialidades)) erros.push(`Campo especialidades inválido: ${unidade.slug}`);
    if (!unidade.nome || !unidade.endereco) erros.push(`Nome/endereço ausente: ${unidade.slug}`);
  }
  const ids = new Set<string>();
  for (const bairro of BAIRROS_CENTROS) {
    if (!bairro.id || ids.has(bairro.id)) erros.push(`ID de bairro ausente ou duplicado: ${bairro.id}`);
    ids.add(bairro.id);
    if (!REGIONAIS_VALIDAS.includes(bairro.regional)) erros.push(`Regional de bairro inválida: ${bairro.nome} (${bairro.regional})`);
    if (!Number.isFinite(bairro.centroX) || !Number.isFinite(bairro.centroY)) erros.push(`Centro inválido: ${bairro.nome}`);
  }
  return erros;
}
