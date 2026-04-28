import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  atualizarStatusCandidato,
  baixarCvCandidato,
  criarCandidatoNoProcesso,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerEntrevistas,
  lerHistorico,
  lerProcessos,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
} from '../../servico-api.js';
import { baixarBlob } from '../../utilitarios.js';
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
import { abrirBlobEmNovaGuia } from '../../shared/browser-utils.js';
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

function resolverRotuloOrigem(item, fallback) {
  return item?.origem || fallback;
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
    origem_rotulo: resolverRotuloOrigem(item, 'Processo seletivo'),
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
    cidade: item.cidade || '',
    bairro: item.bairro || '',
    cv_disponivel: !!item.cv_disponivel,
    cv_nome_arquivo: item.cv_nome_arquivo || '',
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
    origem_rotulo: resolverRotuloOrigem(item, 'Banco de talentos'),
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
    cidade: item.cidade || '',
    bairro: item.bairro || '',
    cv_disponivel: !!item.cv_disponivel,
    cv_nome_arquivo: item.cv_nome_arquivo || '',
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
    origem_rotulo: resolverRotuloOrigem(item, 'Historico de prova'),
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
    cidade: item.cidade || '',
    bairro: item.bairro || '',
    cv_disponivel: !!item.cv_disponivel,
    cv_nome_arquivo: item.cv_nome_arquivo || '',
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

function mesmoCandidato(item, candidato) {
  const idItem = String(item?.id_teste || '').trim();
  const idCandidato = String(candidato?.id_teste || '').trim();
  if (idItem && idCandidato && idItem === idCandidato) return true;

  const nomeItem = normalizarTexto(item?.nome_candidato || item?.nome || '');
  const nomeCandidato = normalizarTexto(candidato?.nome_candidato || '');
  return Boolean(nomeItem && nomeCandidato && nomeItem === nomeCandidato);
}

function obterDataEvento(item) {
  return (
    item?.data_entrevista ||
    item?.data_movimentacao ||
    item?.data_prova ||
    item?.data_iso ||
    item?.data_exibicao ||
    item?.data ||
    item?.criado_em ||
    item?.data_criacao ||
    ''
  );
}

function ordenarEventosDecrescente(a, b) {
  return String(obterDataEvento(b)).localeCompare(String(obterDataEvento(a)));
}

function montarDossieCandidato(candidato, fontes) {
  const processos = (fontes.candidatosProcessos || [])
    .filter((item) => mesmoCandidato(item, candidato))
    .sort(ordenarEventosDecrescente);
  const provas = (fontes.historico || [])
    .filter((item) => mesmoCandidato(item, candidato))
    .sort(ordenarEventosDecrescente);
  const entrevistas = (fontes.entrevistas || [])
    .filter((item) => mesmoCandidato(item, candidato))
    .sort(ordenarEventosDecrescente);
  const bancoTalentos = (fontes.bancoTalentos || [])
    .filter((item) => mesmoCandidato(item, candidato))
    .sort(ordenarEventosDecrescente);

  const alertas = [];
  if (!candidato.contato_principal) {
    alertas.push('Sem contato principal consolidado.');
  }
  if (!candidato.cv_disponivel) {
    alertas.push('Sem CV anexado ao cadastro consolidado.');
  }
  if (
    normalizarTexto(candidato.status_visivel) === 'qualificado' &&
    !entrevistas.length
  ) {
    alertas.push('Candidato qualificado ainda sem entrevista interna agendada.');
  }
  if (entrevistas.some((item) => normalizarTexto(item.status_entrevista) === 'faltou')) {
    alertas.push('Existe registro de falta em entrevista.');
  }
  if (!alertas.length) {
    alertas.push('Nenhum alerta critico encontrado.');
  }

  const historicoCompleto = [
    ...processos.map((item) => ({
      tipo: 'Processo',
      data: obterDataEvento(item),
      descricao: `${item.id_processo || '-'} | ${item.vaga || '-'} | ${item.status_candidato || '-'}`,
    })),
    ...provas.map((item) => ({
      tipo: 'Prova',
      data: obterDataEvento(item),
      descricao: `${item.vaga || '-'} | nota ${obterNotaCandidato(item)} | ${item.status || '-'}`,
    })),
    ...entrevistas.map((item) => ({
      tipo: 'Entrevista',
      data: obterDataEvento(item),
      descricao: `${item.id_processo || '-'} | ${item.status_entrevista || '-'} | ${item.observacoes_rh || 'Sem observacoes.'}`,
    })),
    ...bancoTalentos.map((item) => ({
      tipo: 'Banco de talentos',
      data: obterDataEvento(item),
      descricao: `${item.vaga || '-'} | ${item.origem || '-'}`,
    })),
  ].sort(ordenarEventosDecrescente);

  return {
    processos,
    provas,
    entrevistas,
    bancoTalentos,
    alertas,
    historicoCompleto,
  };
}

function escaparHtml(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderizarLinhasFicha(itens, colunas) {
  if (!itens.length) {
    return `<tr><td colspan="${colunas.length}">Sem registros.</td></tr>`;
  }

  return itens
    .map(
      (item) => `
        <tr>
          ${colunas
            .map((coluna) => `<td>${escaparHtml(coluna.valor(item))}</td>`)
            .join('')}
        </tr>
      `,
    )
    .join('');
}

function abrirFichaImpressao(candidato, dossie) {
  const janela = window.open('', '_blank');
  if (!janela) {
    window.alert('Nao foi possivel abrir a ficha para impressao.');
    return;
  }
  const ficha = dossie || {
    alertas: [],
    processos: [],
    provas: [],
    entrevistas: [],
    historicoCompleto: [],
  };

  const htmlFicha = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Ficha do candidato</title>
        <style>
          body { font-family: Arial, sans-serif; color: #172033; margin: 32px; }
          h1 { font-size: 24px; margin: 0 0 6px; }
          h2 { font-size: 15px; margin: 22px 0 8px; border-bottom: 1px solid #d8dee9; padding-bottom: 4px; }
          p { margin: 3px 0; }
          table { border-collapse: collapse; width: 100%; margin-top: 8px; }
          th, td { border: 1px solid #d8dee9; padding: 7px; font-size: 12px; vertical-align: top; }
          th { background: #f5f7fb; text-align: left; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin-top: 14px; }
          .alerta { background: #fff7e6; border: 1px solid #f2c46d; padding: 8px; margin: 4px 0; }
          @media print { body { margin: 16mm; } button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir ficha</button>
        <h1>${escaparHtml(candidato.nome_candidato || 'Candidato')}</h1>
        <p>Ficha consolidada do candidato</p>
        <div class="grid">
          <p><strong>Status:</strong> ${escaparHtml(candidato.status_visivel || '-')}</p>
          <p><strong>Processo:</strong> ${escaparHtml(candidato.processo_nome || '-')}</p>
          <p><strong>Vaga:</strong> ${escaparHtml(candidato.vaga || '-')}</p>
          <p><strong>Nota/score:</strong> ${escaparHtml(candidato.nota_exibicao || '-')}</p>
          <p><strong>Classificacao:</strong> ${escaparHtml(candidato.classificacao_exibicao || '-')}</p>
          <p><strong>Email:</strong> ${escaparHtml(candidato.email || '-')}</p>
          <p><strong>Telefone:</strong> ${escaparHtml(candidato.telefone || candidato.whatsapp || '-')}</p>
          <p><strong>CV:</strong> ${escaparHtml(candidato.cv_nome_arquivo || 'Sem CV anexado')}</p>
        </div>

        <h2>Alertas</h2>
        ${ficha.alertas.map((alerta) => `<div class="alerta">${escaparHtml(alerta)}</div>`).join('')}

        <h2>Processos</h2>
        <table>
          <thead><tr><th>Processo</th><th>Vaga</th><th>Status</th><th>Score</th><th>Data</th></tr></thead>
          <tbody>
            ${renderizarLinhasFicha(ficha.processos, [
              { valor: (item) => item.id_processo || '-' },
              { valor: (item) => item.vaga || '-' },
              { valor: (item) => item.status_candidato || '-' },
              { valor: (item) => obterNotaCandidato(item) },
              { valor: (item) => formatarDataHora(obterDataEvento(item)) },
            ])}
          </tbody>
        </table>

        <h2>Provas</h2>
        <table>
          <thead><tr><th>ID</th><th>Vaga</th><th>Nota</th><th>Etapas</th><th>Data</th></tr></thead>
          <tbody>
            ${renderizarLinhasFicha(ficha.provas, [
              { valor: (item) => item.id_teste || '-' },
              { valor: (item) => item.vaga || '-' },
              { valor: (item) => obterNotaCandidato(item) },
              { valor: (item) => item.etapas_json || item.pontuacao_bruta || '-' },
              { valor: (item) => formatarDataHora(obterDataEvento(item)) },
            ])}
          </tbody>
        </table>

        <h2>Entrevistas</h2>
        <table>
          <thead><tr><th>Data</th><th>Status</th><th>Processo</th><th>Observacoes</th></tr></thead>
          <tbody>
            ${renderizarLinhasFicha(ficha.entrevistas, [
              { valor: (item) => formatarDataHora(item.data_entrevista) },
              { valor: (item) => item.status_entrevista || '-' },
              { valor: (item) => item.id_processo || '-' },
              { valor: (item) => item.observacoes_rh || '-' },
            ])}
          </tbody>
        </table>

        <h2>Historico completo</h2>
        <table>
          <thead><tr><th>Tipo</th><th>Data</th><th>Descricao</th></tr></thead>
          <tbody>
            ${renderizarLinhasFicha(ficha.historicoCompleto, [
              { valor: (item) => item.tipo },
              { valor: (item) => formatarDataHora(item.data) },
              { valor: (item) => item.descricao },
            ])}
          </tbody>
        </table>
      </body>
    </html>
  `;

  janela.document.open();
  janela.document.write(htmlFicha);
  janela.document.close();
  janela.focus();
}

export function TelaCandidatos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [candidatos, setCandidatos] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [fontesDossie, setFontesDossie] = useState({
    historico: [],
    candidatosProcessos: [],
    bancoTalentos: [],
    entrevistas: [],
  });
  const [filtros, setFiltros] = useState({
    busca: '',
    status: '',
    origem: '',
  });
  const [detalhe, setDetalhe] = useState(null);
  const [candidatoParaAtrelar, setCandidatoParaAtrelar] = useState(null);
  const [processoSelecionado, setProcessoSelecionado] = useState('');

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      window.alert('Nao ha curriculo disponivel para este candidato.');
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
        error?.message || 'Nao foi possivel abrir o curriculo do candidato.',
      );
    }
  };

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const resultados = await Promise.allSettled([
        lerHistorico(),
        lerCandidatosProcessos(true),
        lerBancoTalentos({ forcar: true }),
        lerProcessos(true),
        lerEntrevistas(),
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
      const entrevistas =
        resultados[4].status === 'fulfilled' && Array.isArray(resultados[4].value)
          ? resultados[4].value
          : [];

      const falhas = resultados
        .filter((item) => item.status === 'rejected')
        .map((item) => item.reason);

      if (
        falhas.length &&
        !historico.length &&
        !candidatosProcessos.length &&
        !bancoTalentos.length &&
        !processos.length &&
        !entrevistas.length
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
      setFontesDossie({
        historico,
        candidatosProcessos,
        bancoTalentos,
        entrevistas,
      });
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel carregar a pagina de candidatos.',
      );
      setCandidatos([]);
      setProcessosAbertos([]);
      setFontesDossie({
        historico: [],
        candidatosProcessos: [],
        bancoTalentos: [],
        entrevistas: [],
      });
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
          candidato.cidade,
          candidato.bairro,
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
  const dossieDetalhe = useMemo(
    () => (detalhe ? montarDossieCandidato(detalhe, fontesDossie) : null),
    [detalhe, fontesDossie],
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
        description="Dossie completo com dados pessoais, CV, provas, score, classificacao, entrevistas, alertas e historico."
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
                      <th>Cidade</th>
                      <th>Bairro</th>
                      <th>Vaga</th>
                      <th>Processo</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th>Origem</th>
                      <th>Data</th>
                      <th>CV</th>
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
                              <td>${candidato.cidade || '-'}</td>
                              <td>${candidato.bairro || '-'}</td>
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
                              <td>
                                ${candidato.cv_disponivel
                                  ? html`
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary"
                                        onClick=${() => abrirCurriculo(candidato)}
                                      >
                                        Ver CV
                                      </button>
                                    `
                                  : 'Sem CV'}
                              </td>
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
                            colunas=${12}
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
                      label: 'Cidade',
                      value: detalhe.cidade || '-',
                    },
                    {
                      label: 'Bairro',
                      value: detalhe.bairro || '-',
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
                      <div><strong>Curriculo:</strong> ${detalhe.cv_nome_arquivo || 'Sem arquivo anexado.'}</div>
                    </div>
                    <div class="col-md-6">
                      <div><strong>Tags:</strong> ${(detalhe.tags || []).join(', ') || '-'}</div>
                      <div><strong>Habilidades:</strong> ${(detalhe.habilidades || []).join(', ') || '-'}</div>
                      <div><strong>Observacao RH:</strong> ${detalhe.observacao_rh || '-'}</div>
                    </div>
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Curriculo"
                  description="CV, score, classificacao e leitura operacional consolidada."
                  className="rh-section-card--flat"
                >
                  <div class="row g-3 mb-3">
                    <div class="col-md-4">
                      <strong>Score:</strong> ${detalhe.nota_exibicao || '-'}
                    </div>
                    <div class="col-md-4">
                      <strong>Classificacao:</strong> ${detalhe.classificacao_exibicao || '-'}
                    </div>
                    <div class="col-md-4">
                      <strong>Arquivo:</strong> ${detalhe.cv_nome_arquivo || 'Sem CV anexado.'}
                    </div>
                  </div>
                  <div class="rh-modal-footer-actions">
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      disabled=${!detalhe.cv_disponivel}
                      onClick=${() => abrirCurriculo(detalhe)}
                    >
                      ${detalhe.cv_disponivel ? 'Visualizar ou baixar CV' : 'CV indisponivel'}
                    </button>
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Alertas"
                  description="Pontos que o RH deve verificar antes da decisao."
                  className="rh-section-card--flat"
                >
                  <div class="rh-cell-stack">
                    ${(dossieDetalhe?.alertas || []).map(
                      (alerta) => html`<span key=${alerta}>${alerta}</span>`,
                    )}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Processos"
                  description="Participacoes do candidato em processos seletivos."
                  className="rh-section-card--flat"
                >
                  <div class="table-responsive">
                    <table class="table align-middle rh-modern-history-table">
                      <thead>
                        <tr>
                          <th>Processo</th>
                          <th>Vaga</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${dossieDetalhe?.processos?.length
                          ? dossieDetalhe.processos.map(
                              (item) => html`
                                <tr key=${`${item.id_registro || item.id_teste || item.id_processo}-${obterDataEvento(item)}`}>
                                  <td>${item.id_processo || '-'}</td>
                                  <td>${item.vaga || '-'}</td>
                                  <td>${item.status_candidato || '-'}</td>
                                  <td>${obterNotaCandidato(item)}</td>
                                  <td>${formatarDataHora(obterDataEvento(item))}</td>
                                </tr>
                              `,
                            )
                          : html`<${TabelaVazia} colunas=${5} texto="Sem processos vinculados." />`}
                      </tbody>
                    </table>
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Provas"
                  description="Notas, etapas e historico de provas encontradas."
                  className="rh-section-card--flat"
                >
                  <div class="table-responsive">
                    <table class="table align-middle rh-modern-history-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Vaga</th>
                          <th>Nota</th>
                          <th>Etapas</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${dossieDetalhe?.provas?.length
                          ? dossieDetalhe.provas.map(
                              (item) => html`
                                <tr key=${`${item.id_teste || item.nome_candidato}-${obterDataEvento(item)}`}>
                                  <td>${item.id_teste || '-'}</td>
                                  <td>${item.vaga || '-'}</td>
                                  <td>${obterNotaCandidato(item)}</td>
                                  <td>${item.etapas_json || item.pontuacao_bruta || '-'}</td>
                                  <td>${formatarDataHora(obterDataEvento(item))}</td>
                                </tr>
                              `,
                            )
                          : html`<${TabelaVazia} colunas=${5} texto="Sem provas encontradas." />`}
                      </tbody>
                    </table>
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Entrevistas"
                  description="Agenda interna, status e observacoes."
                  className="rh-section-card--flat"
                >
                  <div class="table-responsive">
                    <table class="table align-middle rh-modern-history-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Status</th>
                          <th>Processo</th>
                          <th>Agenda</th>
                          <th>Observacoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${dossieDetalhe?.entrevistas?.length
                          ? dossieDetalhe.entrevistas.map(
                              (item) => html`
                                <tr key=${item.id_entrevista}>
                                  <td>${formatarDataHora(item.data_entrevista)}</td>
                                  <td>${item.status_entrevista || '-'}</td>
                                  <td>${item.id_processo || '-'}</td>
                                  <td>${item.id_slot ? 'Calendario interno' : 'Registro legado'}</td>
                                  <td>${item.observacoes_rh || '-'}</td>
                                </tr>
                              `,
                            )
                          : html`<${TabelaVazia} colunas=${5} texto="Sem entrevistas encontradas." />`}
                      </tbody>
                    </table>
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Historico completo"
                  description="Linha do tempo consolidada de processos, provas, entrevistas e banco de talentos."
                  className="rh-section-card--flat"
                >
                  <div class="table-responsive">
                    <table class="table align-middle rh-modern-history-table">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Data</th>
                          <th>Descricao</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${dossieDetalhe?.historicoCompleto?.length
                          ? dossieDetalhe.historicoCompleto.map(
                              (item) => html`
                                <tr key=${`${item.tipo}-${item.data}-${item.descricao}`}>
                                  <td>${item.tipo}</td>
                                  <td>${formatarDataHora(item.data)}</td>
                                  <td>${item.descricao}</td>
                                </tr>
                              `,
                            )
                          : html`<${TabelaVazia} colunas=${3} texto="Sem historico consolidado." />`}
                      </tbody>
                    </table>
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
                  class="btn btn-outline-primary"
                  onClick=${() => abrirFichaImpressao(detalhe, dossieDetalhe)}
                >
                  Baixar ficha do candidato
                </button>
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
