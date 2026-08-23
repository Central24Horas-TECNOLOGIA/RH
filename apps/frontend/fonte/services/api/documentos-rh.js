import { requisitar, requisitarArquivo } from './core.js';

export async function listarDocumentosRh({
  idPastaPai = null,
  tipo = '',
  categoriaExtensao = '',
  busca = '',
  criadoPor = '',
  dataCriacaoDe = '',
  dataCriacaoAte = '',
  dataModificacaoDe = '',
  dataModificacaoAte = '',
} = {}) {
  const params = new URLSearchParams();
  if (idPastaPai !== null && idPastaPai !== undefined && idPastaPai !== '') {
    params.set('id_pasta_pai', idPastaPai);
  }
  if (tipo) params.set('tipo', tipo);
  if (categoriaExtensao) params.set('categoria_extensao', categoriaExtensao);
  if (busca) params.set('busca', busca);
  if (criadoPor) params.set('criado_por', criadoPor);
  if (dataCriacaoDe) params.set('data_criacao_de', dataCriacaoDe);
  if (dataCriacaoAte) params.set('data_criacao_ate', dataCriacaoAte);
  if (dataModificacaoDe) params.set('data_modificacao_de', dataModificacaoDe);
  if (dataModificacaoAte) params.set('data_modificacao_ate', dataModificacaoAte);

  const sufixo = params.toString() ? `?${params.toString()}` : '';
  return requisitar(`/documentos-rh${sufixo}`, { method: 'GET' });
}

export async function criarPastaDocumentoRh({ nome, idPastaPai = null }) {
  return requisitar('/documentos-rh/pastas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, id_pasta_pai: idPastaPai }),
  });
}

export async function uploadArquivoDocumentoRh(arquivo, idPastaPai = null) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);

  const params = new URLSearchParams();
  if (idPastaPai !== null && idPastaPai !== undefined && idPastaPai !== '') {
    params.set('id_pasta_pai', idPastaPai);
  }
  const sufixo = params.toString() ? `?${params.toString()}` : '';

  return requisitar(`/documentos-rh/upload${sufixo}`, {
    method: 'POST',
    body: formData,
  });
}

export async function obterConteudoDocumentoRh(idDocumento) {
  return requisitar(`/documentos-rh/${encodeURIComponent(idDocumento)}/conteudo`, {
    method: 'GET',
  });
}

export async function baixarDocumentoRh(idDocumento) {
  return requisitarArquivo(
    `/documentos-rh/${encodeURIComponent(idDocumento)}/download`,
    { method: 'GET' },
  );
}

export async function renomearDocumentoRh(idDocumento, nome) {
  return requisitar(`/documentos-rh/${encodeURIComponent(idDocumento)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome }),
  });
}

export async function excluirDocumentoRh(idDocumento) {
  return requisitar(`/documentos-rh/${encodeURIComponent(idDocumento)}`, {
    method: 'DELETE',
  });
}
