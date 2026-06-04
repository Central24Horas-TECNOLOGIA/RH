function normalizarNumero(valor) {
  const numero = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function formatarNumero(valor) {
  const numero = normalizarNumero(valor);
  return numero === null ? 'sem dado' : numero.toFixed(1).replace('.', ',');
}

function montarResumoLocal(payload) {
  const candidatos = Array.isArray(payload?.candidatos) ? payload.candidatos : [];
  const notas = candidatos
    .map((item) => normalizarNumero(item.notaProva))
    .filter((item) => item !== null);
  const scores = candidatos
    .map((item) => normalizarNumero(item.scoreCv))
    .filter((item) => item !== null);
  const media = (lista) =>
    lista.length
      ? lista.reduce((soma, item) => soma + item, 0) / lista.length
      : null;
  const melhor = [...candidatos]
    .sort((a, b) => Number(b.mediaGeral || 0) - Number(a.mediaGeral || 0))[0];

  return {
    disponivel: false,
    resumo:
      candidatos.length > 0
        ? `Dossiê consolidado com ${candidatos.length} candidato(s), média de prova ${formatarNumero(media(notas))} e média de currículo ${formatarNumero(media(scores))}.`
        : 'Ainda não há dados suficientes para gerar uma análise inteligente do processo.',
    ranking: candidatos
      .slice()
      .sort((a, b) => Number(b.mediaGeral || 0) - Number(a.mediaGeral || 0))
      .slice(0, 5)
      .map((item, indice) => ({
        posicao: indice + 1,
        candidato: item.nome,
        media: formatarNumero(item.mediaGeral),
      })),
    pontos_fortes: melhor
      ? [
          `${melhor.nome} aparece com a melhor média consolidada (${formatarNumero(melhor.mediaGeral)}).`,
          'Candidatos com prova, currículo e entrevista registrados oferecem comparação mais confiável.',
        ]
      : ['Aguardando candidatos avaliados para destacar pontos fortes.'],
    pontos_atencao: [
      'A IA não decide pelo RH; use esta análise como apoio para revisar dados e inconsistências.',
      'Candidatos sem nota de prova, score de CV ou entrevista precisam de validação manual antes de comparação final.',
    ],
    proximos_passos: [
      'Revisar candidatos com dados incompletos.',
      'Registrar devolutivas e observações do RH no dossiê.',
      'Comparar a aderência ao perfil da vaga antes da decisão final.',
    ],
    mensagem_fallback:
      'Não foi possível gerar a análise inteligente neste momento. Os dados consolidados continuam disponíveis para consulta.',
  };
}

export async function gerarAnaliseInteligenteProcesso(payload) {
  const ambiente = typeof window !== 'undefined' ? window : {};
  const endpoint = String(
    ambiente.RUNTIME_CONFIG?.PROCESS_DOSSIER_AI_ENDPOINT ||
      ambiente.__RH_PROCESS_DOSSIER_AI_ENDPOINT__ ||
      '',
  ).trim();

  if (!endpoint) {
    return montarResumoLocal(payload);
  }

  try {
    const resposta = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });

    if (!resposta.ok) {
      throw new Error('Serviço de IA indisponível.');
    }

    const dados = await resposta.json();
    return {
      ...montarResumoLocal(payload),
      ...(dados || {}),
      disponivel: true,
    };
  } catch (error) {
    return montarResumoLocal(payload);
  }
}
