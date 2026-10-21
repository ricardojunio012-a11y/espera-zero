import type { AgendaDia, Alerta, DiaSemana, Especialidade, Estimativa, HorarioEspecialidade, Recomendacao, Unidade } from './tipos';

export interface Posicao { lat: number; lng: number }
const RAIO_TERRA_KM = 6371;

export function distanciaKm(a: Posicao, b: Posicao): number {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Agenda agrupada por slug da UPA; AgendaDia não carrega slug no próprio contrato. */
export type AgendaPorUnidade = Record<string, AgendaDia[]>;

/**
 * Recomenda somente unidades com agenda para a especialidade no dia/horário consultado
 * e sem alerta ativo de ausência de profissional aplicável. `agora` deve ser o horário local
 * usado pelo produto para avaliar a agenda.
 */
export function recomendar(
  unidades: Unidade[],
  esp: Especialidade,
  posicao: Posicao | null,
  estimativas: Record<string, Estimativa>,
  agendas: AgendaPorUnidade,
  alertas: Alerta[],
  agora: Date,
): Recomendacao[] {
  const dia = diaSemana(agora);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  return unidades
    .filter((unidade) => unidade.especialidades.includes(esp))
    .filter((unidade) => atendeNoHorario(agendas[unidade.slug] ?? [], dia, esp, minutosAgora))
    .filter((unidade) => !temAlertaSemProfissional(alertas, unidade.slug, esp, agora))
    .map((unidade): Recomendacao => {
      const estimativa = estimativas[unidade.slug] ?? semDados();
      const trajetoMin = posicao ? calcularTrajetoMin(posicao, unidade) : null;
      const totalMin = estimativa.minutos === null ? null : estimativa.minutos + (trajetoMin ?? 0);
      return {
        unidade, estimativa, trajetoMin, totalMin,
        motivo: montarMotivo(estimativa, trajetoMin, totalMin),
        atendeAgora: true,
      };
    })
    .sort((a, b) => {
      if (a.totalMin === null && b.totalMin !== null) return 1;
      if (a.totalMin !== null && b.totalMin === null) return -1;
      if (a.totalMin !== null && b.totalMin !== null && a.totalMin !== b.totalMin) return a.totalMin - b.totalMin;
      if (a.estimativa.relatos !== b.estimativa.relatos) return b.estimativa.relatos - a.estimativa.relatos;
      if (a.trajetoMin !== b.trajetoMin && a.trajetoMin !== null && b.trajetoMin !== null) return a.trajetoMin - b.trajetoMin;
      return a.unidade.slug.localeCompare(b.unidade.slug);
    });
}

function diaSemana(data: Date): DiaSemana {
  return (['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const)[data.getDay()];
}

function atendeNoHorario(agendas: AgendaDia[], dia: DiaSemana, esp: Especialidade, minutosAgora: number): boolean {
  const agenda = agendas.find((item) => item.dia === dia);
  if (!agenda) return false;
  const horario = agenda.horarios[esp];
  if (!horario || horario === 'nao') return false;
  if (horario === '24h') return true;
  return horarioValidoAgora(horario, minutosAgora);
}

function horarioValidoAgora(horario: Exclude<HorarioEspecialidade, '24h' | 'nao'>, minutosAgora: number): boolean {
  const de = minutosDoDia(horario.de);
  const ate = minutosDoDia(horario.ate);
  if (de === null || ate === null || de === ate) return false;
  return de < ate ? minutosAgora >= de && minutosAgora < ate : minutosAgora >= de || minutosAgora < ate;
}

function minutosDoDia(valor: string): number | null {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(valor);
  if (!match) return null;
  const [hora, minuto] = valor.split(':').map(Number);
  return hora * 60 + minuto;
}

function temAlertaSemProfissional(alertas: Alerta[], slug: string, esp: Especialidade, agora: Date): boolean {
  const agoraMs = agora.getTime();
  return alertas.some((alerta) => {
    if (alerta.slug !== slug || alerta.tipo !== 'sem-profissional') return false;
    if (alerta.especialidade && alerta.especialidade !== esp) return false;
    const criado = Date.parse(alerta.criadoEm);
    const expira = Date.parse(alerta.expiraEm);
    return Number.isFinite(criado) && Number.isFinite(expira) && criado <= agoraMs && agoraMs < expira;
  });
}

/** RN-08 (Escopo/Arquitetura): 1,3 de fator de rota, média 22 km/h e mínimo de 3 minutos. */
export function calcularTrajetoMin(posicao: Posicao, unidade: Pick<Unidade, 'lat' | 'lng'>): number {
  const kmDiretos = distanciaKm(posicao, unidade);
  return Math.max(3, Math.ceil((kmDiretos * 1.3 / 22) * 60));
}

function montarMotivo(estimativa: Estimativa, trajetoMin: number | null, totalMin: number | null): string {
  if (estimativa.origem === 'sem-dados' || estimativa.minutos === null) {
    return trajetoMin === null ? 'Sem estimativa recente; ordenação feita apenas pelas informações disponíveis.' : `Sem estimativa recente; trajeto estimado em ${trajetoMin} min.`;
  }
  const base = trajetoMin === null
    ? `Espera estimada de ${estimativa.minutos} min; sem localização, a ordem considera só a espera.`
    : `Espera de ${estimativa.minutos} min + trajeto de ${trajetoMin} min = cerca de ${totalMin} min.`;
  const origem = estimativa.origem === 'historico'
    ? ' Baseada em histórico, não em relatos recentes.'
    : ` Baseada em ${estimativa.relatos} relato(s)${estimativa.ultimoHaMin === null ? '' : `; último há ${estimativa.ultimoHaMin} min`}.`;
  const confirmar = estimativa.relatos < 6 || (estimativa.ultimoHaMin !== null && estimativa.ultimoHaMin > 30)
    ? ' Confirme ao chegar, pois a informação pode estar incompleta ou desatualizada.'
    : '';
  return `${base}${origem}${confirmar}`;
}

function semDados(): Estimativa {
  return { minutos: null, relatos: 0, ultimoHaMin: null, origem: 'sem-dados', confianca: 'baixa' };
}
