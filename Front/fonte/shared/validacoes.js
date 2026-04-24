function normalizarTexto(valor) {
  return String(valor || '').trim();
}

export function quebrarListaTexto(valor) {
  return Array.from(
    new Set(
      String(valor || '')
        .split(/[,;\n]+/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function validarFormularioProcesso(formulario, regras) {
  if (
    !normalizarTexto(formulario.vaga) ||
    !Number(formulario.quantidade) ||
    !normalizarTexto(formulario.dataEncerramento)
  ) {
    return 'Preencha vaga, quantidade de vagas e data de encerramento.';
  }

  if (regras.exigeOperacao && !normalizarTexto(formulario.operacao)) {
    return 'Para essa vaga, informe a operacao.';
  }

  if (regras.exigeTrilha && !normalizarTexto(formulario.trilha)) {
    return 'Para essa vaga, informe a trilha.';
  }

  if (formulario.usaNotaCorte) {
    const nota = Number(formulario.notaCorte);
    if (!formulario.notaCorte || Number.isNaN(nota) || nota < 4 || nota > 10) {
      return 'A nota de corte deve estar entre 4 e 10.';
    }
  }

  if (
    normalizarTexto(formulario.linkAgendamento) &&
    !/^https?:\/\//i.test(normalizarTexto(formulario.linkAgendamento))
  ) {
    return 'Informe um link de agendamento valido.';
  }

  return '';
}

export function validarCardPipeline(formulario) {
  if (!normalizarTexto(formulario.id_processo) || !normalizarTexto(formulario.nome_candidato)) {
    return 'Informe processo e nome do candidato para criar o card.';
  }

  return '';
}

export function validarFormularioEntrevista(formulario) {
  if (!Number(formulario.id_registro || 0)) {
    return 'Selecione um candidato valido para agendar a entrevista.';
  }

  if (
    normalizarTexto(formulario.link_agendamento) &&
    !/^https?:\/\//i.test(normalizarTexto(formulario.link_agendamento))
  ) {
    return 'Informe um link de agendamento valido.';
  }

  return '';
}

export function validarPerfilCandidato(formulario) {
  const tags = quebrarListaTexto(formulario.tags);
  const habilidades = quebrarListaTexto(formulario.habilidades);
  const observacao = normalizarTexto(formulario.observacao_rh);

  if (tags.length > 30 || habilidades.length > 30) {
    return 'Limite de 30 tags e 30 habilidades por candidato.';
  }

  if (observacao.length > 3000) {
    return 'A observacao RH deve ter no maximo 3000 caracteres.';
  }

  return '';
}
