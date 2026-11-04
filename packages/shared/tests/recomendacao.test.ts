import { describe, expect, it } from 'vitest';
import { recomendar, calcularTrajetoMin, distanciaKm } from '../src/recomendacao';
import type { AgendaDia, Alerta, Estimativa, Unidade } from '../src/tipos';
const unidade = (slug: string, lat: number, lng: number, especialidades: Unidade['especialidades']=['ortopedia']): Unidade => ({
  slug, nome:`UPA ${slug}`, tipo:'upa', endereco:'Rua de teste, 1', bairro:'Centro', regional:'centro-sul', lat, lng,
  especialidades, fontePbh:{id:'teste', atualizadoEm:'2026-10-01T00:00:00-03:00'}
});
const espera = (minutos:number, relatos=6, ultimoHaMin:number|null=5): Estimativa => ({minutos, relatos, ultimoHaMin, origem:'relatos', confianca: relatos>=6?'alta':relatos>=3?'media':'baixa'});
const agora = new Date('2026-10-13T14:00:00-03:00');
const agenda = (horario: AgendaDia['horarios']['ortopedia'] = {de:'08:00',ate:'18:00'}): AgendaDia[] => [{dia:'ter', horarios:{ortopedia:horario}, origem:'grupo', atualizadoEm:'2026-10-01T00:00:00-03:00'}];
const agendas = (slugs: string[], horario: AgendaDia['horarios']['ortopedia'] = {de:'08:00',ate:'18:00'}) => Object.fromEntries(slugs.map(slug=>[slug,agenda(horario)]));
const alerta = (slug:string, tipo:Alerta['tipo'], especialidade:Alerta['especialidade']='ortopedia'): Alerta => ({slug,tipo,especialidade,criadoEm:'2026-10-13T13:00:00-03:00',expiraEm:'2026-10-13T15:00:00-03:00',confirmacoes:1,contestacoes:0});

describe('recomendação', () => {
  it('ordena pelo total espera + trajeto quando existe posição', () => {
    const a = unidade('a', -19.92, -43.93), b = unidade('b', -19.94, -43.95);
    const resultado = recomendar([a,b], 'ortopedia', {lat:-19.92,lng:-43.93}, {a:espera(40),b:espera(10)}, agendas(['a','b']), [], agora);
    expect(resultado[0].unidade.slug).toBe('b');
    expect(resultado[0].totalMin).not.toBeNull();
  });
  it('ordena só por espera e deixa trajeto nulo sem GPS', () => {
    const resultado = recomendar([unidade('a',0,0),unidade('b',0,0)], 'ortopedia', null, {a:espera(35),b:espera(20)}, agendas(['a','b']), [], agora);
    expect(resultado.map(x=>x.unidade.slug)).toEqual(['b','a']);
    expect(resultado[0].trajetoMin).toBeNull();
  });
  it('não recomenda unidade que não oferece a especialidade cadastrada', () => {
    expect(recomendar([unidade('clinica',0,0,['clinica'])], 'ortopedia', null, {}, agendas(['clinica']), [], agora)).toHaveLength(0);
  });
  it('coloca unidade sem estimativa no fim', () => {
    const resultado = recomendar([unidade('sem',0,0),unidade('com',0,0)], 'ortopedia', null, {com:espera(25)}, agendas(['sem','com']), [], agora);
    expect(resultado.map(x=>x.unidade.slug)).toEqual(['com','sem']);
  });
  it('calcula distância e trajeto mínimo de três minutos', () => {
    expect(distanciaKm({lat:-19.92,lng:-43.93},{lat:-19.92,lng:-43.93})).toBe(0);
    expect(calcularTrajetoMin({lat:-19.92,lng:-43.93},{lat:-19.92,lng:-43.93})).toBe(3);
  });
  it('não recomenda unidade fora do horário nem sem agenda para o dia', () => {
    const unidades = [unidade('fechada',0,0), unidade('sem-agenda',0,0)];
    const resultado = recomendar(unidades, 'ortopedia', null, {}, {fechada:agenda('nao')}, [], agora);
    expect(resultado).toHaveLength(0);
  });
  it('remove unidade com alerta ativo sem-profissional aplicável', () => {
    const resultado = recomendar([unidade('a',0,0), unidade('b',0,0)], 'ortopedia', null, {}, agendas(['a','b']), [alerta('a','sem-profissional')], agora);
    expect(resultado.map(x=>x.unidade.slug)).toEqual(['b']);
  });
  it('ignora alerta expirado e alerta de outra especialidade', () => {
    const expirado = {...alerta('a','sem-profissional'), expiraEm:'2026-10-13T13:30:00-03:00'};
    const outro = alerta('b','sem-profissional','clinica');
    const resultado = recomendar([unidade('a',0,0), unidade('b',0,0)], 'ortopedia', null, {}, agendas(['a','b']), [expirado,outro], agora);
    expect(resultado.map(x=>x.unidade.slug)).toEqual(['a','b']);
  });
});
