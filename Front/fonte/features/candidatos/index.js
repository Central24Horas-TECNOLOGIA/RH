import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  atualizarStatusCandidato,
  criarCandidatoNoProcesso,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerHistorico,
  lerProcessos,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
} from '../../servico-api.js';
import {
  EmptyState,
  MetricGrid,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  CANDIDATE_STATUS_ANALYSIS,
  CANDIDATE_STATUS_APPROVED,
  CANDIDATE_STATUS_ELIMINATED,
  CANDIDATE_STATUS_TALENT_BANK,
  getCandidateVisibleStatus,
} from '../../shared/process-flow.js';
import {
  formatarDataHora,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { obterReferenciaProcesso } from '../../shared/process-reference.js';

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function montarChaveCandidato(item) {
  const idTeste = String(item?.id_teste || '').trim();
  const nome = normalizarTexto(item?.nome_candidato || item?.nome || '');
  const processo = String(
    item?.id_processo_ref || item?.id_processo || '',
  ).trim();

  if (idTeste) return `teste:${idTeste}`;
  return `nome:${nome}:processo:${processo}`;
}

function obterNotaCandidato(item) {
  return (
    item?.pontuacao_final ||
    item?.nota_final ||
    item?.score_final ||
    item?.pontuacao ||
    '-'
  );
}

function obterContatoPrincipal(item) {
  return item?.email || item?.telefone || item?.whatsapp || '';
}

function obterClassificacaoCandidato(item) {
  return item?.classificacao || item?.classificacao_slug || '';
}

function obterDataCandidato(item) {
  return (
    item?.data_movimentacao ||
    item?.data_prova ||
    item?.data_iso ||
    item?.created_at ||
    item?.data_criacao ||
    ''
  );
}

function montarCandidatoDeProcesso(item, processosPorReferencia) {
  const processoReferencia = String(
    item.id_processo_ref || item.id_processo || '',
  ).trim();
  const processo =
    processosPorReferencia.get(processoReferencia) ||
    processosPorReferencia.get(String(item.id_processo || '').trim()) ||
    null;

  return {
    ...item,
    origem_cadastro: 'processo',
    origem_rotulo: 'Processo seletivo',
    chave: montarChaveCandidato(item),
    nome_candidato: item.nome_candidato || '-',
    status_visivel: getCandidateVisibleStatus(item),
    id_processo_ref: processoReferencia,
    processo_nome: processo?.id_processo || item.id_processo || '-',
    vaga: item.vaga || processo?.vaga || '-',
    nota_exibicao: obterNotaCandidato(item),
    classificacao_exibicao: obterClassificacaoCandidato(item),
    data_exibicao: obterDataCandidato(item),
    email: item.email || '',
    telefone: item.telefone || '',
    whatsapp: item.whatsapp || '',
    contato_principal: obterContatoPrincipal(item),
    pode_movimentar: true,
    pode_atrelar: true,
    id_registro_processo: item.id_registro,
  };
}

function montarCandidatoDoBanco(item) {
  return {
    ...item,
    origem_cadastro: 'banco',
    origem_rotulo: 'Banco de talentos',
    chave: montarChaveCandidato(item),
    nome_candidato: item.nome_candidato || '-',
    status_visivel: CANDIDATE_STATUS_TALENT_BANK,
    id_processo_ref: item.id_processo_ref || item.id_processo || '',
    processo_nome: item.id_processo || '-',
    vaga: item.vaga || '-',
    nota_exibicao: obterNotaCandidato(item),
    classificacao_exibicao: obterClassificacaoCandidato(item),
    data_exibicao: obterDataCandidato(item),
    email: item.email || '',
    telefone: item.telefone || '',
    whatsapp: item.whatsapp || '',
    contato_principal: obterContatoPrincipal(item),
    pode_movimentar: false,
    pode_atrelar: true,
    id_banco: item.id_banco,
  };
}

function montarCandidatoDoHistorico(item) {
  return {
    ...item,
    origem_cadastro: 'historico',
    origem_rotulo: 'Historico de prova',
    chave: montarChaveCandidato(item),
    nome_candidato: item.nome_candidato || '-',
    status_visivel: item.id_processo ? 'Em processo' : 'Sem processo vinculado',
    id_processo_ref: item.id_processo_ref || item.id_processo || '',
    processo_nome: item.id_processo || '-',
    vaga: item.vaga || '-',
    nota_exibicao: obterNotaCandidato(item),
    classificacao_exibicao: obterClassificacaoCandidato(item),
    data_exibicao: obterDataCandidato(item),
    email: item.email || '',
    telefone: item.telefone || '',
    whatsapp: item.whatsapp || '',
    contato_principal: obterContatoPrincipal(item),
    pode_movimentar: false,
    pode_atrelar: true,
  };
}

function resumirStatus(candidatos) {
  const resumo = {
    total: candidatos.length,
    aprovados: 0,
    eliminados: 0,
    analise: 0,
    processo: 0,
    banco: 0,
  };

  candidatos.forEach((candidato) => {
    const status = normalizarTexto(candidato.status_visivel);

    if (status.includes('aprovado')) {
      resumo.aprovados += 1;
    } else if (status.includes('eliminado') || status.includes('reprovado')) {
      resumo.eliminados += 1;
    } else if (status.includes('banco')) {
      resumo.banco += 1;
    } else if (
      candidato.origem_cadastro === 'processo' ||
      status.includes('processo') ||
      status.includes('agendado') ||
      status.includes('confirmado') ||
      status.includes('compareceu')
    ) {
      resumo.processo += 1;
    } else {
      resumo.analise += 1;
    }
  });

  return resumo;
}

function SelectProcesso({ processos, valor, onChange, disabled = false }) {
  return html`
    <select
      class="form-select"
      value=${valor}
      disabled=${disabled}
      onChange=${(event) => onChange(event.target.value)}
    >
      <option value="">Selecione um processo aberto</option>
      ${processos.map((processo) => {
        const referencia = obterReferenciaProcesso(processo);
        const rotulo = [
          processo.id_processo || 'Processo',
          processo.vaga ? `| ${processo.vaga}` : '',
          processo.operacao ? `| ${processo.operacao}` : '',
        ]
          .filter(Boolean)
          .join(' ');

        return html`
          <option key=${referencia} value=${referencia}>${rotulo}</option>
        `;
      })}
    </select>
  `;
}

export function TelaCandidatos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [candidatos, setCandidatos] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [filtros, setFiltros] = useState({
    busca: '',
    status: '',
    origem: '',
  });
  const [detalhe, setDetalhe] = useState(null);
  const [candidatoParaAtrelar, setCandidatoParaAtrelar] = useState(null);
  const [processoSelecionado, setProcessoSelecionado] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const resultados = await Promise.allSettled([
        lerHistorico(),
        lerCandidatosProcessos(true),
        lerBancoTalentos({ forcar: true }),
        lerProcessos(true),
      ]);

      const historico =
        resultados[0].status === 'fulfilled' && Array.isArray(resultados[0].value)
          ? resultados[0].value
          : [];
      const candidatosProcessos =
        resultados[1].status === 'fulfilled' && Array.isArray(resultados[1].value)
          ? resultados[1].value
          : [];
      const bancoTalentos =
        resultados[2].status === 'fulfilled' && Array.isArray(resultados[2].value)
          ? resultados[2].value
          : [];
      const processos =
        resultados[3].status === 'fulfilled' && Array.isArray(resultados[3].value)
          ? resultados[3].value
          : [];

      const falhas = resultados
        .filter((item) => item.status === 'rejected')
        .map((item) => item.reason);

      if (
        falhas.length &&
        !historico.length &&
        !candidatosProcessos.length &&
        !bancoTalentos.length &&
        !processos.length
      ) {
        setErro(
          falhas[0]?.message ||
            'Nao foi possivel carregar a pagina de candidatos.',
        );
      }

      const processosPorReferencia = new Map();
      processos.forEach((processo) => {
        const referencia = obterReferenciaProcesso(processo);
        if (referencia) processosPorReferencia.set(referencia, processo);
        if (processo.id_processo) {
          processosPorReferencia.set(String(processo.id_processo), processo);
        }
      });

      const abertos = processos.filter(
        (processo) => String(processo.status || '').trim() !== 'Encerrado',
      );

      const mapa = new Map();

      historico.forEach((item) => {
        const candidato = montarCandidatoDoHistorico(item);
        mapa.set(candidato.chave, candidato);
      });

      bancoTalentos.forEach((item) => {
        const candidato = montarCandidatoDoBanco(item);
        mapa.set(candidato.chave, candidato);
      });

      candidatosProcessos.forEach((item) => {
        const candidato = montarCandidatoDeProcesso(
          item,
          processosPorReferencia,
        );
        mapa.set(candidato.chave, candidato);
      });

      const lista = Array.from(mapa.values()).sort((a, b) =>
        String(b.data_exibicao || '').localeCompare(
          String(a.data_exibicao || ''),
        ),
      );

      setCandidatos(lista);
      setProcessosAbertos(abertos);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel carregar a pagina de candidatos.',
      );
      setCandidatos([]);
      setProcessosAbertos([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const candidatosFiltrados = useMemo(() => {
    const busca = normalizarTexto(filtros.busca);
    const statusFiltro = normalizarTexto(filtros.status);
    const origemFiltro = normalizarTexto(filtros.origem);

    return candidatos.filter((candidato) => {
      const textoBusca = normalizarTexto(
        [
          candidato.nome_candidato,
          candidato.email,
          candidato.telefone,
          candidato.whatsapp,
          candidato.vaga,
          candidato.processo_nome,
          candidato.id_processo,
          candidato.id_teste,
          candidato.status_visivel,
          candidato.origem_rotulo,
          candidato.classificacao_exibicao,
        ].join(' '),
      );

      const status = normalizarTexto(candidato.status_visivel);
      const origem = normalizarTexto(candidato.origem_cadastro);

      const bateBusca = !busca || textoBusca.includes(busca);
      const bateStatus = !statusFiltro || status.includes(statusFiltro);
      const bateOrigem = !origemFiltro || origem === origemFiltro;

      return bateBusca && bateStatus && bateOrigem;
    });
  }, [candidatos, filtros]);

  const resumo = useMemo(
    () => resumirStatus(candidatosFiltrados),
    [candidatosFiltrados],
  );

  const aplicarStatus = async (candidato, status) => {
    if (!candidato) return;

    if (candidato.origem_cadastro === 'banco') {
      if (status === CANDIDATE_STATUS_ELIMINATED) {
        const confirmar = window.confirm(
          `Deseja remover ${candidato.nome_candidato} do banco de talentos?`,
        );
        if (!confirmar) return;

        setSalvando(true);
        setErro('');

        try {
          await removerBancoTalentos(candidato.id_banco);
          setDetalhe(null);
          await carregar();
        } catch (error) {
          setErro(
            error?.message ||
              'Nao foi possivel remover o candidato do banco de talentos.',
          );
        } finally {
          setSalvando(false);
        }

        return;
      }

      window.alert(
        'Este candidato esta no banco de talentos. Para aprovar, primeiro atrele-o a um processo seletivo.',
      );
      return;
    }

    if (!candidato.id_registro_processo) {
      window.alert(
        'Este candidato ainda nao possui vinculo operacional com um processo. Atrele-o a um processo antes de aprovar ou eliminar.',
      );
      return;
    }

    const confirmar = window.confirm(
      `Deseja alterar o status de ${candidato.nome_candidato} para "${status}"?`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      await atualizarStatusCandidato(candidato.id_registro_processo, {
        status_candidato: status,
        data_movimentacao: new Date().toISOString(),
      });

      setDetalhe(null);
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel atualizar o status do candidato.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const enviarParaBanco = async (candidato) => {
    if (!candidato || candidato.origem_cadastro !== 'processo') {
      window.alert(
        'Somente candidatos vinculados a um processo podem ser enviados ao banco de talentos.',
      );
      return;
    }

    await aplicarStatus(candidato, CANDIDATE_STATUS_TALENT_BANK);
  };

  const abrirAtrelar = (candidato) => {
    setCandidatoParaAtrelar(candidato);
    setProcessoSelecionado('');
  };

  const candidatoJaVinculadoAoProcessoSelecionado = () => {
    if (!candidatoParaAtrelar || !processoSelecionado) {
      return false;
    }

    if (
      String(candidatoParaAtrelar.id_processo_ref || '').trim() ===
        String(processoSelecionado || '').trim() &&
      candidatoParaAtrelar.origem_cadastro === 'processo'
    ) {
      return true;
    }

    const idTeste = String(candidatoParaAtrelar.id_teste || '').trim();
    if (!idTeste) {
      return false;
    }

    return candidatos.some(
      (item) =>
        item.origem_cadastro === 'processo' &&
        String(item.id_teste || '').trim() === idTeste &&
        String(item.id_processo_ref || '').trim() ===
          String(processoSelecionado || '').trim(),
    );
  };

  const confirmarAtrelar = async () => {
    if (!candidatoParaAtrelar || !processoSelecionado) {
      window.alert('Selecione um processo seletivo aberto.');
      return;
    }

    const processo = processosAbertos.find(
      (item) => obterReferenciaProcesso(item) === processoSelecionado,
    );
    if (!processo) {
      window.alert('Processo selecionado nao encontrado.');
      return;
    }

    if (candidatoJaVinculadoAoProcessoSelecionado()) {
      window.alert('Este candidato ja esta vinculado ao processo selecionado.');
      return;
    }

    const confirmar = window.confirm(
      `Deseja atrelar ${candidatoParaAtrelar.nome_candidato} ao processo ${processo.id_processo || 'selecionado'}?`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      if (candidatoParaAtrelar.origem_cadastro === 'banco') {
        await usarCandidatoDoBancoTalentos(candidatoParaAtrelar.id_banco, {
          id_processo: processo.id_processo || '',
          id_processo_ref: processoSelecionado,
        });
      } else {
        await criarCandidatoNoProcesso({
          id_processo: processo.id_processo || '',
          id_processo_ref: processoSelecionado,
          id_teste: candidatoParaAtrelar.id_teste || '',
          nome_candidato: candidatoParaAtrelar.nome_candidato || '',
          vaga: candidatoParaAtrelar.vaga || processo.vaga || '',
          status_candidato: CANDIDATE_STATUS_ANALYSIS,
          pontuacao_final:
            candidatoParaAtrelar.pontuacao_final ||
            candidatoParaAtrelar.nota_final ||
            '',
          data_prova:
            candidatoParaAtrelar.data_prova ||
            candidatoParaAtrelar.data_iso ||
            new Date().toISOString(),
          origem:
            candidatoParaAtrelar.origem_cadastro === 'historico'
              ? 'Historico'
              : 'Candidatos',
        });
      }

      setCandidatoParaAtrelar(null);
      setProcessoSelecionado('');
      setDetalhe(null);
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel atrelar o candidato ao processo.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-candidates"
      navAtiva="screen-candidates"
      subtituloMarca="Candidatos"
      placeholderBusca="Gestao centralizada de candidatos"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console | Candidatos"
        title="Central de candidatos"
        description="Atalho operacional para consultar candidatos, ver detalhes e executar acoes principais sem remover as funcoes existentes das outras telas."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Resumo geral"
        description="Visao consolidada dos candidatos encontrados no historico, processos seletivos e banco de talentos."
      >
        <${MetricGrid}
          items=${[
            { label: 'Total filtrado', value: resumo.total },
            { label: 'Aprovados', value: resumo.aprovados },
            { label: 'Eliminados', value: resumo.eliminados },
            { label: 'Em analise', value: resumo.analise },
            { label: 'Em processo', value: resumo.processo },
            { label: 'Banco de talentos', value: resumo.banco },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Filtros"
        description="Filtre a lista geral por nome, vaga, processo, status ou origem."
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Busca geral</label>
            <input
              class="form-control"
              placeholder="Nome, email, vaga, processo, status..."
              value=${filtros.busca}
              onInput=${(event) =>
                setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>

          <div class="rh-filter-field">
            <label>Status</label>
            <select
              class="form-select"
              value=${filtros.status}
              onChange=${(event) =>
                setFiltros({ ...filtros, status: event.target.value })}
            >
              <option value="">Todos</option>
              <option value="aprovado">Aprovados</option>
              <option value="eliminado">Eliminados</option>
              <option value="analise">Em analise</option>
              <option value="processo">Em processo</option>
              <option value="banco">Banco de talentos</option>
            </select>
          </div>

          <div class="rh-filter-field">
            <label>Origem</label>
            <select
              class="form-select"
              value=${filtros.origem}
              onChange=${(event) =>
                setFiltros({ ...filtros, origem: event.target.value })}
            >
              <option value="">Todas</option>
              <option value="processo">Processo seletivo</option>
              <option value="banco">Banco de talentos</option>
              <option value="historico">Historico de prova</option>
            </select>
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Lista geral de candidatos"
        description="As acoes desta tela sao atalhos. As telas antigas continuam funcionando normalmente."
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-primary"
            disabled=${carregando || salvando}
            onClick=${carregar}
          >
            Atualizar
          </button>
        `}
      >
        ${carregando
          ? html`
              <${EmptyState}
                title="Carregando candidatos"
                text="Aguarde enquanto o sistema consolida as informacoes."
              />
            `
          : html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Candidato</th>
                      <th>Contato</th>
                      <th>Vaga</th>
                      <th>Processo</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th>Origem</th>
                      <th>Data</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${candidatosFiltrados.length
                      ? candidatosFiltrados.map(
                          (candidato) => html`
                            <tr key=${candidato.chave}>
                              <td>
                                <strong>${candidato.nome_candidato || '-'}</strong>
                                <div class="text-muted small">
                                  ${candidato.id_teste || '-'}
                                </div>
                              </td>
                              <td>
                                <div>${candidato.email || '-'}</div>
                                <div class="text-muted small">
                                  ${candidato.telefone || candidato.whatsapp || '-'}
                                </div>
                              </td>
                              <td>${candidato.vaga || '-'}</td>
                              <td>
                                <div>${candidato.processo_nome || '-'}</div>
                                <div class="text-muted small">
                                  ${candidato.id_processo_ref || candidato.id_processo || '-'}
                                </div>
                              </td>
                              <td>
                                <div>${candidato.nota_exibicao || '-'}</div>
                                <div class="text-muted small">
                                  ${candidato.classificacao_exibicao || '-'}
                                </div>
                              </td>
                              <td>
                                <span
                                  class=${`rh-status-pill ${obterClasseStatusEntrevista(
                                    candidato.status_visivel,
                                  )}`}
                                >
                                  ${candidato.status_visivel || '-'}
                                </span>
                              </td>
                              <td>${candidato.origem_rotulo || '-'}</td>
                              <td>${formatarDataHora(candidato.data_exibicao)}</td>
                              <td class="text-end">
                                <div class="btn-group btn-group-sm">
                                  <button
                                    type="button"
                                    class="btn btn-outline-primary"
                                    title="Ver detalhes"
                                    onClick=${() => setDetalhe(candidato)}
                                  >
                                    Detalhes
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-outline-success"
                                    title="Aprovar"
                                    disabled=${salvando}
                                    onClick=${() =>
                                      aplicarStatus(
                                        candidato,
                                        CANDIDATE_STATUS_APPROVED,
                                      )}
                                  >
                                    Aprovar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-outline-danger"
                                    title="Eliminar"
                                    disabled=${salvando}
                                    onClick=${() =>
                                      aplicarStatus(
                                        candidato,
                                        CANDIDATE_STATUS_ELIMINATED,
                                      )}
                                  >
                                    Eliminar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-outline-warning"
                                    title="Banco de talentos"
                                    disabled=${salvando || candidato.origem_cadastro !== 'processo'}
                                    onClick=${() => enviarParaBanco(candidato)}
                                  >
                                    Banco
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-outline-secondary"
                                    title="Atrelar a processo"
                                    disabled=${salvando}
                                    onClick=${() => abrirAtrelar(candidato)}
                                  >
                                    Atrelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `,
                        )
                      : html`
                          <${TabelaVazia}
                            colunas=${9}
                            texto="Nenhum candidato encontrado."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!detalhe}
        titulo=${`Detalhes | ${detalhe?.nome_candidato || 'Candidato'}`}
        subtitulo="Resumo operacional consolidado deste candidato."
        onClose=${() => setDetalhe(null)}
      >
        ${detalhe
          ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
                    {
                      label: 'Candidato',
                      value: detalhe.nome_candidato || '-',
                    },
                    {
                      label: 'Vaga',
                      value: detalhe.vaga || '-',
                    },
                    {
                      label: 'Processo',
                      value: detalhe.processo_nome || '-',
                    },
                    {
                      label: 'Status',
                      value: detalhe.status_visivel || '-',
                    },
                    {
                      label: 'Email',
                      value: detalhe.email || '-',
                    },
                    {
                      label: 'Telefone',
                      value: detalhe.telefone || detalhe.whatsapp || '-',
                    },
                    {
                      label: 'Origem',
                      value: detalhe.origem_rotulo || '-',
                    },
                    {
                      label: 'Nota',
                      value: detalhe.nota_exibicao || '-',
                    },
                    {
                      label: 'Classificacao',
                      value: detalhe.classificacao_exibicao || '-',
                    },
                    {
                      label: 'ID da prova',
                      value: detalhe.id_teste || '-',
                    },
                    {
                      label: 'ID processo ref',
                      value: detalhe.id_processo_ref || detalhe.id_processo || '-',
                    },
                    {
                      label: 'Data',
                      value: formatarDataHora(detalhe.data_exibicao),
                    },
                  ]}
                />

                <${SectionCard}
                  title="Contexto complementar"
                  description="Informacoes de contato, entrevista e observacoes ja consolidadas no sistema."
                  className="rh-section-card--flat"
                >
                  <div class="row g-3">
                    <div class="col-md-6">
                      <div><strong>Contato principal:</strong> ${detalhe.contato_principal || '-'}</div>
                      <div><strong>Status entrevista:</strong> ${detalhe.status_entrevista || '-'}</div>
                      <div><strong>Data entrevista:</strong> ${formatarDataHora(detalhe.data_entrevista)}</div>
                    </div>
                    <div class="col-md-6">
                      <div><strong>Tags:</strong> ${(detalhe.tags || []).join(', ') || '-'}</div>
                      <div><strong>Habilidades:</strong> ${(detalhe.habilidades || []).join(', ') || '-'}</div>
                      <div><strong>Observacao RH:</strong> ${detalhe.observacao_rh || '-'}</div>
                    </div>
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Acoes rapidas"
                  description="As mesmas movimentacoes continuam disponiveis nas telas antigas. Esta pagina apenas centraliza atalhos."
                  className="rh-section-card--flat"
                >
                  <div class="rh-modal-footer-actions">
                    <button
                      type="button"
                      class="btn btn-outline-success"
                      disabled=${salvando}
                      onClick=${() =>
                        aplicarStatus(detalhe, CANDIDATE_STATUS_APPROVED)}
                    >
                      Aprovar
                    </button>

                    <button
                      type="button"
                      class="btn btn-outline-danger"
                      disabled=${salvando}
                      onClick=${() =>
                        aplicarStatus(detalhe, CANDIDATE_STATUS_ELIMINATED)}
                    >
                      Eliminar
                    </button>

                    <button
                      type="button"
                      class="btn btn-outline-warning"
                      disabled=${salvando || detalhe.origem_cadastro !== 'processo'}
                      onClick=${() => enviarParaBanco(detalhe)}
                    >
                      Banco de talentos
                    </button>

                    <button
                      type="button"
                      class="btn btn-outline-primary"
                      disabled=${salvando}
                      onClick=${() => abrirAtrelar(detalhe)}
                    >
                      Atrelar a processo
                    </button>
                  </div>
                </${SectionCard}>
              </div>

              <footer class="rh-modal-footer">
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

      <${ModalPadrao}
        aberto=${!!candidatoParaAtrelar}
        titulo=${`Atrelar candidato | ${
          candidatoParaAtrelar?.nome_candidato || 'Candidato'
        }`}
        subtitulo="Selecione um processo seletivo aberto para vincular este candidato."
        onClose=${() => {
          setCandidatoParaAtrelar(null);
          setProcessoSelecionado('');
        }}
      >
        <div class="rh-details-body">
          <${MetricGrid}
            items=${[
              {
                label: 'Candidato',
                value: candidatoParaAtrelar?.nome_candidato || '-',
              },
              {
                label: 'Vaga atual',
                value: candidatoParaAtrelar?.vaga || '-',
              },
              {
                label: 'Origem',
                value: candidatoParaAtrelar?.origem_rotulo || '-',
              },
            ]}
          />

          <div class="rh-filter-field">
            <label>Processo seletivo</label>
            <${SelectProcesso}
              processos=${processosAbertos}
              valor=${processoSelecionado}
              disabled=${salvando}
              onChange=${setProcessoSelecionado}
            />
          </div>
        </div>

        <footer class="rh-modal-footer">
          <div class="rh-modal-footer-actions">
            <button
              type="button"
              class="btn btn-outline-secondary"
              disabled=${salvando}
              onClick=${() => {
                setCandidatoParaAtrelar(null);
                setProcessoSelecionado('');
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              class="btn btn-primary"
              disabled=${salvando || !processoSelecionado}
              onClick=${confirmarAtrelar}
            >
              ${salvando ? 'Salvando...' : 'Confirmar vinculo'}
            </button>
          </div>
        </footer>
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
