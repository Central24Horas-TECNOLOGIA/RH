export function copiarTexto(texto) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(texto || '');
  }

  const area = document.createElement('textarea');
  area.value = texto || '';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
  return Promise.resolve();
}

export function toDatetimeLocal(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';

  const pad = (item) => String(item).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

export function montarUrlPublicaCandidatura(slug, hrefBase = window.location.href) {
  const safeSlug = String(slug || '').trim();
  if (!safeSlug) return '';

  const url = new URL(hrefBase, window.location.origin);
  url.hash = `/candidatar/${encodeURIComponent(safeSlug)}`;
  return url.toString();
}

export function obterBasePublicaCandidatura() {
  return (
    window.RUNTIME_CONFIG?.PUBLIC_CANDIDATE_BASE_URL ||
    window.__RH_PUBLIC_CANDIDATE_BASE_URL__ ||
    ''
  ).trim();
}

export function abrirBlobEmNovaGuia(blob) {
  const url = URL.createObjectURL(blob);
  const janela = window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return janela;
}
