import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  TAMANHO_ANALISE,
  TAMANHO_HISTORICO,
  TAMANHO_RECENTES,
  atualizarStatusCandidato,
  baixarCvCandidato,
  baixarPacoteHistorico,
  carregarDetalhesProva,
  construirMapaStatusAtual,
  criarProcesso,
  lerAnalisesCandidatos,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerHistorico,
  lerHistoricoPaginado,
  lerEntrevistas,
  lerProcessos,
  montarIdProcesso,
  obterClasseSituacaoAtual,
  obterRegrasFormularioProcesso,
  obterRotuloSituacaoAtual,
  atualizarPerfilCandidato,
  baixarAnexoEmailRecebido,
  baixarRelatorioCandidatos,
  baixarRelatorioProcessos,
  analisarCvEmailRecebidoGeral,
  enviarEmailRecebidoBancoTalentos,
  ignorarEmailRecebido,
  lerDetalheEmailRecebido,
  excluirEmailRecebido,
  lerEmailsRecebidos,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
  vincularEmailRecebidoProcesso,
  lerRelatorioCandidatos,
  lerRelatorioProcessos,
} from '../../app/controlador-aplicacao.js';
import {
  baixarBlob,
  formatarDataParaInput,
  formatarNotaAnalise,
  formatarPercentualAfinidade,
  formatarPontuacaoDetalhada,
  obterItensPaginados,
} from '../../utilitarios.js';
import { abrirBlobEmNovaGuia } from '../../shared/browser-utils.js';
import {
  formatarDataHora,
  obterClasseAderencia,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  getCandidateActionState,
  getCandidateVisibleStatus,
  isProcessClosed,
} from '../../shared/process-flow.js';
import { obterTourLogin } from '../../shared/tour-config.js';
import {
  obterChaveProcesso,
  obterReferenciaProcessoDoCandidato,
  obterReferenciaProcesso,
} from '../../shared/process-reference.js';
import {
  quebrarListaTexto,
  validarFormularioProcesso,
  validarPerfilCandidato,
} from '../../shared/validacoes.js';
import { BlocoFiltro, CampoFiltro } from './components/filtros.js';
import {
  EmptyState,
  GrupoPaginacao,
  LoadingState,
  MetricGrid,
  ModalDetalhesProva,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import { BotaoAjudaTour, TourGuiado } from '../../ui/tour-guiado.js';

const MENSAGEM_EMAIL_NAO_CONFIGURADO =
  'Caixa de e-mail corporativa ainda não configurada. Informe TENANT_ID, CLIENT_ID e CLIENT_SECRET no servidor.';

function normalizarTextoPainel(valor) {
  return String(valor || '').trim();
}

function mascararEmailContato(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '-';
  const [usuario, dominio] = texto.split('@');
  if (!usuario || !dominio) return '***';
  const prefixoUsuario = usuario.slice(0, Math.min(2, usuario.length));
  const partesDominio = dominio.split('.');
  const dominioBase = partesDominio.shift() || '';
  const sufixoDominio = partesDominio.length ? `.${partesDominio.join('.')}` : '';
  return `${prefixoUsuario}${'*'.repeat(Math.max(3, usuario.length - prefixoUsuario.length))}@${dominioBase.slice(0, 1)}***${sufixoDominio}`;
}

function mascararTelefoneContato(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (!digitos) return '-';
  if (digitos.length <= 4) return '****';
  const ultimos = digitos.slice(-4);
  const ddd = digitos.length >= 10 ? `(${digitos.slice(-11, -9)}) ` : '';
  return `${ddd}*****-${ultimos}`;
}

function obterIntervaloPaginacao(paginacao) {
  const total = Number(paginacao?.totalItens || 0);
  if (!total) return '0-0';

  const inicio = (Number(paginacao.paginaAtual || 1) - 1) * Number(paginacao.tamanhoPagina || paginacao.itens?.length || 1) + 1;
  const fim = Math.min(total, inicio + Number(paginacao.itens?.length || 0) - 1);
  return `${inicio}-${fim}`;
}

function PaginacaoCompacta({
  paginacao,
  onChange,
  label,
  onVerTodos = null,
}) {
  const totalPaginas = Math.max(1, Number(paginacao?.totalPaginas || 1));
  const paginaAtual = Math.min(
    Math.max(1, Number(paginacao?.paginaAtual || 1)),
    totalPaginas,
  );
  const paginas = Array.from({ length: totalPaginas }, (_, indice) => indice + 1);

  return html`
    <footer class="c24-pagination">
      <span>${label}</span>
      <div class="c24-pagination-actions">
        <button
          type="button"
          class="c24-page-btn"
          aria-label="Página anterior"
          disabled=${paginaAtual <= 1}
          onClick=${() => onChange(paginaAtual - 1)}
        >
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        ${paginas.map(
          (pagina) => html`
            <button
              key=${pagina}
              type="button"
              class=${`c24-page-btn ${pagina === paginaAtual ? 'is-active' : ''}`}
              onClick=${() => onChange(pagina)}
            >
              ${pagina}
            </button>
          `,
        )}
        <button
          type="button"
          class="c24-page-btn"
          aria-label="Próxima página"
          disabled=${paginaAtual >= totalPaginas}
          onClick=${() => onChange(paginaAtual + 1)}
        >
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
        ${onVerTodos
          ? html`
              <button type="button" class="c24-page-link" onClick=${onVerTodos}>
                Ver todos
              </button>
            `
          : null}
      </div>
    </footer>
  `;
}

function obterClasseStatusEmail(status) {
  const texto = normalizarTextoPainel(status).toLowerCase();
  if (texto.includes('banco')) return 'is-talent';
  if (texto.includes('vinculado') || texto.includes('analisado')) return 'is-highlight';
  if (texto.includes('erro') || texto.includes('ignorado')) return 'is-eliminated';
  if (texto.includes('sem anexo')) return 'is-pending';
  return 'is-analysis';
}

function obterClasseAlertaEmail(payload) {
  const status = normalizarTextoPainel(payload?.status).toLowerCase();
  if (status === 'error' || payload?.error) return 'alert-danger';
  if (payload && payload.configured === false) return 'alert-warning';
  return 'alert-info';
}

function SecaoCurriculosRecebidosEmail({ modo = 'resumo', controlador = null } = {}) {
  const compacto = modo !== 'completo';
  const [aberta, setAberta] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [payloadEmail, setPayloadEmail] = useState(null);
  const [emails, setEmails] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [selecoesProcesso, setSelecoesProcesso] = useState({});
  const [acaoEmAndamento, setAcaoEmAndamento] = useState('');
  const [detalheEmail, setDetalheEmail] = useState(null);
  const [mostrarIgnorados, setMostrarIgnorados] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(compacto ? 2 : 10);
  const [filtroTexto, setFiltroTexto] = useState('');

  const paginacaoEmails = useMemo(
    () => obterItensPaginados(emails, paginaAtual, tamanhoPagina),
    [emails, paginaAtual, tamanhoPagina],
  );

  const carregarEmails = async () => {
    setCarregando(true);
    try {
      const [resultadoEmails, resultadoProcessos] = await Promise.allSettled([
        lerEmailsRecebidos({
          limite: compacto ? 30 : 80,
          mostrarIgnorados,
          query: filtroTexto.trim(),
          apenasComAnexos: true,
          refresh: true,
        }),
        lerProcessos(true),
      ]);

      if (resultadoEmails.status === 'fulfilled') {
        const payload = resultadoEmails.value || {};
        setPayloadEmail(payload);
        setEmails(Array.isArray(payload.items) ? payload.items : []);
      } else {
        setPayloadEmail({
          configured: false,
          message:
            resultadoEmails.reason?.message || MENSAGEM_EMAIL_NAO_CONFIGURADO,
        });
        setEmails([]);
      }

      if (resultadoProcessos.status === 'fulfilled') {
        setProcessosAbertos(
          (Array.isArray(resultadoProcessos.value)
            ? resultadoProcessos.value
            : []
          ).filter((processo) => !isProcessClosed(processo)),
        );
      } else {
        setProcessosAbertos([]);
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    setPaginaAtual(1);
    carregarEmails();
  }, [mostrarIgnorados, tamanhoPagina]);

  const registrarErroAcao = (error, fallback) => {
    setPayloadEmail((atual) => ({
      ...(atual || {}),
      configured: atual?.configured !== false,
      status: 'error',
      message: error?.message || fallback,
    }));
  };

  const executarAcao = async (chave, acao) => {
    setAcaoEmAndamento(chave);
    try {
      await acao();
      await carregarEmails();
    } finally {
      setAcaoEmAndamento('');
    }
  };

  const analisarEmail = async (item) => {
    if (!item?.possui_anexo) {
      registrarErroAcao(null, 'Este e-mail não possui anexo de currículo.');
      return;
    }
    try {
      await executarAcao(`analisar:${item.id}`, () =>
        analisarCvEmailRecebidoGeral(item.id),
      );
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível analisar o CV recebido.');
    }
  };

  const vincularEmail = async (item) => {
    const idProcesso = selecoesProcesso[item.id] || '';
    if (!idProcesso) {
      registrarErroAcao(null, 'Selecione um processo aberto para vincular.');
      return;
    }
    try {
      await executarAcao(`vincular:${item.id}`, () =>
        vincularEmailRecebidoProcesso(item.id, { id_processo: idProcesso }),
      );
      setSelecoesProcesso((anteriores) => ({ ...anteriores, [item.id]: '' }));
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível vincular este candidato.');
    }
  };

  const enviarParaBanco = async (item) => {
    try {
      await executarAcao(`banco:${item.id}`, () =>
        enviarEmailRecebidoBancoTalentos(item.id),
      );
    } catch (error) {
      registrarErroAcao(
        error,
        'Não foi possível enviar este candidato para o Banco de Talentos.',
      );
    }
  };

  const abrirCvEmail = async (item) => {
    if (!item?.possui_anexo) {
      registrarErroAcao(null, 'Este e-mail não possui anexo de currículo.');
      return;
    }
    try {
      setAcaoEmAndamento(`cv:${item.id}`);
      const anexo = Array.isArray(item.anexos) ? item.anexos[0] : null;
      const resposta = await baixarAnexoEmailRecebido(item.id, anexo?.id || '');
      abrirBlobEmNovaGuia(resposta.blob);
      await carregarEmails();
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível abrir o CV recebido.');
    } finally {
      setAcaoEmAndamento('');
    }
  };

  const ignorarEmail = async (item) => {
    try {
      await executarAcao(`ignorar:${item.id}`, () =>
        ignorarEmailRecebido(item.id),
      );
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível ignorar este e-mail.');
    }
  };

  const excluirEmail = async (item) => {
    const confirmar = window.confirm(
      `Deseja excluir este e-mail?\n\nAssunto: ${item.assunto || 'Sem assunto'}\n\nEsta ação remove o e-mail da caixa configurada quando o IMAP permitir e também oculta o item no sistema.`,
    );

    if (!confirmar) return;

    try {
      await executarAcao(`excluir:${item.id}`, () =>
        excluirEmailRecebido(item.id),
      );
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível excluir este e-mail.');
    }
  };

  const abrirDetalhesEmail = async (item) => {
    try {
      const resposta = await lerDetalheEmailRecebido(item.id);
      setDetalheEmail(resposta?.item || item);
    } catch (error) {
      setDetalheEmail(item);
      registrarErroAcao(error, 'Não foi possível carregar os detalhes do e-mail.');
    }
  };

  const enviarFiltro = (event) => {
    event.preventDefault();
    setPaginaAtual(1);
    carregarEmails();
  };

  return html`
    <${SectionCard}
      className=${`mailbox-card ${compacto ? 'mailbox-card-compact' : 'mailbox-card-full'}`}
      title=${compacto ? 'Caixa de Currículos' : 'Caixa de E-mail'}
      description=${compacto
      ? 'Resumo dos currículos recebidos na caixa configurada.'
      : 'Consulta completa dos e-mails recebidos com currículos.'}
      actions=${html`
        <div class=${`mailbox-toolbar rh-email-panel-actions ${compacto ? 'mailbox-toolbar-compact' : 'mailbox-toolbar-full'}`}>
          ${!compacto
        ? html`
                <form class="mailbox-filter-form d-flex gap-2 flex-wrap" onSubmit=${enviarFiltro}>
                  <input
  class="form-control form-control-sm rh-email-filter-input email-filter-input"
  placeholder="Filtrar por assunto, remetente, nome ou vaga"
  value=${filtroTexto}
  onInput=${(event) => setFiltroTexto(event.target.value)}
/>
                  <button
                    type="submit"
                    class="btn btn-outline-primary btn-sm rh-action-btn email-toolbar-btn"
                    disabled=${carregando}
                  >
                    <span class="material-symbols-outlined">search</span>
                    Filtrar
                  </button>
                </form>
              `
        : controlador
          ? html`
                  <button
                    type="button"
                    class="btn btn-outline-primary btn-sm rh-action-btn email-toolbar-btn"
                    onClick=${() => controlador.irParaTelaProtegida('screen-email-inbox')}
                  >
                    <span class="material-symbols-outlined">mail</span>
                    Abrir caixa completa
                  </button>
                `
          : null}

          <label class="form-check rh-email-toggle-ignored">
            <input
              class="form-check-input"
              type="checkbox"
              checked=${mostrarIgnorados}
              onChange=${(event) => setMostrarIgnorados(event.target.checked)}
            />
            <span class="form-check-label">Mostrar ignorados/excluídos</span>
          </label>

          <select
  class="form-select form-select-sm rh-email-page-size email-page-size"
  value=${String(tamanhoPagina)}
  onChange=${(event) => setTamanhoPagina(Number(event.target.value) || 5)}
>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
          </select>

          <button
            type="button"
            class="btn btn-outline-secondary btn-sm rh-action-btn email-toolbar-btn"
            disabled=${carregando}
            onClick=${carregarEmails}
          >
            <span class="material-symbols-outlined">refresh</span>
            ${carregando ? 'Atualizando...' : 'Atualizar'}
          </button>

          ${compacto
        ? html`
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm rh-action-btn email-toolbar-btn"
                  onClick=${() => setAberta((valor) => !valor)}
                >
                  <span class="material-symbols-outlined">
                    ${aberta ? 'expand_less' : 'expand_more'}
                  </span>
                  ${aberta ? 'Recolher' : 'Expandir'}
                </button>
              `
        : null}
        </div>
      `}
      tourId="home-email-inbox"
    >
      ${aberta
      ? html`
            ${payloadEmail && !payloadEmail.configured
          ? html`
                  <div class="alert alert-warning">
                    ${payloadEmail?.message || MENSAGEM_EMAIL_NAO_CONFIGURADO}
                  </div>
                `
          : payloadEmail?.message
            ? html`<div class=${`alert ${obterClasseAlertaEmail(payloadEmail)}`}>
                    ${payloadEmail.message}
                  </div>`
            : null}

            <div class="table-responsive">
              <table class="table align-middle rh-modern-history-table rh-email-inbox-table email-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Remetente</th>
                    <th>Assunto</th>
                    ${compacto
          ? null
          : html`
                          <th>Nome detectado</th>
                          <th>Vaga detectada</th>
                          <th>Contato detectado</th>
                        `}
                    <th>Anexo/CV</th>
                    <th>Status</th>
                    <th class="text-end">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${paginacaoEmails.itens.length
          ? paginacaoEmails.itens.map(
            (item) => html`
                          <tr key=${item.id} class="email-row">
                            <td class="email-date-cell">${formatarDataHora(item.data_recebimento)}</td>
                            <td class="email-sender-cell">
                              <strong>${item.remetente || 'Remetente não informado'}</strong>
                            </td>
                            <td class="email-subject-cell">
                              <div>${item.assunto || 'Sem assunto'}</div>
                            </td>

                            ${compacto
                ? null
                : html`
                                  <td>${item.nome_detectado || '-'}</td>
                                  <td>${item.vaga_detectada || '-'}</td>
                                  <td>
                                    <div>${item.telefone_detectado || '-'}</div>
                                    <div class="small text-muted">${item.email_detectado || '-'}</div>
                                  </td>
                                `}

                            <td class="email-attachment-cell">${item.possui_anexo ? item.nome_anexo || 'Anexo recebido' : 'Sem anexo'}</td>
                            <td class="email-status-cell">
                              <span class=${`process-candidate-status-badge email-status-pill ${obterClasseStatusEmail(item.status)}`}>
                                ${item.status || 'Recebido'}
                              </span>
                            </td>
                            <td class="text-end email-actions-cell">
                              <div class="email-actions">
                                <div class="email-actions-group email-actions-group-main">
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-dark rh-action-btn email-action-btn"
                                    onClick=${() => abrirDetalhesEmail(item)}
                                  >
                                    <span class="material-symbols-outlined">visibility</span>
                                    Ver
                                  </button>

                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-dark rh-action-btn email-action-btn"
                                    disabled=${!item.possui_anexo ||
                                    acaoEmAndamento === `cv:${item.id}` ||
                                    !controlador?.possuiPermissao?.('candidatos.baixar_curriculo')}
                                    onClick=${() => abrirCvEmail(item)}
                                  >
                                    <span class="material-symbols-outlined">description</span>
                                    CV
                                  </button>

                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-primary rh-action-btn email-action-btn"
                                    disabled=${!item.possui_anexo ||
                                    acaoEmAndamento === `analisar:${item.id}` ||
                                    !controlador?.possuiPermissao?.('candidatos.avaliar_curriculo')}
                                    onClick=${() => analisarEmail(item)}
                                  >
                                    <span class="material-symbols-outlined">auto_awesome</span>
                                    Analisar
                                  </button>
                                </div>

                                ${!compacto
                ? html`
                                    <div class="email-actions-group email-actions-group-process">
                                      <select
                                        class="form-select form-select-sm rh-email-process-select email-process-select"
                                        value=${selecoesProcesso[item.id] || ''}
                                        onChange=${(event) =>
                    setSelecoesProcesso((anteriores) => ({
                      ...anteriores,
                      [item.id]: event.target.value,
                    }))}
                                      >
                                        <option value="">Processo aberto</option>
                                        ${processosAbertos.map(
                      (processo) => html`
                                            <option
                                              key=${obterChaveProcesso(processo)}
                                              value=${obterReferenciaProcesso(processo)}
                                            >
                                              ${processo.id_processo || processo.vaga || 'Processo'}
                                            </option>
                                          `,
                    )}
                                      </select>

                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-primary rh-action-btn email-action-btn"
                                        disabled=${!selecoesProcesso[item.id] ||
                    acaoEmAndamento === `vincular:${item.id}` ||
                    !controlador?.possuiPermissao?.('candidatos.criar')}
                                        onClick=${() => vincularEmail(item)}
                                      >
                                        <span class="material-symbols-outlined">link</span>
                                        Vincular
                                      </button>
                                    </div>
                                    `
                : null}

                                <div class="email-actions-group email-actions-group-secondary">
                                  ${!compacto &&
                controlador?.possuiPermissao?.('candidatos.mover_etapa')
                ? html`
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary rh-action-btn email-action-btn"
                                        disabled=${acaoEmAndamento === `banco:${item.id}`}
                                        onClick=${() => enviarParaBanco(item)}
                                      >
                                        <span class="material-symbols-outlined">group</span>
                                        Banco
                                      </button>
                                    `
                : null}

                                  ${controlador?.possuiPermissao?.('candidatos.mover_etapa')
                ? html`
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-danger rh-action-btn email-action-btn"
                                        disabled=${acaoEmAndamento === `ignorar:${item.id}`}
                                        onClick=${() => ignorarEmail(item)}
                                      >
                                        <span class="material-symbols-outlined">visibility_off</span>
                                        Ignorar
                                      </button>
                                    `
                : null}

                                  ${controlador?.possuiPermissao?.('candidatos.excluir')
                ? html`
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-danger rh-action-btn email-action-btn"
                                        disabled=${acaoEmAndamento === `excluir:${item.id}`}
                                        onClick=${() => excluirEmail(item)}
                                      >
                                        <span class="material-symbols-outlined">delete</span>
                                        Excluir
                                      </button>
                                    `
                : null}
                                </div>
                              </div>
                            </td>
                          </tr>
                        `,
          )
          : html`
                        <tr>
                          <td class="text-center text-muted py-4" colSpan=${compacto ? 6 : 9}>
                            ${carregando
              ? 'Carregando currículos recebidos.'
              : 'Nenhum currículo recebido por e-mail para listar.'}
                          </td>
                        </tr>
                      `}
                </tbody>
              </table>
            </div>

            ${compacto
              ? html`
                  <${PaginacaoCompacta}
                    paginacao=${{ ...paginacaoEmails, tamanhoPagina }}
                    onChange=${setPaginaAtual}
                    label=${`Mostrando ${obterIntervaloPaginacao({
                      ...paginacaoEmails,
                      tamanhoPagina,
                    })} de ${paginacaoEmails.totalItens} e-mail(s)`}
                  />
                `
              : html`
                  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
                    <small class="text-muted">
                      Exibindo ${paginacaoEmails.itens.length} de ${paginacaoEmails.totalItens} e-mail(s).
                    </small>
                    <${GrupoPaginacao}
                      paginaAtual=${paginacaoEmails.paginaAtual}
                      totalPaginas=${paginacaoEmails.totalPaginas}
                      onChange=${setPaginaAtual}
                    />
                  </div>
                `}
          `
      : null}

      <${ModalPadrao}
        aberto=${!!detalheEmail}
        titulo=${`E-mail recebido | ${detalheEmail?.assunto || 'Sem assunto'}`}
        subtitulo=${detalheEmail?.remetente || 'Remetente não informado'}
        onClose=${() => setDetalheEmail(null)}
      >
        <div class="rh-details-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Data de recebimento</label>
              <div>${formatarDataHora(detalheEmail?.data_recebimento)}</div>
            </div>
            <div class="col-md-6">
              <label class="form-label">Anexo/CV</label>
              <div>${detalheEmail?.nome_anexo || 'Sem anexo'}</div>
            </div>
            <div class="col-md-4">
              <label class="form-label">Nome detectado</label>
              <div>${detalheEmail?.nome_detectado || '-'}</div>
            </div>
            <div class="col-md-4">
              <label class="form-label">Telefone detectado</label>
              <div>${detalheEmail?.telefone_detectado || '-'}</div>
            </div>
            <div class="col-md-4">
              <label class="form-label">E-mail detectado</label>
              <div>${detalheEmail?.email_detectado || '-'}</div>
            </div>
            <div class="col-12">
              <label class="form-label">Corpo do e-mail</label>
              <pre class="rh-email-body-preview">${detalheEmail?.corpo || detalheEmail?.resumo_corpo || ''}</pre>
            </div>
          </div>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setDetalheEmail(null)}
          >
            Fechar
          </button>
        </footer>
      </${ModalPadrao}>
    </${SectionCard}>
  `;
}

export function TelaLogin({ controlador }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [tourReopenSignal, setTourReopenSignal] = useState(0);
  const tourLogin = obterTourLogin();

  const enviar = async () => {
    const resultado = await controlador.fazerLogin(
      usuario.trim(),
      senha.trim(),
    );

    if (!resultado.ok) {
      setMensagemErro(resultado.mensagem);
    }
  };

  return html`
    <section class="active screen" id="screen-login">
      <div class="rh-login-page">
        <div class="rh-login-hero" data-tour-id="login-hero">
          <div class="rh-login-hero-badge">Sistema Interno RH</div>
          <h1 class="rh-login-hero-title">Plataforma de provas, processos e análise.</h1>
          <p class="rh-login-hero-text">
            Um fluxo único para aplicação de provas, acompanhamento de candidatos,
            banco de talentos e análise operacional.
          </p>
          <div class="rh-login-hero-points">
            <span>Histórico consolidado</span>
            <span>Processos seletivos</span>
            <span>Análise de candidatos</span>
          </div>
        </div>

        <div
          class="rh-login-panel rh-login-panel-modern"
          data-tour-id="login-panel"
        >
          <div class="rh-login-brand-block rh-login-brand-block-centered">
            <img
              alt="Central 24h"
              class="rh-login-brand-image"
              src="estilos/logo_conecta_padrao.png"
            />
          </div>

          <div class="rh-login-copy-block">
            <h2 class="rh-login-welcome-title">Acesso ao ambiente RH</h2>
            <p class="rh-login-welcome-text">
              Entre com as credenciais para continuar.
            </p>
          </div>

          <div class="mb-3">
            <label class="form-label rh-login-label">Login</label>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon">
                alternate_email
              </span>
              <input
                class="form-control rh-login-input rh-login-input-modern"
                placeholder="nome@empresa.com.br"
                value=${usuario}
                onInput=${(event) => setUsuario(event.target.value)}
                type="text"
              />
            </div>
          </div>

          <div class="mb-2">
            <div class="rh-login-label-row">
              <label class="form-label rh-login-label mb-0">Senha</label>
              <button class="rh-login-link-btn" tabindex="-1" type="button">
                Ambiente restrito
              </button>
            </div>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon">
                lock
              </span>
              <input
                class="form-control rh-login-input rh-login-input-modern"
                placeholder="••••••••"
                value=${senha}
                onInput=${(event) => setSenha(event.target.value)}
                type="password"
              />
            </div>
          </div>

          ${mensagemErro
      ? html`<div class="alert alert-danger mb-3">${mensagemErro}</div>`
      : null}

          <button
            class="btn rh-login-btn rh-login-btn-modern w-100"
            data-tour-id="login-submit"
            onClick=${enviar}
          >
            <span>Acessar sistema</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>

          <div class="rh-login-help-row">
            <${BotaoAjudaTour}
              compact=${true}
              label="Ver orientações"
              onClick=${() => setTourReopenSignal((valor) => valor + 1)}
            />
          </div>

          <div class="rh-login-footer-meta">
            <span>© 2026 Central 24h</span>
            <span>Privacidade</span>
            <span>Termos</span>
            <span>Suporte</span>
          </div>
        </div>
      </div>

      <${TourGuiado}
        screenId="screen-login"
        userId=""
        steps=${tourLogin.steps}
        reopenSignal=${tourReopenSignal}
      />
    </section>
  `;
}

export function TelaInicio({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [recentes, setRecentes] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [candidatosProcessos, setCandidatosProcessos] = useState([]);
  const [entrevistas, setEntrevistas] = useState([]);
  const [paginaRecentes, setPaginaRecentes] = useState(1);
  const [detalheAberto, setDetalheAberto] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [
        resultadoHistorico,
        resultadoProcessos,
        resultadoCandidatos,
        resultadoEntrevistas,
      ] =
        await Promise.allSettled([
          lerHistorico(),
          lerProcessos(true),
          lerCandidatosProcessos(true),
          lerEntrevistas(),
        ]);
      const historico =
        resultadoHistorico.status === 'fulfilled'
          ? resultadoHistorico.value
          : [];
      const ordenado = (Array.isArray(historico) ? historico : [])
        .sort((a, b) =>
          String(b.data_iso || '').localeCompare(String(a.data_iso || '')),
        )
        .slice(0, TAMANHO_RECENTES);
      setRecentes(ordenado);
      setProcessos(
        resultadoProcessos.status === 'fulfilled' &&
          Array.isArray(resultadoProcessos.value)
          ? resultadoProcessos.value
          : [],
      );
      setCandidatosProcessos(
        resultadoCandidatos.status === 'fulfilled' &&
          Array.isArray(resultadoCandidatos.value)
          ? resultadoCandidatos.value
          : [],
      );
      setEntrevistas(
        resultadoEntrevistas.status === 'fulfilled' &&
          Array.isArray(resultadoEntrevistas.value)
          ? resultadoEntrevistas.value
          : [],
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const processosAtivos = useMemo(
    () => (Array.isArray(processos) ? processos : []).filter(
      (processo) => !isProcessClosed(processo.status),
    ),
    [processos],
  );

  const processosAndamento = useMemo(
    () =>
      processosAtivos
        .slice(0, 4)
        .map((processo) => {
          const referencia = obterReferenciaProcesso(processo);
          const idProcesso = String(processo.id_processo || '').trim();
          const candidatosVinculados = (Array.isArray(candidatosProcessos)
            ? candidatosProcessos
            : []
          ).filter((candidato) => {
            const referenciaCandidato = obterReferenciaProcessoDoCandidato(candidato);
            const idCandidato = String(candidato.id_processo || '').trim();
            return (
              (referencia && referenciaCandidato === referencia) ||
              (idProcesso && idCandidato === idProcesso)
            );
          });
          const candidatosAtivos = candidatosVinculados.filter(
            (candidato) => getCandidateVisibleStatus(candidato) !== 'Banco de Talentos',
          );
          const aprovados = Number(processo.vagas_preenchidas || 0) || candidatosVinculados.filter(
            (candidato) => getCandidateVisibleStatus(candidato) === 'Aprovado',
          ).length;
          const totalVagas = Number(processo.quantidade_vagas || 0);
          const percentual = totalVagas > 0
            ? Math.min(100, Math.round((aprovados / totalVagas) * 100))
            : Math.min(100, candidatosAtivos.length * 10);

          return {
            id: referencia || idProcesso || processo.vaga,
            nome: processo.nome_processo || processo.id_processo || processo.vaga || 'Processo',
            candidatos: candidatosAtivos.length,
            percentual,
          };
        }),
    [processosAtivos, candidatosProcessos],
  );

  const recentesPaginados = useMemo(
    () => obterItensPaginados(recentes, paginaRecentes, 3),
    [recentes, paginaRecentes],
  );

  const hojeIso = formatarDataParaInput(new Date());
  const entrevistasHoje = useMemo(
    () =>
      (Array.isArray(entrevistas) ? entrevistas : []).filter(
        (item) => formatarDataParaInput(item.data_entrevista) === hojeIso,
      ),
    [entrevistas, hojeIso],
  );
  const candidatosEmAnalise = useMemo(
    () =>
      (Array.isArray(candidatosProcessos) ? candidatosProcessos : []).filter(
        (candidato) =>
          normalizarTextoPainel(getCandidateVisibleStatus(candidato))
            .toLowerCase()
            .includes('analise'),
      ),
    [candidatosProcessos],
  );
  const alertasOperacionais = useMemo(
    () =>
      (Array.isArray(entrevistas) ? entrevistas : []).filter((item) => {
        const status = normalizarTextoPainel(item.status_entrevista).toLowerCase();
        return status.includes('falt') || status.includes('cancel');
      }),
    [entrevistas],
  );
  const candidatosAtivosResumo = useMemo(
    () =>
      (Array.isArray(candidatosProcessos) ? candidatosProcessos : []).filter((candidato) => {
        const status = normalizarTextoPainel(getCandidateVisibleStatus(candidato)).toLowerCase();
        return (
          !status.includes('banco') &&
          !status.includes('elimin') &&
          !status.includes('reprov') &&
          !status.includes('desist')
        );
      }),
    [candidatosProcessos],
  );
  const contratacoesResumo = useMemo(
    () =>
      (Array.isArray(candidatosProcessos) ? candidatosProcessos : []).filter(
        (candidato) => getCandidateVisibleStatus(candidato) === 'Aprovado',
      ),
    [candidatosProcessos],
  );
  const pendenciasResumo =
    candidatosEmAnalise.length + alertasOperacionais.length;
  const indicadoresPainel = useMemo(
    () => [
      {
        icon: 'groups',
        label: 'Candidatos ativos',
        value: candidatosAtivosResumo.length,
        helper: 'Em acompanhamento',
        variant: 'is-home is-blue',
      },
      {
        icon: 'folder_open',
        label: 'Processos abertos',
        value: processosAtivos.length,
        helper: 'Abertos agora',
        variant: 'is-home is-green',
      },
      {
        icon: 'calendar_month',
        label: 'Entrevistas hoje',
        value: entrevistasHoje.length,
        helper: 'Agenda do dia',
        variant: 'is-home is-yellow',
      },
      {
        icon: 'warning',
        label: 'Pendências',
        value: pendenciasResumo,
        helper: pendenciasResumo ? 'Requer atenção' : 'Sem alertas',
        variant: 'is-home is-red',
      },
      {
        icon: 'star',
        label: 'Contratações',
        value: contratacoesResumo.length,
        helper: 'Aprovados',
        variant: 'is-home is-purple',
      },
    ],
    [
      candidatosAtivosResumo.length,
      contratacoesResumo.length,
      entrevistasHoje.length,
      pendenciasResumo,
      processosAtivos.length,
    ],
  );
  const notificacoesDia = useMemo(() => {
    const processoRecente = processosAtivos[0];
    const candidatoAprovado = (Array.isArray(candidatosProcessos)
      ? candidatosProcessos
      : []
    ).find((candidato) => getCandidateVisibleStatus(candidato) === 'Aprovado');

    return [
      {
        icon: 'check_circle',
        variant: 'is-success',
        text: candidatoAprovado
          ? `Candidato aprovado para ${candidatoAprovado.vaga || 'vaga aberta'}`
          : 'Candidato aprovado para Jovem Aprendiz',
        time: 'ha 5 min',
      },
      {
        icon: 'folder_open',
        variant: 'is-info',
        text: processoRecente
          ? `Novo processo seletivo aberto para ${processoRecente.vaga || processoRecente.id_processo || 'vaga'}`
          : 'Novo processo seletivo aberto para Operador',
        time: 'ha 20 min',
      },
      {
        icon: 'cancel',
        variant: 'is-danger',
        text: alertasOperacionais.length
          ? 'Candidato cancelou presenca na entrevista'
          : 'Candidato cancelou presenca na entrevista',
        time: 'ha 35 min',
      },
      {
        icon: 'groups',
        variant: 'is-purple',
        text: `${entrevistasHoje.length || 3} candidatos agendados para hoje`,
        time: 'ha 1 h',
      },
    ];
  }, [alertasOperacionais.length, candidatosProcessos, entrevistasHoje.length, processosAtivos]);

  return html`
    <${PainelRh}
      screenId="screen-menu"
      navAtiva="screen-menu"
      subtituloMarca="Plataforma de Recrutamento e Seleção"
      placeholderBusca="Buscar candidatos, processos, vagas ou provas..."
      controlador=${controlador}
      acaoPrimaria=${{
      label: 'Iniciar teste',
      icon: 'add',
      permissao: 'provas.enviar',
      onClick: () => controlador.iniciarNovoFluxo(),
    }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        title="Olá, RH!"
        description="Aqui está o panorama geral do seu recrutamento hoje."
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary rh-action-btn c24-top-refresh-btn"
            onClick=${carregar}
          >
            <span class="material-symbols-outlined">refresh</span>
            Atualizar
          </button>
        `}
      />

      <${MetricGrid} items=${indicadoresPainel} />

      <${SectionCard}
        title="Acessos rápidos"
        description="Inicie ações e consulte informações com agilidade."
        className="home-quick-card"
        tourId="home-shortcuts"
      >
        <div class="home-quick-grid">
          ${[
            {
              label: 'Nova vaga',
              icon: 'work',
              permissao: 'vagas.criar',
              onClick: () => controlador.irParaTelaProtegida('screen-process-create'),
            },
            {
              label: 'Adicionar candidato',
              icon: 'person_add',
              permissao: 'candidatos.criar',
              onClick: () => controlador.irParaTelaProtegida('screen-candidates'),
            },
            {
              label: 'Agendar entrevista',
              icon: 'calendar_month',
              permissao: 'entrevistas.visualizar',
              onClick: () => controlador.irParaTelaProtegida('screen-interviews'),
            },
            {
              label: 'Enviar e-mail',
              icon: 'send',
              permissao: 'candidatos.criar',
              onClick: () => controlador.irParaTelaProtegida('screen-email-inbox'),
            },
            {
              label: 'Relatórios',
              icon: 'bar_chart',
              permissao: 'relatorios.visualizar',
              onClick: () => controlador.irParaTelaProtegida('screen-analysis-candidates'),
            },
            {
              label: 'Mais opções',
              icon: 'more_horiz',
              permissao: 'configuracoes.visualizar',
              onClick: () => controlador.irParaTelaProtegida('screen-settings'),
            },
          ]
            .filter((item) => !item.permissao || controlador.possuiPermissao(item.permissao))
            .map(
              (item) => html`
                <button
                  key=${item.label}
                  type="button"
                  class="home-quick-action"
                  onClick=${item.onClick}
                >
                  <span class="material-symbols-outlined">${item.icon}</span>
                  <strong>${item.label}</strong>
                </button>
              `,
            )}
        </div>
      </${SectionCard}>

      <div class="home-dashboard-grid home-dashboard-grid--day">
        <${SectionCard}
          title="Resumo do dia"
          description="Acompanhe o que mais importa hoje."
          className="day-summary-card compact-dashboard-card"
        >
          <div class="day-summary-layout">
            <div class="day-notifications-panel">
              <div class="day-summary-subtitle">
                <span>Notificações</span>
                <button type="button" class="btn btn-link btn-sm p-0">
                  Ver todas
                </button>
              </div>
              <div class="day-notification-list">
                ${notificacoesDia.map(
                  (item) => html`
                    <article class="c24-notification-item" key=${item.text}>
                      <span class=${`c24-notification-icon ${item.variant}`}>
                        <span class="material-symbols-outlined">${item.icon}</span>
                      </span>
                      <p>${item.text}</p>
                      <small>${item.time}</small>
                    </article>
                  `,
                )}
              </div>
            </div>
            <div class="day-summary-stats">
              ${[
                {
                  icon: 'calendar_month',
                  label: 'Entrevistas hoje',
                  value: entrevistasHoje.length,
                  helper: '+2 vs ontem',
                  variant: 'is-blue',
                },
                {
                  icon: 'folder_open',
                  label: 'Processos ativos',
                  value: processosAtivos.length,
                  helper: '+1 vs ontem',
                  variant: 'is-green',
                },
                {
                  icon: 'person',
                  label: 'Aprovações pendentes',
                  value: candidatosEmAnalise.length,
                  helper: '+1 vs ontem',
                  variant: 'is-yellow',
                },
                {
                  icon: 'warning',
                  label: 'Alertas',
                  value: alertasOperacionais.length,
                  helper: 'Requer atenção',
                  variant: 'is-red',
                },
              ].map(
                (item) => html`
                  <article class=${`day-stat-card ${item.variant}`} key=${item.label}>
                    <span class="material-symbols-outlined">${item.icon}</span>
                    <div>
                      <strong>${item.value}</strong>
                      <span>${item.label}</span>
                      <small>${item.helper}</small>
                    </div>
                  </article>
                `,
              )}
            </div>
          </div>
        </${SectionCard}>

        <${SectionCard}
          title="Registros recentes"
          description="Clique em um registro para abrir o detalhamento salvo."
          className="recent-records-card compact-dashboard-card"
          tourId="home-recent"
          actions=${html`
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              onClick=${() => controlador.irParaTelaProtegida('screen-history')}
            >
              Ver todos
            </button>
          `}
        >
          ${carregando
        ? html`<div class="alert alert-secondary">Carregando provas recentes...</div>`
        : recentes.length
          ? html`
                  <div class="rh-recent-grid">
                    ${recentesPaginados.itens.map(
            (item) => html`
                        <button
                          key=${item.id_teste}
                          type="button"
                          class="rh-recent-card"
                          onClick=${async () =>
                setDetalheAberto(
                  await carregarDetalhesProva(item.id_teste),
                )}
                        >
                          <div class="rh-recent-avatar-wrap">
                            <span class="rh-recent-avatar">
                              ${String(item.nome_candidato || 'T')
                .trim()
                .slice(0, 1)
                .toUpperCase()}
                            </span>
                          </div>
                          <div class="rh-recent-card-body">
                            <strong>${item.nome_candidato || '-'}</strong>
                            <span>${item.vaga || '-'}</span>
                            <span>${item.data_exibicao || '-'}</span>
                          </div>
                          <span class="material-symbols-outlined">arrow_forward</span>
                        </button>
                      `,
          )}
                  </div>
                  <${PaginacaoCompacta}
                    paginacao=${{ ...recentesPaginados, tamanhoPagina: 3 }}
                    onChange=${setPaginaRecentes}
                    label=${`Mostrando ${obterIntervaloPaginacao({
                      ...recentesPaginados,
                      tamanhoPagina: 3,
                    })} de ${recentesPaginados.totalItens}`}
                    onVerTodos=${() => controlador.irParaTelaProtegida('screen-history')}
                  />
                `
          : html`
                  <${EmptyState}
                    title="Nenhum registro salvo"
                    text="Assim que uma prova for concluída e salva, ela aparecerá aqui."
                  />
                `}
        </${SectionCard}>
      </div>

      <div class="home-dashboard-grid home-dashboard-grid--secondary">
        <${SecaoCurriculosRecebidosEmail} modo="resumo" controlador=${controlador} />

        <div class="home-side-stack">
          <${SectionCard}
            title="Processos em andamento"
            className="process-progress-card compact-dashboard-card"
          >
            ${processosAndamento.length
              ? html`
                  <div class="process-progress-list active-process-list">
                    ${processosAndamento.map(
                      (item) => html`
                        <article class="process-progress-item active-process-card" key=${item.id}>
                          <div class="active-process-info">
                            <strong>${item.nome}</strong>
                            <div class="active-process-meta">
                              <span>${item.candidatos} candidatos</span>
                              <span>${item.percentual}% preenchido</span>
                            </div>
                            <div class="active-process-progress" aria-hidden="true">
                              <span style=${{ width: `${item.percentual}%` }}></span>
                            </div>
                          </div>
                          <div class="active-process-actions">
                            <button
                              type="button"
                              class="btn-soft-primary"
                              onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
                            >
                              Ver processos
                            </button>
                          </div>
                        </article>
                      `,
                    )}
                  </div>
                `
              : html`
                  <${EmptyState}
                    title="Nenhum processo em andamento"
                    text="Os processos abertos aparecerão aqui assim que forem cadastrados."
                  />
                `}
          </${SectionCard}>

          <${SectionCard}
            title="Resumo rápido"
            description="Visão imediata do volume mais recente salvo no sistema."
            className="quick-summary-card compact-dashboard-card"
          >
            <div class="quick-summary-grid">
              <article class="quick-summary-item">
                <span class="material-symbols-outlined quick-summary-icon">
                  history
                </span>
                <div>
                  <span class="quick-summary-label">Registros recentes</span>
                  <strong class="quick-summary-value">${recentes.length}</strong>
                  <span class="quick-summary-helper">
                    Últimos itens visíveis no painel
                  </span>
                </div>
              </article>
              <article class="quick-summary-item">
                <span class="material-symbols-outlined quick-summary-icon">
                  sync
                </span>
                <div>
                  <span class="quick-summary-label">Status de carregamento</span>
                  <strong class="quick-summary-value">
                    ${carregando ? 'Atualizando' : 'Pronto'}
                  </strong>
                  <span class="quick-summary-helper">
                    Consulta do histórico consolidado
                  </span>
                </div>
              </article>
            </div>
          </${SectionCard}>
        </div>
      </div>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
      baixarPacoteHistorico(
        detalheAberto?.linha?.id_teste,
        detalheAberto?.linha?.nome_candidato || 'candidato',
      )}
      />
    </${PainelRh}>
  `;
}

export function TelaCaixaEmail({ controlador }) {
  return html`
    <${PainelRh}
      screenId="screen-email-inbox"
      navAtiva="screen-email-inbox"
      subtituloMarca="Central 24h"
      placeholderBusca="Caixa de e-mail"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Currículos recebidos"
        title="Caixa de E-mail"
        description="Tela dedicada para consultar, filtrar, analisar, vincular, enviar ao Banco de Talentos, ignorar ou excluir e-mails recebidos."
      />

      <${SecaoCurriculosRecebidosEmail}
        modo="completo"
        controlador=${controlador}
      />
    </${PainelRh}>
  `;
}

export function TelaHistorico({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [paginacao, setPaginacao] = useState({
    paginaAtual: 1,
    totalPaginas: 1,
    totalItens: 0,
  });
  const [filtros, setFiltros] = useState({ nome: '', vaga: '', data: '' });
  const [detalheAberto, setDetalheAberto] = useState(null);
  const [mapaStatus, setMapaStatus] = useState({});

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const [historico, statusAtual] = await Promise.all([
          lerHistoricoPaginado({
            pagina,
            tamanho: TAMANHO_HISTORICO,
            nome: filtros.nome,
            vaga: filtros.vaga,
            data: filtros.data,
          }),
          construirMapaStatusAtual(),
        ]);
        setLinhas(Array.isArray(historico?.items) ? historico.items : []);
        setPaginacao({
          paginaAtual: historico?.page || pagina,
          totalPaginas: historico?.total_pages || 1,
          totalItens: historico?.total_items || 0,
        });
        setMapaStatus(statusAtual);
      } finally {
        setCarregando(false);
      }
    })();
  }, [filtros, pagina]);

  return html`
    <${PainelRh}
      screenId="screen-history"
      navAtiva="screen-history"
      subtituloMarca="Histórico de provas"
      placeholderBusca="Consulta do histórico de avaliações"
      controlador=${controlador}
      acaoPrimaria=${{
      label: 'Iniciar teste',
      permissao: 'provas.enviar',
      onClick: () => controlador.iniciarNovoFluxo(),
    }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Histórico"
        title="Histórico de exames"
        description="Consulte resultados salvos com filtros por candidato, vaga e data."
      />

      <${BlocoFiltro} tourId="history-filters">
        <div class="rh-filter-grid">
          <${CampoFiltro} label="Candidato" icon="person_search">
            <input
              class="form-control"
              placeholder="Pesquisar por nome..."
              value=${filtros.nome}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, nome: event.target.value });
    }}
            />
          </${CampoFiltro}>

          <${CampoFiltro} label="Vaga" icon="work">
            <input
              class="form-control"
              placeholder="Pesquisar por vaga..."
              value=${filtros.vaga}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, vaga: event.target.value });
    }}
            />
          </${CampoFiltro}>

          <${CampoFiltro} label="Data" icon="calendar_month">
            <input
              class="form-control"
              type="date"
              value=${filtros.data}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, data: event.target.value });
    }}
            />
          </${CampoFiltro}>
        </div>
      </${BlocoFiltro}>

      <${SectionCard}
        title="Resultados salvos"
        description="Tabela consolidada com status atualizado e ações de consulta."
        tourId="history-results"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nível</th>
                <th>Data</th>
                <th>Nota</th>
                <th>Status</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${carregando
      ? html`<${TabelaVazia} colunas=${7} texto="Carregando histórico..." />`
      : linhas.length
        ? linhas.map(
          (linha) => html`
                        <tr key=${linha.id_teste}>
                          <td>${linha.nome_candidato || '-'}</td>
                          <td>${linha.vaga || '-'}</td>
                          <td>${linha.nivel || '-'}</td>
                          <td>${linha.data_exibicao || '-'}</td>
                          <td>
                            ${formatarPontuacaoDetalhada(
            linha.pontuacao_final,
            '',
          )}
                          </td>
                          <td>
                            <span
                              class=${`rh-status-pill ${obterClasseSituacaoAtual(obterRotuloSituacaoAtual(linha, mapaStatus))}`}
                            >
                              ${obterRotuloSituacaoAtual(linha, mapaStatus)}
                            </span>
                          </td>
                          <td class="text-end">
                            <div class="d-flex justify-content-end gap-2 flex-wrap">
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-primary"
                                onClick=${async () =>
              setDetalheAberto(
                await carregarDetalhesProva(linha.id_teste),
              )}
                              >
                                Detalhes
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-success"
                                onClick=${() =>
              baixarPacoteHistorico(
                linha.id_teste,
                linha.nome_candidato || 'candidato',
              )}
                              >
                                Baixar prova
                              </button>
                            </div>
                          </td>
                        </tr>
                      `,
        )
        : html`
                      <${TabelaVazia}
                        colunas=${7}
                        texto="Nenhum registro encontrado para os filtros informados."
                      />
                    `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginacao.paginaAtual}
          totalPaginas=${paginacao.totalPaginas}
          onChange=${setPagina}
        />
      </${SectionCard}>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
      baixarPacoteHistorico(
        detalheAberto?.linha?.id_teste,
        detalheAberto?.linha?.nome_candidato || 'candidato',
      )}
      />
    </${PainelRh}>
  `;
}

export function TelaCriarProcesso({ controlador }) {
  const [formulario, setFormulario] = useState({
    vaga: '',
    quantidade: 1,
    dataEncerramento: '',
    operacao: '',
    trilha: '',
    usaNotaCorte: false,
    notaCorte: '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const regras = obterRegrasFormularioProcesso(formulario.vaga);

  useEffect(() => {
    if (regras.trilhaFixa && formulario.trilha !== regras.trilhaFixa) {
      setFormulario((anterior) => ({ ...anterior, trilha: regras.trilhaFixa }));
    }
  }, [regras.trilhaFixa, formulario.trilha]);

  const criar = async () => {
    const mensagemErro = validarFormularioProcesso(formulario, regras);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setErro('');
    setSalvando(true);

    try {
      await criarProcesso({
        id_processo: montarIdProcesso(formulario.vaga),
        vaga: formulario.vaga,
        quantidade_vagas: Number(formulario.quantidade),
        vagas_preenchidas: 0,
        data_encerramento: formulario.dataEncerramento,
        operacao: formulario.operacao,
        trilha: regras.trilhaFixa || formulario.trilha,
        usa_nota_corte: formulario.usaNotaCorte ? 1 : 0,
        nota_corte: formulario.usaNotaCorte
          ? Number(formulario.notaCorte)
          : null,
        status: 'Aberto',
        data_criacao: new Date().toISOString(),
        link_agendamento: '',
      });

      controlador.irParaTelaProtegida('screen-processes');
    } catch (error) {
      setErro(error?.message || 'Não foi possível criar o processo.');
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-process-create"
      navAtiva="screen-process-create"
      subtituloMarca="Novo processo seletivo"
      placeholderBusca="Cadastro de novo processo"
      controlador=${controlador}
      acaoPrimaria=${{
      label: 'Ver processos',
      onClick: () => controlador.irParaTelaProtegida('screen-processes'),
    }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Novo processo"
        title="Abrir processo seletivo"
        description="Cadastre uma vaga com a mesma lógica funcional do sistema atual, agora em uma composição mais previsível."
      />

      <${SectionCard}
        title="Dados do processo"
        description="Os campos abaixo mantêm a compatibilidade com a API e com o fluxo atual de provas."
        tourId="process-create-form"
      >
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Vaga do processo</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.vaga}
              onChange=${(event) =>
      setFormulario({ ...formulario, vaga: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option>Jovem Aprendiz</option>
              <option>Operador</option>
              <option>Estagiário</option>
              <option>Supervisor</option>
              <option>Control Desk</option>
              <option>Planejamento</option>
              <option>TI</option>
              <option>Analista</option>
              <option>Outros</option>
            </select>
          </div>

          <div class="col-md-3">
            <label class="form-label">Quantidade de vagas</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="1"
              value=${formulario.quantidade}
              onInput=${(event) =>
      setFormulario({ ...formulario, quantidade: event.target.value })}
            />
          </div>

          <div class="col-md-3">
            <label class="form-label">Data de encerramento</label>
            <input
              class="form-control rh-flow-input"
              type="date"
              value=${formulario.dataEncerramento}
              onInput=${(event) =>
      setFormulario({
        ...formulario,
        dataEncerramento: event.target.value,
      })}
            />
          </div>

          <div class="col-md-6">
            <label class="form-label">Operação</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.operacao}
              onChange=${(event) =>
      setFormulario({ ...formulario, operacao: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option>CRF</option>
              <option>DAVITA</option>
              <option>NEWE</option>
              <option>BRAVA</option>
              <option>ENDOVIEW</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Trilha</label>
            <select
              class="form-select rh-flow-input"
              disabled=${!!regras.trilhaFixa}
              value=${regras.trilhaFixa || formulario.trilha}
              onChange=${(event) =>
      setFormulario({ ...formulario, trilha: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="RH">RH</option>
              <option value="TI">TI</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label d-block mb-2">Ativar nota de corte</label>
            <label class="rh-cutoff-toggle">
              <input
                type="checkbox"
                checked=${formulario.usaNotaCorte}
                onChange=${(event) =>
      setFormulario({
        ...formulario,
        usaNotaCorte: event.target.checked,
      })}
              />
              <span class="rh-cutoff-toggle-slider"></span>
            </label>
          </div>

          <div class="col-md-6">
            <label class="form-label">Nota de corte</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="4"
              max="10"
              step="0.1"
              disabled=${!formulario.usaNotaCorte}
              value=${formulario.notaCorte}
              onInput=${(event) =>
      setFormulario({ ...formulario, notaCorte: event.target.value })}
            />
          </div>

        </div>

        ${erro ? html`<div class="alert alert-danger mt-4">${erro}</div>` : null}

        <div class="rh-form-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
          >
            Voltar
          </button>
          <button
            type="button"
            class="btn btn-success btn-lg"
            disabled=${salvando}
            onClick=${criar}
          >
            ${salvando ? 'Salvando...' : 'Criar processo'}
          </button>
        </div>
      </${SectionCard}>
    </${PainelRh}>
  `;
}

export function TelaBancoTalentos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [linhas, setLinhas] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [candidatoParaUtilizar, setCandidatoParaUtilizar] = useState(null);
  const [processoSelecionadoUso, setProcessoSelecionadoUso] = useState('');
  const [perfilEdicao, setPerfilEdicao] = useState(null);
  const [formularioPerfil, setFormularioPerfil] = useState({
    tags: '',
    habilidades: '',
    observacao_rh: '',
  });
  const [filtros, setFiltros] = useState({
    busca: '',
    habilidade: '',
    tag: '',
  });

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const [banco, processos] = await Promise.all([
        lerBancoTalentos({
          forcar: true,
          search: filtros.busca,
          skill: filtros.habilidade,
          tag: filtros.tag,
        }),
        lerProcessos(true),
      ]);

      setLinhas(Array.isArray(banco) ? banco : []);
      setProcessosAbertos(
        (Array.isArray(processos) ? processos : []).filter(
          (processo) => String(processo.status || '').trim() !== 'Encerrado',
        ),
      );
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível carregar o banco de talentos.',
      );
      setLinhas([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [filtros.busca, filtros.habilidade, filtros.tag]);

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      window.alert('Não há currículo disponível para este candidato.');
      return;
    }

    try {
      const arquivo = await baixarCvCandidato(candidato.id_teste);
      const tipo = String(arquivo?.contentType || '').toLowerCase();
      if (tipo.includes('pdf')) {
        abrirBlobEmNovaGuia(arquivo.blob);
        return;
      }

      baixarBlob(arquivo.filename || 'curriculo', arquivo.blob);
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível abrir o currículo do candidato.',
      );
    }
  };

  const remover = async (idBanco) => {
    if (!window.confirm('Deseja eliminar este candidato do banco de talentos?')) {
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await removerBancoTalentos(idBanco);
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível remover o candidato do banco.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicaoPerfil = (candidato) => {
    setPerfilEdicao(candidato);
    setFormularioPerfil({
      tags: Array.isArray(candidato.tags) ? candidato.tags.join(', ') : '',
      habilidades: Array.isArray(candidato.habilidades)
        ? candidato.habilidades.join(', ')
        : '',
      observacao_rh: candidato.observacao_rh || '',
    });
  };

  const salvarPerfil = async () => {
    if (!perfilEdicao) return;

    const mensagemErro = validarPerfilCandidato(formularioPerfil);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      await atualizarPerfilCandidato(perfilEdicao.id_teste, {
        nome_candidato: perfilEdicao.nome_candidato,
        tags: quebrarListaTexto(formularioPerfil.tags),
        habilidades: quebrarListaTexto(formularioPerfil.habilidades),
        observacao_rh: formularioPerfil.observacao_rh,
      });
      setPerfilEdicao(null);
      await carregar();
    } catch (error) {
      setErro(error?.message || 'Não foi possível atualizar o perfil RH.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarUso = async () => {
    if (!candidatoParaUtilizar || !processoSelecionadoUso) {
      window.alert('Selecione um processo antes de continuar.');
      return;
    }

    const confirmar = window.confirm(
      `Deseja realmente utilizar o candidato ${candidatoParaUtilizar?.nome_candidato || ''} no processo ${processoSelecionadoUso}?`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      const processoSelecionado = processosAbertos.find(
        (processo) => obterReferenciaProcesso(processo) === processoSelecionadoUso,
      );
      await usarCandidatoDoBancoTalentos(candidatoParaUtilizar.id_banco, {
        id_processo: processoSelecionado?.id_processo || '',
        id_processo_ref: processoSelecionadoUso,
      });

      setCandidatoParaUtilizar(null);
      setProcessoSelecionadoUso('');
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível reutilizar o candidato selecionado.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-talent-bank"
      navAtiva="screen-talent-bank"
      subtituloMarca="Banco de talentos"
      placeholderBusca="Reaproveitamento de candidatos"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Banco de talentos"
        title="Candidatos reaproveitáveis"
        description="Acompanhe candidatos guardados para oportunidades futuras, filtre por habilidade e registre tags e observações do RH."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Filtros"
        description="Busque candidatos por nome, habilidade e tags cadastradas."
        tourId="talent-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Busca por nome</label>
            <input
              class="form-control"
              placeholder="Nome, vaga ou processo"
              value=${filtros.busca}
              onInput=${(event) =>
      setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Habilidade</label>
            <input
              class="form-control"
              placeholder="Excel, Atendimento, TI..."
              value=${filtros.habilidade}
              onInput=${(event) =>
      setFiltros({ ...filtros, habilidade: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Tag</label>
            <input
              class="form-control"
              placeholder="Prioritário, Boa aderência..."
              value=${filtros.tag}
              onInput=${(event) =>
      setFiltros({ ...filtros, tag: event.target.value })}
            />
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Lista atual"
        description="Reaproveitamento, perfil RH e filtros avançados funcionando sobre dados persistidos."
        tourId="talent-table"
      >
        ${carregando
      ? html`
              <${LoadingState}
                titulo="Carregando banco de talentos"
                descricao="Buscando candidatos, tags e observações persistidas."
              />
            `
      : html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Candidato</th>
                      <th>Cidade</th>
                      <th>Bairro</th>
                      <th>Vaga</th>
                      <th>Nota</th>
                      <th>Habilidades / tags</th>
                      <th>Observações RH</th>
                      <th>Entrevista</th>
                      <th>CV</th>
                      <th class="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhas.length
          ? linhas.map(
            (linha) => html`
                            <tr key=${linha.id_banco}>
                              <td>${linha.id_processo || '-'}</td>
                              <td>
                                <strong>${linha.nome_candidato || '-'}</strong>
                                <div class="small text-muted mt-1">
                                  ${formatarDataHora(linha.data_movimentacao)}
                                </div>
                              </td>
                              <td>${linha.cidade || '-'}</td>
                              <td>${linha.bairro || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.pontuacao_final || '-'}</td>
                              <td>
                                <div class="rh-cell-stack">
                                  <div class="rh-chip-wrap">
                                    ${(linha.habilidades || []).map(
              (item) => html`
                                        <span key=${item} class="rh-chip is-skill">${item}</span>
                                      `,
            )}
                                    ${(linha.tags || []).map(
              (item) => html`
                                        <span key=${item} class="rh-chip">${item}</span>
                                      `,
            )}
                                  </div>
                                  <small>${linha.origem || '-'}</small>
                                </div>
                              </td>
                              <td>${linha.observacao_rh || 'Sem observações.'}</td>
                              <td>
                                ${linha.status_entrevista
                ? html`
                                      <div class="rh-cell-stack">
                                        <span
                                          class=${`rh-status-pill ${obterClasseStatusEntrevista(linha.status_entrevista)}`}
                                        >
                                          ${linha.status_entrevista}
                                        </span>
                                        <small>${formatarDataHora(linha.data_entrevista)}</small>
                                      </div>
                                    `
                : 'Não agendada'}
                              </td>
                              <td>
                                ${linha.cv_disponivel
                ? html`
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary"
                                        onClick=${() => abrirCurriculo(linha)}
                                      >
                                        Ver CV
                                      </button>
                                    `
                : 'Sem CV'}
                              </td>
                              <td class="text-end">
                                <div class="d-flex justify-content-end gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    onClick=${() => abrirEdicaoPerfil(linha)}
                                  >
                                    Perfil RH
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    disabled=${salvando}
                                    onClick=${() => remover(linha.id_banco)}
                                  >
                                    Eliminar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-primary"
                                    onClick=${() => {
                setCandidatoParaUtilizar(linha);
                setProcessoSelecionadoUso('');
              }}
                                  >
                                    Utilizar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `,
          )
          : html`
                          <${TabelaVazia}
                            colunas=${11}
                            texto="Nenhum candidato no banco de talentos."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!candidatoParaUtilizar}
        titulo="Utilizar candidato"
        subtitulo="Selecione o processo aberto e confirme a reutilização."
        onClose=${() => {
      setCandidatoParaUtilizar(null);
      setProcessoSelecionadoUso('');
    }}
      >
        <div class="rh-details-body">
          <label class="form-label">Processo aberto</label>
          <select
            class="form-select"
            value=${processoSelecionadoUso}
            onChange=${(event) => setProcessoSelecionadoUso(event.target.value)}
          >
            <option value="">Selecione...</option>
              ${processosAbertos.map(
      (processo) => html`
                <option key=${obterChaveProcesso(processo)} value=${obterReferenciaProcesso(processo)}>
                  ${processo.id_processo} • ${processo.vaga} •
                  ${processo.operacao || processo.trilha || '-'}
                </option>
              `,
    )}
          </select>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => {
      setCandidatoParaUtilizar(null);
      setProcessoSelecionadoUso('');
    }}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${salvando}
            onClick=${confirmarUso}
          >
            Confirmar utilização
          </button>
        </footer>
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!perfilEdicao}
        titulo="Perfil RH do candidato"
        subtitulo="Cadastre habilidades, tags e observações persistidas para reutilização futura."
        onClose=${() => setPerfilEdicao(null)}
      >
        ${perfilEdicao
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-12">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${perfilEdicao.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Habilidades</label>
                    <input
                      class="form-control"
                      placeholder="Excel, Atendimento, Administrativo..."
                      value=${formularioPerfil.habilidades}
                      onInput=${(event) =>
          setFormularioPerfil({
            ...formularioPerfil,
            habilidades: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Tags</label>
                    <input
                      class="form-control"
                      placeholder="Prioritário, Boa aderência..."
                      value=${formularioPerfil.tags}
                      onInput=${(event) =>
          setFormularioPerfil({
            ...formularioPerfil,
            tags: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observação RH</label>
                    <textarea
                      class="form-control"
                      rows="5"
                      value=${formularioPerfil.observacao_rh}
                      onInput=${(event) =>
          setFormularioPerfil({
            ...formularioPerfil,
            observacao_rh: event.target.value,
          })}
                    ></textarea>
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setPerfilEdicao(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  disabled=${salvando}
                  onClick=${salvarPerfil}
                >
                  ${salvando ? 'Salvando...' : 'Salvar perfil'}
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}

function GraficoComparativoAnalise({ itens = [] }) {
  const dados = Array.isArray(itens) ? itens : [];
  const maiorValor = Math.max(
    1,
    ...dados.flatMap((item) => [
      Number(item?.obtained || 0),
      Number(item?.expected || 0),
    ]),
  );

  if (!dados.length) {
    return html`
      <${EmptyState}
        title="Sem dados para o gráfico"
        text="Não há informações suficientes para exibir a comparação."
      />
    `;
  }

  return html`
    <div class="rh-analysis-chart">
      ${dados.map(
    (item, indice) => html`
          <div key=${indice} class="rh-analysis-chart-row">
            <div class="rh-analysis-chart-label">${item.label || '-'}</div>
            <div class="rh-analysis-chart-bars">
              <div class="rh-analysis-chart-bar-track">
                <div
                  class="rh-analysis-chart-bar is-obtained"
                  style=${{
        width: `${(Number(item?.obtained || 0) / maiorValor) * 100}%`,
      }}
                ></div>
              </div>
              <div class="rh-analysis-chart-bar-track">
                <div
                  class="rh-analysis-chart-bar is-expected"
                  style=${{
        width: `${(Number(item?.expected || 0) / maiorValor) * 100}%`,
      }}
                ></div>
              </div>
            </div>
            <div class="rh-analysis-chart-value">
              ${formatarNotaAnalise(item?.obtained || 0)} x
              ${formatarNotaAnalise(item?.expected || 0)}
            </div>
          </div>
        `,
  )}
    </div>
  `;
}

export function TelaAnaliseCandidatos({ controlador }) {
  const [linhas, setLinhas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [relatorioAtivo, setRelatorioAtivo] = useState('processos');
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [relatorioProcessos, setRelatorioProcessos] = useState([]);
  const [relatorioCandidatos, setRelatorioCandidatos] = useState([]);
  const [filtrosRelatorio, setFiltrosRelatorio] = useState({
    dataInicial: '',
    dataFinal: '',
    status: '',
    processo: '',
  });
  const [filtros, setFiltros] = useState({
    processo: '',
    candidato: '',
    vaga: '',
    nota: '',
  });
  const [detalhe, setDetalhe] = useState(null);

  const carregarAnalises = async () => {
    const dados = await lerAnalisesCandidatos();
    setLinhas(Array.isArray(dados) ? dados : []);
  };

  const carregarRelatorios = async () => {
    setCarregandoRelatorio(true);
    try {
      const [processos, candidatos] = await Promise.all([
        lerRelatorioProcessos(filtrosRelatorio),
        lerRelatorioCandidatos(filtrosRelatorio),
      ]);
      setRelatorioProcessos(Array.isArray(processos) ? processos : []);
      setRelatorioCandidatos(Array.isArray(candidatos) ? candidatos : []);
    } finally {
      setCarregandoRelatorio(false);
    }
  };

  const baixarRelatorioAtivo = async () => {
    const arquivo =
      relatorioAtivo === 'processos'
        ? await baixarRelatorioProcessos(filtrosRelatorio)
        : await baixarRelatorioCandidatos(filtrosRelatorio);
    baixarBlob(arquivo.filename || 'relatorio.csv', arquivo.blob);
  };

  useEffect(() => {
    carregarAnalises();
    carregarRelatorios();
  }, []);

  const filtrado = useMemo(
    () =>
      linhas.filter((linha) => {
        const matchProcesso =
          !filtros.processo ||
          String(linha.id_processo || '')
            .toLowerCase()
            .includes(filtros.processo.toLowerCase());
        const matchCandidato =
          !filtros.candidato ||
          String(linha.nome_candidato || '')
            .toLowerCase()
            .includes(filtros.candidato.toLowerCase());
        const matchVaga =
          !filtros.vaga ||
          String(linha.vaga || '')
            .toLowerCase()
            .includes(filtros.vaga.toLowerCase());

        let matchNota = true;
        if (filtros.nota) {
          const notaMinima = Number(String(filtros.nota).replace(',', '.'));
          const notaAtual = Number(
            String(linha.nota_final || 0).replace(',', '.'),
          );
          if (!Number.isNaN(notaMinima)) {
            matchNota = notaAtual >= notaMinima;
          }
        }

        return matchProcesso && matchCandidato && matchVaga && matchNota;
      }),
    [linhas, filtros],
  );

  const paginado = obterItensPaginados(filtrado, pagina, TAMANHO_ANALISE);
  const detalheEstadoAcoes = useMemo(
    () => getCandidateActionState(detalhe || {}, detalhe?.status_processo || ''),
    [detalhe],
  );

  const aplicarAcao = async (statusCandidato) => {
    if (!detalhe?.id_teste) return;
    if (detalheEstadoAcoes.processClosed) {
      window.alert('O processo seletivo deste candidato está encerrado e não permite novas movimentações.');
      return;
    }
    if (
      statusCandidato === 'Aprovado' &&
      !detalheEstadoAcoes.canApprove
    ) {
      window.alert('A aprovação não está disponível para o status atual deste candidato.');
      return;
    }
    if (
      statusCandidato === 'Eliminado' &&
      !detalheEstadoAcoes.canEliminate
    ) {
      window.alert('A eliminação não está disponível para o status atual deste candidato.');
      return;
    }
    if (
      statusCandidato === 'Banco de talentos' &&
      !detalheEstadoAcoes.canSendToTalentBank
    ) {
      window.alert('O envio para banco de talentos não está disponível para o status atual deste candidato.');
      return;
    }

    const candidatosProcesso = await lerCandidatosProcessos(true);
    const vinculo = candidatosProcesso.find(
      (item) =>
        String(item.id_teste || '').trim() ===
        String(detalhe.id_teste || '').trim(),
    );

    if (!vinculo) {
      window.alert(
        'Não foi possível localizar o vínculo do candidato com o processo.',
      );
      return;
    }

    await atualizarStatusCandidato(vinculo.id_registro, {
      status_candidato: statusCandidato,
      data_movimentacao: new Date().toISOString(),
    });

    await carregarAnalises();
    setDetalhe(await lerDetalheAnaliseCandidato(detalhe.id_teste));
  };

  return html`
    <${PainelRh}
      screenId="screen-analysis-candidates"
      navAtiva="screen-analysis-candidates"
      subtituloMarca="Análise por candidato"
      placeholderBusca="Inteligência analítica do RH"
      controlador=${controlador}
      mostrarAtalhos=${false}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Relatórios"
        title="Relatórios e análise por candidato"
        description="Exporte processos e candidatos por período, mantendo a análise individual disponível para consulta operacional."
      />

      <${SectionCard}
        title="Relatórios exportáveis"
        description="Os dados são gerados sob demanda pela API, sem criar arquivo permanente no servidor."
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary"
            disabled=${carregandoRelatorio}
            onClick=${carregarRelatorios}
          >
            Atualizar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${carregandoRelatorio}
            onClick=${baixarRelatorioAtivo}
          >
            Exportar CSV
          </button>
        `}
      >
        <div class="d-flex gap-2 flex-wrap mb-3">
          <button
            type="button"
            class=${`btn ${relatorioAtivo === 'processos' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick=${() => setRelatorioAtivo('processos')}
          >
            Relatório de Processos
          </button>
          <button
            type="button"
            class=${`btn ${relatorioAtivo === 'candidatos' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick=${() => setRelatorioAtivo('candidatos')}
          >
            Relatório de Candidatos
          </button>
        </div>

        <div class="rh-filter-grid rh-filter-grid--wide mb-4">
          <div class="rh-filter-field">
            <label>Data inicial</label>
            <input
              class="form-control"
              type="date"
              value=${filtrosRelatorio.dataInicial}
              onInput=${(event) =>
      setFiltrosRelatorio({
        ...filtrosRelatorio,
        dataInicial: event.target.value,
      })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Data final</label>
            <input
              class="form-control"
              type="date"
              value=${filtrosRelatorio.dataFinal}
              onInput=${(event) =>
      setFiltrosRelatorio({
        ...filtrosRelatorio,
        dataFinal: event.target.value,
      })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Status candidato</label>
            <select
              class="form-select"
              value=${filtrosRelatorio.status}
              disabled=${relatorioAtivo !== 'candidatos'}
              onChange=${(event) =>
      setFiltrosRelatorio({
        ...filtrosRelatorio,
        status: event.target.value,
      })}
            >
              <option value="">Todos</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Eliminado">Eliminado/Reprovado</option>
              <option value="Banco de talentos">Banco de Talentos</option>
              <option value="Analise">Em andamento</option>
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Processo</label>
            <input
              class="form-control"
              value=${filtrosRelatorio.processo}
              disabled=${relatorioAtivo !== 'candidatos'}
              onInput=${(event) =>
      setFiltrosRelatorio({
        ...filtrosRelatorio,
        processo: event.target.value,
      })}
            />
          </div>
        </div>

        ${relatorioAtivo === 'processos'
      ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Vagas</th>
                      <th>Aprovados</th>
                      <th>Eliminados/Reprovados</th>
                      <th>Abertura</th>
                      <th>Encerramento</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${relatorioProcessos.length
          ? relatorioProcessos.slice(0, 12).map(
            (linha) => html`
                            <tr key=${`${linha.nome_relatorio_processo}-${linha.data_abertura}`}>
                              <td>${linha.nome_relatorio_processo || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.quantidade_vagas ?? '-'}</td>
                              <td>${linha.quantidade_aprovados ?? 0}</td>
                              <td>${linha.quantidade_eliminados_reprovados ?? 0}</td>
                              <td>${formatarDataHora(linha.data_abertura)}</td>
                              <td>${linha.data_encerramento || '-'}</td>
                              <td>${linha.status_processo || '-'}</td>
                            </tr>
                          `,
          )
          : html`<${TabelaVazia} colunas=${8} texto="Nenhum processo no período." />`}
                  </tbody>
                </table>
              </div>
            `
      : html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Candidato</th>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Origem</th>
                      <th>Movimentações</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th>Última movimentação</th>
                      <th>Aprovação</th>
                      <th>Eliminação/Reprovação</th>
                      <th>Motivo eliminação</th>
                      <th>Etapa eliminação</th>
                      <th>Banco</th>
                      <th>Contato</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${relatorioCandidatos.length
          ? relatorioCandidatos.slice(0, 12).map(
            (linha) => html`
                            <tr key=${`${linha.nome_candidato}-${linha.processo}-${linha.status}`}>
                              <td>${linha.nome_candidato || '-'}</td>
                              <td>${linha.processo || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.origem_inicial || '-'}</td>
                              <td>${linha.movimentacoes || '-'}</td>
                              <td>${linha.nota_prova || 'Sem prova'}</td>
                              <td>
                                <span class=${`rh-status-pill ${obterClasseStatusEntrevista(linha.status_atual || linha.status)}`}>
                                  ${linha.status_atual || linha.status || '-'}
                                </span>
                              </td>
                              <td>${formatarDataHora(linha.data_movimentacao)}</td>
                              <td>${formatarDataHora(linha.data_aprovacao)}</td>
                              <td>${formatarDataHora(linha.data_eliminacao_reprovacao)}</td>
                              <td>${linha.motivo_eliminacao || (String(linha.status_atual || linha.status || '').toLowerCase().includes('eliminado') ? 'Motivo não informado' : '-')}</td>
                              <td>${linha.etapa_eliminacao || '-'}</td>
                              <td>${formatarDataHora(linha.data_banco_talentos)}</td>
                              <td>
                                <div>${mascararEmailContato(linha.email)}</div>
                                <div class="small text-muted">${mascararTelefoneContato(linha.telefone)}</div>
                              </td>
                            </tr>
                          `,
          )
          : html`<${TabelaVazia} colunas=${14} texto="Nenhum candidato no período." />`}
                  </tbody>
                </table>
              </div>
            `}
      </${SectionCard}>

      <${BlocoFiltro} tourId="analysis-filters">
        <div class="rh-filter-grid rh-filter-grid--wide">
          <${CampoFiltro} label="Processo" icon="folder_managed">
            <input
              class="form-control"
              value=${filtros.processo}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, processo: event.target.value });
    }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Candidato" icon="person_search">
            <input
              class="form-control"
              value=${filtros.candidato}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, candidato: event.target.value });
    }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Vaga" icon="work">
            <input
              class="form-control"
              value=${filtros.vaga}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, vaga: event.target.value });
    }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Nota mínima" icon="star">
            <input
              class="form-control"
              type="number"
              step="0.1"
              min="0"
              max="10"
              value=${filtros.nota}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, nota: event.target.value });
    }}
            />
          </${CampoFiltro}>
        </div>
      </${BlocoFiltro}>

      <${SectionCard}
        title="Ranking analítico"
        description="O modal de detalhe respeita o status atual do candidato e bloqueia movimentações em processo encerrado."
        tourId="analysis-ranking"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Processo</th>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nota</th>
                <th>Afinidade</th>
                <th>Recomendação</th>
                <th>Status</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${paginado.itens.length
      ? paginado.itens.map(
        (linha) => html`
                      <tr key=${linha.id_teste}>
                        <td>${linha.id_processo || '-'}</td>
                        <td>${linha.nome_candidato || '-'}</td>
                        <td>${linha.vaga || '-'}</td>
                        <td>${formatarNotaAnalise(linha.nota_final)}</td>
                        <td>
                          ${formatarPercentualAfinidade(
          linha.afinidade_percentual,
        )}%
                        </td>
                        <td>
                          <span class=${obterClasseAderencia(linha.recomendacao)}>
                            ${linha.recomendacao || '-'}
                          </span>
                        </td>
                        <td>${getCandidateVisibleStatus(linha) || '-'}</td>
                        <td class="text-end">
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-primary"
                            onClick=${async () =>
            setDetalhe(
              await lerDetalheAnaliseCandidato(linha.id_teste),
            )}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    `,
      )
      : html`
                    <${TabelaVazia}
                      colunas=${8}
                      texto="Nenhuma análise disponível."
                    />
                  `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginado.paginaAtual}
          totalPaginas=${paginado.totalPaginas}
          onChange=${setPagina}
        />
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!detalhe}
        titulo=${`Análise do candidato • ${detalhe?.nome_candidato || 'Candidato'}`}
        subtitulo="Comparativo analítico entre desempenho e expectativa da vaga."
        onClose=${() => setDetalhe(null)}
      >
        ${detalhe
      ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
          { label: 'Processo', value: detalhe.id_processo || '-' },
          { label: 'Candidato', value: detalhe.nome_candidato || '-' },
          { label: 'Vaga', value: detalhe.vaga || '-' },
          {
            label: 'Nota final',
            value: formatarNotaAnalise(detalhe.nota_final),
          },
          {
            label: 'Afinidade',
            value: `${formatarPercentualAfinidade(
              detalhe.afinidade_percentual,
            )}%`,
          },
          {
            label: 'Recomendação',
            value: html`
                        <span class=${obterClasseAderencia(detalhe.recomendacao)}>
                          ${detalhe.recomendacao || '-'}
                        </span>
                      `,
          },
          {
            label: 'Status atual',
            value: getCandidateVisibleStatus(detalhe) || '-',
          },
          {
            label: 'Processo',
            value: detalhe.status_processo || 'Aberto',
          },
        ]}
                />

                <${SectionCard}
                  title="Etapas comparadas"
                  className="rh-section-card--flat"
                >
                  <${GraficoComparativoAnalise} itens=${detalhe.grafico || []} />
                </${SectionCard}>

                <${SectionCard}
                  title="Observações"
                  className="rh-section-card--flat"
                >
                  <div class="rh-detail-list">
                    <div>
                      Nota textual geral:
                      ${formatarNotaAnalise(
          detalhe?.analise_texto?.overall || 0,
        )}
                    </div>
                    ${(detalhe.ressalvas || []).map(
          (item, indice) => html`<div key=${indice}>${item}</div>`,
        )}
                    <div>${detalhe.parecer_final || '-'}</div>
                  </div>
                </${SectionCard}>
              </div>

              <footer class="rh-modal-footer">
                <div class="rh-modal-footer-actions">
                  ${detalheEstadoAcoes.canApprove
          ? html`
                        <button
                          type="button"
                          class="btn btn-outline-success"
                          onClick=${() => aplicarAcao('Aprovado')}
                        >
                          Aprovar
                        </button>
                      `
          : null}
                  ${detalheEstadoAcoes.canEliminate
          ? html`
                        <button
                          type="button"
                          class="btn btn-outline-danger"
                          onClick=${() => aplicarAcao('Eliminado')}
                        >
                          Eliminar
                        </button>
                      `
          : null}
                  ${detalheEstadoAcoes.canSendToTalentBank
          ? html`
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          onClick=${() => aplicarAcao('Banco de talentos')}
                        >
                          Banco de talentos
                        </button>
                      `
          : null}
                  ${!detalheEstadoAcoes.canApprove &&
          !detalheEstadoAcoes.canEliminate &&
          !detalheEstadoAcoes.canSendToTalentBank
          ? html`
                        <span class="text-muted">
                          ${isProcessClosed(detalhe?.status_processo)
              ? 'Processo encerrado: sem movimentações.'
              : 'Sem ações operacionais para o status atual.'}
                        </span>
                      `
          : null}
                </div>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${() => setDetalhe(null)}
                >
                  Fechar
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
