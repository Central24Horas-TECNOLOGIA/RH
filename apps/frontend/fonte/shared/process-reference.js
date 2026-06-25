function normalizarValor(valor) {
  return String(valor || '').trim();
}

export function obterReferenciaProcesso(item) {
  if (!item || typeof item !== 'object') {
    return normalizarValor(item);
  }

  return normalizarValor(item.id_processo_ref || item.id_processo);
}

export function obterIdVisualProcesso(item) {
  if (!item || typeof item !== 'object') {
    return normalizarValor(item);
  }

  return normalizarValor(item.id_processo);
}

export function obterChaveProcesso(item) {
  return obterReferenciaProcesso(item) || obterIdVisualProcesso(item);
}

export function mesmoProcesso(item, referencia) {
  return obterReferenciaProcesso(item) === normalizarValor(referencia);
}

export function encontrarProcessoPorReferencia(lista, referencia) {
  return (Array.isArray(lista) ? lista : []).find((item) =>
    mesmoProcesso(item, referencia),
  );
}

export function montarPayloadProcessoSelecionado(lista, referencia) {
  const processo = encontrarProcessoPorReferencia(lista, referencia);
  return {
    processo,
    id_processo: obterIdVisualProcesso(processo),
    id_processo_ref: obterReferenciaProcesso(processo),
  };
}

export function obterReferenciaProcessoDoCandidato(candidato) {
  return normalizarValor(
    candidato?.id_processo_ref || candidato?.id_processo || '',
  );
}
