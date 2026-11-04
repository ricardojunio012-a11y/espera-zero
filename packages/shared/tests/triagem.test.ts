import { describe, expect, it } from 'vitest';
import { centroSaudeEstaAberto, triagem } from '../src/triagem';
import type { RespostasTriagem } from '../src/tipos';
const base: RespostasTriagem = { paraQuem: 'eu', sinaisAlerta: [], sintoma: 'sintoma leve', tempo: 'hoje' };

describe('triagem', () => {
  it('manda qualquer sinal de alerta diretamente para SAMU 192', () => {
    const resultado = triagem({ ...base, sinaisAlerta: ['dor-forte-no-peito'], sintoma: 'dor leve' });
    expect(resultado.destino).toBe('samu');
    expect(resultado.motivos.join(' ')).toContain('192');
  });
  it('encaminha trauma/fratura para ortopedia', () => {
    expect(triagem({ ...base, sintoma: 'suspeita de fratura', tempo: 'agora' }).especialidade).toBe('ortopedia');
  });
  it('orienta avaliação presencial para dor dentária com rosto inchado sem inventar oferta de odontologia na UPA', () => {
    const resultado = triagem({ ...base, sintoma: 'dor de dente com rosto inchado' });
    expect(resultado.destino).toBe('upa');
    expect(resultado.especialidade).toBeUndefined();
    expect(resultado.motivos.join(' ')).toContain('não confirmam odontologia em nenhuma UPA');
  });
  it('prioriza pediatria para criança conforme o exemplo do projeto', () => {
    const resultado = triagem({ ...base, paraQuem: 'crianca', sintoma: 'febre', tempo: 'dias' });
    expect(resultado.destino).toBe('upa');
    expect(resultado.especialidade).toBe('pediatria');
  });
  it('encaminha necessidade administrativa ao centro de saúde em horário aberto', () => {
    expect(triagem({ ...base, sintoma: 'receita' }, { centroSaudeAberto: true }).destino).toBe('centro-saude');
  });
  it('usa UPA se o centro de saúde estiver fechado', () => {
    const resultado = triagem({ ...base, sintoma: 'atestado' }, { centroSaudeAberto: false });
    expect(resultado.destino).toBe('upa');
    expect(resultado.motivos.join(' ')).toContain('fora do horário');
  });
  it('sintoma leve recente pode ir para teleconsulta', () => {
    expect(triagem(base).destino).toBe('teleconsulta');
  });
  it('detecta sinal de alerta descrito no campo de sintoma também', () => {
    expect(triagem({ ...base, sinaisAlerta: [], sintoma: 'dor forte no peito' }).destino).toBe('samu');
  });
  it('confere o horário do centro de saúde (dias úteis, 7h-19h)', () => {
    expect(centroSaudeEstaAberto(new Date(2026, 9, 13, 8, 0))).toBe(true);
    expect(centroSaudeEstaAberto(new Date(2026, 9, 17, 8, 0))).toBe(false);
    expect(centroSaudeEstaAberto(new Date(2026, 9, 13, 19, 0))).toBe(false);
  });
  it('sintoma não classificado não inventa teleconsulta', () => {
    expect(triagem({ ...base, sintoma: 'dor persistente', tempo: 'hoje' }).destino).toBe('upa');
  });
});
