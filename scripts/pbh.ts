import { desprojetarXY } from '../packages/shared/src/localizacao'
import type { Unidade } from '../packages/shared/src/tipos'

export const DATASET = 'rede-de-assistencia-saude'
const API = 'https://dados.pbh.gov.br/api/3/action'
// The portal sits behind a WAF that answers "Acesso Bloqueado" to clients without a browser User-Agent.
const CABECALHOS = { 'User-Agent': 'Mozilla/5.0 (compatible; espera-zero-sync/1.0; +https://github.com/ricardojunio012-a11y/espera-zero)' }

const COLUNAS = ['ID_EQ_SAUDE', 'SIGLA_CATEGORIA', 'NOME', 'TIPO_LOGRADOURO', 'LOGRADOURO', 'NUMERO_IMOVEL', 'NOME_BAIRRO_POPULAR', 'GEOMETRIA'] as const

/** PBH name → our slug. Noroeste is published under the hospital's name. */
const SLUG_POR_NOME: Record<string, string> = {
  BARREIRO: 'barreiro',
  'CENTRO SUL': 'centro-sul',
  LESTE: 'leste',
  NORDESTE: 'nordeste',
  'ODILON BEHRENS': 'noroeste',
  NOROESTE: 'noroeste',
  NORTE: 'norte',
  OESTE: 'oeste',
  PAMPULHA: 'pampulha',
  'VENDA NOVA': 'venda-nova',
}

export interface Recurso {
  id: string
  nome: string
  url: string
  atualizadoEm: string
}

export interface UpaPbh {
  slug: string
  idPbh: string
  enderecoPbh: string
  bairroPbh: string
  lat: number
  lng: number
}

export async function recursoMaisRecente(): Promise<Recurso> {
  const r = await fetch(`${API}/package_show?id=${DATASET}`, { headers: CABECALHOS })
  if (!r.ok) throw new Error(`CKAN respondeu ${r.status} em package_show.`)
  const corpo = await r.json() as { success: boolean; result: { resources: Array<Record<string, string>> } }
  if (!corpo.success) throw new Error('CKAN respondeu success=false.')
  const csvs = corpo.result.resources
    .filter((x) => x.format?.toUpperCase() === 'CSV')
    .sort((a, b) => (a.last_modified ?? a.created).localeCompare(b.last_modified ?? b.created))
  const ultimo = csvs.at(-1)
  if (!ultimo) throw new Error('Nenhum CSV no conjunto rede-de-assistencia-saude.')
  return { id: ultimo.id, nome: ultimo.name, url: ultimo.url, atualizadoEm: `${ultimo.last_modified ?? ultimo.created}Z` }
}

export async function baixarCsv(url: string): Promise<string> {
  const r = await fetch(url, { headers: CABECALHOS })
  if (!r.ok) throw new Error(`Download do CSV respondeu ${r.status}.`)
  return r.text()
}

/** Fails loudly when the format changes (RF-25), instead of importing garbage. */
export function lerUpas(csv: string): UpaPbh[] {
  const linhas = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  const cabecalho = linhas[0]?.split(';') ?? []
  const faltando = COLUNAS.filter((c) => !cabecalho.includes(c))
  if (faltando.length) throw new Error(`Formato do CSV mudou: faltam as colunas ${faltando.join(', ')}.`)
  const col = (nome: (typeof COLUNAS)[number]) => cabecalho.indexOf(nome)

  const upas: UpaPbh[] = []
  for (const linha of linhas.slice(1)) {
    const c = linha.split(';')
    if (c[col('SIGLA_CATEGORIA')] !== 'UPA') continue
    const nome = c[col('NOME')].replace(/^UNIDADE DE PRONTO ATENDIMENTO\s+/, '').trim()
    const slug = SLUG_POR_NOME[nome]
    if (!slug) throw new Error(`UPA desconhecida na base da PBH: "${nome}". Atualize SLUG_POR_NOME.`)
    const ponto = /^POINT \(([\d.]+) ([\d.]+)\)$/.exec(c[col('GEOMETRIA')].trim())
    if (!ponto) throw new Error(`Geometria inesperada para ${slug}: ${c[col('GEOMETRIA')]}`)
    const [lat, lng] = desprojetarXY(Number(ponto[1]), Number(ponto[2]))
    if (lat < -20.1 || lat > -19.7 || lng < -44.1 || lng > -43.8) throw new Error(`Coordenada de ${slug} fora de Belo Horizonte: ${lat}, ${lng}.`)
    upas.push({
      slug,
      idPbh: c[col('ID_EQ_SAUDE')],
      enderecoPbh: `${c[col('TIPO_LOGRADOURO')]} ${c[col('LOGRADOURO')]}, ${c[col('NUMERO_IMOVEL')]}`,
      bairroPbh: c[col('NOME_BAIRRO_POPULAR')],
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    })
  }
  const slugs = new Set(upas.map((u) => u.slug))
  if (upas.length !== 9 || slugs.size !== 9) throw new Error(`Esperadas 9 UPAs distintas, vieram ${upas.length} (${[...slugs].join(', ')}).`)
  return upas
}

const METROS_POR_GRAU = 111_000

export interface Divergencia {
  slug: string
  campo: 'endereço' | 'coordenada'
  nosso: string
  pbh: string
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/\b(RUA|AVENIDA|AVE|AV)\b\.?/g, '').replace(/[^A-Z0-9]/g, '')
}

/** Distance above which our coordinate and the PBH one count as different places. */
const TOLERANCIA_M = 150

export function compararComBase(base: Unidade[], pbh: UpaPbh[]): Divergencia[] {
  const divergencias: Divergencia[] = []
  for (const p of pbh) {
    const u = base.find((x) => x.slug === p.slug)
    if (!u) continue
    if (normalizar(u.endereco) !== normalizar(p.enderecoPbh)) {
      divergencias.push({ slug: p.slug, campo: 'endereço', nosso: u.endereco, pbh: p.enderecoPbh })
    }
    const metros = Math.hypot(u.lat - p.lat, (u.lng - p.lng) * Math.cos((u.lat * Math.PI) / 180)) * METROS_POR_GRAU
    if (metros > TOLERANCIA_M) {
      divergencias.push({ slug: p.slug, campo: 'coordenada', nosso: `${u.lat}, ${u.lng}`, pbh: `${p.lat}, ${p.lng} (${Math.round(metros)} m)` })
    }
  }
  return divergencias
}
