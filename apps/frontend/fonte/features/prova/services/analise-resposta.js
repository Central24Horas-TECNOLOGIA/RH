function textoSemAcentos(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function removerHtmlLocal(valor) {
  if (typeof document === 'undefined') {
    return String(valor || '').replace(/<[^>]+>/g, ' ');
  }

  const elemento = document.createElement('div');
  elemento.innerHTML = String(valor || '');
  return elemento.textContent || elemento.innerText || '';
}

// Implementação única do recurso já existente de Análise de Resposta.
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
  const formatacoesAplicadas = resposta?.formatacoesAplicadas || {};
  const esperado = questao.expected || {};

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

  const requisitosFormatacao = [
    { ativo: esperado.anyBold, atendido: formatacoesAplicadas.negrito, nome: 'negrito' },
    { ativo: esperado.requiresItalic, atendido: formatacoesAplicadas.italico, nome: 'itálico' },
    { ativo: esperado.requiresUnderline, atendido: formatacoesAplicadas.sublinhado, nome: 'sublinhado' },
    { ativo: esperado.requiresStrike, atendido: formatacoesAplicadas.tachado, nome: 'tachado' },
    {
      ativo: Boolean(esperado.requiredFontSize),
      atendido: (formatacoesAplicadas.tamanhosFonte || []).includes(
        Number(esperado.requiredFontSize),
      ),
      nome: `fonte ${esperado.requiredFontSize}`,
    },
    {
      ativo: Boolean(esperado.requiredAlignment),
      atendido: (formatacoesAplicadas.alinhamentos || []).includes(
        String(esperado.requiredAlignment),
      ),
      nome: `alinhamento ${esperado.requiredAlignment}`,
    },
    {
      ativo: esperado.requiresList,
      atendido:
        esperado.requiredListType === 'ordered'
          ? formatacoesAplicadas.listaOrdenada
          : esperado.requiredListType === 'unordered'
            ? formatacoesAplicadas.listaNaoOrdenada
            : formatacoesAplicadas.lista,
      nome:
        esperado.requiredListType === 'ordered'
          ? 'lista numerada'
          : esperado.requiredListType === 'unordered'
            ? 'lista com marcadores'
            : 'lista',
    },
  ].filter((item) => item.ativo);

  requisitosFormatacao.forEach((requisito) => {
    if (requisito.atendido) {
      pontosPositivos.push(`Formatação solicitada atendida: ${requisito.nome}.`);
    } else {
      pontosAtencao.push(`Formatação solicitada não identificada: ${requisito.nome}.`);
    }
  });

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
    dados_analisados: {
      enunciado_original:
        questao.personalizacaoInteligente?.original?.description ||
        questao.enunciadoQuestao ||
        questao.description ||
        '',
      resposta_candidato: texto,
      resposta_candidato_html: String(resposta?.content || ''),
      rubrica_interna: questao.rubricaInterna || '',
      o_que_deve_ser_avaliado: questao.oQueDeveSerAvaliado || '',
      formatacoes_aplicadas: formatacoesAplicadas,
      criterios_e_regras_existentes: {
        expected: questao.expected || {},
        criterios: questao.gabarito?.criterios || [],
      },
    },
  };
}
