import { html } from '../../infraestrutura-react.js';
import { formatarPontuacaoDetalhada } from '../../utilitarios.js';
import { obterClasseSituacaoAtual } from '../../app/controlador-aplicacao.js';
import { EmptyState } from './feedback.js';
import { SectionCard } from './layout.js';

export function ModalPadrao({
  aberto,
  titulo,
  subtitulo,
  onClose,
  children,
  className = '',
}) {
  if (!aberto) return null;

  return html`
    <div
      class="rh-modal-overlay"
      onClick=${(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        class=${`rh-modal-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
      >
        <header class="rh-modal-header">
          <div>
            <h3 class="rh-modal-title">${titulo}</h3>
            ${subtitulo
      ? html`<p class="rh-modal-subtitle">${subtitulo}</p>`
      : null}
          </div>
          <button
            type="button"
            class="btn rh-modal-close-btn"
            aria-label="Fechar"
            onClick=${onClose}
          >
            X
          </button>
        </header>
        <div class="rh-modal-content">${children}</div>
      </div>
    </div>
  `;
}

export function ModalDetalhesProva({
  detalhe,
  onClose,
  onDownload,
  onCandidateDetails,
}) {
  if (!detalhe) return null;

  const { linha, payload, resumoEtapas, situacaoAtual } = detalhe;
  const candidato = payload?.candidate || {};
  const nomeCandidato = candidato.name || linha.nome_candidato || 'Candidato';
  const notaFinal = formatarPontuacaoDetalhada(
    linha.pontuacao_final,
    payload?.weightedFinalScore,
  );
  const dataProva = linha.data_exibicao || payload?.finishedAt || payload?.startedAt || '-';

  return html`
    <${ModalPadrao}
      aberto=${true}
      titulo=${`Prova | ${nomeCandidato}`}
      subtitulo="Detalhes da prova e gabarito registrado no sistema."
      className="recent-exam-detail-dialog"
      onClose=${onClose}
    >
      <div class="rh-details-body recent-exam-detail-body">
        <section class="recent-exam-kpi-grid">
          ${[
      ['Nota Final', notaFinal, '/10'],
      ['Vaga', candidato.role || linha.vaga || '-', candidato.level || linha.nivel || ''],
      ['Data da Prova', dataProva, payload?.startedAt ? `Início: ${payload.startedAt}` : ''],
      ['Status do Processo', situacaoAtual || '-', ''],
    ].map(
      ([label, value, helper]) => html`
              <article class="recent-exam-kpi" key=${label}>
                <span>${label}</span>
                <strong>${value}</strong>
                ${helper ? html`<small>${helper}</small>` : null}
              </article>
            `,
    )}
        </section>

        <${SectionCard}
          title="Desempenho por Etapa"
          className="rh-section-card--flat recent-exam-section"
        >
          ${resumoEtapas?.length
      ? html`
                  <div class="recent-exam-stage-grid">
                    ${resumoEtapas.map(
        (etapa, indice) => html`
                        <article key=${indice} class="recent-exam-stage-card">
                          <div class="recent-exam-stage-head">
                            <div>
                              <strong>${etapa.label || '-'}</strong>
                              <small>Peso ${etapa.weight ?? '-'}%</small>
                            </div>
                            <span>${etapa.rawScore ?? 0}/${etapa.rawMax ?? 0}</span>
                          </div>
                          <div class="recent-exam-progress" aria-hidden="true">
                            <span style=${{ width: `${Math.max(0, Math.min(100, (etapa.percent || 0) * 100))}%` }}></span>
                          </div>
                          <small>Nota ponderada: ${Number(etapa.weightedScore || 0).toFixed(1)}</small>
                        </article>
                      `,
      )}
                  </div>
                `
      : html`
                  <${EmptyState}
                    title="Sem detalhamento salvo"
                    text="Esta prova possui apenas o resumo consolidado no histórico."
                  />
                `
    }
        </${SectionCard}>

        <${SectionCard}
          title="Registro completo"
          className="rh-section-card--flat recent-exam-section"
        >
          ${payload?.textContent
      ? html`<pre class="rh-detail-log">${payload.textContent}</pre>`
      : html`
                  <${EmptyState}
                    title="Gabarito indisponível"
                    text="Não existe texto detalhado salvo para esta prova."
                  />
                `
    }
        </${SectionCard}>
      </div>

      <footer class="rh-modal-footer">
        <div class="rh-modal-footer-actions">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => window.print()}
          >
            Imprimir
          </button>
          <button
            type="button"
            class="btn btn-outline-primary"
            onClick=${onDownload}
          >
            Baixar prova
          </button>
          ${onCandidateDetails
      ? html`
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  onClick=${onCandidateDetails}
                >
                  Detalhes do candidato
                </button>
              `
      : null}
        </div>
        <button type="button" class="btn btn-primary" onClick=${onClose}>
          Fechar
        </button>
      </footer>
    </${ModalPadrao}>
  `;
}
