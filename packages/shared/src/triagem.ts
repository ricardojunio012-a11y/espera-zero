import type { RespostasTriagem, ResultadoTriagem } from './tipos';

/** Sinais de alerta exibidos como opções fechadas na interface. Qualquer seleção interrompe a triagem. */
export const SINAIS_ALERTA = [
  { id: 'dor-forte-no-peito', texto: 'Dor forte no peito' },
  { id: 'falta-de-ar-intensa', texto: 'Falta de ar intensa' },
  { id: 'desmaio-ou-confusao', texto: 'Desmaio ou confusão' },
  { id: 'sangramento-que-nao-para', texto: 'Sangramento que não para' },
  { id: 'sinais-de-avc', texto: 'Sinais de AVC' },
  { id: 'convulsao', texto: 'Convulsão' },
] as const;

export interface ContextoTriagem {
  /** Informado pela camada de tela, para manter a regra pura/testável. */
  centroSaudeAberto?: boolean;
}

/** Centro de saúde conforme o horário definido no RN-04 (horário local do navegador). */
export function centroSaudeEstaAberto(agora: Date): boolean {
  const dia = agora.getDay(); // 0 = domingo, 6 = sábado
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  return dia >= 1 && dia <= 5 && minutos >= 7 * 60 && minutos < 19 * 60;
}

function normalizarTexto(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
function contemQualquer(texto: string, opcoes: string[]): boolean {
  return opcoes.some((opcao) => texto.includes(opcao));
}

/**
 * Triagem ORIENTATIVA, não diagnóstico. Ordem conservadora: sinal de alerta primeiro,
 * depois causas que exigem UPA, encaminhamentos não urgentes e sintomas leves recentes.
 * `centroSaudeAberto` implementa RN-04 sem ler o relógio dentro de uma função pura.
 */
export function triagem(r: RespostasTriagem, contexto: ContextoTriagem = {}): ResultadoTriagem {
  const sintomaBruto = normalizarTexto(r.sintoma);
  const alertaNoTexto = contemQualquer(sintomaBruto, ['dor forte no peito', 'falta de ar intensa', 'desmaio', 'confusao', 'sangramento que nao para', 'sinais de avc', 'avc', 'convulsao']);
  if (r.sinaisAlerta.length > 0 || alertaNoTexto) {
    return { destino: 'samu', motivos: ['Você informou um sinal de alerta. Ligue 192 agora. Não continue a triagem.'] };
  }

  const sintoma = sintomaBruto;
  const textoLivreNaoUrgente = contemQualquer(sintoma, [
    'receita', 'atestado', 'exame de rotina', 'exame rotina', 'dor cronica', 'cronic',
  ]);
  if (textoLivreNaoUrgente) {
    return centroSaudeOuUpa(contexto.centroSaudeAberto, 'O motivo informado costuma ser atendido no centro de saúde.');
  }

  const trauma = contemQualquer(sintoma, ['fratura', 'trauma', 'torcao', 'torção', 'machucado com suspeita de osso']);
  if (trauma) {
    return { destino: 'upa', especialidade: 'ortopedia', motivos: ['Você informou suspeita de fratura ou trauma; procure uma UPA com ortopedia.'] };
  }

  const dorDentaria = contemQualquer(sintoma, ['dor-dente-rosto-inchado', 'dor de dente com rosto inchado', 'dor de dente e rosto inchado', 'dente inchado']);
  if (dorDentaria) {
    return { destino: 'upa', motivos: ['Dor de dente com inchaço no rosto precisa de avaliação presencial urgente. Os dados disponíveis não confirmam odontologia em nenhuma UPA; confirme o serviço odontológico com a rede de saúde.'] };
  }

  // A regra escrita no projeto prioriza pediatria para crianças nos casos orientados para UPA.
  if (r.paraQuem === 'crianca') {
    return { destino: 'upa', especialidade: 'pediatria', motivos: ['Como o atendimento é para uma criança, confira uma UPA com pediatria disponível hoje.'] };
  }

  const sintomaCronicoOuLeveDias = r.tempo === 'semanas' || (r.tempo === 'dias' && contemQualquer(sintoma, ['leve', 'dor leve', 'sintoma leve', 'febre leve', 'tosse leve']));
  if (sintomaCronicoOuLeveDias) {
    return centroSaudeOuUpa(contexto.centroSaudeAberto, 'O sintoma foi descrito como leve e presente há dias/semanas.');
  }

  const leveRecente = (r.tempo === 'agora' || r.tempo === 'hoje') && contemQualquer(sintoma, ['leve', 'sintoma leve', 'dor leve', 'resfriado leve', 'mal-estar leve']);
  if (leveRecente && r.paraQuem !== 'idoso') {
    return { destino: 'teleconsulta', motivos: ['Para um sintoma leve e recente em adulto, a teleconsulta pode ser uma alternativa.'] };
  }

  return { destino: 'upa', especialidade: 'clinica', motivos: ['Pelas respostas informadas, a orientação disponível é procurar uma UPA com clínica médica.'] };
}

function centroSaudeOuUpa(centroSaudeAberto: boolean | undefined, motivo: string): ResultadoTriagem {
  if (centroSaudeAberto === false) {
    return {
      destino: 'upa', especialidade: 'clinica',
      motivos: [`O centro de saúde está fora do horário informado (seg. a sex., 7h às 19h). ${motivo} Por isso, a orientação muda para UPA com clínica médica.`],
    };
  }
  return { destino: 'centro-saude', motivos: [motivo] };
}
