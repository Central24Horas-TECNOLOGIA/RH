// Reúne funções pequenas e reutilizáveis usadas em páginas, contexto e serviços.

export function sanitizarNomeArquivo(nome) {
  return String(nome || '').replace(/[^\w\-\.À-ÿ]/g, '_');
}

export function removerHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').trim();
}

export function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function textoMaiusculoSeguro(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase();
}

export function contarFrases(texto) {
  return (texto.match(/[.!?](\s|$)/g) || []).length || (texto.trim() ? 1 : 0);
}

export function contarItensListaNoHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.querySelectorAll('li').length;
}

export function formatarDataParaInput(valorData) {
  const data = new Date(valorData);
  if (Number.isNaN(data.getTime())) return '';
  const pad = (valor) => String(valor).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

export function obterItensPaginados(itens, paginaAtual, tamanhoPagina) {
  const lista = Array.isArray(itens) ? itens : [];
  const totalPaginas = Math.max(1, Math.ceil(lista.length / tamanhoPagina));
  const paginaSegura = Math.min(Math.max(1, paginaAtual), totalPaginas);
  const inicio = (paginaSegura - 1) * tamanhoPagina;

  return {
    itens: lista.slice(inicio, inicio + tamanhoPagina),
    paginaAtual: paginaSegura,
    totalPaginas,
    totalItens: lista.length,
  };
}

export function construirModeloPaginacao(paginaAtual, totalPaginas) {
  const total = Math.max(1, totalPaginas || 1);
  const pagina = Math.min(Math.max(1, paginaAtual || 1), total);
  const itens = [];

  for (let indice = 1; indice <= total; indice += 1) {
    itens.push({
      pagina: indice,
      ativa: indice === pagina,
    });
  }

  return itens;
}

export function formatarNotaAnalise(valor) {
  let bruto = String(valor ?? '0').trim();
  if (!bruto) return '0,0';

  bruto = bruto.replace(/\s/g, '');

  if (bruto.includes(',') && bruto.includes('.')) {
    bruto = bruto.replace(/\./g, '').replace(',', '.');
  } else if (bruto.includes(',')) {
    bruto = bruto.replace(',', '.');
  } else {
    const partes = bruto.split('.');
    if (partes.length > 2) {
      bruto = `${partes[0]}.${partes.slice(1).join('')}`;
    }
  }

  let numero = Number(bruto);
  if (!Number.isFinite(numero)) {
    const fallback = bruto.match(/-?\d+/);
    numero = fallback ? Number(fallback[0]) : 0;
  }

  numero = Math.round(numero);

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatarPercentualAfinidade(valor) {
  let numero = Number(String(valor ?? 0).replace(',', '.'));

  if (!Number.isFinite(numero)) {
    numero = 0;
  }

  numero = Math.max(0, Math.min(numero, 100));

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatarNotaDetalhe(valorLinha, valorPayload) {
  const valorBruto =
    valorLinha !== undefined && valorLinha !== null && valorLinha !== ''
      ? valorLinha
      : valorPayload;

  if (valorBruto === undefined || valorBruto === null || valorBruto === '') {
    return '-';
  }

  const texto = String(valorBruto).trim();
  if (!texto) return '-';

  const numero = Number(texto.replace(',', '.'));
  if (Number.isFinite(numero)) {
    return numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  return texto;
}

export function formatarPontuacaoDetalhada(pontuacaoLinha, pontuacaoPayload) {
  return formatarNotaDetalhe(pontuacaoLinha, pontuacaoPayload);
}

export function baixarBlob(nomeArquivo, blob) {
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = nomeArquivo;
  document.body.appendChild(ancora);
  ancora.click();
  document.body.removeChild(ancora);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function formatarValorCsv(valor) {
  const texto = String(valor ?? '');
  if (/[",\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function gerarIdResultado() {
  const agora = new Date();
  const pad = (valor) => String(valor).padStart(2, '0');
  return `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
}


