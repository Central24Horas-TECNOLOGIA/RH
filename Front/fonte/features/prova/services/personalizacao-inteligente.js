const CHAVE_HISTORICO_PERSONALIZACAO =
  'rh_exam_personalization_history_v1';

export const STATUS_PERSONALIZACAO = {
  NAO_PERSONALIZADA: 'Não personalizada',
  PENDENTE: 'Personalização pendente',
  GERADA: 'Gerada',
  EM_REVISAO: 'Em revisão',
  APROVADA: 'Aprovada',
  REPROVADA: 'Reprovada',
  EDITADA: 'Editada manualmente',
  PUBLICADA: 'Publicada',
  ERRO: 'Erro na geração',
};

export const PERFIS_OPERACAO = [
  {
    id: 'atendimento_saude',
    label: 'Atendimento em saúde',
    descricao:
      'Cenários com pacientes, agendamento, acolhimento, sigilo e clareza nas orientações.',
    situacoes: [
      'agendamento de consulta',
      'indisponibilidade de agenda',
      'orientação sobre retorno',
    ],
    tom: 'acolhedor, claro e cuidadoso',
  },
  {
    id: 'call_center',
    label: 'Call center / SAC',
    descricao:
      'Cenários com fila de atendimento, registro em sistema, SLA, postura e solução no primeiro contato.',
    situacoes: [
      'cliente insatisfeito',
      'registro de protocolo',
      'encaminhamento para suporte',
    ],
    tom: 'objetivo, cordial e resolutivo',
  },
  {
    id: 'backoffice',
    label: 'Backoffice operacional',
    descricao:
      'Cenários com análise de cadastro, atualização de planilhas, conferência de dados e tratativas internas.',
    situacoes: [
      'cadastro divergente',
      'relatório pendente',
      'validação de informação',
    ],
    tom: 'preciso, organizado e profissional',
  },
  {
    id: 'suporte_ti',
    label: 'Suporte técnico',
    descricao:
      'Cenários com incidente, abertura de chamado, diagnóstico inicial, orientação ao usuário e escalonamento.',
    situacoes: [
      'falha de acesso',
      'sistema indisponível',
      'triagem de incidente',
    ],
    tom: 'técnico, claro e orientado a causa',
  },
  {
    id: 'rh_dp',
    label: 'RH / DP',
    descricao:
      'Cenários com documentos, comunicação interna, admissão, processo seletivo e atendimento a colaboradores.',
    situacoes: [
      'documentação pendente',
      'comunicado interno',
      'orientação ao candidato',
    ],
    tom: 'formal, humano e objetivo',
  },
];

export const NIVEIS_PERSONALIZACAO = [
  {
    id: 'leve',
    label: 'Leve',
    descricao: 'Aplica pequenas adaptações de vocabulário sem mudar o cenário principal.',
  },
  {
    id: 'situacional',
    label: 'Situacional',
    descricao: 'Reescreve a situação para uma rotina realista do perfil de atendimento.',
  },
  {
    id: 'contextual_avancado',
    label: 'Contextual avançado',
    descricao: 'Cria um cenário mais completo, preservando tarefa, peso e critérios.',
  },
];

const CONTEXTOS_PERFIL_ATENDIMENTO = {
  atendimento_saude: {
    ambiente: 'equipe de atendimento',
    atividade: 'agendamento e confirmação de consultas',
    publico: 'paciente',
    publicoPlural: 'pacientes',
    registros: 'agenda de consultas e avisos do sistema',
    problema: 'algumas orientações sobre marcação, confirmação e retorno estavam sendo repassadas apenas verbalmente',
    risco: 'dúvidas para os pacientes e falhas no atendimento',
    elementos: 'agenda, registro no sistema, orientação clara e acolhimento',
    termos: ['paciente', 'consulta', 'agenda', 'agendamento', 'atendimento'],
  },
  call_center: {
    ambiente: 'equipe de atendimento',
    atividade: 'tratativa de solicitações por telefone e canais digitais',
    publico: 'cliente',
    publicoPlural: 'clientes',
    registros: 'protocolos, avisos de fila e orientações do sistema',
    problema: 'algumas informações sobre protocolos e encaminhamentos estavam ficando dispersas entre os atendentes',
    risco: 'retrabalho, espera maior e perda de clareza para o cliente',
    elementos: 'protocolo, registro no sistema, fila de atendimento e comunicação objetiva',
    termos: ['cliente', 'protocolo', 'atendimento', 'solicitação', 'registro'],
  },
  backoffice: {
    ambiente: 'equipe de backoffice',
    atividade: 'conferência de cadastros, planilhas e pendências internas',
    publico: 'solicitante',
    publicoPlural: 'solicitantes',
    registros: 'planilhas, cadastros e avisos internos',
    problema: 'algumas divergências de cadastro e atualização estavam sendo tratadas sem registro claro',
    risco: 'atrasos na conferência e inconsistências no acompanhamento',
    elementos: 'cadastro, planilha, conferência de dados e registro das pendências',
    termos: ['cadastro', 'planilha', 'conferência', 'pendência', 'registro'],
  },
  suporte_ti: {
    ambiente: 'equipe de suporte',
    atividade: 'triagem de chamados e orientação inicial a usuários',
    publico: 'usuário',
    publicoPlural: 'usuários',
    registros: 'chamados, filas de suporte e avisos técnicos',
    problema: 'algumas orientações sobre acesso, indisponibilidade e escalonamento estavam sem registro padronizado',
    risco: 'demora na solução e perda de informações importantes do chamado',
    elementos: 'chamado, diagnóstico inicial, orientação ao usuário e escalonamento',
    termos: ['usuário', 'chamado', 'suporte', 'acesso', 'sistema'],
  },
  rh_dp: {
    ambiente: 'equipe de RH',
    atividade: 'atendimento a colaboradores e organização de documentos',
    publico: 'colaborador',
    publicoPlural: 'colaboradores',
    registros: 'documentos, comunicados internos e avisos do sistema',
    problema: 'algumas orientações sobre documentos e prazos estavam sendo repassadas de forma informal',
    risco: 'dúvidas entre colaboradores e atraso nas tratativas internas',
    elementos: 'documentos, prazos, comunicado interno e registro das orientações',
    termos: ['colaborador', 'documento', 'prazo', 'comunicado', 'RH'],
  },
};

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function textoSemAcentos(valor) {
  return normalizarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor ?? null));
}

function obterPerfilPorId(id) {
  return (
    PERFIS_OPERACAO.find((perfil) => perfil.id === id) ||
    PERFIS_OPERACAO[0]
  );
}

function obterContextoPerfil(perfil) {
  return (
    CONTEXTOS_PERFIL_ATENDIMENTO[perfil?.id] ||
    CONTEXTOS_PERFIL_ATENDIMENTO.call_center
  );
}

function obterOpcao(lista, id) {
  return lista.find((item) => item.id === id) || lista[0];
}

function criarSnapshotQuestao(questao) {
  return {
    stageKey: questao.stageKey,
    stage: questao.stage,
    type: questao.type,
    title: questao.title,
    description: questao.description,
    options: clonar(questao.options || []),
    answer: questao.answer,
    correctIndex: questao.correctIndex,
    expected: clonar(questao.expected || {}),
    taskId: questao.taskId,
    points: questao.points,
    stageWeight: questao.stageWeight,
  };
}

function montarContexto(configuracao = {}) {
  const perfil = obterPerfilPorId(configuracao.perfilOperacao);
  const nivel = obterOpcao(
    NIVEIS_PERSONALIZACAO,
    configuracao.nivelPersonalizacao,
  );
  const operacao =
    normalizarTexto(configuracao.operacao) ||
    normalizarTexto(configuracao.cliente) ||
    perfil.label;
  const contextoPerfil = obterContextoPerfil(perfil);

  return {
    operacao,
    cliente: normalizarTexto(configuracao.cliente) || operacao,
    perfil,
    contextoPerfil,
    nivel,
    usuario: normalizarTexto(configuracao.usuario) || 'RH',
  };
}

function escaparRegExp(valor) {
  return String(valor || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trocarTermo(texto, termo, substituto) {
  if (!normalizarTexto(termo) || !normalizarTexto(substituto)) return texto;
  return texto.replace(new RegExp(`\\b${escaparRegExp(termo)}\\b`, 'gi'), substituto);
}

function substituirVocabularioBase(texto, contextoPerfil) {
  let resultado = texto;
  resultado = trocarTermo(resultado, 'rotina do setor', `rotina de ${contextoPerfil.atividade}`);
  resultado = trocarTermo(resultado, 'avisos do setor', contextoPerfil.registros);
  resultado = trocarTermo(resultado, 'setor', contextoPerfil.ambiente);
  resultado = trocarTermo(resultado, 'cliente', contextoPerfil.publico);
  resultado = trocarTermo(resultado, 'clientes', contextoPerfil.publicoPlural);
  resultado = trocarTermo(resultado, 'usuário', contextoPerfil.publico);
  resultado = trocarTermo(resultado, 'usuários', contextoPerfil.publicoPlural);
  resultado = trocarTermo(resultado, 'colaboradores', 'integrantes da equipe');
  resultado = trocarTermo(resultado, 'recados', 'orientações');
  return resultado;
}

function removerTermosConfiguradosDoEnunciado(texto, contexto) {
  let resultado = texto;
  const substituto = contexto.contextoPerfil.ambiente;
  const termos = [
    contexto.operacao,
    contexto.cliente,
  ].filter((termo) => normalizarTexto(termo).length > 2);

  termos.forEach((termo) => {
    resultado = resultado.replace(
      new RegExp(escaparRegExp(termo), 'gi'),
      substituto,
    );
  });

  return resultado;
}

function separarCenarioETarefa(texto) {
  const partes = normalizarTexto(texto)
    .split(/\n{2,}/)
    .map((parte) => parte.trim())
    .filter(Boolean);

  if (partes.length > 1) {
    return {
      cenario: partes[0],
      tarefa: partes.slice(1).join('\n\n'),
    };
  }

  const indiceInstrucao = normalizarTexto(texto).search(
    /\b(Escreva|Redija|Assinale|Escolha|Informe|Calcule|Crie|Monte|Responda|Analise|Organize|Classifique)\b/i,
  );

  if (indiceInstrucao > 20) {
    return {
      cenario: texto.slice(0, indiceInstrucao).trim(),
      tarefa: texto.slice(indiceInstrucao).trim(),
    };
  }

  return {
    cenario: '',
    tarefa: normalizarTexto(texto),
  };
}

function minuscularPrimeiraLetra(texto) {
  const valor = normalizarTexto(texto);
  if (!valor) return valor;
  return `${valor.charAt(0).toLowerCase()}${valor.slice(1)}`;
}

function montarEnunciadoLeve(textoOriginal, contexto) {
  const contextoPerfil = contexto.contextoPerfil;
  const adaptado = substituirVocabularioBase(textoOriginal, contextoPerfil);
  const semTermosConfigurados = removerTermosConfiguradosDoEnunciado(
    adaptado,
    contexto,
  );

  if (textoSemAcentos(semTermosConfigurados) !== textoSemAcentos(textoOriginal)) {
    return semTermosConfigurados;
  }

  return `Em uma rotina de ${contextoPerfil.atividade}, ${minuscularPrimeiraLetra(semTermosConfigurados)}`;
}

function montarEnunciadoSituacional(textoOriginal, contexto) {
  const contextoPerfil = contexto.contextoPerfil;
  const { tarefa } = separarCenarioETarefa(textoOriginal);
  const tarefaFinal = substituirVocabularioBase(
    tarefa || textoOriginal,
    contextoPerfil,
  );
  const cenario = [
    `Durante a rotina de ${contextoPerfil.atividade}, foi percebido que ${contextoPerfil.problema}.`,
    `Para evitar ${contextoPerfil.risco} e manter a comunicação organizada, a equipe precisa executar a orientação abaixo.`,
  ].join(' ');

  return `${cenario}\n\n${tarefaFinal}`;
}

function montarEnunciadoContextualAvancado(textoOriginal, contexto) {
  const contextoPerfil = contexto.contextoPerfil;
  const { tarefa } = separarCenarioETarefa(textoOriginal);
  const tarefaFinal = substituirVocabularioBase(
    tarefa || textoOriginal,
    contextoPerfil,
  );
  const cenario = [
    `Em um dia de maior volume na rotina de ${contextoPerfil.atividade}, a equipe precisou conciliar ${contextoPerfil.elementos}.`,
    `Como parte do alinhamento do turno, uma orientação inconsistente poderia gerar ${contextoPerfil.risco}.`,
    'A tarefa deve resolver a situação de forma clara, objetiva e compatível com o nível da prova.',
  ].join(' ');

  return `${cenario}\n\n${tarefaFinal}`;
}

function personalizarEnunciado(questao, contexto) {
  if (questao.type === 'excel_external') {
    return questao.description;
  }

  const textoOriginal = normalizarTexto(questao.description);
  if (!textoOriginal) return textoOriginal;

  let textoPersonalizado;
  if (contexto.nivel.id === 'leve') {
    textoPersonalizado = montarEnunciadoLeve(textoOriginal, contexto);
  } else if (contexto.nivel.id === 'contextual_avancado') {
    textoPersonalizado = montarEnunciadoContextualAvancado(
      textoOriginal,
      contexto,
    );
  } else {
    textoPersonalizado = montarEnunciadoSituacional(textoOriginal, contexto);
  }

  return removerTermosConfiguradosDoEnunciado(textoPersonalizado, contexto);
}

function validarQuestaoPersonalizada(original, personalizada) {
  const alertas = [];

  if (!normalizarTexto(personalizada.description)) {
    alertas.push('Enunciado personalizado vazio.');
  }

  if (original.type !== personalizada.type) {
    alertas.push('Tipo da questão foi alterado.');
  }

  if (Number(original.points || 0) !== Number(personalizada.points || 0)) {
    alertas.push('Peso da questão foi alterado.');
  }

  if (normalizarTexto(original.stageKey) !== normalizarTexto(personalizada.stageKey)) {
    alertas.push('Etapa original foi alterada.');
  }

  if (
    original.type === 'multiple' &&
    Array.isArray(original.options) &&
    Array.isArray(personalizada.options)
  ) {
    if (original.options.length !== personalizada.options.length) {
      alertas.push('Quantidade de alternativas foi alterada.');
    }
    if (
      Number(original.answer ?? original.correctIndex) !==
      Number(personalizada.answer ?? personalizada.correctIndex)
    ) {
      alertas.push('Alternativa correta foi alterada.');
    }
  }

  return {
    ok: alertas.length === 0,
    alertas,
  };
}

export function gerarQuestaoPersonalizada(
  questao,
  configuracao = {},
  indice = 0,
) {
  const contexto = montarContexto(configuracao);
  const original = criarSnapshotQuestao(questao);
  const personalizada = {
    ...clonar(questao),
    description: personalizarEnunciado(questao, contexto),
  };

  const alertas = [];
  if (questao.type === 'excel_external') {
    alertas.push(
      'Questão prática de Excel preservada sem adaptação textual para não alterar arquivo-base, peso ou critério.',
    );
  }

  if (!contexto.operacao) {
    alertas.push('Operação não informada; personalização ficou genérica.');
  }

  const validacao = validarQuestaoPersonalizada(original, personalizada);
  const status = validacao.ok
    ? STATUS_PERSONALIZACAO.GERADA
    : STATUS_PERSONALIZACAO.EM_REVISAO;
  const alertasFinais = [...alertas, ...validacao.alertas];

  return {
    ...personalizada,
    personalizacaoInteligente: {
      ativa: true,
      indice,
      status,
      operacao: contexto.operacao,
      cliente: contexto.cliente,
      perfil_atendimento: contexto.perfil.label,
      nivel_personalizacao: contexto.nivel.label,
      termos_publicos: contexto.contextoPerfil.termos,
      competencia_preservada: personalizada.stage || personalizada.stageKey,
      nivel_preservado: true,
      peso_preservado: true,
      original,
      justificativa_adaptacao:
        questao.type === 'excel_external'
          ? 'Questão mantida neutra para preservar arquivo-base e checklist técnico.'
          : `Enunciado adaptado ao perfil "${contexto.perfil.label}" no nível "${contexto.nivel.label}", sem alterar tipo, peso, etapa, alternativas ou critérios.`,
      alertas: alertasFinais,
      validacao,
      visivel_ao_candidato: false,
      gerada_em: new Date().toISOString(),
      gerada_por: contexto.usuario,
      mecanismo: 'template_local',
    },
  };
}

export function gerarPersonalizacaoProva(questoes = [], configuracao = {}) {
  const lista = Array.isArray(questoes) ? questoes : [];
  const questoesPersonalizadas = lista.map((questao, indice) => {
    try {
      return gerarQuestaoPersonalizada(questao, configuracao, indice);
    } catch (error) {
      return {
        ...clonar(questao),
        personalizacaoInteligente: {
          ativa: true,
          indice,
          status: STATUS_PERSONALIZACAO.ERRO,
          original: criarSnapshotQuestao(questao),
          alertas: [
            error?.message ||
              'Não foi possível personalizar esta questão automaticamente.',
          ],
          gerada_em: new Date().toISOString(),
          mecanismo: 'template_local_fallback',
        },
      };
    }
  });
  const alertas = questoesPersonalizadas.flatMap(
    (questao) => questao.personalizacaoInteligente?.alertas || [],
  );

  return {
    status: STATUS_PERSONALIZACAO.GERADA,
    questoes: questoesPersonalizadas,
    alertas,
    historico: montarHistoricoPersonalizacao(
      questoesPersonalizadas,
      configuracao,
      'gerar_personalizacao_automatica',
    ),
  };
}

export function montarHistoricoPersonalizacao(
  questoes = [],
  configuracao = {},
  acao = 'personalizacao',
) {
  const contexto = montarContexto(configuracao);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    acao,
    operacao: contexto.operacao,
    cliente: contexto.cliente,
    perfil_atendimento: contexto.perfil.label,
    nivel_personalizacao: contexto.nivel.label,
    usuario: contexto.usuario,
    data_hora: new Date().toISOString(),
    mecanismo: 'template_local',
    total_questoes: questoes.length,
    questoes: questoes.map((questao, indice) => ({
      indice,
      status: questao.personalizacaoInteligente?.status ||
        STATUS_PERSONALIZACAO.NAO_PERSONALIZADA,
      questao_original:
        questao.personalizacaoInteligente?.original?.description ||
        questao.description,
      questao_personalizada: questao.description,
      competencia_preservada:
        questao.personalizacaoInteligente?.competencia_preservada ||
        questao.stage ||
        questao.stageKey,
      peso: questao.points,
      alertas: questao.personalizacaoInteligente?.alertas || [],
    })),
  };
}

export function registrarHistoricoPersonalizacao(item) {
  if (!item) return;

  try {
    const atual = JSON.parse(
      localStorage.getItem(CHAVE_HISTORICO_PERSONALIZACAO) || '[]',
    );
    const lista = Array.isArray(atual) ? atual : [];
    lista.unshift(item);
    localStorage.setItem(
      CHAVE_HISTORICO_PERSONALIZACAO,
      JSON.stringify(lista.slice(0, 100)),
    );
  } catch (error) {
    console.warn('Não foi possível registrar histórico de personalização.', error);
  }
}

function removerHtmlLocal(valor) {
  if (typeof document === 'undefined') {
    return String(valor || '').replace(/<[^>]+>/g, ' ');
  }

  const elemento = document.createElement('div');
  elemento.innerHTML = String(valor || '');
  return elemento.textContent || elemento.innerText || '';
}

export function corrigirRespostaDiscursivaInteligente(
  questao,
  resposta,
  notaBase = 0,
  notaMaxima = 10,
) {
  if (questao?.type !== 'word') return null;

  const texto = removerHtmlLocal(resposta?.content || '').trim();
  const contexto = questao.personalizacaoInteligente;
  const alertas = [];
  const pontosPositivos = [];
  const pontosAtencao = [];

  if (!texto) {
    alertas.push('Resposta não informada.');
    pontosAtencao.push('Candidato não apresentou conteúdo para análise.');
  }

  if (texto.length >= Number(questao.expected?.minTextLength || 80)) {
    pontosPositivos.push('Resposta possui desenvolvimento textual suficiente.');
  } else {
    pontosAtencao.push('Resposta curta para a complexidade esperada.');
  }

  if (/[.!?]/.test(texto)) {
    pontosPositivos.push('Comunicação escrita apresenta estrutura de frase.');
  } else if (texto) {
    pontosAtencao.push('Texto pode melhorar pontuação e clareza.');
  }

  const termosPublicos = Array.isArray(contexto?.termos_publicos)
    ? contexto.termos_publicos
    : [];
  const textoNormalizado = textoSemAcentos(texto);
  const aderenteAoCenario =
    Boolean(contexto?.ativa) &&
    termosPublicos.some((termo) =>
      textoNormalizado.includes(textoSemAcentos(termo)),
    );

  if (aderenteAoCenario) {
    pontosPositivos.push('Resposta dialoga com o cenário apresentado na questão.');
  } else if (contexto?.ativa && texto) {
    pontosAtencao.push(
      'Resposta pode conectar melhor a solução ao cenário apresentado na questão.',
    );
  }

  if (/não sei|nao sei|qualquer coisa|tanto faz/i.test(texto)) {
    alertas.push('Resposta possivelmente genérica ou pouco profissional.');
  }

  const notaSugerida = Math.max(
    0,
    Math.min(Number(notaMaxima || 10), Number(notaBase || 0)),
  );

  return {
    nota_sugerida: notaSugerida,
    nota_maxima: Number(notaMaxima || 10),
    justificativa_nota:
      'Sugestão local baseada na rubrica textual, sem substituir revisão final do RH.',
    pontos_positivos: pontosPositivos,
    pontos_atencao: pontosAtencao,
    aderencia_perfil_atendimento: contexto?.ativa
      ? aderenteAoCenario
        ? 'Aderente ao cenário apresentado.'
        : 'Precisa de revisão humana para confirmar aderência ao cenário.'
      : 'Questão sem personalização inteligente ativa.',
    alertas,
    revisao_humana: true,
  };
}
