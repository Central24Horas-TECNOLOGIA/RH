import { requisitar, requisitarArquivo } from './core.js';

function montarQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    query.set(chave, valor);
  });
  const texto = query.toString();
  return texto ? `?${texto}` : '';
}

export async function listarPerfis() {
  return requisitar('/settings/security/roles', { method: 'GET' });
}

export async function listarPermissoes() {
  return requisitar('/settings/security/permissions', { method: 'GET' });
}

export async function atualizarPermissoesPerfil(idPerfil, payload) {
  return requisitar(`/settings/security/roles/${encodeURIComponent(idPerfil)}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

export async function listarUsuarios(filtros = {}) {
  return requisitar(`/settings/users${montarQuery(filtros)}`, { method: 'GET' });
}

export async function criarUsuario(payload) {
  return requisitar('/settings/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

export async function atualizarUsuario(idUsuario, payload) {
  return requisitar(`/settings/users/${encodeURIComponent(idUsuario)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

export async function redefinirSenhaUsuario(idUsuario, payload) {
  return requisitar(`/settings/users/${encodeURIComponent(idUsuario)}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

export async function alterarStatusUsuario(idUsuario, payload) {
  return requisitar(`/settings/users/${encodeURIComponent(idUsuario)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

export async function excluirUsuario(idUsuario, justificativa = '') {
  return requisitar(
    `/settings/users/${encodeURIComponent(idUsuario)}${montarQuery({ justificativa })}`,
    { method: 'DELETE' },
  );
}

export async function listarLogsAuditoria(filtros = {}) {
  return requisitar(`/settings/audit-logs${montarQuery(filtros)}`, { method: 'GET' });
}

export async function baixarLogsAuditoria() {
  return requisitarArquivo('/settings/audit-logs/export', { method: 'GET' });
}

export async function listarCatalogoConfiguracoes() {
  return requisitar('/settings/catalog', { method: 'GET' });
}

export async function criarItemConfiguracao(tipo, payload) {
  return requisitar(`/settings/catalog/${encodeURIComponent(tipo)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

export async function atualizarItemConfiguracao(tipo, idItem, payload) {
  return requisitar(
    `/settings/catalog/${encodeURIComponent(tipo)}/${encodeURIComponent(idItem)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );
}

export async function desativarItemConfiguracao(tipo, idItem, justificativa = '') {
  return requisitar(
    `/settings/catalog/${encodeURIComponent(tipo)}/${encodeURIComponent(idItem)}${montarQuery({ justificativa })}`,
    { method: 'DELETE' },
  );
}

export async function registrarSolicitacaoLgpd(payload) {
  return requisitar('/settings/lgpd/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}
