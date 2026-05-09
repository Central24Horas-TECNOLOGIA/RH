import { html } from '../../infraestrutura-react.js';
import { formatarPontuacaoDetalhada } from '../../utilitarios.js';
import { obterClasseSituacaoAtual } from '../../app/controlador-aplicacao.js';
import { EmptyState, MetricGrid } from './feedback.js';
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
            ×
          </button>
        </header>
        <div class="rh-modal-content">${children}</div>
      </div>
    </div>
  `;
}

export function ModalDetalhesProva({ detalhe, onClose, onDownload }) {
  if (!detalhe) return null;

  const { linha, payload, resumoEtapas, situacaoAtual } = detalhe;

  return html`
    <${ModalPadrao}
      aberto=${true}
      titulo=${`Detalhes da prova • ${linha.nome_candidato || 'Candidato'}`}
      subtitulo="Informacoes registradas no historico e no gabarito salvo."
      onClose=${onClose}
    >
      <div class="rh-details-body">
        <${MetricGrid}
          items=${[
            {
              label: 'Candidato',
              value: payload?.candidate?.name || linha.nome_candidato || '-',
            },
            {
              label: 'Vaga',
              value: payload?.candidate?.role || linha.vaga || '-',
            },
            {
              label: 'Nivel',
              value: payload?.candidate?.level || linha.nivel || '-',
            },
            {
              label: 'Nota final',
              value: formatarPontuacaoDetalhada(
                linha.pontuacao_final,
                payload?.weightedFinalScore,
              ),
            },
            {
              label: 'Data',
              value: linha.data_exibicao || '-',
            },
            {
              label: 'Situacao',
              value: html`
                <span
                  class=${`rh-status-pill ${obterClasseSituacaoAtual(situacaoAtual)}`}
                >
                  ${situacaoAtual}
                </span>
              `,
            },
          ]}
        />

        <${SectionCard}
          title="Notas por etapa"
          className="rh-section-card--flat"
        >
          ${
            resumoEtapas?.length
              ? html`
                  <div class="rh-stage-grid">
                    ${resumoEtapas.map(
                      (etapa, indice) => html`
                        <article key=${indice} class="rh-stage-card">
                          <div class="rh-stage-card-top">
                            <strong>${etapa.label || '-'}</strong>
                            <span>Peso ${etapa.weight ?? '-'}%</span>
                          </div>
                          <div class="rh-stage-card-score">
                            ${etapa.rawScore ?? 0}/${etapa.rawMax ?? 0}
                          </div>
                          <p>
                            Aproveitamento:
                            ${((etapa.percent || 0) * 100).toFixed(1)}%
                          </p>
                          <p>
                            Nota ponderada:
                            ${Number(etapa.weightedScore || 0).toFixed(1)}
                          </p>
                        </article>
                      `,
                    )}
                  </div>
                `
              : html`
                  <${EmptyState}
                    title="Sem detalhamento salvo"
                    text="Esta prova possui apenas o resumo consolidado no historico."
                  />
                `
          }
        </${SectionCard}>

        <${SectionCard}
          title="Registro completo"
          className="rh-section-card--flat"
        >
          ${
            payload?.textContent
              ? html`<pre class="rh-detail-log">${payload.textContent}</pre>`
              : html`
                  <${EmptyState}
                    title="Gabarito indisponivel"
                    text="Nao existe texto detalhado salvo para esta prova."
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
        </div>
        <button type="button" class="btn btn-primary" onClick=${onClose}>
          Fechar
        </button>
      </footer>
    </${ModalPadrao}>
  `;
}
