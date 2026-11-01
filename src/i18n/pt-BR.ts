// Textos da interface. Telas e componentes não escrevem texto solto: importam daqui.
// Textos com número viram função, para o plural e a unidade ficarem num lugar só.

const PROFISSIONAL = {
  clinica: 'clínico',
  pediatria: 'pediatra',
  ortopedia: 'ortopedista',
  odonto: 'dentista',
} as const

const haPorExtenso = (min: number) => {
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} minutos`
  return `há ${Math.floor(min / 60)} horas`
}

export const ptBR = {
  especialidade: {
    clinica: 'Clínica médica',
    pediatria: 'Pediatria',
    ortopedia: 'Ortopedia',
    odonto: 'Odontologia',
  },
  // Nome curto, usado nas linhas do quadro da semana.
  especialidadeCurta: {
    clinica: 'Clínica',
    pediatria: 'Pediatria',
    ortopedia: 'Ortopedia',
    odonto: 'Odonto',
  },
  // "Tem ortopedista agora" / "Sem pediatra hoje" (sheet "Avisar algo", tela 15).
  profissional: PROFISSIONAL,
  dia: {
    dom: 'Dom',
    seg: 'Seg',
    ter: 'Ter',
    qua: 'Qua',
    qui: 'Qui',
    sex: 'Sex',
    sab: 'Sáb',
  },
  diaExtenso: {
    dom: 'domingo',
    seg: 'segunda',
    ter: 'terça',
    qua: 'quarta',
    qui: 'quinta',
    sex: 'sexta',
    sab: 'sábado',
  },
  upa: {
    carregando: { titulo: 'Abrindo a UPA', texto: 'Carregando as informações…' },
    naoEncontrada: {
      titulo: 'UPA não encontrada',
      texto: 'Não achamos nenhuma UPA com esse endereço. Veja a lista completa.',
      voltar: 'Ver todas as UPAs',
    },
    erro: {
      titulo: 'Não foi possível abrir a UPA',
      tentarDeNovo: 'Tentar de novo',
      porCodigo: {
        offline: 'Sem conexão. Verifique a internet e tente de novo.',
        permissao: 'Não temos permissão para mostrar esta UPA agora.',
        limite: 'Muitas tentativas seguidas. Espere um pouco e tente de novo.',
        validacao: 'Os dados desta UPA vieram com problema. Tente de novo mais tarde.',
        'nao-encontrado': 'Não achamos esta UPA.',
        desconhecido: 'Algo deu errado. Tente de novo.',
      },
    },
    barra: {
      voltar: 'Voltar para a lista de UPAs',
      compartilhar: 'Compartilhar esta UPA',
      linkCopiado: 'Link copiado.',
      naoCopiou: 'Não deu para copiar o link.',
    },
    // Anunciado por leitor de tela quando a situação muda (aria-live).
    situacaoAnunciada: {
      atende: 'atende agora',
      fechado: 'fechado agora',
      'nao-atende': 'não atende',
    },
    comoChegar: 'Como chegar',
    novaAba: '(abre em uma nova aba)',
    agora: {
      titulo: 'Agora',
      semInformacao: 'sem informação recente',
      rodape: 'Espera estimada a partir dos check-ins de quem está na unidade, por especialidade.',
      naoAtende: 'não atende',
      quadroDaSemana: 'quadro da semana',
      avisoDaComunidade: 'aviso da comunidade',
      fechado: 'Fechado agora',
      min: 'min',
    },
    checkin: {
      titulo: 'Check-in',
      texto:
        'Chegou na UPA? Toque em “Cheguei” e, quando for chamado, em “Fui atendido”. O tempo continua contando mesmo se você fechar o navegador.',
      botao: 'Cheguei',
    },
    avisos: {
      titulo: 'Avisos de hoje',
      vazio: 'Nenhum aviso ativo agora.',
      rodape: 'Avisos somem sozinhos depois de 6 horas ou quando 3 pessoas dizem que não é mais assim.',
    },
    quadro: {
      titulo: 'Quadro da semana',
      sugerir: 'Sugerir correção',
      legendaTabela: 'Dias da semana em que cada especialidade atende',
      atende: 'atende',
      naoAtendeCelula: 'não atende',
      naoAtende: 'Não atende',
      horariosVariam: 'horários variam',
      todosOsDias: 'todos os dias',
      oficial: 'Não é informação oficial da prefeitura.',
      semConfirmacoes: 'Escala montada pela comunidade, ainda sem confirmações.',
      confirmada: (n: number) =>
        `Escala montada pela comunidade e confirmada por ${n === 1 ? '1 pessoa' : `${n} pessoas`}.`,
    },
  },
  // Títulos dos avisos (tela 11 e sheet da tela 15).
  aviso: {
    temProfissional: (esp: keyof typeof PROFISSIONAL) => `Tem ${PROFISSIONAL[esp]} agora`,
    semProfissional: (esp: keyof typeof PROFISSIONAL) => `Sem ${PROFISSIONAL[esp]} hoje`,
    temProfissionalGeral: 'Tem profissional agora',
    semProfissionalGeral: 'Sem profissional hoje',
    'raio-x': 'Raio-x parado',
    fila: 'Fila grande na recepção',
    farmacia: 'Farmácia sem remédio',
    outro: 'Outro aviso',
  },
  // RN-24: todo número informa a origem e a idade.
  relatos: (n: number) => (n === 1 ? '1 relato' : `${n} relatos`),
  pessoas: (n: number) => (n === 1 ? '1 pessoa' : `${n} pessoas`),
  haMinutos: (min: number) => {
    if (min < 1) return 'agora há pouco'
    if (min < 60) return `há ${min} min`
    return `há ${Math.floor(min / 60)} h`
  },
  expiraEm: (min: number) => (min < 60 ? `expira em ${Math.max(min, 1)} min` : `expira em ${Math.round(min / 60)}h`),
  semInformacaoRecente: 'sem informação recente',
  abreAs: (hora: string) => `Abre às ${hora}`,
  abreAmanha: (hora: string) => `Abre amanhã às ${hora}`,
  horario24h: '24 horas',
  horarioDeAte: (de: string, ate: string) => `${de} às ${ate}`,
  esperaAcessivel: (min: number, relatos: number, haMin: number) =>
    `${min} minutos, ${relatos === 1 ? '1 relato' : `${relatos} relatos`}, ${haPorExtenso(haMin)}`,
} as const
