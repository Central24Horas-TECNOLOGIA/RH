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
