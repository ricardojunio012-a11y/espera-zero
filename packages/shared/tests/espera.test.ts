import { describe, expect, it } from 'vitest';
import { agregarHistorico, estimarEspera, gerarIdHistorico, medianaPonderada } from '../src/espera';
import type { Checkin, Historico } from '../src/tipos';
const agora = new Date(2026, 9, 13, 14, 0, 0).getTime();
function checkin(minutos: number, idadeMin: number, especialidade: Checkin['especialidade']='ortopedia'): Checkin {
  return { slug: 'oeste', especialidade, minutos, janela: 1, criadoEm: new Date(agora - idadeMin * 60_000).toISOString() };
}
const historico: Historico[] = [{ slug:'oeste', dia:'ter', hora:14, medianaMin:40, amostras:8, atualizadoEm:'2026-10-12T05:00:00-03:00', especialidade:'ortopedia' }];

describe('espera', () => {
  it('calcula mediana ponderada e ignora amostras fora das últimas duas horas', () => {
    const resultado = estimarEspera([checkin(30, 0), checkin(50, 30), checkin(300, 121)], agora, 'ortopedia');
    expect(resultado.relatos).toBe(2);
    expect(resultado.minutos).toBe(30);
    expect(resultado.confianca).toBe('baixa');
  });
  it('não aceita tempos fora de 0..360 nem datas futuras', () => {
    const resultado = estimarEspera([checkin(361, 0), checkin(-1, 0), checkin(20, -3)], agora, 'ortopedia');
    expect(resultado.origem).toBe('sem-dados');
    expect(resultado.minutos).toBeNull();
  });
  it('usa histórico quando não há relatos recentes', () => {
    const resultado = estimarEspera([], agora, 'ortopedia', historico);
    expect(resultado.origem).toBe('historico');
    expect(resultado.minutos).toBe(40);
    expect(resultado.relatos).toBe(0);
  });
  it('retorna sem-dados se não existe relato nem histórico compatível', () => {
    const resultado = estimarEspera([], agora, 'ortopedia', []);
    expect(resultado.origem).toBe('sem-dados');
    expect(resultado.minutos).toBeNull();
  });
  it('limita a influência de um relato em até 15 min quando há histórico correspondente', () => {
    const resultado = estimarEspera([checkin(100, 0)], agora, 'ortopedia', historico);
    expect(resultado.minutos).toBe(55);
  });
  it('calcula mediana ponderada sem média simples indevida', () => {
    expect(medianaPonderada([{ valor: 10, peso: 0.75 }, { valor: 90, peso: 0.25 }])).toBe(10);
  });
  it('agrega histórico por unidade, especialidade, dia e hora', () => {
    const dados = agregarHistorico([checkin(20, 0), checkin(40, 10)], '2026-10-13T14:00:00-03:00');
    expect(dados).toHaveLength(1);
    expect(dados[0].especialidade).toBe('ortopedia');
    expect(dados[0].amostras).toBe(2);
    expect(dados[0].medianaMin).toBe(30);
  });
  it('não mistura especialidades ao estimar nem ao agregar histórico', () => {
    const outroHistorico: Historico = {...historico[0], especialidade:'clinica', medianaMin:90};
    const estimativa = estimarEspera([], agora, 'clinica', [historico[0], outroHistorico]);
    expect(estimativa.minutos).toBe(90);
    const dados = agregarHistorico([checkin(20,0,'ortopedia'),checkin(50,0,'clinica')], '2026-10-13T14:00:00-03:00');
    expect(dados).toHaveLength(2);
  });
  it('gera ID de histórico incluindo a especialidade', () => {
    expect(gerarIdHistorico('oeste','ortopedia','ter',14)).toBe('oesteortopediater_14');
  });
});
