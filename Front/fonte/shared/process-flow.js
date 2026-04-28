const PROCESS_STATUS_CLOSED = 'Encerrado';

const CANDIDATE_STATUS_ANALYSIS = 'Analise';
const CANDIDATE_STATUS_QUALIFIED = 'Qualificado';
const CANDIDATE_STATUS_NOT_QUALIFIED = 'Nao qualificado';
const CANDIDATE_STATUS_SCHEDULED = 'Agendado';
const CANDIDATE_STATUS_CONFIRMED = 'Confirmado';
const CANDIDATE_STATUS_RESCHEDULED = 'Reagendado';
const CANDIDATE_STATUS_ATTENDED = 'Compareceu';
const CANDIDATE_STATUS_MISSED = 'Faltou';
const CANDIDATE_STATUS_APPROVED = 'Aprovado';
const CANDIDATE_STATUS_ELIMINATED = 'Eliminado';
const CANDIDATE_STATUS_TALENT_BANK = 'Banco de talentos';

const INTERVIEW_STATUSES = new Set([
  CANDIDATE_STATUS_SCHEDULED,
  CANDIDATE_STATUS_CONFIRMED,
  CANDIDATE_STATUS_RESCHEDULED,
  CANDIDATE_STATUS_ATTENDED,
  CANDIDATE_STATUS_MISSED,
]);

const TERMINAL_STATUSES = new Set([
  CANDIDATE_STATUS_NOT_QUALIFIED,
  CANDIDATE_STATUS_APPROVED,
  CANDIDATE_STATUS_ELIMINATED,
  CANDIDATE_STATUS_TALENT_BANK,
]);

function normalizeCompareText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeProcessStatus(status) {
  return normalizeCompareText(status) === 'encerrado'
    ? PROCESS_STATUS_CLOSED
    : String(status || '').trim();
}

export function isProcessClosed(statusOrProcess) {
  if (typeof statusOrProcess === 'object' && statusOrProcess !== null) {
    return normalizeProcessStatus(
      statusOrProcess.status || statusOrProcess.status_processo,
    ) === PROCESS_STATUS_CLOSED;
  }

  return normalizeProcessStatus(statusOrProcess) === PROCESS_STATUS_CLOSED;
}

export function canonicalizeCandidateStatus(status) {
  const value = normalizeCompareText(status);

  if (!value) return CANDIDATE_STATUS_ANALYSIS;
  if (value === 'analise' || value === 'em analise') return CANDIDATE_STATUS_ANALYSIS;
  if (value === 'qualificado') return CANDIDATE_STATUS_QUALIFIED;
  if (value === 'nao qualificado') return CANDIDATE_STATUS_NOT_QUALIFIED;
  if (value === 'agendado') return CANDIDATE_STATUS_SCHEDULED;
  if (value === 'entrevista agendada') return CANDIDATE_STATUS_SCHEDULED;
  if (value === 'confirmado') return CANDIDATE_STATUS_CONFIRMED;
  if (value === 'reagendado') return CANDIDATE_STATUS_RESCHEDULED;
  if (value === 'compareceu') return CANDIDATE_STATUS_ATTENDED;
  if (value === 'faltou') return CANDIDATE_STATUS_MISSED;
  if (value === 'aprovado') return CANDIDATE_STATUS_APPROVED;
  if (value === 'banco de talentos') return CANDIDATE_STATUS_TALENT_BANK;
  if (value === 'reprovado' || value.includes('eliminado')) {
    return CANDIDATE_STATUS_ELIMINATED;
  }

  return String(status || '').trim();
}

export function getCandidateVisibleStatus(candidateOrStatus, statusEntrevista = '') {
  if (
    candidateOrStatus &&
    typeof candidateOrStatus === 'object' &&
    !Array.isArray(candidateOrStatus)
  ) {
    if (candidateOrStatus.status_fluxo) {
      return canonicalizeCandidateStatus(candidateOrStatus.status_fluxo);
    }

    return getCandidateVisibleStatus(
      candidateOrStatus.status_candidato,
      candidateOrStatus.status_entrevista,
    );
  }

  const candidateStatus = canonicalizeCandidateStatus(candidateOrStatus);
  const interviewStatus = String(statusEntrevista || '').trim()
    ? canonicalizeCandidateStatus(statusEntrevista)
    : '';

  if (TERMINAL_STATUSES.has(candidateStatus)) {
    return candidateStatus;
  }

  if (INTERVIEW_STATUSES.has(interviewStatus)) {
    return interviewStatus;
  }

  return candidateStatus;
}

export function isTerminalCandidateStatus(status) {
  return TERMINAL_STATUSES.has(canonicalizeCandidateStatus(status));
}

export function getCandidateActionState(candidate, processStatus = '') {
  const visibleStatus = getCandidateVisibleStatus(candidate);
  const closed = isProcessClosed(processStatus || candidate?.status_processo);
  const schedule = !closed && visibleStatus === CANDIDATE_STATUS_QUALIFIED;
  const finalDecision =
    !closed &&
    (visibleStatus === CANDIDATE_STATUS_ANALYSIS ||
      visibleStatus === CANDIDATE_STATUS_ATTENDED);

  return {
    visibleStatus,
    processClosed: closed,
    isFinalized:
      closed ||
      isTerminalCandidateStatus(visibleStatus) ||
      visibleStatus === CANDIDATE_STATUS_MISSED,
    canScheduleInterview: schedule,
    canApprove: finalDecision,
    canEliminate: finalDecision,
    canSendToTalentBank: finalDecision,
  };
}

export function getCandidateFlowGroup(candidate) {
  const status = getCandidateVisibleStatus(candidate);

  if (status === CANDIDATE_STATUS_QUALIFIED) {
    return 'Qualificacao';
  }

  if (INTERVIEW_STATUSES.has(status)) {
    return 'Entrevista';
  }

  if (TERMINAL_STATUSES.has(status)) {
    return 'Finalizado';
  }

  return 'Analise';
}

export function getPipelineStageLabel(stage) {
  const value = String(stage || '').trim();

  if (value === 'Triagem') return 'Analise';
  if (value === 'Prova') return 'Qualificados';
  if (value === 'Entrevista') return 'Entrevistas';
  if (value === 'Aprovado') return 'Aprovados';
  if (value === 'Reprovado') return 'Finalizados';
  return value || 'Etapa';
}

export {
  CANDIDATE_STATUS_ANALYSIS,
  CANDIDATE_STATUS_APPROVED,
  CANDIDATE_STATUS_ATTENDED,
  CANDIDATE_STATUS_CONFIRMED,
  CANDIDATE_STATUS_ELIMINATED,
  CANDIDATE_STATUS_MISSED,
  CANDIDATE_STATUS_NOT_QUALIFIED,
  CANDIDATE_STATUS_QUALIFIED,
  CANDIDATE_STATUS_RESCHEDULED,
  CANDIDATE_STATUS_SCHEDULED,
  CANDIDATE_STATUS_TALENT_BANK,
  PROCESS_STATUS_CLOSED,
};
