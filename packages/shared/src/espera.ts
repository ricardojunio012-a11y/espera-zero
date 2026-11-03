import type { Checkin, Confianca, DiaSemana, Estimativa, Historico } from './tipos';

const JANELA_MS = 2 * 60 * 60 * 1000;
const MAX_MINUTOS = 360;
const MEIA_VIDA_MIN = 45; // RN-09: peso cai pela metade a cada 45 minutos.
const FUSO_HORARIO = 'America/Sao_Paulo';

const DIAS: Record<string, DiaSemana> = {
  Sun: 'dom',
  Mon: 'seg',
  Tue: 'ter',
  Wed: 'qua',
  Thu: 'qui',
  Fri: 'sex',
  Sat: 'sab',
};

/** Interpreta uma data sempre no fuso horário de Belo Horizonte. */
function partesNoFuso(date: Date): { dia: DiaSemana; hora: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO_HORARIO,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const dia = partes.find((parte) => parte.type === 'weekday')?.value;
  const hora = partes.find((parte) => parte.type === 'hour')?.value;

  if (!dia || !hora || !DIAS[dia]) {
    throw new Error('Não foi possível interpretar a data no fuso horário do projeto.');
  }

  return {
    dia: DIAS[dia],
    hora: Number(hora),
  };
}

function epochDe(data: string): number {
  const valor = Date.parse(data);
  return Number.isFinite(valor) ? valor : Number.NaN;
}

function diaDaSemana(date: Date): DiaSemana {
  return partesNoFuso(date).dia;
}

function confiancaPorQuantidade(total: number): Confianca {
  if (total < 3) return 'baixa';
  if (total < 6) return 'media';
  return 'alta';
}

/** Mediana ponderada. */
export function medianaPonderada(
  valores: Array<{ valor: number; peso: number }>
): number | null {
  const validos = valores
    .filter((v) => Number.isFinite(v.valor) && v.peso > 0)
    .sort((a, b) => a.valor - b.valor);

  if (validos.length === 0) return null;

  const pesoTotal = validos.reduce((soma, v) => soma + v.peso, 0);
  let acumulado = 0;

  for (let i = 0; i < validos.length; i++) {
    acumulado += validos[i].peso;

    if (acumulado > pesoTotal / 2) return validos[i].valor;

    if (Math.abs(acumulado - pesoTotal / 2) < 1e-9) {
      const proximo = validos[i + 1];
      return proximo
        ? (validos[i].valor + proximo.valor) / 2
        : validos[i].valor;
    }
  }

  return validos[validos.length - 1].valor;
}

function historicoCorrespondente(
  historico: Historico[],
  agora: Date,
  especialidade: Checkin['especialidade']
): Historico | undefined {
  const { dia, hora } = partesNoFuso(agora);

  // Especialidade é obrigatória: nunca usa histórico legado ou de outra especialidade.
  return historico.find(
    (h) =>
      h.especialidade === especialidade &&
      h.dia === dia &&
      h.hora === hora &&
      Number.isFinite(h.medianaMin) &&
      h.medianaMin >= 0 &&
      h.medianaMin <= MAX_MINUTOS
  );
}

/**
 * Estima a espera usando apenas check-ins concluídos enviados pelo serviço chamador,
 * já filtrados para uma UPA.
 * O registro em checkins/ representa um atendimento concluído;
 * o check-in ativo permanece no localStorage.
 */
export function estimarEspera(
  checkinsConcluidos: Checkin[],
  agoraMs: number,
  especialidade: Checkin['especialidade'],
  historico: Historico[] = []
): Estimativa {
  const agora = new Date(agoraMs);

  const amostras = checkinsConcluidos
    .filter((checkin) => checkin.especialidade === especialidade)
    .flatMap((checkin) => {
      const criadoEm = epochDe(checkin.criadoEm);
      const idadeMs = agoraMs - criadoEm;

      if (!Number.isFinite(criadoEm) || idadeMs < 0 || idadeMs > JANELA_MS) {
        return [];
      }

      if (
        !Number.isInteger(checkin.minutos) ||
        checkin.minutos < 0 ||
        checkin.minutos > MAX_MINUTOS
      ) {
        return [];
      }

      const idadeMin = idadeMs / 60_000;
      const peso = Math.pow(0.5, idadeMin / MEIA_VIDA_MIN);

      return [{ minutos: checkin.minutos, idadeMin, peso }];
    });

  if (amostras.length > 0) {
    const valor = medianaPonderada(
      amostras.map((a) => ({ valor: a.minutos, peso: a.peso }))
    );

    if (valor === null) return semDados();

    let minutos = Math.round(valor);

    // Salvaguarda parcial RN-11: com um único relato,
    // limita o desvio ao histórico coincidente, quando existir.
    if (amostras.length === 1) {
      const baseHistorica = historicoCorrespondente(
        historico,
        agora,
        especialidade
      );

      if (baseHistorica) {
        minutos = Math.max(
          baseHistorica.medianaMin - 15,
          Math.min(baseHistorica.medianaMin + 15, minutos)
        );
      }
    }

    const ultimoHaMin = Math.max(
      0,
      Math.floor(Math.min(...amostras.map((a) => a.idadeMin)))
    );

    return {
      minutos,
      relatos: amostras.length,
      ultimoHaMin,
      origem: 'relatos',
      confianca: confiancaPorQuantidade(amostras.length),
    };
  }

  const baseHistorica = historicoCorrespondente(
    historico,
    agora,
    especialidade
  );

  if (baseHistorica) {
    return {
      minutos: Math.round(baseHistorica.medianaMin),
      relatos: 0,
      ultimoHaMin: null,
      origem: 'historico',
      confianca: baseHistorica.amostras >= 3 ? 'media' : 'baixa',
    };
  }

  return semDados();
}

function semDados(): Estimativa {
  return {
    minutos: null,
    relatos: 0,
    ultimoHaMin: null,
    origem: 'sem-dados',
    confianca: 'baixa',
  };
}

/** RF-26: produz histórico agregado por UPA, especialidade, dia da semana e hora. */
export function agregarHistorico(
  checkinsConcluidos: Checkin[],
  atualizadoEm: string
): Historico[] {
  const grupos = new Map<
    string,
    {
      slug: string;
      especialidade: Checkin['especialidade'];
      dia: DiaSemana;
      hora: number;
      minutos: number[];
    }
  >();

  for (const checkin of checkinsConcluidos) {
    const criadoEm = epochDe(checkin.criadoEm);

    if (
      !Number.isFinite(criadoEm) ||
      !Number.isInteger(checkin.minutos) ||
      checkin.minutos < 0 ||
      checkin.minutos > MAX_MINUTOS
    ) {
      continue;
    }

    const date = new Date(criadoEm);
    const { dia, hora } = partesNoFuso(date);

    const chave = `${checkin.slug}|${checkin.especialidade}|${dia}|${hora}`;

    const grupo = grupos.get(chave) ?? {
      slug: checkin.slug,
      especialidade: checkin.especialidade,
      dia,
      hora,
      minutos: [],
    };

    grupo.minutos.push(checkin.minutos);
    grupos.set(chave, grupo);
  }

  return [...grupos.values()].map((g) => ({
    slug: g.slug,
    especialidade: g.especialidade,
    dia: g.dia,
    hora: g.hora,
    medianaMin: medianaSimples(g.minutos),
    amostras: g.minutos.length,
    atualizadoEm,
  }));
}

/** ID de documento conforme o formato acordado: {slug}{especialidade}{dia}_{hora}. */
export function gerarIdHistorico(
  slug: string,
  especialidade: Checkin['especialidade'],
  dia: DiaSemana,
  hora: number
): string {
  if (!slug.trim() || !Number.isInteger(hora) || hora < 0 || hora > 23) {
    throw new Error('Dados inválidos para ID de histórico.');
  }

  return `${slug}${especialidade}${dia}_${hora}`;
}

function medianaSimples(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);

  return ordenados.length % 2
    ? ordenados[meio]
    : Math.round((ordenados[meio - 1] + ordenados[meio]) / 2);
}
