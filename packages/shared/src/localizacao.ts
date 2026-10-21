import type { BairroCentro, GeometriaBairro } from './tipos';
import { BAIRROS_CENTROS } from './dados';

// CRS da camada Bairro Popular conforme o Portal de Dados Abertos da PBH: SIRGAS 2000 / UTM zona 23S (EPSG:31983).
// O dataset oficial da PBH informa EPSG:31983; os valores WKT (X ~603 mil, Y ~7,8 milhões) são compatíveis com coordenadas UTM.
// Validar a transformação com testes de localização conhecidos antes de considerar os resultados geográficos plenamente verificados.
const A = 6378137;
const F = 1 / 298.257222101;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const MERIDIANO_CENTRAL = (-45 * Math.PI) / 180;

export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function projetarLatLng(lat: number, lng: number): [number, number] {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi), tanPhi = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * sinPhi * sinPhi);
  const t = tanPhi * tanPhi;
  const c = EP2 * cosPhi * cosPhi;
  const aa = cosPhi * (lambda - MERIDIANO_CENTRAL);
  const e4 = E2 * E2, e6 = e4 * E2;
  const m = A * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi));
  const x = 500000 + K0 * n * (aa + (1 - t + c) * aa ** 3 / 6
    + (5 - 18 * t + t * t + 72 * c - 58 * EP2) * aa ** 5 / 120);
  const y = 10000000 + K0 * (m + n * tanPhi * (aa * aa / 2
    + (5 - t + 9 * c + 4 * c * c) * aa ** 4 / 24
    + (61 - 58 * t + t * t + 600 * c - 330 * EP2) * aa ** 6 / 720));
  return [x, y];
}
export function desprojetarXY(x: number, y: number): [number, number] {
  const xx = x - 500000;
  const yy = y - 10000000;
  const e4 = E2 * E2, e6 = e4 * E2;
  const m = yy / K0;
  const mu = m / (A * (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const j1 = 3 * e1 / 2 - 27 * e1 ** 3 / 32;
  const j2 = 21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32;
  const j3 = 151 * e1 ** 3 / 96;
  const j4 = 1097 * e1 ** 4 / 512;
  const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);
  const sinFp = Math.sin(fp), cosFp = Math.cos(fp), tanFp = Math.tan(fp);
  const c1 = EP2 * cosFp * cosFp;
  const t1 = tanFp * tanFp;
  const n1 = A / Math.sqrt(1 - E2 * sinFp * sinFp);
  const r1 = A * (1 - E2) / Math.pow(1 - E2 * sinFp * sinFp, 1.5);
  const d = xx / (n1 * K0);
  const lat = fp - (n1 * tanFp / r1) * (d * d / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4 / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6 / 720);
  const lng = MERIDIANO_CENTRAL + (d - (1 + 2 * t1 + c1) * d ** 3 / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5 / 120) / cosFp;
  return [(lat * 180) / Math.PI, (lng * 180) / Math.PI];
}

type Ponto = [number, number];
type Poligono = Ponto[][]; // [anel externo, ...buracos]
const cacheGeometrias = new Map<string, Poligono[]>();

/** Parser pequeno para o WKT MULTIPOLYGON usado no arquivo enviado; cache evita reler os mesmos vértices. */
export function parseMultiPolygonWkt(wkt: string): Poligono[] {
  const cache = cacheGeometrias.get(wkt);
  if (cache) return cache;
  const wktNormalizado = wkt.startsWith('POLYGON')
    ? `MULTIPOLYGON (${wkt.slice('POLYGON '.length)})`
    : wkt;
  const resultado: Poligono[] = [];
  let profundidade = 0;
  let poligonoAtual: Poligono | null = null;
  let textoAnel = '';
  for (const caractere of wktNormalizado.slice(wktNormalizado.indexOf('('))) {
    if (caractere === '(') {
      profundidade++;
      if (profundidade === 2) poligonoAtual = [];
      if (profundidade === 3) textoAnel = '';
    } else if (caractere === ')') {
      if (profundidade === 3 && poligonoAtual) {
        const pontos = textoAnel.split(',').map((par) => par.trim().split(/\s+/).map(Number)).filter((par) => par.length >= 2 && Number.isFinite(par[0]) && Number.isFinite(par[1])).map((par) => [par[0], par[1]] as Ponto);
        if (pontos.length >= 3) poligonoAtual.push(pontos);
      }
      if (profundidade === 2 && poligonoAtual) {
        resultado.push(poligonoAtual);
        poligonoAtual = null;
      }
      profundidade--;
    } else if (profundidade === 3) {
      textoAnel += caractere;
    }
  }
  cacheGeometrias.set(wkt, resultado);
  return resultado;
}

function pontoNoAnel(ponto: Ponto, anel: Ponto[]): boolean {
  let dentro = false;
  const [x, y] = ponto;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    const cruza = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

export function pontoDentroDoWkt(x: number, y: number, geometriaWkt: string): boolean {
  const ponto: Ponto = [x, y];
  return parseMultiPolygonWkt(geometriaWkt).some((poligono) => {
    if (!poligono.length || !pontoNoAnel(ponto, poligono[0])) return false;
    return !poligono.slice(1).some((buraco) => pontoNoAnel(ponto, buraco));
  });
}

/**
 * Converte GPS em bairro por ponto-no-polígono. A geometria deve ser fornecida pelo chamador
 * após consentimento de localização; os metadados/centros permanecem leves no bundle inicial.
 */
export function bairroMaisProximo(
  lat: number,
  lng: number,
  geometrias: GeometriaBairro[],
  centros: BairroCentro[] = BAIRROS_CENTROS,
): { bairro: BairroCentro; km: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (!Array.isArray(geometrias) || geometrias.length === 0) return null;
  const porId = new Map(centros.map((bairro) => [bairro.id, bairro]));
  const [x, y] = projetarLatLng(lat, lng);
  for (const geometria of geometrias) {
    const bairro = porId.get(geometria.id);
    if (bairro && pontoDentroDoWkt(x, y, geometria.geometriaWkt)) return { bairro, km: 0 };
  }
  let melhor: { bairro: BairroCentro; km: number } | null = null;
  for (const bairro of centros) {
    const [centroLat, centroLng] = desprojetarXY(bairro.centroX, bairro.centroY);
    const km = haversineKm(lat, lng, centroLat, centroLng);
    if (!melhor || km < melhor.km) melhor = { bairro, km };
  }
  return melhor;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
