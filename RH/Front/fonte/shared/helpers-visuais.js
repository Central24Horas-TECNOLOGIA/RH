import { ROTULOS_ETAPAS } from '../perguntas.js';
import { canonicalizeCandidateStatus } from './process-flow.js';

export function formatarTempoRestante(segundosTotais) {
  const total = Math.max(0, Number(segundosTotais || 0));
  const minutos = String(Math.floor(total / 60)).padStart(2, '0');
  const segundos = String(total % 60).padStart(2, '0');
  return `${minutos}:${segundos}`;
}

export function formatarNotaVisual(valor, casas = 1) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero)) {
    return (0).toLocaleString('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
  }

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function obterClasseEtapaResultado(percentual) {
  const percent = Number(percentual || 0);
  if (percent >= 0.7) return 'good';
  if (percent >= 0.4) return 'warn';
  return 'bad';
}

export function obterClasseStatusProcesso(status) {
  const valor = canonicalizeCandidateStatus(status);
  if (valor === 'Aprovado') return 'is-approved';
  if (valor === 'Qualificado') return 'is-highlight';
  if (valor === 'Agendado' || valor === 'Confirmado' || valor === 'Reagendado') return 'is-scheduled';
  if (valor.startsWith('Eliminado') || valor === 'Reprovado' || valor === 'Desistente') return 'is-eliminated';
  if (valor === 'Banco de Talentos') return 'is-talent';
  if (valor === 'Nao qualificado' || valor === 'NÃ£o qualificado' || valor === 'Não qualificado') return 'is-not-qualified';
  return 'is-analysis';
}

export function obterClasseStatusEntrevista(status) {
  const valor = canonicalizeCandidateStatus(status);
  if (valor === 'Aprovado') return 'is-approved';
  if (valor === 'Banco de Talentos') return 'is-talent';
  if (valor === 'Compareceu') return 'is-approved';
  if (valor === 'Faltou' || valor === 'Eliminado' || valor === 'Desistente') return 'is-eliminated';
  if (valor === 'Agendado' || valor === 'Confirmado' || valor === 'Reagendado') return 'is-scheduled';
  if (valor === 'Qualificado') return 'is-highlight';
  if (valor === 'Nao qualificado' || valor === 'NÃ£o qualificado' || valor === 'Não qualificado') return 'is-not-qualified';
  return 'is-analysis';
}

export function formatarDataHora(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor || '-');
  return data.toLocaleString('pt-BR');
}

export function montarDescricaoFluxo(blueprint) {
  if (!blueprint?.stages?.length) {
    return 'Selecione a vaga para visualizar a trilha.';
  }

  return blueprint.stages
    .map(
      (etapa) => `${ROTULOS_ETAPAS[etapa.key] || 'Etapa'} (${etapa.weight}%)`,
    )
    .join(' -> ');
}

export function obterClasseAderencia(recomendacao) {
  const texto = String(recomendacao || '')
    .trim()
    .toLowerCase();

  if (texto === 'forte aderencia' || texto === 'forte aderência') {
    return 'rh-aderencia-tag is-strong';
  }

  if (texto === 'boa aderencia' || texto === 'boa aderência') {
    return 'rh-aderencia-tag is-medium';
  }

  return 'rh-aderencia-tag is-low';
}

export function montarResumoAnaliticoCv(item) {
  const score = Number(item?.score_final || 0);
  const classificacao = String(item?.classificacao || '').trim() || '-';

  let payloadProblemas = {};
  try {
    payloadProblemas = JSON.parse(item?.problemas || '{}');
  } catch (error) {
    payloadProblemas = {};
  }

  const problemas = Array.isArray(payloadProblemas)
    ? payloadProblemas
    : Array.isArray(payloadProblemas.problemas)
      ? payloadProblemas.problemas
      : [];

  const pontosFortes = Array.isArray(payloadProblemas?.pontos_fortes)
    ? payloadProblemas.pontos_fortes
    : [];

  const educationStrength = payloadProblemas?.education_strength || '';
  const experienceStrength = payloadProblemas?.experience_strength || '';

  let palavras = [];
  try {
    const lidas = JSON.parse(item?.palavras_chave || '[]');
    palavras = Array.isArray(lidas) ? lidas : [];
  } catch (error) {
    palavras = [];
  }

  const partes = [
    `O candidato foi classificado como "${classificacao}" com score ${score}.`,
    palavras.length
      ? `O sistema encontrou aderencia por palavras-chave como ${palavras.join(', ')}.`
      : 'O sistema encontrou pouca aderencia por palavras-chave relevantes.',
  ];

  if (pontosFortes.length) {
    partes.push(`Pontos fortes identificados: ${pontosFortes.join(' ')}`);
  }

  if (problemas.length) {
    partes.push(`Pontos de atencao: ${problemas.join(' ')}`);
  } else {
    partes.push('Nao foram identificados problemas criticos na leitura automatica do curriculo.');
  }

  if (educationStrength) {
    partes.push(`Analise de formacao: ${educationStrength}.`);
  }

  if (experienceStrength) {
    partes.push(`Analise de experiencia profissional: ${experienceStrength}.`);
  }

  if (score >= 7) {
    partes.push('Por isso, o curriculo foi considerado com forte aderencia ao processo.');
  } else if (score >= 4.5) {
    partes.push('Por isso, o curriculo foi considerado razoavelmente aderente ao processo.');
  } else {
    partes.push('Por isso, o curriculo foi considerado pouco aderente ao processo.');
  }

  return partes.join('\n\n');
}
