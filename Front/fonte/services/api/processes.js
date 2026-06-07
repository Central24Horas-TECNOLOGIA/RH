import {
  gravarCache,
  invalidarCacheApi,
  lerCache,
  requisitarArquivo,
  requisitar,
} from './core.js';

export async function lerProcessos(forcar = false) {
  if (!forcar) {
    const emCache = lerCache('processos');
    if (emCache) return emCache;
  }

  const dados = await requisitar('/processes', { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache('processos', lista);
  return lista;
}

export async function criarProcesso(dadosProcesso) {
  const resultado = await requisitar('/processes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosProcesso),
  });

  invalidarCacheApi('processos');
  return resultado;
}

export async function atualizarProcesso(idProcesso, dadosProcesso) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosProcesso),
    },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function encerrarProcesso(idProcesso) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/close`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function lerCandidatosProcessos(forcar = false) {
  if (!forcar) {
    const emCache = lerCache('candidatos-processos');
    if (emCache) return emCache;
  }

  const dados = await requisitar('/process-candidates', { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache('candidatos-processos', lista);
  return lista;
}

export async function criarCandidatoNoProcesso(dadosCandidato) {
  const resultado = await requisitar('/process-candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosCandidato),
  });

  invalidarCacheApi(
    'candidatos-processos',
    'banco-talentos',
    'processos',
    'pipeline-candidatos',
  );
  return resultado;
}

export async function atualizarStatusCandidato(idRegistro, dadosStatus) {
  const resultado = await requisitar(
    `/process-candidates/${idRegistro}/status`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosStatus),
    },
  );

  invalidarCacheApi('candidatos-processos', 'banco-talentos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function atualizarStatusCandidatoAvulso(idTeste, dadosStatus) {
  const resultado = await requisitar(
    `/candidate-profiles/${encodeURIComponent(idTeste)}/status`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosStatus),
    },
  );

  invalidarCacheApi('gabaritos', 'banco-talentos', 'candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}

export async function lerBancoTalentos({
  forcar = false,
  search = '',
  skill = '',
  tag = '',
} = {}) {
  const chaveCache = `banco-talentos:${search}:${skill}:${tag}`;

  if (!forcar) {
    const emCache = lerCache(chaveCache);
    if (emCache) return emCache;
  }

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (skill) params.set('skill', skill);
  if (tag) params.set('tag', tag);

  const sufixo = params.toString() ? `?${params.toString()}` : '';
  const dados = await requisitar(`/talent-bank${sufixo}`, { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache(chaveCache, lista);
  return lista;
}

export async function removerBancoTalentos(idBanco) {
  const resultado = await requisitar(`/talent-bank/${idBanco}`, {
    method: 'DELETE',
  });

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'processos');
  return resultado;
}


export async function criarBancoTalentos(dadosCandidato) {
  const resultado = await requisitar('/talent-bank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosCandidato),
  });

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function atualizarPerfilCandidato(idTeste, payload) {
  const resultado = await requisitar(
    `/candidate-profiles/${encodeURIComponent(idTeste)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}

export async function lerFichaCandidato(idTeste) {
  return requisitar(`/candidate-profiles/${encodeURIComponent(idTeste)}/sheet`, {
    method: 'GET',
  });
}

export async function atualizarFichaCandidato(idTeste, payload) {
  const resultado = await requisitar(
    `/candidate-profiles/${encodeURIComponent(idTeste)}/sheet`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}

export async function usarCandidatoDoBancoTalentos(idBanco, dadosUso) {
  const resultado = await requisitar(`/talent-bank/${idBanco}/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosUso),
  });

  invalidarCacheApi(
    'banco-talentos',
    'candidatos-processos',
    'processos',
    'pipeline-candidatos',
  );
  return resultado;
}

export async function lerDetalheProcesso(idProcesso) {
  return requisitar(`/processes/${encodeURIComponent(idProcesso)}/details`, {
    method: 'GET',
  });
}

export async function lerAnotacoesDossieProcesso(idProcesso) {
  return requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/dossier/notes`,
    { method: 'GET' },
  );
}

export async function criarAnotacaoDossieProcesso(idProcesso, payload) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/dossier/notes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function atualizarAnotacaoDossieProcesso(idAnotacao, payload) {
  const resultado = await requisitar(
    `/process-dossier-notes/${encodeURIComponent(idAnotacao)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function lerPreAnalisesCv(idProcesso, pagina = 1, tamanho = 5, filtros = {}) {
  const params = new URLSearchParams({
    page: String(pagina),
    page_size: String(tamanho),
  });
  if (filtros.nome) params.set('nome', filtros.nome);
  if (filtros.scoreMin) params.set('score_min', filtros.scoreMin);
  if (filtros.scoreMax) params.set('score_max', filtros.scoreMax);
  if (filtros.classificacao) params.set('classificacao', filtros.classificacao);
  if (filtros.mostrarOcultos) params.set('incluir_ocultos', 'true');

  return requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/cv-pre-analyses?${params.toString()}`,
    { method: 'GET' },
  );
}

export async function limparListaPreAnalisesCv(idProcesso) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/cv-pre-analyses/clear-list`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function analisarCvProcesso(idProcesso, formData) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/cv-pre-analyses`,
    {
      method: 'POST',
      body: formData,
    },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function atualizarPreAnaliseCv(idPreAnalise, payload) {
  const resultado = await requisitar(`/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}

export async function analisarCvCandidatoInscrito(idTeste, payload = {}) {
  const resultado = await requisitar(
    `/candidate-profiles/${encodeURIComponent(idTeste)}/analyze-cv`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function excluirPreAnaliseCv(idPreAnalise) {
  return requisitar(`/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}`, {
    method: 'DELETE',
  });
}

export async function enviarPreAnaliseParaBancoTalentos(idPreAnalise) {
  const resultado = await requisitar(
    `/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}/talent-bank`,
    { method: 'POST' },
  );

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'processos');
  return resultado;
}

export async function adicionarPreAnaliseAoProcesso(idPreAnalise, opcoes = {}) {
  const resultado = await requisitar(
    `/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}/add-to-process`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opcoes || {}),
    },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function lerEmailsRecebidosProcesso(idProcesso, limite = 12) {
  const params = new URLSearchParams({ limit: String(limite) });
  return requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/email-inbox?${params.toString()}`,
    { method: 'GET' },
  );
}

export async function analisarCvEmailRecebido(idProcesso, payload) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/email-inbox/analyze-cv`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function lerEmailsRecebidos({
  limite = 50,
  mostrarIgnorados = false,
  apenasComAnexos = true,
  refresh = true,
  query = '',
} = {}) {
  const params = new URLSearchParams({ limit: String(limite) });
  if (mostrarIgnorados) params.set('include_ignored', 'true');
  params.set('with_attachments_only', apenasComAnexos ? 'true' : 'false');
  params.set('refresh', refresh ? 'true' : 'false');
  if (query) params.set('query', query);
  return requisitar(`/email-inbox/messages?${params.toString()}`, { method: 'GET' });
}

export async function lerDetalheEmailRecebido(idEmail) {
  return requisitar(`/email-inbox/messages/${encodeURIComponent(idEmail)}`, {
    method: 'GET',
  });
}

export async function baixarAnexoEmailRecebido(idEmail, idAnexo = '') {
  const respostaDownload = await requisitar(
    `/email-inbox/messages/${encodeURIComponent(idEmail)}/download-attachments`,
    { method: 'POST' },
  );
  const item = respostaDownload?.item || {};
  const anexos = Array.isArray(item.anexos) ? item.anexos : [];
  const anexo = anexos.find((entrada) => entrada.id === idAnexo) || anexos[0];
  const caminho = anexo?.id
    ? `/email-inbox/messages/${encodeURIComponent(idEmail)}/attachment/${encodeURIComponent(anexo.id)}`
    : `/email-inbox/messages/${encodeURIComponent(idEmail)}/attachment`;
  return requisitarArquivo(
    caminho,
    { method: 'GET' },
  );
}

export async function analisarCvEmailRecebidoGeral(idEmail) {
  const resultado = await requisitar(
    `/email-inbox/messages/${encodeURIComponent(idEmail)}/analyze-cv`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos', 'candidatos-processos', 'banco-talentos');
  return resultado;
}

export async function vincularEmailRecebidoProcesso(idEmail, payload) {
  const resultado = await requisitar(
    `/email-inbox/messages/${encodeURIComponent(idEmail)}/link-process`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );

  invalidarCacheApi('processos', 'candidatos-processos', 'pipeline-candidatos');
  return resultado;
}

export async function enviarEmailRecebidoBancoTalentos(idEmail) {
  const resultado = await requisitar(
    `/email-inbox/messages/${encodeURIComponent(idEmail)}/talent-bank`,
    { method: 'POST' },
  );

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'processos');
  return resultado;
}

export async function ignorarEmailRecebido(idEmail) {
  const resultado = await requisitar(
    `/email-inbox/messages/${encodeURIComponent(idEmail)}/ignore`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos', 'candidatos-processos', 'banco-talentos');
  return resultado;
}

export async function excluirEmailRecebido(idEmail) {
  const resultado = await requisitar(
    `/email-inbox/messages/${encodeURIComponent(idEmail)}`,
    { method: 'DELETE' },
  );

  invalidarCacheApi('processos', 'candidatos-processos', 'banco-talentos');
  return resultado;
}

export async function registrarWhatsappAprovacao(idRegistro, payload) {
  return requisitar(
    `/process-candidates/${encodeURIComponent(idRegistro)}/approval-whatsapp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );
}

export async function registrarWhatsappContatoManual(idRegistro, payload) {
  const resultado = await requisitar(
    `/process-candidates/${encodeURIComponent(idRegistro)}/whatsapp-contact`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );

  invalidarCacheApi('candidatos-processos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function enviarEmailAprovacao(idRegistro, payload) {
  return requisitar(
    `/process-candidates/${encodeURIComponent(idRegistro)}/approval-email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );
}

export async function gerarLinkPublicoCandidatura(idProcesso) {
  const resultado = await requisitar(
    `/processos/${encodeURIComponent(idProcesso)}/gerar-link-candidatura`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function desativarLinkPublicoCandidatura(idProcesso) {
  const resultado = await requisitar(
    `/processos/${encodeURIComponent(idProcesso)}/link-candidatura/desativar`,
    { method: 'PATCH' },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function baixarCvCandidato(idTeste) {
  return requisitarArquivo(
    `/candidate-profiles/${encodeURIComponent(idTeste)}/cv`,
    { method: 'GET' },
  );
}
