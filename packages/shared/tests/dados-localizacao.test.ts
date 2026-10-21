import { describe, expect, it } from 'vitest';
import { validarDadosReferencia } from '../src/dados';
import { normalizar, parseMultiPolygonWkt, pontoDentroDoWkt, projetarLatLng, bairroMaisProximo } from '../src/localizacao';
import { BAIRROS_CENTROS, UNIDADES } from '../src/dados';
import geometriasJson from '../public/bairros-geometrias.json';
import type { GeometriaBairro } from '../src/tipos';

describe('dados e localização', () => {
  it('tem 9 UPAs e 493 centros de bairros sem IDs repetidos', () => {
    expect(validarDadosReferencia()).toEqual([]);
  });
  it('mantém regional administrativa nos 493 bairros e nas 9 UPAs', () => {
    expect(BAIRROS_CENTROS).toHaveLength(493);
    expect(BAIRROS_CENTROS.every((b) => Boolean(b.regional) && Number.isFinite(b.centroX) && Number.isFinite(b.centroY))).toBe(true);
    expect(UNIDADES).toHaveLength(9);
    expect(UNIDADES.every((u) => Boolean(u.regional) && u.especialidades.length > 0)).toBe(true);
    expect(UNIDADES.filter((u) => u.especialidades.includes('ortopedia'))).toHaveLength(3);
    expect(UNIDADES.some((u) => u.especialidades.includes('odonto'))).toBe(false);
    expect(UNIDADES.every((u) => u.especialidades.includes('cirurgia-geral'))).toBe(true);
  });
  it('normaliza acentos e maiúsculas para busca', () => {
    expect(normalizar('  SÃO João  ')).toBe('sao joao');
  });
  it('lê geometrias WKT Polygon e MultiPolygon', () => {
    const wkt = 'MULTIPOLYGON (((0 0, 10 0, 10 10, 0 10, 0 0)))';
    expect(parseMultiPolygonWkt(wkt)).toHaveLength(1);
    expect(pontoDentroDoWkt(5,5,wkt)).toBe(true);
    expect(pontoDentroDoWkt(15,5,wkt)).toBe(false);
    const polygon = 'POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))';
    expect(parseMultiPolygonWkt(polygon)).toHaveLength(1);
    expect(pontoDentroDoWkt(5,5,polygon)).toBe(true);
  });
  it('projeta um ponto de Belo Horizonte para coordenadas métricas plausíveis', () => {
    const [x,y] = projetarLatLng(-19.92,-43.94);
    expect(x).toBeGreaterThan(500000); expect(x).toBeLessThan(700000);
    expect(y).toBeGreaterThan(7700000); expect(y).toBeLessThan(7900000);
  });
  it('retorna um bairro se receber GPS válido', () => {
    const geometrias = geometriasJson.bairros as GeometriaBairro[];
    const resultado = bairroMaisProximo(-19.92,-43.94,geometrias);
    expect(resultado?.bairro.nome.length).toBeGreaterThan(0);
    expect(Number.isFinite(resultado?.km)).toBe(true);
  });
  it('mantém geometrias separadas e referenciadas por ID', () => {
    const geometrias = geometriasJson.bairros as GeometriaBairro[];
    expect(geometrias).toHaveLength(493);
    expect(new Set(geometrias.map((g) => g.id)).size).toBe(493);
    expect(geometrias.every((g) => g.geometriaWkt.startsWith('MULTIPOLYGON') || g.geometriaWkt.startsWith('POLYGON'))).toBe(true);
  });
});
