import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  TAMANHO_DETALHE_PROCESSO,
  agendarEntrevista,
  adicionarPreAnaliseAoProcesso,
  analisarCvCandidatoInscrito,
  analisarCvEmailRecebido,
  atualizarAnotacaoDossieProcesso,
  atualizarEntrevista,
  atualizarFichaCandidato,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  analisarCvProcesso,
  baixarPacoteHistorico,
  baixarCvCandidato,
  carregarDetalhesProva,
  criarAnotacaoDossieProcesso,
  desativarLinkPublicoCandidatura,
  encerrarProcesso,
  excluirPreAnaliseCv,
  enviarPreAnaliseParaBancoTalentos,
  enviarEmailAprovacao,
  gerarLinkPublicoCandidatura,
  lerEmailsRecebidosProcesso,
  lerAnotacoesDossieProcesso,
  lerCandidatosProcessos,
  lerDetalheProcesso,
  lerEntrevistas,
  lerFichaCandidato,
  lerPreAnalisesCv,
  lerProcessos,
  lerSlotsEntrevista,
  limparListaPreAnalisesCv,
  registrarWhatsappAprovacao,
  registrarWhatsappContatoManual,
} from '../../app/controlador-aplicacao.js';
import {
  baixarBlob,
  formatarDataParaInput,
  obterItensPaginados,
} from '../../utilitarios.js';
import {
  formatarDataHora,
  montarResumoAnaliticoCv,
  obterClasseStatusEntrevista,
  obterClasseStatusProcesso,
} from '../../shared/helpers-visuais.js';
import {
  abrirBlobEmNovaGuia,
  copiarTexto,
  montarUrlPublicaCandidatura,
  obterBasePublicaCandidatura,
  toDatetimeLocal,
} from '../../shared/browser-utils.js';
import { AcaoSair } from '../../shared/components/actions.js';
import {
  DOCUMENTOS_APROVACAO_PADRAO,
  ModalAprovacaoCandidato,
  atualizarDocumentosNaMensagem,
} from '../../shared/components/approval-modal.js';
import {
  ModalEdicaoEntrevista,
} from '../../shared/components/interview-edit-modal.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  CANDIDATE_STATUS_APPROVED,
  CANDIDATE_STATUS_ANALYSIS,
  CANDIDATE_STATUS_ELIMINATED,
  CANDIDATE_STATUS_PENDING_CONFIRMATION,
  CANDIDATE_STATUS_TALENT_BANK,
  canonicalizeCandidateStatus,
  getCandidateActionState,
  isActiveCandidateStatus,
  isProcessClosed,
} from '../../shared/process-flow.js';
import {
  validarFormularioEntrevista,
  validarFormularioProcesso,
} from '../../shared/validacoes.js';
import {
  encontrarProcessoPorReferencia,
  obterChaveProcesso,
  obterReferenciaProcesso,
  obterReferenciaProcessoDoCandidato,
} from '../../shared/process-reference.js';
import { CHAVE_PROCESSO_DETALHE } from './state.js';
import { gerarAnaliseInteligenteProcesso } from '../../services/process-dossier-ai.js';
import { CabecalhoSecaoColapsavel } from './components/section-toggle.js';
import {
  LoadingState,
  MetricGrid,
  ModalDetalhesProva,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';

const MENSAGEM_CANDIDATO_APROVADO_BLOQUEADO =
  'Este candidato já foi aprovado. Para alterar sua situação, será necessário um novo cadastro ou atualização manual.';
const AVISO_URL_PUBLICA_NAO_CONFIGURADA =
  'URL pública ainda não configurada. Defina PUBLIC_CANDIDATE_BASE_URL no servidor para liberar inscrições externas.';
const EXIBIR_PAGINA_PUBLICA_CANDIDATURA = false;
const EXIBIR_CANDIDATOS_INSCRITOS = false;
const TAMANHO_PAGINA_CANDIDATOS_DETALHE = 4;
const TAMANHO_PAGINA_APROVADOS_DETALHE = 4;
const TAMANHO_PAGINA_PRE_ANALISE_DETALHE = 5;
const MOTIVOS_ELIMINACAO = [
  'Eliminado pela nota de corte',
  'Eliminado na entrevista',
  'Candidato não compareceu',
  'Optou por não prosseguir',
];
const ETAPAS_ELIMINACAO_ENTREVISTA = [
  'Com o Gestor do RH',
  'Com Supervisor',
  'Com Gestor da Área',
];
const REQUISITOS_PUBLICOS_PADRAO = [
  'Ensino médio completo ou formação compatível com a vaga.',
  'Experiência anterior em atividades relacionadas será considerada um diferencial.',
  'Boa comunicação verbal e escrita.',
  'Organização, responsabilidade e postura profissional.',
  'Facilidade para aprender sistemas, processos internos e rotinas operacionais.',
  'Disponibilidade para cumprir a jornada e os horários definidos pelo RH.',
];
const RESPONSABILIDADES_PUBLICAS_PADRAO = [
  'Executar as atividades da função conforme orientação da liderança.',
  'Atender demandas internas e externas com cordialidade, clareza e agilidade.',
  'Registrar informações de forma correta nos sistemas e controles definidos.',
  'Cumprir procedimentos, prazos, políticas internas e orientações do processo.',
  'Apoiar a equipe na manutenção da qualidade e continuidade das operações.',
];
const CLASSIFICACOES_FICHA_CANDIDATO = [
  'Indicado',
  'Indicado com restrições',
  'Contraindicado',
];

function formatarValorFicha(valor, fallback = 'Não informado') {
  const texto = String(valor ?? '').trim();
  return texto || fallback;
}

function escaparHtmlFicha(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function montarFormularioFichaCandidato(ficha) {
  const candidato = ficha?.candidato || {};
  const avaliacao = ficha?.avaliacao_rh || {};

  return {
    nome_candidato: candidato.nome_candidato || '',
    email: candidato.email || '',
    telefone: candidato.telefone || '',
    whatsapp: candidato.whatsapp || '',
    cidade: candidato.cidade || '',
    bairro: candidato.bairro || '',
    observacao_rh: avaliacao.observacoes || '',
    classificacao: avaliacao.classificacao || '',
    justificativa: avaliacao.justificativa || '',
  };
}

function montarFichaParaImpressao(ficha, formulario) {
  const dadosFormulario = formulario || montarFormularioFichaCandidato(ficha);
  const classificacao = dadosFormulario.classificacao || '';

  return {
    ...(ficha || {}),
    candidato: {
      ...(ficha?.candidato || {}),
      nome_candidato: dadosFormulario.nome_candidato,
      email: dadosFormulario.email,
      telefone: dadosFormulario.telefone,
      whatsapp: dadosFormulario.whatsapp,
      cidade: dadosFormulario.cidade,
      bairro: dadosFormulario.bairro,
    },
    avaliacao_rh: {
      ...(ficha?.avaliacao_rh || {}),
      observacoes: dadosFormulario.observacao_rh,
      classificacao,
      classificacao_label: classificacao || 'Não definido',
      justificativa: dadosFormulario.justificativa,
    },
  };
}

function montarLinhasTabelaImpressao(itens, colunas, textoVazio) {
  if (!itens?.length) {
    return `
      <tr>
        <td colspan="${colunas.length}" class="muted">${escaparHtmlFicha(textoVazio)}</td>
      </tr>
    `;
  }

  return itens.map((item) => `
    <tr>
      ${colunas.map((coluna) => `
        <td>${escaparHtmlFicha(coluna.valor(item))}</td>
      `).join('')}
    </tr>
  `).join('');
}

function imprimirFichaCandidato(ficha, formulario) {
  const fichaImpressao = montarFichaParaImpressao(ficha, formulario);
  const candidato = fichaImpressao.candidato || {};
  const curriculo = candidato.curriculo || {};
  const avaliacao = fichaImpressao.avaliacao_rh || {};
  const processos = Array.isArray(fichaImpressao.processos)
    ? fichaImpressao.processos
    : [];
  const resultados = Array.isArray(fichaImpressao.resultados)
    ? fichaImpressao.resultados
    : [];
  const nome = formatarValorFicha(candidato.nome_candidato, 'Candidato');
  const dataGeracao = formatarDataHora(new Date().toISOString());
  const janela = window.open('', '_blank');

  if (!janela) {
    throw new Error('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.');
  }

  const htmlImpressao = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Ficha Geral - ${escaparHtmlFicha(nome)}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #172033;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.45;
          }
          .toolbar {
            display: flex;
            justify-content: flex-end;
            margin: 0 0 16px;
          }
          .toolbar button {
            border: 1px solid #1b5fc1;
            border-radius: 6px;
            background: #1b5fc1;
            color: #fff;
            padding: 8px 14px;
            font-weight: 700;
            cursor: pointer;
          }
          header {
            border-bottom: 2px solid #1b5fc1;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          h1 {
            margin: 0 0 4px;
            font-size: 24px;
          }
          h2 {
            margin: 18px 0 8px;
            font-size: 15px;
            color: #1b5fc1;
          }
          .muted { color: #627085; }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 18px;
          }
          .field strong {
            display: block;
            font-size: 10px;
            color: #627085;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
          }
          th, td {
            border: 1px solid #d8e0ec;
            padding: 7px;
            vertical-align: top;
            text-align: left;
          }
          th {
            background: #edf3fb;
            color: #172033;
          }
          .text-block {
            min-height: 38px;
            border: 1px solid #d8e0ec;
            border-radius: 6px;
            padding: 8px;
            white-space: pre-wrap;
          }
          @media print {
            .toolbar { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button type="button" onclick="window.print()">Imprimir / salvar PDF</button>
        </div>
        <header>
          <h1>Ficha Geral do Candidato</h1>
          <div class="muted">Gerada em ${escaparHtmlFicha(dataGeracao)}</div>
        </header>

        <h2>Dados do candidato</h2>
        <section class="grid">
          <div class="field"><strong>Nome</strong>${escaparHtmlFicha(formatarValorFicha(candidato.nome_candidato))}</div>
          <div class="field"><strong>E-mail</strong>${escaparHtmlFicha(formatarValorFicha(candidato.email))}</div>
          <div class="field"><strong>Telefone</strong>${escaparHtmlFicha(formatarValorFicha(candidato.telefone))}</div>
          <div class="field"><strong>WhatsApp</strong>${escaparHtmlFicha(formatarValorFicha(candidato.whatsapp))}</div>
          <div class="field"><strong>Cidade</strong>${escaparHtmlFicha(formatarValorFicha(candidato.cidade))}</div>
          <div class="field"><strong>Bairro</strong>${escaparHtmlFicha(formatarValorFicha(candidato.bairro))}</div>
        </section>

        <h2>Currículo</h2>
        <section class="grid">
          <div class="field"><strong>Arquivo</strong>${escaparHtmlFicha(formatarValorFicha(curriculo.nome_arquivo))}</div>
          <div class="field"><strong>Status</strong>${escaparHtmlFicha(formatarValorFicha(curriculo.status))}</div>
          <div class="field"><strong>Nota do currículo</strong>${escaparHtmlFicha(formatarValorFicha(candidato.nota_curriculo))}</div>
          <div class="field"><strong>Disponível para download</strong>${curriculo.disponivel ? 'Sim' : 'Não'}</div>
        </section>

        <h2>Processos seletivos</h2>
        <table>
          <thead>
            <tr>
              <th>Vaga/processo</th>
              <th>Status</th>
              <th>Etapa</th>
              <th>Data</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            ${montarLinhasTabelaImpressao(
              processos,
              [
                { valor: (item) => formatarValorFicha(item.vaga) },
                { valor: (item) => formatarValorFicha(item.status) },
                { valor: (item) => formatarValorFicha(item.etapa) },
                { valor: (item) => formatarDataHora(item.data_inscricao) },
                { valor: (item) => formatarValorFicha(item.resultado_geral) },
              ],
              'Nenhum processo registrado.',
            )}
          </tbody>
        </table>

        <h2>Resultados resumidos</h2>
        <table>
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Pontuação</th>
              <th>Status</th>
              <th>Processo</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            ${montarLinhasTabelaImpressao(
              resultados,
              [
                { valor: (item) => formatarValorFicha(item.etapa) },
                { valor: (item) => formatarValorFicha(item.pontuacao) },
                { valor: (item) => formatarValorFicha(item.status) },
                { valor: (item) => formatarValorFicha(item.processo) },
                { valor: (item) => formatarDataHora(item.data) },
              ],
              'Nenhum resultado registrado.',
            )}
          </tbody>
        </table>

        <h2>Avaliação RH</h2>
        <section class="grid">
          <div class="field"><strong>Classificação</strong>${escaparHtmlFicha(avaliacao.classificacao_label || 'Não definido')}</div>
          <div class="field"><strong>Data de geração</strong>${escaparHtmlFicha(dataGeracao)}</div>
        </section>
        <h2>Observações do candidato</h2>
        <div class="text-block">${escaparHtmlFicha(formatarValorFicha(avaliacao.observacoes))}</div>
        <h2>Justificativa</h2>
        <div class="text-block">${escaparHtmlFicha(formatarValorFicha(avaliacao.justificativa))}</div>
        <script>
          window.addEventListener('load', function () {
            window.setTimeout(function () { window.print(); }, 200);
          });
        </script>
      </body>
    </html>
  `;

  janela.document.open();
  janela.document.write(htmlImpressao);
  janela.document.close();
}

function normalizarTextoComparacao(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function obterNotaProvaCandidato(candidato) {
  return (
    candidato?.nota_prova ||
    candidato?.pontuacao_final ||
    candidato?.nota_final ||
    candidato?.nota_exibicao ||
    ''
  );
}

function converterNumeroDossie(valor) {
  const texto = String(valor ?? '').replace(',', '.').trim();
  if (!texto || texto === '-') return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function formatarNumeroDossie(valor, fallback = '-') {
  const numero = converterNumeroDossie(valor);
  return numero === null ? fallback : numero.toFixed(1).replace('.', ',');
}

function obterScoreCvCandidato(candidato) {
  return (
    candidato?.cv_score_final ||
    candidato?.score_curriculo ||
    candidato?.nota_curriculo ||
    candidato?.score_cv ||
    ''
  );
}

function obterStatusDossie(candidato) {
  return (
    candidato?.status_fluxo ||
    candidato?.status_candidato ||
    candidato?.status ||
    'Não informado'
  );
}

function obterEtapaDossie(candidato, entrevistas = []) {
  const idTeste = String(candidato?.id_teste || '').trim();
  const idRegistro = String(candidato?.id_registro || '').trim();
  const entrevista = entrevistas.find((item) => {
    const mesmoTeste =
      idTeste && String(item?.id_teste || '').trim() === idTeste;
    const mesmoRegistro =
      idRegistro && String(item?.id_registro || '').trim() === idRegistro;
    return mesmoTeste || mesmoRegistro;
  });

  if (entrevista?.status_entrevista) return entrevista.status_entrevista;
  return candidato?.etapa_pipeline || obterStatusDossie(candidato);
}

function montarCandidatosDossie(candidatos = [], entrevistas = []) {
  return candidatos.map((candidato) => {
    const notaProva = converterNumeroDossie(obterNotaProvaCandidato(candidato));
    const scoreCv = converterNumeroDossie(obterScoreCvCandidato(candidato));
    const mediaBase = [notaProva, scoreCv].filter((valor) => valor !== null);
    const mediaGeral = mediaBase.length
      ? mediaBase.reduce((soma, valor) => soma + valor, 0) / mediaBase.length
      : null;

    return {
      id: String(candidato.id_registro || candidato.id_teste || ''),
      id_teste: candidato.id_teste || '',
      nome: candidato.nome_candidato || 'Candidato sem nome',
      processo:
        candidato.id_processo_ref ||
        candidato.id_processo ||
        candidato.vaga ||
        '',
      vaga: candidato.vaga || '',
      data:
        candidato.data_prova ||
        candidato.data_atualizacao_pipeline ||
        candidato.aprovado_em ||
        candidato.eliminado_em ||
        '',
      etapa: obterEtapaDossie(candidato, entrevistas),
      classificacao:
        candidato.cv_classificacao ||
        candidato.classificacao ||
        obterStatusDossie(candidato),
      status: obterStatusDossie(candidato),
      notaProva,
      scoreCv,
      mediaGeral,
      email: candidato.email || '',
      whatsapp: candidato.whatsapp || candidato.telefone || '',
      origem: formatarOrigemCandidato(candidato),
      raw: candidato,
    };
  });
}

function filtrarCandidatosDossie(candidatos = [], filtros = {}) {
  const processo = normalizarTextoComparacao(filtros.processo);
  const candidato = normalizarTextoComparacao(filtros.candidato);
  const etapa = normalizarTextoComparacao(filtros.etapa);
  const classificacao = normalizarTextoComparacao(filtros.classificacao);
  const status = normalizarTextoComparacao(filtros.status);
  const dataFiltro = String(filtros.data || '').trim();
  const notaMin = converterNumeroDossie(filtros.notaMin);
  const notaMax = converterNumeroDossie(filtros.notaMax);
  const scoreMin = converterNumeroDossie(filtros.scoreMin);
  const scoreMax = converterNumeroDossie(filtros.scoreMax);

  return candidatos.filter((item) => {
    const textoProcesso = normalizarTextoComparacao([item.processo, item.vaga].join(' '));
    const textoCandidato = normalizarTextoComparacao([item.nome, item.email, item.whatsapp].join(' '));
    const textoEtapa = normalizarTextoComparacao(item.etapa);
    const textoClassificacao = normalizarTextoComparacao(item.classificacao);
    const textoStatus = normalizarTextoComparacao(item.status);
    const dataItem = item.data ? formatarIsoDataLocal(item.data) : '';

    if (processo && !textoProcesso.includes(processo)) return false;
    if (candidato && !textoCandidato.includes(candidato)) return false;
    if (etapa && !textoEtapa.includes(etapa)) return false;
    if (classificacao && !textoClassificacao.includes(classificacao)) return false;
    if (status && !textoStatus.includes(status)) return false;
    if (dataFiltro && dataItem !== dataFiltro) return false;
    if (notaMin !== null && (item.notaProva === null || item.notaProva < notaMin)) return false;
    if (notaMax !== null && (item.notaProva === null || item.notaProva > notaMax)) return false;
    if (scoreMin !== null && (item.scoreCv === null || item.scoreCv < scoreMin)) return false;
    if (scoreMax !== null && (item.scoreCv === null || item.scoreCv > scoreMax)) return false;
    return true;
  });
}

function calcularEstatisticasDossie(candidatos = []) {
  const media = (valores) => {
    const validos = valores.filter((valor) => valor !== null);
    if (!validos.length) return null;
    return validos.reduce((soma, valor) => soma + valor, 0) / validos.length;
  };

  return {
    total: candidatos.length,
    avaliados: candidatos.filter(
      (item) => item.notaProva !== null || item.scoreCv !== null,
    ).length,
    mediaProva: media(candidatos.map((item) => item.notaProva)),
    mediaCv: media(candidatos.map((item) => item.scoreCv)),
    mediaGeral: media(candidatos.map((item) => item.mediaGeral)),
  };
}

function formatarOrigemCandidato(candidato) {
  const rotulo = String(candidato?.origem_rotulo || '').trim();
  if (rotulo) return rotulo;

  const origem = normalizarTextoComparacao(candidato?.origem);
  if (!origem) return 'Processo Único';
  if (origem.includes('pagina') && (origem.includes('candidatura') || origem.includes('inscricao'))) {
    return 'Página de inscrição';
  }
  if (origem.includes('pre analise') || origem.includes('pre-analise') || origem.includes('analise direta')) {
    return 'Análise direta do CV';
  }
  if (origem.includes('banco') && origem.includes('talento')) return 'Banco de Talentos';
  if (origem.includes('recebimento') && origem.includes('email')) return 'Recebimento de e-mail';
  if (origem.includes('processo unico') || origem.includes('processo_unico') || origem === 'prova') {
    return 'Processo Único';
  }
  return String(candidato?.origem || '-').trim() || '-';
}

function formatarDataCurta(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '-';
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto;
  return data.toLocaleDateString('pt-BR');
}

function formatarHoraCurta(valor) {
  const data = new Date(String(valor || '').trim());
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function criarDataLocalProcesso(valor) {
  if (valor instanceof Date) return new Date(valor);
  const texto = String(valor || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
  }
  const data = texto ? new Date(texto) : new Date();
  return Number.isNaN(data.getTime()) ? new Date() : data;
}

function formatarIsoDataLocal(valor) {
  const data = criarDataLocalProcesso(valor);
  if (Number.isNaN(data.getTime())) return '';
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function moverIsoDataLocal(valor, deslocamento) {
  const data = criarDataLocalProcesso(valor);
  data.setDate(data.getDate() + deslocamento);
  return formatarIsoDataLocal(data);
}

function gerarFaixaDiasCalendario(dataBase = new Date(), dataSelecionada = '') {
  const base = criarDataLocalProcesso(dataBase);
  if (Number.isNaN(base.getTime())) return [];
  const selecionada = dataSelecionada || formatarIsoDataLocal(base);

  return [-2, -1, 0, 1, 2].map((deslocamento) => {
    const data = new Date(base);
    data.setDate(base.getDate() + deslocamento);
    const chave = formatarIsoDataLocal(data);
    return {
      chave,
      mes: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
      dia: data.toLocaleDateString('pt-BR', { day: '2-digit' }),
      semana: data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
      selecionado: chave === selecionada,
    };
  });
}

function obterValorDataHoraSlot(slot, campos) {
  const campoEncontrado = campos.find((campo) => String(slot?.[campo] || '').trim());
  const valor = String(slot?.[campoEncontrado] || '').trim();
  const data = String(slot?.data || slot?.date || slot?.dia || slot?.data_slot || '').trim();

  if (data && /^\d{2}:\d{2}/.test(valor)) {
    return `${data}T${valor}`;
  }

  return valor;
}

function obterIdSlotEntrevista(slot) {
  return slot?.id_slot ?? slot?.slot_id ?? slot?.id ?? slot?.id_entrevista_slot ?? '';
}

function obterDataInicioSlotEntrevista(slot) {
  const inicio = obterValorDataHoraSlot(slot, [
    'inicio',
    'data_inicio',
    'data_hora_inicio',
    'start',
    'start_time',
    'hora_inicio',
    'horario',
  ]);
  if (!inicio) return null;

  const data = new Date(inicio);
  return Number.isNaN(data.getTime()) ? null : data;
}

function obterDataFimSlotEntrevista(slot) {
  const fim = obterValorDataHoraSlot(slot, [
    'fim',
    'data_fim',
    'data_hora_fim',
    'end',
    'end_time',
    'hora_fim',
    'termino',
  ]);
  if (!fim) return null;

  const data = new Date(fim);
  return Number.isNaN(data.getTime()) ? null : data;
}

function obterVagasDisponiveisSlotEntrevista(slot) {
  const valor = [
    slot?.disponiveis,
    slot?.vagas_restantes,
    slot?.vagas_disponiveis,
    slot?.available_slots,
    slot?.capacidade_disponivel,
    slot?.capacity,
    slot?.capacidade,
  ].find((item) => item !== null && item !== undefined && String(item).trim() !== '');
  const numero = Number(valor ?? 1);
  return Number.isFinite(numero) ? numero : 1;
}

function obterMotivoEliminacao(candidato) {
  return String(candidato?.motivo_eliminacao || '').trim() || 'Motivo não informado';
}

function montarFormularioCandidato(candidato) {
  return {
    nome_candidato: candidato?.nome_candidato || '',
    email: candidato?.email || '',
    telefone: candidato?.telefone || '',
    whatsapp: candidato?.whatsapp || '',
    cidade: candidato?.cidade || '',
    bairro: candidato?.bairro || '',
  };
}

function candidatoTemProvaSalva(candidato) {
  const idTeste = String(candidato?.id_teste || '').trim();
  if (candidato?.prova_disponivel || candidato?.id_teste_prova) {
    return Boolean(idTeste || candidato?.id_teste_prova);
  }
  const origem = normalizarTextoComparacao(candidato?.origem);
  const nota = String(obterNotaProvaCandidato(candidato) || '').trim();

  return Boolean(
    idTeste &&
    !idTeste.toUpperCase().startsWith('CV-') &&
    nota &&
    (origem.includes('prova') || !origem.includes('pre-analise')),
  );
}

function montarItensPublicosPadrao(textos) {
  return textos.map((texto) => ({ texto, visivel: true }));
}

function normalizarItensPublicos(valor, chave, textosPadrao) {
  const bruto = String(valor || '').trim();
  if (!bruto) return montarItensPublicosPadrao(textosPadrao);

  try {
    const parsed = JSON.parse(bruto);
    const lista = Array.isArray(parsed) ? parsed : parsed?.[chave];
    if (!Array.isArray(lista)) return montarItensPublicosPadrao(textosPadrao);
    return lista
      .map((item) => {
        if (typeof item === 'string') return { texto: item.trim(), visivel: true };
        return {
          texto: String(item?.texto || '').trim(),
          visivel: item?.visivel !== false,
        };
      })
      .filter((item) => item.texto);
  } catch (error) {
    const linhas = bruto
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    return linhas.length
      ? montarItensPublicosPadrao(linhas)
      : montarItensPublicosPadrao(textosPadrao);
  }
}

function serializarItensPublicos(chave, itens) {
  return JSON.stringify({
    [chave]: (itens || []).map((item) => ({
      texto: String(item.texto || '').trim(),
      visivel: item.visivel !== false,
    })),
  });
}

function isPreAnaliseNaoQualificada(item) {
  const valor = normalizarTextoComparacao(item?.classificacao || item?.classificacao_slug);
  return valor === 'nao qualificado' || valor === 'nao-qualificado';
}

function isPreAnaliseUtilizavelDireto(item) {
  return !isPreAnaliseNaoQualificada(item);
}

function lerProblemasCv(item) {
  try {
    const dados = JSON.parse(item?.problemas || '{}');
    return dados && typeof dados === 'object' ? dados : {};
  } catch (error) {
    return {};
  }
}

function montarCandidatoDeFluxo(candidato, processoStatus = '') {
  const estadoAcoes = getCandidateActionState(candidato, processoStatus);

  return {
    ...candidato,
    status_fluxo: estadoAcoes.visibleStatus,
    status_processo: processoStatus || candidato.status_processo || '',
    acoes_fluxo: estadoAcoes,
  };
}

const TIPOS_CONTATO_WHATSAPP = [
  { valor: 'contato_enviado', label: 'Contato enviado' },
  { valor: 'respondeu', label: 'Respondeu' },
  { valor: 'confirmou_entrevista', label: 'Confirmou entrevista' },
  { valor: 'cancelou_entrevista', label: 'Cancelou entrevista' },
  { valor: 'solicitou_reagendamento', label: 'Solicitou reagendamento' },
  { valor: 'observacao_livre', label: 'Observação livre' },
];

function obterReferenciaProcessoSeguro(processo) {
  return obterReferenciaProcesso(processo) || String(processo?.id_processo || '').trim();
}

function limparCodigoProcessoUsuario(valor) {
  return String(valor || '').split('@@')[0].trim();
}

function obterCodigoProcessoUsuario(processo) {
  return (
    limparCodigoProcessoUsuario(processo?.id_processo) ||
    limparCodigoProcessoUsuario(obterReferenciaProcessoSeguro(processo)) ||
    '-'
  );
}

function obterTooltipProcessoUsuario(processo) {
  return [
    obterCodigoProcessoUsuario(processo),
    processo?.vaga || '',
    processo?.data_criacao ? `Criado em ${formatarDataCurta(processo.data_criacao)}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
}

function obterOpcoesTextoUnicas(itens = [], campo) {
  const valores = itens
    .map((item) => String(typeof campo === 'function' ? campo(item) : item?.[campo] || '').trim())
    .filter(Boolean);
  return Array.from(new Set(valores)).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  );
}

function renderizarOpcoesFiltro(opcoes = [], rotuloTodos = 'Todos') {
  return html`
    <option value="">${rotuloTodos}</option>
    ${opcoes.map((opcao) => html`<option key=${opcao} value=${opcao}>${opcao}</option>`)}
  `;
}

function obterCandidatosDoProcesso(candidatos = [], processo) {
  const referencia = obterReferenciaProcessoSeguro(processo);
  const idProcesso = String(processo?.id_processo || '').trim();
  const idRef = String(processo?.id_processo_ref || '').trim();
  return candidatos.filter((candidato) => {
    const refCandidato = obterReferenciaProcessoDoCandidato(candidato);
    return (
      (referencia && refCandidato === referencia) ||
      (idRef && refCandidato === idRef) ||
      (idProcesso && String(candidato?.id_processo || '').trim() === idProcesso)
    );
  });
}

function obterEntrevistasDoProcesso(entrevistas = [], processo) {
  const referencia = obterReferenciaProcessoSeguro(processo);
  const idProcesso = String(processo?.id_processo || '').trim();
  const idRef = String(processo?.id_processo_ref || '').trim();
  return (Array.isArray(entrevistas) ? entrevistas : []).filter((entrevista) => {
    const refEntrevista = String(
      entrevista?.id_processo_ref ||
      entrevista?.id_processo ||
      entrevista?.processo ||
      '',
    ).trim();
    return (
      (referencia && refEntrevista === referencia) ||
      (idRef && refEntrevista === idRef) ||
      (idProcesso && refEntrevista === idProcesso)
    );
  });
}

function obterStatusProcessoClasse(status) {
  return isProcessClosed(status) ? 'is-unsaved' : 'is-finished';
}

function calcularProgressoProcesso(processo, candidatosProcesso = []) {
  const vagas = Number(processo?.quantidade_vagas || 0);
  const preenchidas = Number(processo?.vagas_preenchidas || 0);
  if (vagas > 0) {
    return Math.max(0, Math.min(100, Math.round((preenchidas / vagas) * 100)));
  }

  const aprovados = candidatosProcesso.filter(
    (candidato) =>
      canonicalizeCandidateStatus(
        candidato.status_fluxo || candidato.status_candidato,
      ) === CANDIDATE_STATUS_APPROVED,
  ).length;
  if (!candidatosProcesso.length) return 0;
  return Math.max(0, Math.min(100, Math.round((aprovados / candidatosProcesso.length) * 100)));
}

function obterDataValor(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function calcularDuracaoProcesso(processo) {
  const inicio = obterDataValor(processo?.data_criacao);
  const fim =
    obterDataValor(processo?.data_encerramento_real) ||
    obterDataValor(processo?.encerrado_em) ||
    obterDataValor(processo?.data_encerramento);
  if (!inicio || !fim) return '-';
  const dias = Math.max(0, Math.ceil((fim.getTime() - inicio.getTime()) / 86400000));
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

function obterResponsavelProcesso(processo, candidato = null) {
  return String(
    processo?.responsavel ||
    processo?.usuario_responsavel ||
    processo?.recrutador ||
    processo?.criado_por ||
    candidato?.usuario_responsavel ||
    '',
  ).trim() || 'Não informado';
}

function obterUltimaMovimentacaoProcesso(processo, candidatosProcesso = [], entrevistasProcesso = []) {
  const datas = [
    processo?.atualizado_em,
    processo?.data_atualizacao,
    processo?.data_criacao,
    ...candidatosProcesso.map(
      (candidato) =>
        candidato.data_movimentacao ||
        candidato.data_atualizacao_pipeline ||
        candidato.aprovado_em ||
        candidato.eliminado_em ||
        candidato.data_prova,
    ),
    ...entrevistasProcesso.map(
      (entrevista) =>
        entrevista.atualizado_em ||
        entrevista.criado_em ||
        entrevista.data_entrevista,
    ),
  ]
    .map(obterDataValor)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());

  return datas[0] ? formatarDataHora(datas[0].toISOString()) : '-';
}

function normalizarNumeroWhatsAppBrasil(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 13) return '';
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

function montarMensagemWhatsAppProcesso(candidato, processo = {}) {
  const nome = String(candidato?.nome_candidato || candidato?.nome || '').trim() || 'candidato';
  const vaga = String(candidato?.vaga || processo?.vaga || '').trim() || 'a vaga em andamento';
  return `Olá, ${nome}. Aqui é o RH da Central 24 Horas. Estamos entrando em contato sobre o processo seletivo ${vaga}.`;
}

function obterTempoPendente(candidato) {
  const dataBase = obterDataValor(
    candidato?.data_movimentacao ||
    candidato?.data_atualizacao_pipeline ||
    candidato?.data_prova,
  );
  if (!dataBase) return '-';
  const dias = Math.max(0, Math.floor((Date.now() - dataBase.getTime()) / 86400000));
  if (dias === 0) return 'Hoje';
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

function renderizarResumoProcessoAberto({ processo, candidatosProcesso, entrevistasProcesso, onDetalhes }) {
  const progresso = calcularProgressoProcesso(processo, candidatosProcesso);
  const codigo = obterCodigoProcessoUsuario(processo);
  return html`
    <article class="active-process-card process-highlight-card" key=${obterChaveProcesso(processo)}>
      <div class="active-process-info">
        <strong title=${processo.vaga || codigo}>${processo.vaga || codigo}</strong>
        <span title=${obterTooltipProcessoUsuario(processo)}>${codigo}</span>
        <div class="active-process-meta">
          <span>${processo.vaga || '-'}</span>
          <span class=${`rh-status-pill ${obterStatusProcessoClasse(processo.status)}`}>
            ${processo.status || 'Aberto'}
          </span>
          <span>${candidatosProcesso.length} candidato(s)</span>
          <span>Abertura: ${formatarDataCurta(processo.data_criacao)}</span>
          <span>Resp.: ${obterResponsavelProcesso(processo)}</span>
        </div>
        <div class="active-process-progress" aria-label=${`Progresso ${progresso}%`}>
          <i style=${{ width: `${progresso}%` }}></i>
          <span>${progresso}%</span>
        </div>
      </div>
      <div class="active-process-actions">
        <button type="button" class="btn-soft-primary" onClick=${() => onDetalhes(processo)}>
          Ver Detalhes
        </button>
      </div>
    </article>
  `;
}

function MenuAcoesProcesso({ acoes = [] }) {
  const itens = acoes.filter(Boolean);
  const [aberto, setAberto] = useState(false);
  const [menuId] = useState(() => `process-actions-${Math.random().toString(36).slice(2)}`);
  const [posicao, setPosicao] = useState(null);

  useEffect(() => {
    const fecharOutrosMenus = (event) => {
      if (event.detail !== menuId) setAberto(false);
    };
    window.addEventListener('process-actions-open', fecharOutrosMenus);
    return () => window.removeEventListener('process-actions-open', fecharOutrosMenus);
  }, [menuId]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = () => setAberto(false);
    const fecharComEsc = (event) => {
      if (event.key === 'Escape') fechar();
    };
    document.addEventListener('click', fechar);
    document.addEventListener('keydown', fecharComEsc);
    window.addEventListener('resize', fechar);
    window.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('click', fechar);
      document.removeEventListener('keydown', fecharComEsc);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', fechar, true);
    };
  }, [aberto]);

  if (!itens.length) return null;

  const alternarMenu = (event) => {
    event.stopPropagation();
    if (!aberto) {
      window.dispatchEvent(new CustomEvent('process-actions-open', { detail: menuId }));
      const rect = event.currentTarget.getBoundingClientRect();
      const largura = 196;
      const altura = Math.min(228, 14 + itens.length * 34);
      const topoAbaixo = rect.bottom + 6;
      const topo =
        topoAbaixo + altura > window.innerHeight - 8
          ? Math.max(8, rect.top - altura - 6)
          : topoAbaixo;
      setPosicao({
        top: `${topo}px`,
        left: `${Math.max(8, Math.min(window.innerWidth - largura - 8, rect.right - largura))}px`,
      });
    }
    setAberto(!aberto);
  };

  const executarAcao = (event, acao) => {
    event.stopPropagation();
    setAberto(false);
    acao.onClick?.();
  };

  return html`
    <div class="process-row-action-menu">
      <button
        type="button"
        class="process-row-action-trigger"
        title="Mais ações"
        aria-label="Mais ações"
        aria-haspopup="menu"
        aria-expanded=${aberto}
        onClick=${alternarMenu}
      >
        <span class="material-symbols-outlined">more_horiz</span>
      </button>
      ${aberto
        ? html`
            <div
              class="process-row-actions-dropdown"
              role="menu"
              style=${posicao || {}}
              onClick=${(event) => event.stopPropagation()}
            >
              ${itens.map(
                (acao) => html`
                  <button
                    key=${acao.label}
                    type="button"
                    role="menuitem"
                    class=${`process-row-actions-item ${acao.danger ? 'is-danger' : ''}`.trim()}
                    onClick=${(event) => executarAcao(event, acao)}
                  >
                    ${acao.icon
                      ? html`<span class="material-symbols-outlined">${acao.icon}</span>`
                      : null}
                    <span>${acao.label}</span>
                  </button>
                `,
              )}
            </div>
          `
        : null}
    </div>
  `;
}

function montarRegistrosRecentesProcessosAbertos({
  processosAbertos = [],
  candidatos = [],
  entrevistas = [],
}) {
  const refsAbertas = new Set(
    processosAbertos
      .map(obterReferenciaProcessoSeguro)
      .filter(Boolean),
  );
  const eventosCandidatos = candidatos
    .filter((candidato) => refsAbertas.has(obterReferenciaProcessoDoCandidato(candidato)))
    .map((candidato) => ({
      id: `cand-${candidato.id_registro || candidato.id_teste}`,
      titulo: candidato.nome_candidato || 'Candidato',
      descricao:
        candidato.movimentacoes ||
        candidato.status_fluxo ||
        candidato.status_candidato ||
        'Movimentação de candidato',
      data:
        candidato.data_movimentacao ||
        candidato.data_atualizacao_pipeline ||
        candidato.data_prova,
      icone: 'person_search',
    }));
  const eventosEntrevistas = (Array.isArray(entrevistas) ? entrevistas : [])
    .filter((entrevista) => refsAbertas.has(String(entrevista.id_processo_ref || entrevista.id_processo || '').trim()))
    .map((entrevista) => ({
      id: `ent-${entrevista.id_entrevista || entrevista.id_slot || entrevista.data_entrevista}`,
      titulo: entrevista.nome_candidato || 'Entrevista',
      descricao: entrevista.status_entrevista || 'Entrevista registrada',
      data: entrevista.atualizado_em || entrevista.criado_em || entrevista.data_entrevista,
      icone: 'event_available',
    }));

  return [...eventosCandidatos, ...eventosEntrevistas]
    .filter((item) => item.data)
    .sort((a, b) => {
      const dataA = obterDataValor(a.data)?.getTime() || 0;
      const dataB = obterDataValor(b.data)?.getTime() || 0;
      return dataB - dataA;
    })
    .slice(0, 8);
}

async function carregarDadosProcessos({ incluirEntrevistas = false } = {}) {
  const chamadas = [
    lerProcessos(true),
    lerCandidatosProcessos(true),
    incluirEntrevistas ? lerEntrevistas({}) : Promise.resolve(null),
  ];
  const [resultadoProcessos, resultadoCandidatos, resultadoEntrevistas] =
    await Promise.allSettled(chamadas);
  const mensagensErro = [];

  if (resultadoProcessos.status !== 'fulfilled') {
    mensagensErro.push(
      resultadoProcessos.reason?.message ||
      'Não foi possível carregar os processos seletivos.',
    );
  }
  if (resultadoCandidatos.status !== 'fulfilled') {
    mensagensErro.push(
      resultadoCandidatos.reason?.message ||
      'Não foi possível carregar os candidatos vinculados.',
    );
  }

  return {
    processos:
      resultadoProcessos.status === 'fulfilled' && Array.isArray(resultadoProcessos.value)
        ? resultadoProcessos.value
        : [],
    candidatos:
      resultadoCandidatos.status === 'fulfilled' && Array.isArray(resultadoCandidatos.value)
        ? resultadoCandidatos.value
        : [],
    entrevistas:
      resultadoEntrevistas.status === 'fulfilled' && Array.isArray(resultadoEntrevistas.value)
        ? resultadoEntrevistas.value
        : null,
    erros: mensagensErro,
  };
}

function renderizarAcoesDoCandidato({
  candidato,
  onAtualizarStatus,
  onAprovar,
  onAgendarEntrevista,
  onEditar,
  onFicha,
  fichaCarregandoId = '',
  controlador,
}) {
  const estadoAcoes = candidato.acoes_fluxo || getCandidateActionState(candidato);
  const podeAgendar = controlador?.possuiPermissao?.('entrevistas.criar');
  const podeAprovar = controlador?.possuiPermissao?.('candidatos.aprovar_final');
  const podeEliminar = controlador?.possuiPermissao?.('candidatos.eliminar');
  const podeMover = controlador?.possuiPermissao?.('candidatos.mover_etapa');
  const podeEditar = controlador?.possuiAlgumaPermissao?.(
    'candidatos.editar',
    'candidatos.editar_basico',
    'candidatos.editar_admissional',
  );
  const botoes = [];

  if (typeof onFicha === 'function') {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-dark rh-action-btn btn-action btn-neutral"
          title="Abrir detalhes completos do candidato"
          disabled=${fichaCarregandoId === String(candidato.id_teste || '')}
          onClick=${() => onFicha(candidato)}
        >
          <span class="material-symbols-outlined">badge</span>
          ${fichaCarregandoId === String(candidato.id_teste || '') ? 'Abrindo...' : 'Detalhes'}
        </button>
      `,
    );
  }

  if (
    !estadoAcoes.processClosed &&
    estadoAcoes.isActive &&
    typeof onAgendarEntrevista === 'function' &&
    podeAgendar
  ) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-primary rh-action-btn btn-action btn-primary-soft"
          title="Agendar entrevista"
          onClick=${() => onAgendarEntrevista(candidato)}
        >
          <span class="material-symbols-outlined">event</span>
          Entrevista
        </button>
      `,
    );
  }

  if (estadoAcoes.canApprove && podeAprovar) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-success rh-action-btn btn-action btn-success-soft"
          title="Aprovar candidato"
          onClick=${() =>
          typeof onAprovar === 'function'
            ? onAprovar(candidato)
            : onAtualizarStatus(candidato, 'Aprovado')}
        >
          <span class="material-symbols-outlined">check_circle</span>
          Aprovar
        </button>
      `,
    );
  }

  if (estadoAcoes.canEliminate && podeEliminar) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-danger rh-action-btn btn-action btn-danger-soft"
          title="Eliminar candidato"
          onClick=${() => onAtualizarStatus(candidato, 'Eliminado')}
        >
          <span class="material-symbols-outlined">cancel</span>
          Eliminar
        </button>
      `,
    );
  }

  if (estadoAcoes.canSendToTalentBank && podeMover) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary rh-action-btn btn-action btn-neutral"
          title="Enviar para Banco de Talentos"
          onClick=${() => onAtualizarStatus(candidato, 'Banco de Talentos')}
        >
          <span class="material-symbols-outlined">inventory_2</span>
          Banco
        </button>
      `,
    );
  }

  if (estadoAcoes.canEdit && typeof onEditar === 'function' && podeEditar) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary rh-action-btn btn-action btn-neutral"
          title="Editar dados do candidato"
          onClick=${() => onEditar(candidato)}
        >
          <span class="material-symbols-outlined">edit</span>
          Editar
        </button>
      `,
    );
  }

  if (!botoes.length) {
    return html`
      <span class="text-muted">
        ${estadoAcoes.processClosed
        ? 'Processo encerrado. Movimentações não são permitidas.'
        : 'Sem ações disponíveis'}
      </span>
    `;
  }

  return html`<div class="rh-action-cluster">${botoes}</div>`;
}

function PaginacaoCompacta({
  paginaAtual = 1,
  totalPaginas = 1,
  totalItens = 0,
  tamanhoPagina = 1,
  itensNaPagina = 0,
  onChange,
}) {
  const total = Number(totalItens || 0);
  if (!total) return null;

  const totalPaginasSeguro = Math.max(1, Number(totalPaginas || 1));
  const paginaSegura = Math.min(Math.max(1, Number(paginaAtual || 1)), totalPaginasSeguro);
  const inicio = ((paginaSegura - 1) * Math.max(1, Number(tamanhoPagina || 1))) + 1;
  const fim = Math.min(total, inicio + Math.max(0, Number(itensNaPagina || 0)) - 1);
  const podeVoltar = paginaSegura > 1;
  const podeAvancar = paginaSegura < totalPaginasSeguro;

  return html`
    <div class="c24-pagination-bar">
      <span>Mostrando ${inicio}-${fim} de ${total}</span>
      ${totalPaginasSeguro > 1
        ? html`
            <div class="c24-pagination-actions">
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                disabled=${!podeVoltar}
                onClick=${() => podeVoltar && onChange?.(paginaSegura - 1)}
              >
                Anterior
              </button>
              <span class="c24-pagination-current">${paginaSegura}/${totalPaginasSeguro}</span>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                disabled=${!podeAvancar}
                onClick=${() => podeAvancar && onChange?.(paginaSegura + 1)}
              >
                Próximo
              </button>
            </div>
          `
        : null}
    </div>
  `;
}

function renderizarAcoesCompactasDoCandidato({
  candidato,
  onAtualizarStatus,
  onAprovar,
  onAgendarEntrevista,
  onEditar,
  onFicha,
  onDetalheProva,
  onCurriculo,
  onWhatsapp,
  fichaCarregandoId = '',
  carregandoDetalhe = false,
  temProvaSalva = false,
  podeBaixarCv = false,
  controlador,
  menuAberto = false,
  onToggleMenu,
  onCloseMenu,
}) {
  const estadoAcoes = candidato.acoes_fluxo || getCandidateActionState(candidato);
  const podeAgendar = controlador?.possuiPermissao?.('entrevistas.criar');
  const podeAprovar = controlador?.possuiPermissao?.('candidatos.aprovar_final');
  const podeEliminar = controlador?.possuiPermissao?.('candidatos.eliminar');
  const podeMover = controlador?.possuiPermissao?.('candidatos.mover_etapa');
  const podeEditar = controlador?.possuiAlgumaPermissao?.(
    'candidatos.editar',
    'candidatos.editar_basico',
    'candidatos.editar_admissional',
  );
  const podeRegistrarWhatsapp = controlador?.possuiAlgumaPermissao?.(
    'candidatos.editar',
    'candidatos.editar_basico',
    'entrevistas.criar',
    'emails.enviar_modelo',
  );
  const numeroWhatsapp = normalizarNumeroWhatsAppBrasil(
    candidato.whatsapp || candidato.telefone,
  );
  const acoesPrincipais = [];
  const acoesMenu = [];

  if (
    !estadoAcoes.processClosed &&
    estadoAcoes.isActive &&
    typeof onAgendarEntrevista === 'function' &&
    podeAgendar
  ) {
    acoesPrincipais.push(html`
      <button
        type="button"
        class="btn btn-sm btn-outline-primary rh-action-btn btn-action btn-primary-soft"
        title="Agendar entrevista"
        onClick=${() => onAgendarEntrevista(candidato)}
      >
        <span class="material-symbols-outlined">event</span>
        Entrevista
      </button>
    `);
  }

  if (estadoAcoes.canApprove && podeAprovar) {
    acoesPrincipais.push(html`
      <button
        type="button"
        class="btn btn-sm btn-outline-success rh-action-btn btn-action btn-success-soft"
        title="Aprovar candidato"
        onClick=${() =>
          typeof onAprovar === 'function'
            ? onAprovar(candidato)
            : onAtualizarStatus(candidato, 'Aprovado')}
      >
        <span class="material-symbols-outlined">check_circle</span>
        Aprovar
      </button>
    `);
  }

  if (numeroWhatsapp && podeRegistrarWhatsapp && typeof onWhatsapp === 'function') {
    acoesPrincipais.push(html`
      <button
        type="button"
        class="btn btn-sm btn-outline-success rh-action-btn btn-action btn-success-soft"
        title="Abrir WhatsApp e registrar contato manual"
        onClick=${() => onWhatsapp(candidato)}
      >
        <span class="material-symbols-outlined">chat</span>
        WhatsApp
      </button>
    `);
  }

  if (temProvaSalva && typeof onDetalheProva === 'function') {
    acoesPrincipais.push(html`
      <button
        type="button"
        class="btn btn-sm btn-outline-primary rh-action-btn btn-action btn-primary-soft"
        disabled=${carregandoDetalhe}
        onClick=${() => onDetalheProva(candidato)}
      >
        <span class="material-symbols-outlined">visibility</span>
        Resultado
      </button>
    `);
  }

  if (typeof onFicha === 'function') {
    acoesMenu.push({
      label: fichaCarregandoId === String(candidato.id_teste || '') ? 'Abrindo...' : 'Detalhes',
      icon: 'badge',
      disabled: fichaCarregandoId === String(candidato.id_teste || ''),
      onClick: () => onFicha(candidato),
    });
  }

  if (temProvaSalva && typeof onDetalheProva === 'function') {
    acoesMenu.push({
      label: 'Notas',
      icon: 'analytics',
      disabled: carregandoDetalhe,
      onClick: () => onDetalheProva(candidato),
    });
  }

  if (podeBaixarCv && typeof onCurriculo === 'function') {
    acoesMenu.push({
      label: 'Ver CV',
      icon: 'description',
      onClick: () => onCurriculo(candidato),
    });
  }

  if (estadoAcoes.canSendToTalentBank && podeMover) {
    acoesMenu.push({
      label: 'Banco',
      icon: 'inventory_2',
      onClick: () => onAtualizarStatus(candidato, 'Banco de Talentos'),
    });
  }

  if (estadoAcoes.canEdit && typeof onEditar === 'function' && podeEditar) {
    acoesMenu.push({
      label: 'Editar',
      icon: 'edit',
      onClick: () => onEditar(candidato),
    });
  }

  if (estadoAcoes.canEliminate && podeEliminar) {
    acoesMenu.push({
      label: 'Eliminar',
      icon: 'cancel',
      danger: true,
      onClick: () => onAtualizarStatus(candidato, 'Eliminado'),
    });
  }

  if (!acoesPrincipais.length && !acoesMenu.length) {
    return html`
      <span class="text-muted">
        ${estadoAcoes.processClosed
          ? 'Processo encerrado. Movimentações não são permitidas.'
          : 'Sem ações disponíveis'}
      </span>
    `;
  }

  return html`
    ${acoesPrincipais}
    ${acoesMenu.length
      ? html`
          <div
            class=${`candidate-actions-menu ${menuAberto ? 'is-open' : ''}`}
            onClick=${(event) => event.stopPropagation()}
          >
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary rh-action-btn btn-action btn-neutral candidate-actions-menu-toggle"
              aria-haspopup="menu"
              aria-expanded=${menuAberto}
              onClick=${(event) => {
                event.stopPropagation();
                onToggleMenu?.();
              }}
            >
              <span class="material-symbols-outlined">more_vert</span>
              Mais ações
            </button>
            ${menuAberto
              ? html`
                  <div class="candidate-actions-menu-list" role="menu">
                    ${acoesMenu.map(
                      (acao) => html`
                        <button
                          type="button"
                          role="menuitem"
                          class=${`candidate-actions-menu-item ${acao.danger ? 'is-danger' : ''}`}
                          disabled=${!!acao.disabled}
                          onClick=${() => {
                            onCloseMenu?.();
                            acao.onClick?.();
                          }}
                        >
                          <span class="material-symbols-outlined">${acao.icon}</span>
                          ${acao.label}
                        </button>
                      `,
                    )}
                  </div>
                `
              : null}
          </div>
        `
      : null}
  `;
}

function ModalFichaCandidato({
  ficha,
  formulario,
  salvando,
  erro,
  mensagem,
  onClose,
  onChange,
  onSave,
  onPrint,
  onAbrirCurriculo,
}) {
  if (!ficha) return null;

  const candidato = ficha.candidato || {};
  const curriculo = candidato.curriculo || {};
  const processos = Array.isArray(ficha.processos) ? ficha.processos : [];
  const resultados = Array.isArray(ficha.resultados) ? ficha.resultados : [];

  return html`
    <${ModalPadrao}
      aberto=${true}
      titulo=${`Ficha Geral | ${candidato.nome_candidato || 'Candidato'}`}
      subtitulo="Consulta consolidada do candidato, com observações e classificação interna do RH."
      className="candidate-sheet-dialog"
      onClose=${onClose}
    >
      <div class="rh-details-body candidate-sheet-body">
        ${erro
          ? html`<div class="alert alert-danger py-2">${erro}</div>`
          : null}
        ${mensagem
          ? html`<div class="alert alert-success py-2">${mensagem}</div>`
          : null}

        <${SectionCard}
          title="Dados do candidato"
          className="rh-section-card--flat candidate-sheet-section"
        >
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Nome</label>
              <input
                class="form-control"
                value=${formulario.nome_candidato}
                onInput=${(event) => onChange('nome_candidato', event.target.value)}
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">E-mail</label>
              <input
                class="form-control"
                value=${formulario.email}
                onInput=${(event) => onChange('email', event.target.value)}
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">Telefone</label>
              <input
                class="form-control"
                value=${formulario.telefone}
                onInput=${(event) => onChange('telefone', event.target.value)}
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">WhatsApp</label>
              <input
                class="form-control"
                value=${formulario.whatsapp}
                onInput=${(event) => onChange('whatsapp', event.target.value)}
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">Cidade</label>
              <input
                class="form-control"
                value=${formulario.cidade}
                onInput=${(event) => onChange('cidade', event.target.value)}
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">Bairro</label>
              <input
                class="form-control"
                value=${formulario.bairro}
                onInput=${(event) => onChange('bairro', event.target.value)}
              />
            </div>
          </div>
        </${SectionCard}>

        <${SectionCard}
          title="Currículo"
          className="rh-section-card--flat candidate-sheet-section"
          actions=${curriculo.disponivel
            ? html`
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary rh-action-btn"
                  onClick=${() =>
                    onAbrirCurriculo({
                      id_teste: candidato.id_teste || candidato.id,
                      cv_disponivel: curriculo.disponivel,
                    })}
                >
                  <span class="material-symbols-outlined">description</span>
                  Ver CV
                </button>
              `
            : null}
        >
          <${MetricGrid}
            items=${[
              {
                label: 'Arquivo',
                value: curriculo.nome_arquivo || 'Sem currículo',
              },
              {
                label: 'Status',
                value: curriculo.status || 'Não avaliado',
              },
              {
                label: 'Nota do currículo',
                value: formatarValorFicha(candidato.nota_curriculo),
              },
            ]}
          />
        </${SectionCard}>

        <${SectionCard}
          title="Processos seletivos"
          className="rh-section-card--flat candidate-sheet-section"
        >
          <div class="table-responsive">
            <table class="table align-middle rh-modern-history-table">
              <thead>
                <tr>
                  <th>Vaga/processo</th>
                  <th>Status</th>
                  <th>Etapa</th>
                  <th>Data</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                ${processos.length
                  ? processos.map((item, indice) => html`
                      <tr key=${`${item.id || 'processo'}-${indice}`}>
                        <td>${item.vaga || '-'}</td>
                        <td>${item.status || '-'}</td>
                        <td>${item.etapa || '-'}</td>
                        <td>${formatarDataHora(item.data_inscricao)}</td>
                        <td>${item.resultado_geral || 'Não informado'}</td>
                      </tr>
                    `)
                  : html`
                      <${TabelaVazia}
                        colunas=${5}
                        texto="Nenhum processo registrado para este candidato."
                      />
                    `}
              </tbody>
            </table>
          </div>
        </${SectionCard}>

        <${SectionCard}
          title="Resultados resumidos"
          className="rh-section-card--flat candidate-sheet-section"
        >
          <div class="table-responsive">
            <table class="table align-middle rh-modern-history-table">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Pontuação</th>
                  <th>Status</th>
                  <th>Processo</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                ${resultados.length
                  ? resultados.map((item, indice) => html`
                      <tr key=${`${item.etapa || 'resultado'}-${indice}`}>
                        <td>${item.etapa || '-'}</td>
                        <td>${item.pontuacao || 'Não informado'}</td>
                        <td>${item.status || '-'}</td>
                        <td>${item.processo || '-'}</td>
                        <td>${formatarDataHora(item.data)}</td>
                      </tr>
                    `)
                  : html`
                      <${TabelaVazia}
                        colunas=${5}
                        texto="Nenhum resultado de prova, CV ou entrevista registrado."
                      />
                    `}
              </tbody>
            </table>
          </div>
        </${SectionCard}>

        <${SectionCard}
          title="Avaliação RH"
          className="rh-section-card--flat candidate-sheet-section"
        >
          <div class="mb-3">
            <label class="form-label">Observações do candidato</label>
            <textarea
              class="form-control"
              rows="4"
              value=${formulario.observacao_rh}
              onInput=${(event) => onChange('observacao_rh', event.target.value)}
            ></textarea>
          </div>

          <div class="candidate-sheet-choice-grid mb-3">
            ${CLASSIFICACOES_FICHA_CANDIDATO.map((opcao) => html`
              <label
                key=${opcao}
                class=${`candidate-sheet-choice ${formulario.classificacao === opcao ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="candidate-sheet-recommendation"
                  value=${opcao}
                  checked=${formulario.classificacao === opcao}
                  onChange=${() => onChange('classificacao', opcao)}
                />
                <span>${opcao}</span>
              </label>
            `)}
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary mb-3"
            onClick=${() => onChange('classificacao', '')}
          >
            Marcar como não definido
          </button>

          <div>
            <label class="form-label">Justificativa</label>
            <textarea
              class="form-control"
              rows="3"
              value=${formulario.justificativa}
              onInput=${(event) => onChange('justificativa', event.target.value)}
            ></textarea>
          </div>
        </${SectionCard}>
      </div>

      <footer class="rh-modal-footer">
        <div class="rh-modal-footer-actions">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${onClose}
            disabled=${salvando}
          >
            Fechar
          </button>
          <button
            type="button"
            class="btn btn-outline-primary"
            onClick=${onPrint}
            disabled=${salvando}
          >
            Imprimir ficha
          </button>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          onClick=${onSave}
          disabled=${salvando}
        >
          ${salvando ? 'Salvando...' : 'Salvar ficha'}
        </button>
      </footer>
    </${ModalPadrao}>
  `;
}

function ModalRegistroWhatsapp({
  candidato,
  formulario,
  salvando = false,
  erro = '',
  onClose,
  onChange,
  onSave,
}) {
  if (!candidato) return null;

  return html`
    <${ModalPadrao}
      aberto=${!!candidato}
      titulo="Registrar contato WhatsApp"
      subtitulo="Registro manual de contato. Esta ação não altera automaticamente o status do candidato."
      onClose=${onClose}
    >
      <div class="rh-details-body">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Candidato</label>
            <input
              class="form-control"
              readonly
              value=${candidato.nome_candidato || candidato.nome || ''}
            />
          </div>
          <div class="col-md-6">
            <label class="form-label">Evento</label>
            <select
              class="form-select"
              value=${formulario.tipo_contato}
              onChange=${(event) => onChange('tipo_contato', event.target.value)}
            >
              ${TIPOS_CONTATO_WHATSAPP.map(
                (tipo) => html`
                  <option key=${tipo.valor} value=${tipo.valor}>
                    ${tipo.label}
                  </option>
                `,
              )}
            </select>
          </div>
          <div class="col-12">
            <label class="form-label">Mensagem pré-formatada</label>
            <textarea
              class="form-control"
              rows="4"
              readonly
              value=${formulario.mensagem}
            ></textarea>
          </div>
          <div class="col-12">
            <label class="form-label">Observação livre</label>
            <textarea
              class="form-control"
              rows="4"
              placeholder="Registre retorno do candidato, contexto ou próximo passo."
              value=${formulario.observacao}
              onInput=${(event) => onChange('observacao', event.target.value)}
            ></textarea>
          </div>
        </div>
        ${erro ? html`<div class="alert alert-danger mt-3 mb-0">${erro}</div>` : null}
      </div>
      <footer class="rh-modal-footer">
        <button
          type="button"
          class="btn btn-outline-secondary"
          disabled=${salvando}
          onClick=${onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          disabled=${salvando}
          onClick=${onSave}
        >
          ${salvando ? 'Registrando...' : 'Registrar contato'}
        </button>
      </footer>
    </${ModalPadrao}>
  `;
}

function SecaoDetalheExpansivel({
  aberto,
  titulo,
  description,
  className = '',
  tourId = '',
  onToggle,
  children,
}) {
  return html`
    <${SectionCard} className=${className} tourId=${tourId}>
      <div class="rh-section-card-header">
        <div>
          <${CabecalhoSecaoColapsavel}
            aberto=${aberto}
            titulo=${titulo}
            onClick=${onToggle}
          />
          ${description
      ? html`<p class="rh-section-card-description">${description}</p>`
      : null}
        </div>
      </div>
      ${aberto ? html`<div class="mt-3">${children}</div>` : null}
    </${SectionCard}>
  `;
}

function WidgetEntrevistasProcesso({
  entrevistas = [],
  carregando = false,
  onAbrirAgenda,
  onEditar,
}) {
  const [dataSelecionada, setDataSelecionada] = useState(() =>
    formatarIsoDataLocal(new Date()),
  );
  const dias = gerarFaixaDiasCalendario(dataSelecionada, dataSelecionada);
  const entrevistasDoDia = useMemo(
    () =>
      (Array.isArray(entrevistas) ? entrevistas : []).filter(
        (entrevista) =>
          entrevista?.data_entrevista &&
          formatarIsoDataLocal(entrevista.data_entrevista) === dataSelecionada,
      ),
    [entrevistas, dataSelecionada],
  );

  return html`
    <${SectionCard}
      title="Entrevistas registradas"
      description="Agenda vinculada ao processo atual, usando horários internos."
      className="process-interview-widget compact-dashboard-card"
      tourId="process-interviews"
      actions=${html`
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm"
          onClick=${onAbrirAgenda}
        >
          Ver agenda completa
        </button>
      `}
    >
      <div class="process-calendar-strip">
        <button
          type="button"
          class="calendar-arrow-btn"
          aria-label="Dia anterior"
          onClick=${() => setDataSelecionada(moverIsoDataLocal(dataSelecionada, -1))}
        >
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        <div class="process-calendar-days">
          ${dias.map(
            (dia) => html`
              <button
                type="button"
                class=${`process-calendar-day ${dia.selecionado ? 'is-selected' : ''}`}
                key=${dia.chave}
                onClick=${() => setDataSelecionada(dia.chave)}
              >
                <small>${dia.mes}</small>
                <strong>${dia.dia}</strong>
                <em>${dia.semana}</em>
              </button>
            `,
          )}
        </div>
        <button
          type="button"
          class="calendar-arrow-btn"
          aria-label="Próximo dia"
          onClick=${() => setDataSelecionada(moverIsoDataLocal(dataSelecionada, 1))}
        >
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      ${carregando
        ? html`
            <${LoadingState}
              titulo="Carregando entrevistas"
              descricao="Sincronizando agenda e status do candidato."
            />
          `
        : entrevistasDoDia.length
          ? html`
              <div class="process-interview-list">
                ${entrevistasDoDia.slice(0, 3).map(
                  (entrevista) => html`
                    <article class="process-interview-row" key=${entrevista.id_entrevista}>
                      <span class="material-symbols-outlined">event_available</span>
                      <div>
                        <strong>${entrevista.nome_candidato || '-'}</strong>
                        <small>
                          ${formatarDataCurta(entrevista.data_entrevista)}
                          as ${formatarHoraCurta(entrevista.data_entrevista)}
                        </small>
                      </div>
                      <span class=${`rh-status-pill ${obterClasseStatusEntrevista(entrevista.status_entrevista)}`}>
                        ${entrevista.status_entrevista || '-'}
                      </span>
                      <div class="process-interview-actions">
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary rh-action-btn"
                          onClick=${() =>
                            copiarTexto(entrevista.mensagem_base || '')
                              .then(() =>
                                window.alert('Mensagem copiada para a área de transferência.'),
                              )
                              .catch(() =>
                                window.alert('Não foi possível copiar a mensagem automaticamente.'),
                              )}
                        >
                          <span class="material-symbols-outlined">content_copy</span>
                          Copiar
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-primary rh-action-btn"
                          disabled=${isProcessClosed(entrevista.status_processo)}
                          onClick=${() => onEditar(entrevista)}
                        >
                          <span class="material-symbols-outlined">edit</span>
                          Editar
                        </button>
                      </div>
                    </article>
                  `,
                )}
              </div>
            `
          : html`
              <div class="c24-empty-state c24-empty-state-horizontal">
                <span class="material-symbols-outlined">calendar_month</span>
                <div>
                  <h3>Nenhuma entrevista registrada</h3>
                  <p>Use os slots ou confirmações para agendar entrevistas.</p>
                </div>
              </div>
            `}
    </${SectionCard}>
  `;
}

function DossieProcesso({
  processo,
  candidatos = [],
  candidatosFiltrados = [],
  estatisticas,
  filtros,
  onFiltroChange,
  onLimparFiltros,
  analise,
  anotacoes = [],
  formularioAnotacao,
  anotacaoEditandoId,
  salvandoAnotacao,
  erro,
  mensagem,
  onChangeAnotacao,
  onSelecionarCandidatoAnotacao,
  onSalvarAnotacao,
  onEditarAnotacao,
  onCancelarEdicao,
}) {
  const opcoesEtapa = Array.from(
    new Set(candidatos.map((item) => item.etapa).filter(Boolean)),
  );
  const opcoesClassificacao = Array.from(
    new Set(candidatos.map((item) => item.classificacao).filter(Boolean)),
  );
  const opcoesStatus = Array.from(
    new Set(candidatos.map((item) => item.status).filter(Boolean)),
  );
  const candidatosGrafico = candidatosFiltrados
    .filter(
      (item) =>
        item.notaProva !== null ||
        item.scoreCv !== null ||
        item.mediaGeral !== null,
    )
    .slice()
    .sort((a, b) => Number(b.mediaGeral || 0) - Number(a.mediaGeral || 0))
    .slice(0, 8);
  const largura = (valor) =>
    `${Math.max(4, Math.min(100, Number(valor || 0) * 10))}%`;

  return html`
    <div class="process-dossier-shell">
      ${erro ? html`<div class="alert alert-warning py-2">${erro}</div>` : null}
      ${mensagem ? html`<div class="alert alert-success py-2">${mensagem}</div>` : null}

      <${MetricGrid}
        items=${[
          { label: 'Candidatos avaliados', value: estatisticas?.avaliados || 0 },
          { label: 'Média da prova', value: formatarNumeroDossie(estatisticas?.mediaProva) },
          { label: 'Média do currículo', value: formatarNumeroDossie(estatisticas?.mediaCv) },
          { label: 'Média geral', value: formatarNumeroDossie(estatisticas?.mediaGeral) },
        ]}
      />

      <div class="process-dossier-filter-grid">
        <label>
          <span>Processo</span>
          <input
            class="form-control"
            value=${filtros.processo}
            placeholder=${processo?.id_processo || 'Filtrar processo'}
            onInput=${(event) => onFiltroChange('processo', event.target.value)}
          />
        </label>
        <label>
          <span>Candidato</span>
          <input
            class="form-control"
            value=${filtros.candidato}
            placeholder="Nome, e-mail ou WhatsApp"
            onInput=${(event) => onFiltroChange('candidato', event.target.value)}
          />
        </label>
        <label>
          <span>Data/dia</span>
          <input
            class="form-control"
            type="date"
            value=${filtros.data}
            onInput=${(event) => onFiltroChange('data', event.target.value)}
          />
        </label>
        <label>
          <span>Etapa</span>
          <select
            class="form-select"
            value=${filtros.etapa}
            onChange=${(event) => onFiltroChange('etapa', event.target.value)}
          >
            <option value="">Todas</option>
            ${opcoesEtapa.map(
              (item) => html`<option key=${item} value=${item}>${item}</option>`,
            )}
          </select>
        </label>
        <label>
          <span>Classificação</span>
          <select
            class="form-select"
            value=${filtros.classificacao}
            onChange=${(event) => onFiltroChange('classificacao', event.target.value)}
          >
            <option value="">Todas</option>
            ${opcoesClassificacao.map(
              (item) => html`<option key=${item} value=${item}>${item}</option>`,
            )}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            class="form-select"
            value=${filtros.status}
            onChange=${(event) => onFiltroChange('status', event.target.value)}
          >
            <option value="">Todos</option>
            ${opcoesStatus.map(
              (item) => html`<option key=${item} value=${item}>${item}</option>`,
            )}
          </select>
        </label>
        <label>
          <span>Nota mínima</span>
          <input
            class="form-control"
            type="number"
            min="0"
            max="10"
            step="0.1"
            value=${filtros.notaMin}
            onInput=${(event) => onFiltroChange('notaMin', event.target.value)}
          />
        </label>
        <label>
          <span>Nota máxima</span>
          <input
            class="form-control"
            type="number"
            min="0"
            max="10"
            step="0.1"
            value=${filtros.notaMax}
            onInput=${(event) => onFiltroChange('notaMax', event.target.value)}
          />
        </label>
        <label>
          <span>Score mínimo</span>
          <input
            class="form-control"
            type="number"
            min="0"
            max="10"
            step="0.1"
            value=${filtros.scoreMin}
            onInput=${(event) => onFiltroChange('scoreMin', event.target.value)}
          />
        </label>
        <label>
          <span>Score máximo</span>
          <input
            class="form-control"
            type="number"
            min="0"
            max="10"
            step="0.1"
            value=${filtros.scoreMax}
            onInput=${(event) => onFiltroChange('scoreMax', event.target.value)}
          />
        </label>
        <div class="process-dossier-filter-actions">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            onClick=${onLimparFiltros}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div class="process-dossier-layout">
        <section class="process-dossier-panel">
          <header>
            <h4>Comparativo entre candidatos</h4>
            <span>${candidatosFiltrados.length} candidato(s)</span>
          </header>
          ${candidatosGrafico.length
            ? html`
                <div class="process-dossier-chart">
                  ${candidatosGrafico.map(
                    (item) => html`
                      <article class="process-dossier-chart-row" key=${item.id || item.nome}>
                        <div class="process-dossier-chart-name">
                          <strong>${item.nome}</strong>
                          <small>${item.etapa || item.status}</small>
                        </div>
                        <div class="process-dossier-bars">
                          <span>
                            <i style=${{ width: largura(item.notaProva) }}></i>
                            Nota ${formatarNumeroDossie(item.notaProva)}
                          </span>
                          <span class="is-cv">
                            <i style=${{ width: largura(item.scoreCv) }}></i>
                            CV ${formatarNumeroDossie(item.scoreCv)}
                          </span>
                          <span class="is-average">
                            <i style=${{ width: largura(item.mediaGeral) }}></i>
                            Média ${formatarNumeroDossie(item.mediaGeral)}
                          </span>
                        </div>
                      </article>
                    `,
                  )}
                </div>
              `
            : html`
                <div class="c24-empty-state">
                  <span class="material-symbols-outlined">bar_chart</span>
                  <h3>Ainda não há dados suficientes para o gráfico.</h3>
                  <p>Registre nota de prova ou score de currículo para comparar candidatos.</p>
                </div>
              `}
        </section>

        <section class="process-dossier-panel">
          <header>
            <h4>Análise inteligente</h4>
            <span>${analise?.disponivel ? 'IA integrada' : 'Fallback local'}</span>
          </header>
          <p class="process-dossier-ai-summary">
            ${analise?.resumo ||
            'Ainda não há dados suficientes para gerar o dossiê inteligente.'}
          </p>
          <div class="process-dossier-ai-grid">
            <div>
              <h5>Ranking analítico</h5>
              ${analise?.ranking?.length
                ? html`
                    <ol class="process-dossier-ranking">
                      ${analise.ranking.map(
                        (item) => html`
                          <li key=${`${item.posicao}-${item.candidato}`}>
                            <span>${item.posicao}</span>
                            <strong>${item.candidato}</strong>
                            <small>Média ${item.media}</small>
                          </li>
                        `,
                      )}
                    </ol>
                  `
                : html`<p class="text-muted mb-0">Sem ranking disponível.</p>`}
            </div>
            <div>
              <h5>Pontos de atenção</h5>
              <ul class="process-dossier-list">
                ${(analise?.pontos_atencao || []).slice(0, 4).map(
                  (item) => html`<li key=${item}>${item}</li>`,
                )}
              </ul>
            </div>
          </div>
          <div class="process-dossier-ai-note">
            A análise organiza informações para apoiar o RH. A decisão final continua sendo humana.
          </div>
        </section>
      </div>

      <section class="process-dossier-panel">
        <header>
          <h4>Base consolidada</h4>
          <span>${candidatosFiltrados.length} registro(s)</span>
        </header>
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table process-dossier-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Etapa</th>
                <th>Status</th>
                <th>Classificação</th>
                <th>Nota</th>
                <th>Score CV</th>
                <th>Média</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${candidatosFiltrados.length
                ? candidatosFiltrados.map(
                    (item) => html`
                      <tr key=${item.id || item.nome}>
                        <td>
                          <strong>${item.nome}</strong>
                          <div class="small text-muted">${item.email || item.whatsapp || '-'}</div>
                        </td>
                        <td>${item.etapa || '-'}</td>
                        <td>${item.status || '-'}</td>
                        <td>${item.classificacao || '-'}</td>
                        <td>${formatarNumeroDossie(item.notaProva)}</td>
                        <td>${formatarNumeroDossie(item.scoreCv)}</td>
                        <td>${formatarNumeroDossie(item.mediaGeral)}</td>
                        <td>${formatarDataHora(item.data)}</td>
                      </tr>
                    `,
                  )
                : html`
                    <${TabelaVazia}
                      colunas=${8}
                      texto="Nenhum candidato encontrado para os filtros selecionados."
                    />
                  `}
            </tbody>
          </table>
        </div>
      </section>

      <section class="process-dossier-panel">
        <header>
          <h4>Anotações do RH</h4>
          <span>${anotacoes.length} anotação(ões)</span>
        </header>
        <div class="process-dossier-notes-grid">
          <div class="process-dossier-note-form">
            <label class="form-label">Candidato relacionado</label>
            <select
              class="form-select"
              value=${formularioAnotacao.id_teste}
              onChange=${(event) => onSelecionarCandidatoAnotacao(event.target.value)}
            >
              <option value="">Processo geral</option>
              ${candidatos.map(
                (item) => html`
                  <option key=${item.id_teste || item.id} value=${item.id_teste || item.id || ''}>
                    ${item.nome}
                  </option>
                `,
              )}
            </select>
            <label class="form-label mt-3">Observação</label>
            <textarea
              class="form-control"
              rows="4"
              placeholder="Registre uma observação objetiva para o RH."
              value=${formularioAnotacao.texto}
              onInput=${(event) => onChangeAnotacao('texto', event.target.value)}
            ></textarea>
            <div class="d-flex gap-2 flex-wrap mt-3">
              <button
                type="button"
                class="btn btn-primary"
                disabled=${salvandoAnotacao}
                onClick=${onSalvarAnotacao}
              >
                ${salvandoAnotacao
                  ? 'Salvando...'
                  : anotacaoEditandoId
                    ? 'Salvar edição'
                    : 'Registrar anotação'}
              </button>
              ${anotacaoEditandoId
                ? html`
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      disabled=${salvandoAnotacao}
                      onClick=${onCancelarEdicao}
                    >
                      Cancelar edição
                    </button>
                  `
                : null}
            </div>
          </div>
          <div class="process-dossier-note-list">
            ${anotacoes.length
              ? anotacoes.map(
                  (item) => html`
                    <article class="process-dossier-note" key=${item.id_anotacao}>
                      <div>
                        <strong>${item.nome_candidato || 'Processo geral'}</strong>
                        <small>
                          ${formatarDataHora(item.atualizado_em || item.criado_em)}
                          ${item.usuario_responsavel
                            ? ` • ${item.usuario_responsavel}`
                            : ''}
                        </small>
                      </div>
                      <p>${item.texto}</p>
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary"
                        onClick=${() => onEditarAnotacao(item)}
                      >
                        Editar
                      </button>
                    </article>
                  `,
                )
              : html`
                  <div class="c24-empty-state">
                    <span class="material-symbols-outlined">edit_note</span>
                    <h3>Nenhuma anotação registrada para este processo.</h3>
                    <p>Use o campo ao lado para registrar contexto administrativo.</p>
                  </div>
                `}
          </div>
        </div>
      </section>
    </div>
  `;
}

export function TelaProcessos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processos, setProcessos] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [entrevistas, setEntrevistas] = useState(null);
  const [filtros, setFiltros] = useState({
    vaga: '',
    operacao: '',
    notaCorte: '',
    status: '',
  });
  const [blocos, setBlocos] = useState({
    abertos: true,
    encerrados: false,
    candidatos: false,
  });
  const [edicao, setEdicao] = useState(null);
  const [processoParaEncerrar, setProcessoParaEncerrar] = useState('');
  const [aprovacaoSelecionada, setAprovacaoSelecionada] = useState(null);
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const dados = await carregarDadosProcessos({
        incluirEntrevistas: controlador?.possuiPermissao?.('entrevistas.visualizar'),
      });
      setProcessos(dados.processos);
      setCandidatos(dados.candidatos);
      setEntrevistas(dados.entrevistas);

      if (dados.erros.length) {
        setErro(dados.erros.join(' '));
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const processosAbertos = useMemo(
    () =>
      processos
        .filter((processo) => String(processo.status || '').trim() !== 'Encerrado')
        .filter((processo) => {
          const vaga = String(processo.vaga || '').toLowerCase();
          const operacao = String(processo.operacao || '').toLowerCase();
          const usaNota = Number(processo.usa_nota_corte || 0) ? 'sim' : 'nao';
          const status = String(processo.status || '').toLowerCase();

          const matchVaga =
            !filtros.vaga || vaga.includes(filtros.vaga.toLowerCase());
          const matchOperacao =
            !filtros.operacao ||
            operacao.includes(filtros.operacao.toLowerCase());
          const matchNota =
            !filtros.notaCorte || usaNota === filtros.notaCorte;
          const matchStatus =
            !filtros.status || status.includes(filtros.status.toLowerCase());

          return matchVaga && matchOperacao && matchNota && matchStatus;
        }),
    [filtros, processos],
  );

  const processosEncerrados = useMemo(
    () =>
      processos.filter(
        (processo) => String(processo.status || '').trim() === 'Encerrado',
      ),
    [processos],
  );

  const processosPorId = useMemo(
    () =>
      processos.reduce((acc, processo) => {
        const referencia = obterReferenciaProcessoSeguro(processo);
        if (referencia) {
          acc[referencia] = processo;
        }
        return acc;
      }, {}),
    [processos],
  );

  const candidatosComFluxo = useMemo(
    () =>
      candidatos.map((candidato) => {
        const processo =
          processosPorId[obterReferenciaProcessoDoCandidato(candidato)];
        return montarCandidatoDeFluxo(candidato, processo?.status || '');
      }),
    [candidatos, processosPorId],
  );

  const candidatosComDecisaoPendente = useMemo(
    () =>
      candidatosComFluxo.filter(
        (candidato) =>
          candidato.acoes_fluxo?.canApprove ||
          candidato.acoes_fluxo?.canEliminate ||
          candidato.acoes_fluxo?.canSendToTalentBank,
      ),
    [candidatosComFluxo],
  );

  const processosEmAndamento = useMemo(
    () =>
      processosAbertos.filter((processo) =>
        obterCandidatosDoProcesso(candidatosComFluxo, processo).some((candidato) =>
          isActiveCandidateStatus(candidato.status_fluxo || candidato.status_candidato),
        ),
      ),
    [candidatosComFluxo, processosAbertos],
  );

  const entrevistasVinculadas = Array.isArray(entrevistas) ? entrevistas.length : null;

  const resumo = useMemo(
    () => ({
      totalProcessos: processos.length,
      abertos: processosAbertos.length,
      encerrados: processosEncerrados.length,
      emAndamento: processosEmAndamento.length,
      candidatosComDecisaoPendente: candidatosComDecisaoPendente.length,
      candidatosVinculados: candidatosComFluxo.length,
      entrevistasVinculadas,
    }),
    [
      processos.length,
      processosAbertos.length,
      processosEncerrados.length,
      processosEmAndamento.length,
      candidatosComDecisaoPendente.length,
      candidatosComFluxo.length,
      entrevistasVinculadas,
    ],
  );
  const opcoesVagaProcessos = useMemo(
    () => obterOpcoesTextoUnicas(processos, 'vaga'),
    [processos],
  );
  const opcoesOperacaoProcessos = useMemo(
    () => obterOpcoesTextoUnicas(processos, 'operacao'),
    [processos],
  );

  const atualizarStatus = async (
    registro,
    statusCandidato,
    idProcesso,
    dadosAprovacao = {},
  ) => {
    const processo = encontrarProcessoPorReferencia(processos, idProcesso);
    const candidatoAtual = candidatos.find(
      (item) => Number(item.id_registro || 0) === Number(registro || 0),
    );
    const statusAtual = canonicalizeCandidateStatus(
      candidatoAtual?.status_fluxo || candidatoAtual?.status_candidato,
    );

    if (statusAtual === CANDIDATE_STATUS_APPROVED) {
      window.alert(MENSAGEM_CANDIDATO_APROVADO_BLOQUEADO);
      return;
    }

    if (isProcessClosed(processo)) {
      window.alert('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (
      statusCandidato === 'Aprovado' &&
      Number(processo?.quantidade_vagas || 0) === 1
    ) {
      const confirmar = window.confirm(
        'Este processo possui apenas 1 vaga. Ao aprovar o candidato, o processo pode ser encerrado automaticamente. Deseja continuar?',
      );
      if (!confirmar) return;
    }

    await atualizarStatusCandidato(registro, {
      status_candidato: statusCandidato,
      data_movimentacao: new Date().toISOString(),
      ...(statusCandidato === CANDIDATE_STATUS_APPROVED ? dadosAprovacao : {}),
    });

    await carregar();
  };

  const abrirAprovacao = (candidato) => {
    const processo = encontrarProcessoPorReferencia(
      processos,
      obterReferenciaProcessoDoCandidato(candidato),
    );
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato);

    if (estadoAcoes.processClosed || isProcessClosed(processo)) {
      window.alert('Processo encerrado. Movimentações não são permitidas.');
      return;
    }

    if (!estadoAcoes.canApprove) {
      window.alert('A aprovação não está disponível para o status atual deste candidato.');
      return;
    }

    setAprovacaoSelecionada({ candidato, processo });
  };

  const confirmarAprovacao = async (dadosAprovacao) => {
    if (!aprovacaoSelecionada?.candidato) return;

    setSalvandoAprovacao(true);
    try {
      const candidato = aprovacaoSelecionada.candidato;
      await atualizarStatus(
        candidato.id_registro,
        CANDIDATE_STATUS_APPROVED,
        obterReferenciaProcessoDoCandidato(candidato),
        dadosAprovacao,
      );
      setAprovacaoSelecionada(null);
    } finally {
      setSalvandoAprovacao(false);
    }
  };

  const salvarEdicao = async () => {
    const mensagemErro = validarFormularioProcesso(
      {
        vaga: edicao?.vaga,
        quantidade: edicao?.quantidade_vagas,
        dataEncerramento: edicao?.data_encerramento,
        operacao: edicao?.operacao,
        trilha: edicao?.trilha,
        usaNotaCorte: Number(edicao?.usa_nota_corte || 0) === 1,
        notaCorte: edicao?.nota_corte,
        linkAgendamento: edicao?.link_agendamento || '',
      },
      { exigeOperacao: false, exigeTrilha: false, trilhaFixa: '' },
    );
    if (mensagemErro || !obterReferenciaProcesso(edicao)) {
      setErro(mensagemErro || 'Preencha os campos obrigatórios para editar o processo.');
      return;
    }

    await atualizarProcesso(obterReferenciaProcesso(edicao), {
      quantidade_vagas: Number(edicao.quantidade_vagas),
      data_encerramento: edicao.data_encerramento,
      operacao: edicao.operacao || '',
      trilha: edicao.trilha || '',
      usa_nota_corte: Number(edicao.usa_nota_corte || 0),
      nota_corte:
        edicao.nota_corte !== '' && edicao.nota_corte !== null
          ? Number(edicao.nota_corte)
          : null,
      status: edicao.status || 'Aberto',
      link_agendamento: edicao.link_agendamento || '',
      observacoes_publicas_vaga: edicao.observacoes_publicas_vaga || '',
    });

    setEdicao(null);
    await carregar();
  };

  const confirmarEncerramento = async () => {
    if (!processoParaEncerrar) return;
    await encerrarProcesso(processoParaEncerrar);
    setProcessoParaEncerrar('');
    await carregar();
  };

  const abrirDetalhe = (processo) => {
    sessionStorage.setItem(
      CHAVE_PROCESSO_DETALHE,
      obterReferenciaProcessoSeguro(processo),
    );
    controlador.irParaTelaProtegida('screen-process-details');
  };

  const processoSelecionadoParaEncerramento = useMemo(
    () => encontrarProcessoPorReferencia(processos, processoParaEncerrar),
    [processoParaEncerrar, processos],
  );

  return html`
    <${PainelRh}
      screenId="screen-processes"
      navAtiva="screen-processes"
      subtituloMarca="Processos seletivos"
      placeholderBusca="Gerenciamento de processos e candidatos"
      controlador=${controlador}
      acaoPrimaria=${{
      label: 'Novo processo',
      permissao: 'vagas.criar',
      onClick: () => controlador.irParaTelaProtegida('screen-process-create'),
    }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Processos"
        title="Processos Seletivos"
        description="Gerencie processos, etapas, candidatos, entrevistas e decisões finais."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Cards Resumo"
        description="Indicadores operacionais calculados com os dados disponíveis no sistema."
      >
        <${MetricGrid}
          items=${[
            { label: 'Processos Abertos', value: resumo.abertos, icon: 'folder_open', variant: 'is-approved' },
            { label: 'Processos Encerrados', value: resumo.encerrados, icon: 'inventory_2', variant: 'is-eliminated' },
            { label: 'Processos em Andamento', value: resumo.emAndamento, icon: 'sync', variant: 'is-highlight' },
            {
              label: 'Decisões Pendentes',
              value: resumo.candidatosComDecisaoPendente,
              icon: 'rule',
              variant: 'is-analysis',
            },
            { label: 'Candidatos Vinculados', value: resumo.candidatosVinculados, icon: 'groups' },
            resumo.entrevistasVinculadas !== null
              ? { label: 'Entrevistas Vinculadas', value: resumo.entrevistasVinculadas, icon: 'event_available' }
              : null,
          ].filter(Boolean)}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Filtros"
        description="Aplicados somente na lista de processos abertos."
        className="process-filter-panel"
        tourId="process-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Vaga</label>
            <select
              class="form-select"
              value=${filtros.vaga}
              onChange=${(event) =>
      setFiltros({ ...filtros, vaga: event.target.value })}
            >
              ${renderizarOpcoesFiltro(opcoesVagaProcessos)}
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Operação</label>
            <select
              class="form-select"
              value=${filtros.operacao}
              onChange=${(event) =>
      setFiltros({ ...filtros, operacao: event.target.value })}
            >
              ${renderizarOpcoesFiltro(opcoesOperacaoProcessos, 'Todas')}
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Nota de corte</label>
            <select
              class="form-select"
              value=${filtros.notaCorte}
              onChange=${(event) =>
      setFiltros({ ...filtros, notaCorte: event.target.value })}
            >
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
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
              <option value="aberto">Aberto</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Processos Abertos em Destaque"
        description="Acompanhamento compacto dos processos ativos com candidatos, progresso e responsável."
        className="process-progress-card"
      >
        ${processosAbertos.length
          ? html`
              <div class="active-process-list">
                ${processosAbertos.slice(0, 5).map((processo) => {
                  const candidatosProcesso = obterCandidatosDoProcesso(candidatosComFluxo, processo);
                  const entrevistasProcesso = obterEntrevistasDoProcesso(entrevistas || [], processo);
                  return renderizarResumoProcessoAberto({
                    processo,
                    candidatosProcesso,
                    entrevistasProcesso,
                    onDetalhes: abrirDetalhe,
                  });
                })}
              </div>
            `
          : html`
              <div class="c24-empty-state c24-empty-state-horizontal">
                <span class="material-symbols-outlined">folder_open</span>
                <div>
                  <h3>Nenhum processo aberto</h3>
                  <p>Quando houver processos ativos, eles aparecerão aqui.</p>
                </div>
              </div>
            `}
      </${SectionCard}>

      <${SectionCard}
        title="Gestão de Processos Seletivos"
        description="Funcionalidade existente preservada, com ações alinhadas e foco nos processos ativos."
        tourId="process-open-table"
      >
        <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Operação</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Link legado</th>
                      <th>Status</th>
                      <th class="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${carregando
          ? html`<${TabelaVazia} colunas=${11} texto="Carregando processos..." />`
          : processosAbertos.length
            ? processosAbertos.map(
              (processo) => html`
                              <tr key=${obterChaveProcesso(processo)}>
                                <td class="process-code-cell">
                                  <strong title=${obterTooltipProcessoUsuario(processo)}>
                                    ${obterCodigoProcessoUsuario(processo)}
                                  </strong>
                                  <span>${processo.data_criacao ? `Criado em ${formatarDataCurta(processo.data_criacao)}` : processo.vaga || '-'}</span>
                                </td>
                                <td>${processo.vaga || '-'}</td>
                                <td>${processo.operacao || '-'}</td>
                                <td>${processo.trilha || '-'}</td>
                                <td>${Number(processo.usa_nota_corte || 0) ? 'Sim' : 'Não'}</td>
                                <td>${processo.nota_corte || '-'}</td>
                                <td>
                                  <div>${`${processo.vagas_preenchidas || 0}/${processo.quantidade_vagas || 0}`}</div>
                                  <small class="text-muted">
                                    ${Number(processo.candidatos_concorrendo ?? processo.quantidade_candidatos ?? 0)}
                                    concorrendo
                                  </small>
                                </td>
                                <td>${processo.data_encerramento || '-'}</td>
                                <td>
                                  ${processo.link_agendamento
                  ? html`
                                        <a
                                          href=${processo.link_agendamento}
                                          target="_blank"
                                          rel="noreferrer"
                                          class="rh-link-inline"
                                        >
                                          Abrir
                                        </a>
                                      `
                  : 'Não informado'}
                                </td>
                                <td>
                                  <span class="rh-status-pill is-finished">
                                    ${processo.status || '-'}
                                  </span>
                                </td>
                                <td class="text-end">
                                  <div class="process-row-actions">
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-primary process-primary-action"
                                      onClick=${() => abrirDetalhe(processo)}
                                    >
                                      Detalhes
                                    </button>
                                    <${MenuAcoesProcesso}
                                      acoes=${[
                                        {
                                          label: 'Editar',
                                          icon: 'edit',
                                          onClick: () =>
                                            setEdicao({
                                              ...processo,
                                              data_encerramento: formatarDataParaInput(
                                                processo.data_encerramento,
                                              ),
                                            }),
                                        },
                                        {
                                          label: 'Encerrar',
                                          icon: 'archive',
                                          danger: true,
                                          onClick: () =>
                                            setProcessoParaEncerrar(
                                              obterReferenciaProcesso(processo),
                                            ),
                                        },
                                      ]}
                                    />
                                  </div>
                                </td>
                              </tr>
                            `,
            )
            : html`
                            <${TabelaVazia}
                              colunas=${11}
                              texto="Nenhum processo aberto encontrado."
                            />
                          `}
                  </tbody>
                </table>
              </div>
      </${SectionCard}>

      <${SectionCard}
        title=""
        actions=${html`
          <${CabecalhoSecaoColapsavel}
            aberto=${blocos.encerrados}
            titulo="Processos encerrados"
            onClick=${() =>
        setBlocos({ ...blocos, encerrados: !blocos.encerrados })}
          />
        `}
      >
        ${blocos.encerrados
      ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Operação</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Link legado</th>
                      <th>Status</th>
                      <th class="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${processosEncerrados.length
          ? processosEncerrados.map(
            (processo) => html`
                              <tr key=${obterChaveProcesso(processo)}>
                              <td class="process-code-cell">
                                <strong title=${obterTooltipProcessoUsuario(processo)}>
                                  ${obterCodigoProcessoUsuario(processo)}
                                </strong>
                                <span>${processo.data_criacao ? `Criado em ${formatarDataCurta(processo.data_criacao)}` : processo.vaga || '-'}</span>
                              </td>
                              <td>${processo.vaga || '-'}</td>
                              <td>${processo.operacao || '-'}</td>
                              <td>${processo.trilha || '-'}</td>
                              <td>${Number(processo.usa_nota_corte || 0) ? 'Sim' : 'Não'}</td>
                              <td>${processo.nota_corte || '-'}</td>
                              <td>
                                ${`${processo.vagas_preenchidas || 0}/${processo.quantidade_vagas || 0}`}
                              </td>
                              <td>${processo.data_encerramento || '-'}</td>
                              <td>
                                ${processo.link_agendamento
                ? html`
                                      <a
                                        href=${processo.link_agendamento}
                                        target="_blank"
                                        rel="noreferrer"
                                        class="rh-link-inline"
                                      >
                                        Abrir
                                      </a>
                                    `
                : 'Não informado'}
                              </td>
                              <td>
                                <span class="rh-status-pill is-unsaved">
                                  ${processo.status || '-'}
                                </span>
                              </td>
                              <td class="text-end">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-primary"
                                  onClick=${() => abrirDetalhe(processo)}
                                >
                                  Detalhes
                                </button>
                              </td>
                            </tr>
                          `,
          )
          : html`
                          <${TabelaVazia}
                            colunas=${11}
                            texto="Nenhum processo encerrado."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `
      : null}
      </${SectionCard}>

      <${SectionCard}
        title="Decisões Finais Pendentes"
        description="Sempre visível para apoiar a decisão humana do RH sem alterar status automaticamente."
        className="process-decisions-fixed-card"
      >
        <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Candidato</th>
                      <th>Vaga</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th class="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${candidatosComDecisaoPendente.length
          ? candidatosComDecisaoPendente.map(
            (candidato) => html`
                            <tr key=${candidato.id_registro}>
                              <td>${candidato.id_processo || '-'}</td>
                              <td>${candidato.nome_candidato || '-'}</td>
                              <td>${candidato.vaga || '-'}</td>
                              <td>${candidato.pontuacao_final || '-'}</td>
                              <td>
                                <span
                                  class=${`process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_fluxo)}`}
                                >
                                  ${candidato.status_fluxo || '-'}
                                </span>
                              </td>
                              <td class="text-end">
                                ${renderizarAcoesDoCandidato({
              candidato,
              onAprovar: abrirAprovacao,
              onAtualizarStatus: (item, status) =>
                atualizarStatus(
                  item.id_registro,
                  status,
                  obterReferenciaProcessoDoCandidato(item),
                ),
              controlador,
            })}
                              </td>
                            </tr>
                          `,
          )
          : html`
                          <${TabelaVazia}
                            colunas=${6}
                            texto="Nenhum candidato com decisão final pendente."
                          />
                        `}
                  </tbody>
                </table>
              </div>
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!edicao}
        titulo="Editar processo"
        subtitulo="Ajuste as informações sem alterar a integração existente."
        onClose=${() => setEdicao(null)}
      >
        ${edicao
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Vaga</label>
                    <input class="form-control" readonly value=${edicao.vaga || ''} />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Quantidade de vagas</label>
                    <input
                      class="form-control"
                      type="number"
                      min="1"
                      value=${edicao.quantidade_vagas || 0}
                      onInput=${(event) =>
          setEdicao({
            ...edicao,
            quantidade_vagas: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Data de encerramento</label>
                    <input
                      class="form-control"
                      type="date"
                      value=${edicao.data_encerramento || ''}
                      onInput=${(event) =>
          setEdicao({
            ...edicao,
            data_encerramento: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Operação</label>
                    <input
                      class="form-control"
                      value=${edicao.operacao || ''}
                      onInput=${(event) =>
          setEdicao({ ...edicao, operacao: event.target.value })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Trilha</label>
                    <input
                      class="form-control"
                      value=${edicao.trilha || ''}
                      onInput=${(event) =>
          setEdicao({ ...edicao, trilha: event.target.value })}
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label d-block mb-2">Nota de corte</label>
                    <div class="form-check form-switch pt-2">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        checked=${Number(edicao.usa_nota_corte || 0) === 1}
                        onChange=${(event) =>
          setEdicao({
            ...edicao,
            usa_nota_corte: event.target.checked ? 1 : 0,
          })}
                      />
                    </div>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Valor corte</label>
                    <input
                      class="form-control"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value=${edicao.nota_corte ?? ''}
                      disabled=${Number(edicao.usa_nota_corte || 0) !== 1}
                      onInput=${(event) =>
          setEdicao({ ...edicao, nota_corte: event.target.value })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Status</label>
                    <select
                      class="form-select"
                      value=${edicao.status || 'Aberto'}
                      onChange=${(event) =>
          setEdicao({ ...edicao, status: event.target.value })}
                    >
                      <option value="Aberto">Aberto</option>
                      <option value="Encerrado">Encerrado</option>
                    </select>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Link legado</label>
                    <input
                      class="form-control"
                      placeholder="https://..."
                      value=${edicao.link_agendamento || ''}
                      onInput=${(event) =>
          setEdicao({
            ...edicao,
            link_agendamento: event.target.value,
          })}
                    />
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setEdicao(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${salvarEdicao}
                >
                  Salvar alterações
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!processoParaEncerrar}
        titulo="Encerrar processo"
        subtitulo="Essa ação move o processo para a lista de encerrados."
        onClose=${() => setProcessoParaEncerrar('')}
      >
        <div class="rh-details-body">
          <div class="alert alert-warning mb-0">
            Deseja realmente encerrar o processo ${processoSelecionadoParaEncerramento?.id_processo || processoParaEncerrar || ''}?
          </div>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setProcessoParaEncerrar('')}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick=${confirmarEncerramento}
          >
            Encerrar processo
          </button>
        </footer>
      </${ModalPadrao}>

      <${ModalAprovacaoCandidato}
        aberto=${!!aprovacaoSelecionada}
        candidato=${aprovacaoSelecionada?.candidato}
        processo=${aprovacaoSelecionada?.processo}
        salvando=${salvandoAprovacao}
        onClose=${() => setAprovacaoSelecionada(null)}
        onConfirm=${confirmarAprovacao}
      />
    </${PainelRh}>
  `;
}

export function TelaProcessosAbertos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processos, setProcessos] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [entrevistas, setEntrevistas] = useState(null);
  const [processoParaEncerrar, setProcessoParaEncerrar] = useState('');
  const [edicao, setEdicao] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await carregarDadosProcessos({
        incluirEntrevistas: controlador?.possuiPermissao?.('entrevistas.visualizar'),
      });
      setProcessos(dados.processos);
      setCandidatos(dados.candidatos);
      setEntrevistas(dados.entrevistas);
      if (dados.erros.length) setErro(dados.erros.join(' '));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const processosAbertos = useMemo(
    () => processos.filter((processo) => !isProcessClosed(processo)),
    [processos],
  );
  const processosPorId = useMemo(
    () =>
      processos.reduce((acc, processo) => {
        const referencia = obterReferenciaProcessoSeguro(processo);
        if (referencia) acc[referencia] = processo;
        return acc;
      }, {}),
    [processos],
  );
  const candidatosComFluxo = useMemo(
    () =>
      candidatos.map((candidato) => {
        const processo =
          processosPorId[obterReferenciaProcessoDoCandidato(candidato)];
        return montarCandidatoDeFluxo(candidato, processo?.status || '');
      }),
    [candidatos, processosPorId],
  );
  const decisoesPendentes = useMemo(
    () =>
      candidatosComFluxo.filter(
        (candidato) =>
          candidato.acoes_fluxo?.canApprove ||
          candidato.acoes_fluxo?.canEliminate ||
          candidato.acoes_fluxo?.canSendToTalentBank,
      ),
    [candidatosComFluxo],
  );
  const hoje = formatarIsoDataLocal(new Date());
  const processosComEntrevistasHoje = Array.isArray(entrevistas)
    ? new Set(
        entrevistas
          .filter((entrevista) =>
            entrevista.data_entrevista &&
            formatarIsoDataLocal(entrevista.data_entrevista) === hoje,
          )
          .map((entrevista) => String(entrevista.id_processo_ref || entrevista.id_processo || '').trim())
          .filter(Boolean),
      ).size
    : null;
  const processosSemMovimentacao = processosAbertos.filter((processo) => {
    const candidatosProcesso = obterCandidatosDoProcesso(candidatosComFluxo, processo);
    const entrevistasProcesso = obterEntrevistasDoProcesso(entrevistas || [], processo);
    return !candidatosProcesso.length && !entrevistasProcesso.length;
  }).length;
  const candidatosEmAnalise = candidatosComFluxo.filter(
    (candidato) =>
      canonicalizeCandidateStatus(candidato.status_fluxo || candidato.status_candidato) ===
      CANDIDATE_STATUS_ANALYSIS,
  ).length;
  const registrosRecentes = montarRegistrosRecentesProcessosAbertos({
    processosAbertos,
    candidatos: candidatosComFluxo,
    entrevistas: entrevistas || [],
  });

  const abrirDetalhe = (processo) => {
    sessionStorage.setItem(CHAVE_PROCESSO_DETALHE, obterReferenciaProcessoSeguro(processo));
    controlador.irParaTelaProtegida('screen-process-details');
  };

  const salvarEdicao = async () => {
    const mensagemErro = validarFormularioProcesso(
      {
        vaga: edicao?.vaga,
        quantidade: edicao?.quantidade_vagas,
        dataEncerramento: edicao?.data_encerramento,
        operacao: edicao?.operacao,
        trilha: edicao?.trilha,
        usaNotaCorte: Number(edicao?.usa_nota_corte || 0) === 1,
        notaCorte: edicao?.nota_corte,
        linkAgendamento: edicao?.link_agendamento || '',
      },
      { exigeOperacao: false, exigeTrilha: false, trilhaFixa: '' },
    );
    const referencia = obterReferenciaProcessoSeguro(edicao);
    if (mensagemErro || !referencia) {
      setErro(mensagemErro || 'Preencha os campos obrigatórios para editar o processo.');
      return;
    }

    await atualizarProcesso(referencia, {
      quantidade_vagas: Number(edicao.quantidade_vagas),
      data_encerramento: edicao.data_encerramento,
      operacao: edicao.operacao || '',
      trilha: edicao.trilha || '',
      usa_nota_corte: Number(edicao.usa_nota_corte || 0),
      nota_corte:
        edicao.nota_corte !== '' && edicao.nota_corte !== null
          ? Number(edicao.nota_corte)
          : null,
      status: edicao.status || 'Aberto',
      link_agendamento: edicao.link_agendamento || '',
      observacoes_publicas_vaga: edicao.observacoes_publicas_vaga || '',
    });

    setEdicao(null);
    await carregar();
  };

  const confirmarEncerramento = async () => {
    if (!processoParaEncerrar) return;
    await encerrarProcesso(processoParaEncerrar);
    setProcessoParaEncerrar('');
    await carregar();
  };

  const processoSelecionadoParaEncerramento = useMemo(
    () => encontrarProcessoPorReferencia(processos, processoParaEncerrar),
    [processoParaEncerrar, processos],
  );

  return html`
    <${PainelRh}
      screenId="screen-processes-open"
      navAtiva="screen-processes-open"
      subtituloMarca="Processos seletivos"
      placeholderBusca="Processos abertos"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Novo processo',
        permissao: 'vagas.criar',
        onClick: () => controlador.irParaTelaProtegida('screen-process-create'),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Processos"
        title="Processos Abertos"
        description="Acompanhe processos ativos e ações pendentes."
      />
      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard} title="Indicadores">
        <${MetricGrid}
          items=${[
            { label: 'Total de Processos Abertos', value: processosAbertos.length, icon: 'folder_open', variant: 'is-approved' },
            processosComEntrevistasHoje !== null
              ? { label: 'Entrevistas Hoje', value: processosComEntrevistasHoje, icon: 'today', variant: 'is-highlight' }
              : null,
            { label: 'Processos sem Movimentação', value: processosSemMovimentacao, icon: 'motion_photos_off' },
            { label: 'Decisões Pendentes', value: decisoesPendentes.length, icon: 'rule', variant: 'is-analysis' },
            { label: 'Candidatos em Análise', value: candidatosEmAnalise, icon: 'person_search' },
          ].filter(Boolean)}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Lista Principal"
        description="Processos ativos com etapa, candidatos, entrevistas e última movimentação."
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table process-wide-table">
            <thead>
              <tr>
                <th>Processo</th>
                <th>Vaga</th>
                <th>Status</th>
                <th>Etapa Atual</th>
                <th>Candidatos</th>
                <th>Entrevistas Agendadas</th>
                <th>Última Movimentação</th>
                <th>Responsável</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${carregando
                ? html`<${TabelaVazia} colunas=${9} texto="Carregando processos abertos..." />`
                : processosAbertos.length
                  ? processosAbertos.map((processo) => {
                      const candidatosProcesso = obterCandidatosDoProcesso(candidatosComFluxo, processo);
                      const entrevistasProcesso = obterEntrevistasDoProcesso(entrevistas || [], processo);
                      const etapaAtual =
                        candidatosProcesso.find((item) => item.etapa_pipeline || item.status_fluxo)?.etapa_pipeline ||
                        candidatosProcesso.find((item) => item.status_fluxo)?.status_fluxo ||
                        '-';
                      return html`
                        <tr key=${obterChaveProcesso(processo)}>
                          <td class="process-code-cell">
                            <strong title=${obterTooltipProcessoUsuario(processo)}>
                              ${obterCodigoProcessoUsuario(processo)}
                            </strong>
                            <span>${processo.data_criacao ? `Criado em ${formatarDataCurta(processo.data_criacao)}` : processo.vaga || '-'}</span>
                          </td>
                          <td>${processo.vaga || '-'}</td>
                          <td>
                            <span class=${`rh-status-pill ${obterStatusProcessoClasse(processo.status)}`}>
                              ${processo.status || 'Aberto'}
                            </span>
                          </td>
                          <td>${etapaAtual}</td>
                          <td>${candidatosProcesso.length}</td>
                          <td>${entrevistasProcesso.length}</td>
                          <td>${obterUltimaMovimentacaoProcesso(processo, candidatosProcesso, entrevistasProcesso)}</td>
                          <td>${obterResponsavelProcesso(processo)}</td>
                          <td class="text-end">
                            <div class="process-row-actions">
                              <button type="button" class="btn btn-sm btn-outline-primary process-primary-action" onClick=${() => abrirDetalhe(processo)}>
                                Ver Detalhes
                              </button>
                              <${MenuAcoesProcesso}
                                acoes=${[
                                  controlador.possuiPermissao('vagas.editar') ||
                                  controlador.possuiPermissao('vagas.editar_limitado') ||
                                  controlador.possuiPermissao('processos.editar')
                                    ? {
                                        label: 'Editar',
                                        icon: 'edit',
                                        onClick: () => setEdicao({ ...processo }),
                                      }
                                    : null,
                                  {
                                    label: 'Ver Candidatos',
                                    icon: 'groups',
                                    onClick: () => abrirDetalhe(processo),
                                  },
                                  controlador.possuiPermissao('entrevistas.visualizar')
                                    ? {
                                        label: 'Ver Entrevistas',
                                        icon: 'event_available',
                                        onClick: () => controlador.irParaTelaProtegida('screen-interviews'),
                                      }
                                    : null,
                                  controlador.possuiPermissao('vagas.encerrar')
                                    ? {
                                        label: 'Encerrar',
                                        icon: 'archive',
                                        danger: true,
                                        onClick: () => setProcessoParaEncerrar(obterReferenciaProcessoSeguro(processo)),
                                      }
                                    : null,
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      `;
                    })
                  : html`<${TabelaVazia} colunas=${9} texto="Nenhum processo aberto encontrado." />`}
            </tbody>
          </table>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Registros Recentes"
        description="Eventos reais vindos de movimentações de candidatos e entrevistas dos processos abertos."
      >
        ${registrosRecentes.length
          ? html`
              <div class="rh-recent-grid process-recent-events-grid">
                ${registrosRecentes.map(
                  (item) => html`
                    <article class="rh-recent-card" key=${item.id}>
                      <span class="rh-recent-avatar-wrap material-symbols-outlined">${item.icone}</span>
                      <span class="rh-recent-card-body">
                        <strong>${item.titulo}</strong>
                        <span>${item.descricao}</span>
                        <span>${formatarDataHora(item.data)}</span>
                      </span>
                    </article>
                  `,
                )}
              </div>
            `
          : html`
              <div class="c24-empty-state c24-empty-state-horizontal">
                <span class="material-symbols-outlined">history</span>
                <div>
                  <h3>Nenhum registro recente</h3>
                  <p>Sem histórico, logs ou eventos disponíveis para processos abertos.</p>
                </div>
              </div>
            `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!edicao}
        titulo="Editar processo"
        subtitulo="Ajuste as informações sem alterar a integração existente."
        onClose=${() => setEdicao(null)}
      >
        ${edicao
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Vaga</label>
                    <input class="form-control" readonly value=${edicao.vaga || ''} />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Quantidade de vagas</label>
                    <input
                      class="form-control"
                      type="number"
                      min="1"
                      value=${edicao.quantidade_vagas || 0}
                      onInput=${(event) =>
                        setEdicao({ ...edicao, quantidade_vagas: event.target.value })}
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Data de encerramento</label>
                    <input
                      class="form-control"
                      type="date"
                      value=${edicao.data_encerramento || ''}
                      onInput=${(event) =>
                        setEdicao({ ...edicao, data_encerramento: event.target.value })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Operação</label>
                    <input
                      class="form-control"
                      value=${edicao.operacao || ''}
                      onInput=${(event) => setEdicao({ ...edicao, operacao: event.target.value })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Trilha</label>
                    <input
                      class="form-control"
                      value=${edicao.trilha || ''}
                      onInput=${(event) => setEdicao({ ...edicao, trilha: event.target.value })}
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label d-block mb-2">Nota de corte</label>
                    <div class="form-check form-switch pt-2">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        checked=${Number(edicao.usa_nota_corte || 0) === 1}
                        onChange=${(event) =>
                          setEdicao({
                            ...edicao,
                            usa_nota_corte: event.target.checked ? 1 : 0,
                          })}
                      />
                    </div>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Valor corte</label>
                    <input
                      class="form-control"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value=${edicao.nota_corte ?? ''}
                      disabled=${Number(edicao.usa_nota_corte || 0) !== 1}
                      onInput=${(event) => setEdicao({ ...edicao, nota_corte: event.target.value })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Status</label>
                    <select
                      class="form-select"
                      value=${edicao.status || 'Aberto'}
                      onChange=${(event) => setEdicao({ ...edicao, status: event.target.value })}
                    >
                      <option value="Aberto">Aberto</option>
                      <option value="Encerrado">Encerrado</option>
                    </select>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Link legado</label>
                    <input
                      class="form-control"
                      placeholder="https://..."
                      value=${edicao.link_agendamento || ''}
                      onInput=${(event) =>
                        setEdicao({ ...edicao, link_agendamento: event.target.value })}
                    />
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button type="button" class="btn btn-outline-secondary" onClick=${() => setEdicao(null)}>
                  Cancelar
                </button>
                <button type="button" class="btn btn-primary" onClick=${salvarEdicao}>
                  Salvar alterações
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!processoParaEncerrar}
        titulo="Encerrar processo"
        subtitulo="Esta ação usa a rotina existente de encerramento."
        onClose=${() => setProcessoParaEncerrar('')}
      >
        <p>
          Deseja realmente encerrar o processo ${processoSelecionadoParaEncerramento?.id_processo || processoParaEncerrar || ''}?
        </p>
        <footer class="rh-modal-footer">
          <button type="button" class="btn btn-outline-secondary" onClick=${() => setProcessoParaEncerrar('')}>
            Cancelar
          </button>
          <button type="button" class="btn btn-danger" onClick=${confirmarEncerramento}>
            Encerrar
          </button>
        </footer>
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}

export function TelaProcessosEncerrados({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processos, setProcessos] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [filtros, setFiltros] = useState({
    vaga: '',
    periodo: '',
    status: '',
    responsavel: '',
  });

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await carregarDadosProcessos({ incluirEntrevistas: false });
      setProcessos(dados.processos);
      setCandidatos(dados.candidatos);
      if (dados.erros.length) setErro(dados.erros.join(' '));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const processosEncerrados = useMemo(
    () =>
      processos
        .filter((processo) => isProcessClosed(processo))
        .filter((processo) => {
          const textoVaga = normalizarTextoComparacao(processo.vaga);
          const textoStatus = normalizarTextoComparacao(processo.status);
          const textoResponsavel = normalizarTextoComparacao(obterResponsavelProcesso(processo));
          const dataEncerramento = String(
            processo.data_encerramento_real ||
            processo.encerrado_em ||
            processo.data_encerramento ||
            '',
          );
          if (filtros.vaga && !textoVaga.includes(normalizarTextoComparacao(filtros.vaga))) return false;
          if (filtros.status && !textoStatus.includes(normalizarTextoComparacao(filtros.status))) return false;
          if (filtros.responsavel && !textoResponsavel.includes(normalizarTextoComparacao(filtros.responsavel))) return false;
          if (filtros.periodo && !dataEncerramento.startsWith(filtros.periodo)) return false;
          return true;
        }),
    [filtros, processos],
  );
  const candidatosComFluxo = useMemo(
    () => candidatos.map((candidato) => montarCandidatoDeFluxo(candidato)),
    [candidatos],
  );
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const encerradosNoMes = processosEncerrados.filter((processo) =>
    String(processo.data_encerramento_real || processo.encerrado_em || processo.data_encerramento || '').startsWith(mesAtual),
  ).length;
  const contratacoesFinais = candidatosComFluxo.filter(
    (candidato) =>
      canonicalizeCandidateStatus(candidato.status_fluxo || candidato.status_candidato) ===
      CANDIDATE_STATUS_APPROVED,
  ).length;
  const duracoes = processosEncerrados
    .map((processo) => {
      const inicio = obterDataValor(processo.data_criacao);
      const fim = obterDataValor(processo.data_encerramento_real || processo.encerrado_em || processo.data_encerramento);
      if (!inicio || !fim) return null;
      return Math.max(0, Math.ceil((fim.getTime() - inicio.getTime()) / 86400000));
    })
    .filter((valor) => valor !== null);
  const mediaDuracao = duracoes.length
    ? `${Math.round(duracoes.reduce((soma, valor) => soma + valor, 0) / duracoes.length)} dias`
    : null;
  const opcoesVagaProcessos = useMemo(
    () => obterOpcoesTextoUnicas(processos.filter((processo) => isProcessClosed(processo)), 'vaga'),
    [processos],
  );
  const opcoesStatusProcessos = useMemo(
    () => obterOpcoesTextoUnicas(processos.filter((processo) => isProcessClosed(processo)), 'status'),
    [processos],
  );

  const abrirDetalhe = (processo) => {
    sessionStorage.setItem(CHAVE_PROCESSO_DETALHE, obterReferenciaProcessoSeguro(processo));
    controlador.irParaTelaProtegida('screen-process-details');
  };

  return html`
    <${PainelRh}
      screenId="screen-processes-closed"
      navAtiva="screen-processes-closed"
      subtituloMarca="Processos seletivos"
      placeholderBusca="Processos encerrados"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Processos"
        title="Processos Encerrados"
        description="Consulte processos finalizados e histórico de encerramento."
      />
      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard} title="Indicadores">
        <${MetricGrid}
          items=${[
            { label: 'Total Encerrado', value: processosEncerrados.length, icon: 'inventory_2', variant: 'is-eliminated' },
            { label: 'Encerrados no Mês', value: encerradosNoMes, icon: 'calendar_month' },
            { label: 'Contratações Finais', value: contratacoesFinais, icon: 'verified', variant: 'is-approved' },
            mediaDuracao ? { label: 'Média de Duração', value: mediaDuracao, icon: 'timer' } : null,
          ].filter(Boolean)}
        />
      </${SectionCard}>

      <${SectionCard} title="Filtros" className="process-filter-panel">
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Vaga</label>
            <select
              class="form-select"
              value=${filtros.vaga}
              onChange=${(event) => setFiltros({ ...filtros, vaga: event.target.value })}
            >
              ${renderizarOpcoesFiltro(opcoesVagaProcessos)}
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Período</label>
            <input class="form-control" type="month" value=${filtros.periodo} onInput=${(event) => setFiltros({ ...filtros, periodo: event.target.value })} />
          </div>
          <div class="rh-filter-field">
            <label>Status</label>
            <select
              class="form-select"
              value=${filtros.status}
              onChange=${(event) => setFiltros({ ...filtros, status: event.target.value })}
            >
              ${renderizarOpcoesFiltro(opcoesStatusProcessos)}
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Responsável</label>
            <input class="form-control" value=${filtros.responsavel} onInput=${(event) => setFiltros({ ...filtros, responsavel: event.target.value })} />
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard} title="Tabela">
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table process-wide-table">
            <thead>
              <tr>
                <th>Processo</th>
                <th>Vaga</th>
                <th>Data de Abertura</th>
                <th>Data de Encerramento</th>
                <th>Duração</th>
                <th>Quantidade de Candidatos</th>
                <th>Aprovado Final</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${carregando
                ? html`<${TabelaVazia} colunas=${8} texto="Carregando processos encerrados..." />`
                : processosEncerrados.length
                  ? processosEncerrados.map((processo) => {
                      const candidatosProcesso = obterCandidatosDoProcesso(candidatosComFluxo, processo);
                      const aprovados = candidatosProcesso.filter(
                        (candidato) =>
                          canonicalizeCandidateStatus(candidato.status_fluxo || candidato.status_candidato) ===
                          CANDIDATE_STATUS_APPROVED,
                      );
                      return html`
                        <tr key=${obterChaveProcesso(processo)}>
                          <td class="process-code-cell">
                            <strong title=${obterTooltipProcessoUsuario(processo)}>
                              ${obterCodigoProcessoUsuario(processo)}
                            </strong>
                            <span>${processo.data_criacao ? `Criado em ${formatarDataCurta(processo.data_criacao)}` : processo.vaga || '-'}</span>
                          </td>
                          <td>${processo.vaga || '-'}</td>
                          <td>${formatarDataCurta(processo.data_criacao)}</td>
                          <td>${formatarDataCurta(processo.data_encerramento_real || processo.encerrado_em || processo.data_encerramento)}</td>
                          <td>${calcularDuracaoProcesso(processo)}</td>
                          <td>${candidatosProcesso.length}</td>
                          <td>${aprovados.map((item) => item.nome_candidato).filter(Boolean).join(', ') || '-'}</td>
                          <td class="text-end">
                            <div class="process-row-actions">
                              <button type="button" class="btn btn-sm btn-outline-primary process-primary-action" onClick=${() => abrirDetalhe(processo)}>
                                Ver Detalhes
                              </button>
                              <${MenuAcoesProcesso}
                                acoes=${[
                                  {
                                    label: 'Ver Dossiê',
                                    icon: 'article',
                                    onClick: () => abrirDetalhe(processo),
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      `;
                    })
                  : html`<${TabelaVazia} colunas=${8} texto="Nenhum processo encerrado encontrado." />`}
            </tbody>
          </table>
        </div>
      </${SectionCard}>
    </${PainelRh}>
  `;
}

export function TelaProcessosDecisoesPendentes({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processos, setProcessos] = useState([]);
  const [candidatos, setCandidatos] = useState([]);

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await carregarDadosProcessos({ incluirEntrevistas: false });
      setProcessos(dados.processos);
      setCandidatos(dados.candidatos);
      if (dados.erros.length) setErro(dados.erros.join(' '));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const processosPorId = useMemo(
    () =>
      processos.reduce((acc, processo) => {
        const referencia = obterReferenciaProcessoSeguro(processo);
        if (referencia) acc[referencia] = processo;
        return acc;
      }, {}),
    [processos],
  );
  const candidatosComFluxo = useMemo(
    () =>
      candidatos.map((candidato) => {
        const processo =
          processosPorId[obterReferenciaProcessoDoCandidato(candidato)];
        return montarCandidatoDeFluxo(candidato, processo?.status || '');
      }),
    [candidatos, processosPorId],
  );
  const pendentes = useMemo(
    () =>
      candidatosComFluxo.filter(
        (candidato) =>
          candidato.acoes_fluxo?.canApprove ||
          candidato.acoes_fluxo?.canEliminate ||
          candidato.acoes_fluxo?.canSendToTalentBank,
      ),
    [candidatosComFluxo],
  );
  const pendentesMaisTresDias = pendentes.filter((candidato) => {
    const data = obterDataValor(
      candidato.data_movimentacao ||
      candidato.data_atualizacao_pipeline ||
      candidato.data_prova,
    );
    return data && (Date.now() - data.getTime()) / 86400000 > 3;
  }).length;
  const processosPendentes = new Set(
    pendentes.map(obterReferenciaProcessoDoCandidato).filter(Boolean),
  ).size;
  const responsaveisPendentes = new Set(
    pendentes.map((candidato) => {
      const processo = processosPorId[obterReferenciaProcessoDoCandidato(candidato)] || {};
      return obterResponsavelProcesso(processo, candidato);
    }).filter((responsavel) => responsavel && responsavel !== 'Não informado'),
  ).size;

  const abrirDetalhe = (candidato) => {
    const processo = processosPorId[obterReferenciaProcessoDoCandidato(candidato)] || {};
    sessionStorage.setItem(
      CHAVE_PROCESSO_DETALHE,
      obterReferenciaProcessoSeguro(processo) || obterReferenciaProcessoDoCandidato(candidato),
    );
    controlador.irParaTelaProtegida('screen-process-details');
  };

  return html`
    <${PainelRh}
      screenId="screen-process-decisions"
      navAtiva="screen-process-decisions"
      subtituloMarca="Processos seletivos"
      placeholderBusca="Decisões pendentes"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Processos"
        title="Decisões Pendentes"
        description="Acompanhe candidatos e processos aguardando decisão final."
      />
      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard} title="Indicadores">
        <${MetricGrid}
          items=${[
            { label: 'Total Pendente', value: pendentes.length, icon: 'rule', variant: 'is-analysis' },
            { label: 'Pendentes há mais de 3 dias', value: pendentesMaisTresDias, icon: 'timer' },
            { label: 'Pendentes por Processo', value: processosPendentes, icon: 'folder_managed' },
            { label: 'Pendentes por Responsável', value: responsaveisPendentes, icon: 'supervisor_account' },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Lista Principal"
        description="A decisão continua manual; esta tela apenas organiza os candidatos pendentes."
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table process-wide-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Processo</th>
                <th>Vaga</th>
                <th>Responsável</th>
                <th>Tempo pendente</th>
                <th>Status</th>
                <th class="text-end">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${carregando
                ? html`<${TabelaVazia} colunas=${7} texto="Carregando decisões pendentes..." />`
                : pendentes.length
                  ? pendentes.map((candidato) => {
                      const processo = processosPorId[obterReferenciaProcessoDoCandidato(candidato)] || {};
                      return html`
                        <tr key=${candidato.id_registro}>
                          <td>${candidato.nome_candidato || '-'}</td>
                          <td class="process-code-cell">
                            <strong title=${obterTooltipProcessoUsuario(processo)}>
                              ${obterCodigoProcessoUsuario(processo) !== '-'
                                ? obterCodigoProcessoUsuario(processo)
                                : limparCodigoProcessoUsuario(obterReferenciaProcessoDoCandidato(candidato)) || '-'}
                            </strong>
                            <span>${processo.data_criacao ? `Criado em ${formatarDataCurta(processo.data_criacao)}` : candidato.vaga || processo.vaga || '-'}</span>
                          </td>
                          <td>${candidato.vaga || processo.vaga || '-'}</td>
                          <td>${obterResponsavelProcesso(processo, candidato)}</td>
                          <td>${obterTempoPendente(candidato)}</td>
                          <td>
                            <span class=${`process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_fluxo)}`}>
                              ${candidato.status_fluxo || '-'}
                            </span>
                          </td>
                          <td class="text-end">
                            <button type="button" class="btn btn-sm btn-outline-primary" onClick=${() => abrirDetalhe(candidato)}>
                              Abrir detalhes
                            </button>
                          </td>
                        </tr>
                      `;
                    })
                  : html`<${TabelaVazia} colunas=${7} texto="Nenhuma decisão final pendente." />`}
            </tbody>
          </table>
        </div>
      </${SectionCard}>
    </${PainelRh}>
  `;
}

export function TelaDetalhesProcesso({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvandoEntrevista, setSalvandoEntrevista] = useState(false);
  const [erro, setErro] = useState('');
  const [processo, setProcesso] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [entrevistas, setEntrevistas] = useState([]);
  const [slotsEntrevista, setSlotsEntrevista] = useState([]);
  const [carregandoSlotsEntrevista, setCarregandoSlotsEntrevista] = useState(false);
  const [preAnalises, setPreAnalises] = useState([]);
  const [paginaPreAnalises, setPaginaPreAnalises] = useState(1);
  const [totalPaginasPreAnalises, setTotalPaginasPreAnalises] = useState(1);
  const [totalItensPreAnalises, setTotalItensPreAnalises] = useState(0);
  const [classificacoesPreAnalises, setClassificacoesPreAnalises] = useState([]);
  const [filtrosPreAnalises, setFiltrosPreAnalises] = useState({
    nome: '',
    scoreMin: '',
    scoreMax: '',
    classificacao: '',
    mostrarOcultos: false,
  });
  const [emailsRecebidos, setEmailsRecebidos] = useState([]);
  const [statusEmailRecebido, setStatusEmailRecebido] = useState(null);
  const [avisosSecoes, setAvisosSecoes] = useState({});
  const [anotacoesDossie, setAnotacoesDossie] = useState([]);
  const [analiseDossie, setAnaliseDossie] = useState(null);
  const [erroDossie, setErroDossie] = useState('');
  const [mensagemDossie, setMensagemDossie] = useState('');
  const [salvandoAnotacaoDossie, setSalvandoAnotacaoDossie] = useState(false);
  const [anotacaoDossieEditandoId, setAnotacaoDossieEditandoId] = useState('');
  const [formularioAnotacaoDossie, setFormularioAnotacaoDossie] = useState({
    id_teste: '',
    nome_candidato: '',
    texto: '',
  });
  const [filtrosDossie, setFiltrosDossie] = useState({
    processo: '',
    candidato: '',
    data: '',
    etapa: '',
    classificacao: '',
    status: '',
    notaMin: '',
    notaMax: '',
    scoreMin: '',
    scoreMax: '',
  });
  const [carregandoEmails, setCarregandoEmails] = useState(false);
  const [analisandoEmailUid, setAnalisandoEmailUid] = useState('');
  const [arquivoCv, setArquivoCv] = useState(null);
  const [guardarCvOriginal, setGuardarCvOriginal] = useState(false);
  const [analisandoCv, setAnalisandoCv] = useState(false);
  const [preAnaliseSelecionada, setPreAnaliseSelecionada] = useState(null);
  const [candidatoEditando, setCandidatoEditando] = useState(null);
  const [formularioCandidato, setFormularioCandidato] = useState(
    montarFormularioCandidato(null),
  );
  const [fichaCandidatoSelecionada, setFichaCandidatoSelecionada] =
    useState(null);
  const [formularioFichaCandidato, setFormularioFichaCandidato] = useState(
    montarFormularioFichaCandidato(null),
  );
  const [carregandoFichaCandidato, setCarregandoFichaCandidato] = useState('');
  const [salvandoFichaCandidato, setSalvandoFichaCandidato] = useState(false);
  const [erroFichaCandidato, setErroFichaCandidato] = useState('');
  const [mensagemFichaCandidato, setMensagemFichaCandidato] = useState('');
  const [visualizacaoCv, setVisualizacaoCv] = useState(null);
  const [resultadoAnaliseSelecionado, setResultadoAnaliseSelecionado] =
    useState(null);
  const [detalheProvaSelecionado, setDetalheProvaSelecionado] = useState(null);
  const [carregandoDetalheProva, setCarregandoDetalheProva] = useState('');
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState(null);
  const [documentosEntrevista, setDocumentosEntrevista] = useState([]);
  const [aprovacaoSelecionada, setAprovacaoSelecionada] = useState(null);
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false);
  const [enviandoCanalAprovacao, setEnviandoCanalAprovacao] = useState('');
  const [eliminacaoSelecionada, setEliminacaoSelecionada] = useState(null);
  const [formularioEliminacao, setFormularioEliminacao] = useState({
    motivo_eliminacao: '',
    etapa_eliminacao: '',
  });
  const [erroEliminacao, setErroEliminacao] = useState('');
  const [entrevistaEdicao, setEntrevistaEdicao] = useState(null);
  const [salvandoEdicaoEntrevista, setSalvandoEdicaoEntrevista] = useState(false);
  const [formularioEdicaoEntrevista, setFormularioEdicaoEntrevista] = useState({
    id_slot: '',
    status_entrevista: CANDIDATE_STATUS_PENDING_CONFIRMATION,
    observacoes_rh: '',
    mensagem_personalizada: '',
  });
  const [formularioEntrevista, setFormularioEntrevista] = useState({
    id_registro: '',
    id_processo: '',
    id_processo_ref: '',
    id_slot: '',
    data_entrevista: '',
    status_entrevista: CANDIDATE_STATUS_PENDING_CONFIRMATION,
    link_agendamento: '',
    observacoes_rh: '',
    mensagem_personalizada: '',
    email: '',
    telefone: '',
    whatsapp: '',
  });
  const [mensagemEntrevistaEditada, setMensagemEntrevistaEditada] =
    useState(false);
  const [feedbackLinkPublico, setFeedbackLinkPublico] = useState('');
  const [observacoesPublicasVaga, setObservacoesPublicasVaga] = useState('');
  const [requisitosPublicos, setRequisitosPublicos] = useState(() =>
    montarItensPublicosPadrao(REQUISITOS_PUBLICOS_PADRAO),
  );
  const [responsabilidadesPublicas, setResponsabilidadesPublicas] = useState(() =>
    montarItensPublicosPadrao(RESPONSABILIDADES_PUBLICAS_PADRAO),
  );
  const [salvandoObservacoesPublicas, setSalvandoObservacoesPublicas] =
    useState(false);
  const [buscaCandidatosProcesso, setBuscaCandidatosProcesso] = useState('');
  const [paginaCandidatosProcesso, setPaginaCandidatosProcesso] = useState(1);
  const [paginaCandidatosAprovados, setPaginaCandidatosAprovados] = useState(1);
  const [menuAcoesCandidatoAberto, setMenuAcoesCandidatoAberto] = useState('');
  const [whatsappSelecionado, setWhatsappSelecionado] = useState(null);
  const [formularioWhatsapp, setFormularioWhatsapp] = useState({
    tipo_contato: 'contato_enviado',
    observacao: '',
    mensagem: '',
  });
  const [registrandoWhatsapp, setRegistrandoWhatsapp] = useState(false);
  const [erroWhatsapp, setErroWhatsapp] = useState('');
  const [secoesExpandidas, setSecoesExpandidas] = useState({
    paginaPublica: false,
    recebimentoEmail: true,
    candidatosInscritos: true,
    dossieProcesso: true,
    preAnaliseCv: true,
    candidatosProcesso: true,
    candidatosAprovados: true,
  });

  const idProcesso = sessionStorage.getItem(CHAVE_PROCESSO_DETALHE) || '';

  const alternarSecao = (chave) => {
    setSecoesExpandidas((anteriores) => ({
      ...anteriores,
      [chave]: !anteriores[chave],
    }));
  };

  useEffect(() => {
    if (!feedbackLinkPublico) return undefined;

    const timeout = window.setTimeout(() => setFeedbackLinkPublico(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedbackLinkPublico]);

  useEffect(() => {
    if (!mensagemDossie) return undefined;

    const timeout = window.setTimeout(() => setMensagemDossie(''), 3600);
    return () => window.clearTimeout(timeout);
  }, [mensagemDossie]);

  useEffect(() => {
    if (!menuAcoesCandidatoAberto) return undefined;

    const fecharMenu = () => setMenuAcoesCandidatoAberto('');
    const fecharNoEscape = (event) => {
      if (event.key === 'Escape') fecharMenu();
    };

    document.addEventListener('click', fecharMenu);
    document.addEventListener('keydown', fecharNoEscape);
    return () => {
      document.removeEventListener('click', fecharMenu);
      document.removeEventListener('keydown', fecharNoEscape);
    };
  }, [menuAcoesCandidatoAberto]);

  const carregarEmailsDoProcesso = async () => {
    if (!idProcesso) return;
    setCarregandoEmails(true);
    try {
      const payload = await lerEmailsRecebidosProcesso(idProcesso, 12);
      setStatusEmailRecebido(payload || null);
      setEmailsRecebidos(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      setStatusEmailRecebido({
        configured: false,
        message:
          error?.message ||
          'Recebimento de e-mail ainda não configurado ou indisponível no momento.',
      });
      setEmailsRecebidos([]);
    } finally {
      setCarregandoEmails(false);
    }
  };

  const carregar = async (pagina = 1, filtrosCv = filtrosPreAnalises) => {
    if (!idProcesso) {
      setErro('Processo não identificado.');
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro('');
    setAvisosSecoes({});

    try {
      const [
        resultadoDetalhe,
        resultadoPreAnalises,
        resultadoEntrevistas,
        resultadoSlots,
        resultadoAnotacoesDossie,
      ] = await Promise.allSettled([
        lerDetalheProcesso(idProcesso),
        lerPreAnalisesCv(idProcesso, pagina, 5, filtrosCv),
        lerEntrevistas({ idProcesso }),
        lerSlotsEntrevista({ idProcesso }),
        lerAnotacoesDossieProcesso(idProcesso),
      ]);

      if (resultadoDetalhe.status !== 'fulfilled') {
        throw resultadoDetalhe.reason;
      }

      const detalhe = resultadoDetalhe.value || {};
      const listaPreAnalises =
        resultadoPreAnalises.status === 'fulfilled'
          ? resultadoPreAnalises.value
          : {};
      const listaEntrevistas =
        resultadoEntrevistas.status === 'fulfilled'
          ? resultadoEntrevistas.value
          : [];
      const listaSlots =
        resultadoSlots.status === 'fulfilled' ? resultadoSlots.value : [];
      const listaAnotacoesDossie =
        resultadoAnotacoesDossie.status === 'fulfilled'
          ? resultadoAnotacoesDossie.value
          : [];
      const novosAvisos = {};

      if (resultadoPreAnalises.status !== 'fulfilled') {
        console.error('Erro ao carregar pré-análise do processo.', resultadoPreAnalises.reason);
        novosAvisos.preAnaliseCv =
          'Não foi possível carregar a pré-análise de CV agora.';
      }

      if (resultadoEntrevistas.status !== 'fulfilled') {
        console.error('Erro ao carregar entrevistas do processo.', resultadoEntrevistas.reason);
        novosAvisos.entrevistas =
          'Não foi possível carregar as entrevistas agora.';
      }

      if (resultadoSlots.status !== 'fulfilled') {
        console.error('Erro ao carregar horários de entrevista.', resultadoSlots.reason);
        novosAvisos.entrevistas =
          novosAvisos.entrevistas ||
          'Não foi possível carregar os horários de entrevista agora.';
      }

      if (resultadoAnotacoesDossie.status !== 'fulfilled') {
        console.error(
          'Erro ao carregar anotações do dossiê.',
          resultadoAnotacoesDossie.reason,
        );
        novosAvisos.dossieProcesso =
          'Não foi possível carregar as anotações do dossiê agora.';
      }

      if (detalhe?.processo) {
        sessionStorage.setItem(
          CHAVE_PROCESSO_DETALHE,
          obterReferenciaProcesso(detalhe.processo),
        );
      }
      setProcesso(detalhe?.processo || null);
      setObservacoesPublicasVaga(
        detalhe?.processo?.observacoes_publicas_vaga || '',
      );
      setRequisitosPublicos(
        normalizarItensPublicos(
          detalhe?.processo?.requisitos_publicos,
          'requisitos',
          REQUISITOS_PUBLICOS_PADRAO,
        ),
      );
      setResponsabilidadesPublicas(
        normalizarItensPublicos(
          detalhe?.processo?.responsabilidades_publicas,
          'responsabilidades',
          RESPONSABILIDADES_PUBLICAS_PADRAO,
        ),
      );
      setResumo(detalhe?.resumo || null);
      setCandidatos(Array.isArray(detalhe?.candidatos) ? detalhe.candidatos : []);
      setPreAnalises(
        Array.isArray(listaPreAnalises?.items) ? listaPreAnalises.items : [],
      );
      setPaginaPreAnalises(Number(listaPreAnalises?.page || 1));
      setTotalPaginasPreAnalises(Number(listaPreAnalises?.total_pages || 1));
      setTotalItensPreAnalises(Number(listaPreAnalises?.total_items || 0));
      setClassificacoesPreAnalises(
        Array.isArray(listaPreAnalises?.classificacoes)
          ? listaPreAnalises.classificacoes
          : [],
      );
      setEntrevistas(Array.isArray(listaEntrevistas) ? listaEntrevistas : []);
      setSlotsEntrevista(Array.isArray(listaSlots) ? listaSlots : []);
      setAnotacoesDossie(
        Array.isArray(listaAnotacoesDossie) ? listaAnotacoesDossie : [],
      );
      setAvisosSecoes(novosAvisos);
    } catch (error) {
      setErro(
        error.message || 'Não foi possível carregar o detalhe do processo.',
      );
    } finally {
      setCarregando(false);
    }
  };

  const carregarSlotsEntrevistaDoProcesso = async (referenciaProcesso = '') => {
    const filtroProcesso = String(
      referenciaProcesso || obterReferenciaProcesso(processo) || idProcesso || '',
    ).trim();

    setCarregandoSlotsEntrevista(true);
    try {
      const listaSlots = await lerSlotsEntrevista({ idProcesso: filtroProcesso });
      const slotsNormalizados = Array.isArray(listaSlots)
        ? listaSlots
        : Array.isArray(listaSlots?.slots)
          ? listaSlots.slots
          : Array.isArray(listaSlots?.data)
            ? listaSlots.data
            : [];
      setSlotsEntrevista(slotsNormalizados);
    } catch (error) {
      console.error('Erro ao carregar horários de entrevista.', error);
      setSlotsEntrevista([]);
      setErro(
        error?.message || 'Não foi possível carregar os horários de entrevista agora.',
      );
    } finally {
      setCarregandoSlotsEntrevista(false);
    }
  };

  useEffect(() => {
    carregar(1);
  }, []);

  const processoEncerrado = isProcessClosed(processo);
  const basePublicaConfigurada = useMemo(
    () =>
      String(
        processo?.public_candidate_base_url || obterBasePublicaCandidatura(),
      ).trim(),
    [processo?.public_candidate_base_url],
  );
  const urlInternaCandidatura = useMemo(
    () =>
      processo?.link_publico_slug
        ? montarUrlPublicaCandidatura(processo.link_publico_slug)
        : '',
    [processo?.link_publico_slug],
  );
  const urlPublicaCandidatura = useMemo(
    () =>
      processo?.link_publico_slug && basePublicaConfigurada
        ? montarUrlPublicaCandidatura(
          processo.link_publico_slug,
          basePublicaConfigurada,
        )
        : '',
    [processo?.link_publico_slug, basePublicaConfigurada],
  );
  const linkPublicoAtivo = Boolean(processo?.link_publico_ativo) && !processoEncerrado;
  const statusPaginaPublica = !processo?.link_publico_slug
    ? 'Não gerada'
    : linkPublicoAtivo
      ? 'Ativa'
      : 'Inativa';
  const candidatosComFluxo = useMemo(
    () =>
      candidatos.map((candidato) =>
        montarCandidatoDeFluxo(candidato, processo?.status || ''),
      ),
    [candidatos, processo?.status],
  );
  const candidatosInscritos = useMemo(
    () =>
      candidatosComFluxo.filter((candidato) => {
        const origem = normalizarTextoComparacao(candidato.origem);
        const status = canonicalizeCandidateStatus(
          candidato.status_fluxo || candidato.status_candidato,
        );
        return origem.includes('pagina de candidatura') && status === CANDIDATE_STATUS_ANALYSIS;
      }),
    [candidatosComFluxo],
  );
  const candidatosOperacionais = useMemo(
    () =>
      candidatosComFluxo.filter(
        (candidato) =>
          !candidatosInscritos.some(
            (inscrito) => Number(inscrito.id_registro || 0) === Number(candidato.id_registro || 0),
          ) &&
          isActiveCandidateStatus(candidato.status_fluxo || candidato.status_candidato),
      ),
    [candidatosComFluxo, candidatosInscritos],
  );
  const candidatosAprovados = useMemo(
    () =>
      candidatosComFluxo.filter(
        (candidato) =>
          canonicalizeCandidateStatus(
            candidato.status_fluxo || candidato.status_candidato,
          ) === CANDIDATE_STATUS_APPROVED,
      ),
    [candidatosComFluxo],
  );
  const candidatosOperacionaisFiltrados = useMemo(() => {
    const termo = normalizarTextoComparacao(buscaCandidatosProcesso);
    if (!termo) return candidatosOperacionais;

    return candidatosOperacionais.filter((candidato) => {
      const origem = formatarOrigemCandidato(candidato);
      const localidade = [candidato.cidade, candidato.bairro]
        .map((valor) => String(valor || '').trim())
        .filter(Boolean)
        .join(' ');
      const textoBusca = [
        candidato.nome_candidato,
        candidato.vaga,
        candidato.id_registro,
        candidato.id_teste,
        candidato.id_candidato,
        candidato.status_fluxo,
        origem,
        localidade,
        ...(Array.isArray(candidato.tags) ? candidato.tags : []),
      ]
        .map(normalizarTextoComparacao)
        .join(' ');
      return textoBusca.includes(termo);
    });
  }, [buscaCandidatosProcesso, candidatosOperacionais]);
  const candidatosProcessoPaginados = useMemo(
    () =>
      obterItensPaginados(
        candidatosOperacionaisFiltrados,
        paginaCandidatosProcesso,
        TAMANHO_PAGINA_CANDIDATOS_DETALHE,
      ),
    [candidatosOperacionaisFiltrados, paginaCandidatosProcesso],
  );
  const candidatosAprovadosPaginados = useMemo(
    () =>
      obterItensPaginados(
        candidatosAprovados,
        paginaCandidatosAprovados,
        TAMANHO_PAGINA_APROVADOS_DETALHE,
      ),
    [candidatosAprovados, paginaCandidatosAprovados],
  );
  const candidatosDossie = useMemo(
    () => montarCandidatosDossie(candidatosComFluxo, entrevistas),
    [candidatosComFluxo, entrevistas],
  );
  const candidatosDossieFiltrados = useMemo(
    () => filtrarCandidatosDossie(candidatosDossie, filtrosDossie),
    [candidatosDossie, filtrosDossie],
  );
  const estatisticasDossie = useMemo(
    () => calcularEstatisticasDossie(candidatosDossieFiltrados),
    [candidatosDossieFiltrados],
  );

  useEffect(() => {
    setPaginaCandidatosProcesso(1);
  }, [buscaCandidatosProcesso, candidatosOperacionais.length]);

  useEffect(() => {
    setPaginaCandidatosAprovados(1);
  }, [candidatosAprovados.length]);

  useEffect(() => {
    let ativo = true;

    gerarAnaliseInteligenteProcesso({
      processo,
      candidatos: candidatosDossieFiltrados,
      anotacoes: anotacoesDossie,
      gerado_em: new Date().toISOString(),
    }).then((resultado) => {
      if (ativo) setAnaliseDossie(resultado);
    });

    return () => {
      ativo = false;
    };
  }, [processo, candidatosDossieFiltrados, anotacoesDossie]);

  const encontrarAnaliseDoInscrito = (candidato) =>
    preAnalises.find((item) => {
      const emailAnalise = normalizarTextoComparacao(item.email);
      const emailCandidato = normalizarTextoComparacao(candidato.email);
      return emailAnalise && emailCandidato && emailAnalise === emailCandidato;
    }) ||
    (candidato.cv_id_pre_analise
      ? {
        id_pre_analise: candidato.cv_id_pre_analise,
        nome_candidato: candidato.nome_candidato,
        email: candidato.email,
        telefone: candidato.telefone,
        whatsapp: candidato.whatsapp,
        score_final: candidato.cv_score_final,
        classificacao: candidato.cv_classificacao,
        classificacao_slug: candidato.cv_classificacao_slug,
        problemas: candidato.cv_problemas,
      }
      : null);
  const slotsDisponiveisEntrevista = useMemo(
    () => {
      const agora = new Date();
      return slotsEntrevista.filter(
        (slot) => {
          const statusSlot = normalizarTextoComparacao(
            slot.status_calculado || slot.status_slot || slot.status || '',
          );
          const inicioSlot = obterDataInicioSlotEntrevista(slot);
          return (
            statusSlot !== 'bloqueado'
            && statusSlot !== 'lotado'
            && obterVagasDisponiveisSlotEntrevista(slot) > 0
            && inicioSlot
            && inicioSlot > agora
          );
        },
      );
    },
    [slotsEntrevista],
  );

  const formatarHorarioSlotEntrevista = (slot) => {
    if (!slot) return '-';

    const inicio = obterDataInicioSlotEntrevista(slot);
    const fim = obterDataFimSlotEntrevista(slot);
    const vagasDisponiveis = obterVagasDisponiveisSlotEntrevista(slot);
    const rotuloVagas =
      vagasDisponiveis === 1 ? 'vaga disponível' : 'vagas disponíveis';

    if (!inicio || !fim) {
      return `${formatarDataHora(slot.inicio)} até ${formatarDataHora(slot.fim)} — ${vagasDisponiveis} ${rotuloVagas}`;
    }

    const horaInicio = inicio.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const horaFim = fim.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${inicio.toLocaleDateString('pt-BR')} - ${horaInicio} às ${horaFim} — ${vagasDisponiveis} ${rotuloVagas}`;
  };

  const montarDataEntrevistaIso = (slot) => {
    const data = obterDataInicioSlotEntrevista(slot);
    if (!data) return '';

    const pad = (value) => String(value).padStart(2, '0');
    return [
      data.getFullYear(),
      pad(data.getMonth() + 1),
      pad(data.getDate()),
    ].join('-') + `T${pad(data.getHours())}:${pad(data.getMinutes())}:00`;
  };

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      setErro('Currículo não encontrado para este candidato.');
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

  const abrirWhatsappCandidato = (candidato) => {
    const numero = normalizarNumeroWhatsAppBrasil(
      candidato?.whatsapp || candidato?.telefone,
    );
    if (!numero) {
      setErro('O candidato não possui telefone/WhatsApp válido para contato.');
      return;
    }

    const mensagem = montarMensagemWhatsAppProcesso(candidato, processo);
    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
      '_blank',
      'noopener,noreferrer',
    );
    setErroWhatsapp('');
    setFormularioWhatsapp({
      tipo_contato: 'contato_enviado',
      observacao: '',
      mensagem,
    });
    setWhatsappSelecionado(candidato);
  };

  const atualizarCampoWhatsapp = (campo, valor) => {
    setFormularioWhatsapp((atual) => ({
      ...atual,
      [campo]: valor,
    }));
    setErroWhatsapp('');
  };

  const salvarRegistroWhatsapp = async () => {
    if (!whatsappSelecionado?.id_registro) {
      setErroWhatsapp('Candidato sem registro para salvar o contato.');
      return;
    }

    setRegistrandoWhatsapp(true);
    setErroWhatsapp('');
    try {
      await registrarWhatsappContatoManual(
        whatsappSelecionado.id_registro,
        formularioWhatsapp,
      );
      setWhatsappSelecionado(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      setErroWhatsapp(error?.message || 'Não foi possível registrar o contato WhatsApp.');
    } finally {
      setRegistrandoWhatsapp(false);
    }
  };

  const abrirFichaCandidato = async (candidato) => {
    if (!candidato?.id_teste) {
      setErro('Candidato sem identificador para abrir a ficha.');
      return;
    }

    try {
      setErro('');
      setErroFichaCandidato('');
      setMensagemFichaCandidato('');
      setCarregandoFichaCandidato(String(candidato.id_teste));
      const ficha = await lerFichaCandidato(candidato.id_teste);
      setFichaCandidatoSelecionada(ficha);
      setFormularioFichaCandidato(montarFormularioFichaCandidato(ficha));
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar a ficha do candidato.');
    } finally {
      setCarregandoFichaCandidato('');
    }
  };

  const atualizarCampoFichaCandidato = (campo, valor) => {
    setFormularioFichaCandidato((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
    setMensagemFichaCandidato('');
  };

  const salvarFichaCandidato = async () => {
    const idTeste = fichaCandidatoSelecionada?.candidato?.id_teste ||
      fichaCandidatoSelecionada?.candidato?.id;
    if (!idTeste) return;

    setSalvandoFichaCandidato(true);
    setErroFichaCandidato('');
    setMensagemFichaCandidato('');

    try {
      const fichaAtualizada = await atualizarFichaCandidato(idTeste, formularioFichaCandidato);
      setFichaCandidatoSelecionada(fichaAtualizada);
      setFormularioFichaCandidato(montarFormularioFichaCandidato(fichaAtualizada));
      setMensagemFichaCandidato('Ficha salva com sucesso.');
      await carregar(paginaPreAnalises);
    } catch (error) {
      setErroFichaCandidato(error?.message || 'Não foi possível salvar a ficha do candidato.');
    } finally {
      setSalvandoFichaCandidato(false);
    }
  };

  const imprimirFichaSelecionada = () => {
    try {
      imprimirFichaCandidato(fichaCandidatoSelecionada, formularioFichaCandidato);
    } catch (error) {
      setErroFichaCandidato(error?.message || 'Não foi possível imprimir a ficha do candidato.');
    }
  };

  const abrirDetalheProva = async (candidato) => {
    if (!candidatoTemProvaSalva(candidato)) {
      setErro('Este candidato ainda não possui prova salva neste processo.');
      return;
    }

    try {
      setErro('');
      const idTesteProva = candidato.id_teste_prova || candidato.id_teste;
      setCarregandoDetalheProva(String(candidato.id_registro || idTesteProva || ''));
      const detalhe = await carregarDetalhesProva(
        idTesteProva,
        obterReferenciaProcesso(processo) || idProcesso,
      );
      const processoAtualRef = String(obterReferenciaProcesso(processo) || idProcesso || '').trim();
      const processoProvaRef = String(
        detalhe?.linha?.id_processo_ref || detalhe?.linha?.id_processo || '',
      ).trim();

      if (
        processoAtualRef &&
        processoProvaRef &&
        processoAtualRef !== processoProvaRef &&
        processoAtualRef.split('@@', 1)[0] !== processoProvaRef
      ) {
        throw new Error('O resultado encontrado pertence a outro processo.');
      }

      setDetalheProvaSelecionado(detalhe);
    } catch (error) {
      setErro(error?.message || 'Não foi possível abrir o resultado da prova.');
    } finally {
      setCarregandoDetalheProva('');
    }
  };

  const analisarCvInscrito = async (candidato) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (!candidato?.id_teste) {
      setErro('Candidato inscrito não identificado.');
      return;
    }

    try {
      setErro('');
      await analisarCvCandidatoInscrito(candidato.id_teste, {
        id_processo: obterReferenciaProcesso(processo) || idProcesso,
      });
      await carregar(1);
    } catch (error) {
      setErro(error?.message || 'Não foi possível analisar o CV deste candidato.');
    }
  };

  const gerarPaginaPublica = async () => {
    if (!processo) return;

    try {
      const resultado = await gerarLinkPublicoCandidatura(
        obterReferenciaProcesso(processo) || idProcesso,
      );
      await carregar(paginaPreAnalises);
      if (resultado?.url) {
        setFeedbackLinkPublico(
          resultado?.aviso_url_publica || 'Página pública gerada com sucesso.',
        );
      }
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível gerar a página pública de candidatura.',
      );
    }
  };

  const copiarLinkPublico = async () => {
    if (!linkPublicoAtivo) return;
    if (!urlPublicaCandidatura) {
      setErro(AVISO_URL_PUBLICA_NAO_CONFIGURADA);
      return;
    }

    try {
      await copiarTexto(urlPublicaCandidatura);
      setFeedbackLinkPublico('Link público copiado.');
    } catch (error) {
      setErro('Não foi possível copiar o link público agora.');
    }
  };

  const abrirPaginaPublica = () => {
    const url = urlPublicaCandidatura || urlInternaCandidatura;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const desativarPaginaPublica = async () => {
    if (!processo) return;
    if (!window.confirm('Deseja desativar o link público desta vaga?')) {
      return;
    }

    try {
      await desativarLinkPublicoCandidatura(
        obterReferenciaProcesso(processo) || idProcesso,
      );
      await carregar(paginaPreAnalises);
      setFeedbackLinkPublico('Link público desativado.');
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível desativar o link público desta vaga.',
      );
    }
  };

  const salvarObservacoesPublicasVaga = async () => {
    if (!processo) return;

    try {
      setSalvandoObservacoesPublicas(true);
      await atualizarProcesso(obterReferenciaProcesso(processo) || idProcesso, {
        quantidade_vagas: Number(processo.quantidade_vagas || 0),
        data_encerramento: processo.data_encerramento || '',
        operacao: processo.operacao || '',
        trilha: processo.trilha || '',
        usa_nota_corte: Number(processo.usa_nota_corte || 0),
        nota_corte:
          processo.nota_corte !== '' && processo.nota_corte !== null
            ? Number(processo.nota_corte)
            : null,
        status: processo.status || 'Aberto',
        link_agendamento: processo.link_agendamento || '',
        observacoes_publicas_vaga: observacoesPublicasVaga,
        requisitos_publicos: serializarItensPublicos(
          'requisitos',
          requisitosPublicos,
        ),
        responsabilidades_publicas: serializarItensPublicos(
          'responsabilidades',
          responsabilidadesPublicas,
        ),
      });
      await carregar(paginaPreAnalises);
      setFeedbackLinkPublico('Configurações da página pública salvas.');
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível salvar as configurações da página pública.',
      );
    } finally {
      setSalvandoObservacoesPublicas(false);
    }
  };

  const abrirEliminacao = (candidato) => {
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');
    if (estadoAcoes.processClosed || processoEncerrado) {
      setErro('Processo encerrado. Movimentações não são permitidas.');
      return;
    }

    if (!estadoAcoes.canEliminate) {
      setErro('A eliminação não está disponível para o status atual deste candidato.');
      return;
    }

    setErroEliminacao('');
    setFormularioEliminacao({
      motivo_eliminacao: '',
      etapa_eliminacao: '',
    });
    setEliminacaoSelecionada(candidato);
  };

  const atualizarStatus = async (idRegistro, status, dadosStatus = {}) => {
    const statusSeguro = String(status || '').trim();
    const candidatoAtual = candidatos.find(
      (item) => Number(item.id_registro || 0) === Number(idRegistro || 0),
    );
    const statusAtual = canonicalizeCandidateStatus(
      candidatoAtual?.status_fluxo || candidatoAtual?.status_candidato,
    );

    if (statusAtual === CANDIDATE_STATUS_APPROVED) {
      setErro(MENSAGEM_CANDIDATO_APROVADO_BLOQUEADO);
      return;
    }

    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (statusSeguro === 'Eliminado') {
      const motivoInformado = String(dadosStatus.motivo_eliminacao || '').trim();
      if (!motivoInformado) {
        abrirEliminacao(candidatoAtual || { id_registro: idRegistro });
        return;
      }
    }

    try {
      await atualizarStatusCandidato(idRegistro, {
        status_candidato: statusSeguro,
        ...(statusSeguro === CANDIDATE_STATUS_APPROVED ? dadosStatus : {}),
        ...(statusSeguro === CANDIDATE_STATUS_ELIMINATED ? dadosStatus : {}),
      });
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível atualizar o status.');
    }
  };

  const confirmarEliminacao = async () => {
    if (!eliminacaoSelecionada?.id_registro) return;

    const motivo = String(formularioEliminacao.motivo_eliminacao || '').trim();
    const etapa = String(formularioEliminacao.etapa_eliminacao || '').trim();
    if (!motivo) {
      setErroEliminacao('Selecione o motivo da eliminação.');
      return;
    }
    if (motivo === 'Eliminado na entrevista' && !etapa) {
      setErroEliminacao('Selecione em qual entrevista ocorreu a eliminação.');
      return;
    }

    await atualizarStatus(
      eliminacaoSelecionada.id_registro,
      CANDIDATE_STATUS_ELIMINATED,
      {
        motivo_eliminacao: motivo,
        etapa_eliminacao: motivo === 'Eliminado na entrevista' ? etapa : '',
        data_eliminacao: new Date().toISOString(),
      },
    );
    setEliminacaoSelecionada(null);
    setErroEliminacao('');
  };

  const abrirAprovacao = (candidato) => {
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');
    if (estadoAcoes.processClosed || processoEncerrado) {
      setErro('Processo encerrado. Movimentações não são permitidas.');
      return;
    }

    if (!estadoAcoes.canApprove) {
      setErro('A aprovação não está disponível para o status atual deste candidato.');
      return;
    }

    setAprovacaoSelecionada(candidato);
  };

  const confirmarAprovacao = async (dadosAprovacao) => {
    if (!aprovacaoSelecionada) return;

    setSalvandoAprovacao(true);
    try {
      await atualizarStatus(
        aprovacaoSelecionada.id_registro,
        CANDIDATE_STATUS_APPROVED,
        dadosAprovacao,
      );
      setAprovacaoSelecionada(null);
    } finally {
      setSalvandoAprovacao(false);
    }
  };

  const enviarAprovacaoWhatsApp = async (dadosAprovacao) => {
    if (!aprovacaoSelecionada) return;
    const numero = normalizarNumeroWhatsAppBrasil(
      aprovacaoSelecionada.whatsapp || aprovacaoSelecionada.telefone || '',
    );
    if (!numero) {
      throw new Error('O candidato não possui número de WhatsApp cadastrado.');
    }

    setEnviandoCanalAprovacao('whatsapp');
    try {
      await registrarWhatsappAprovacao(aprovacaoSelecionada.id_registro, dadosAprovacao);
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(dadosAprovacao.mensagem_aprovacao || '')}`,
        '_blank',
        'noopener,noreferrer',
      );
    } finally {
      setEnviandoCanalAprovacao('');
    }
  };

  const enviarAprovacaoEmail = async (dadosAprovacao) => {
    if (!aprovacaoSelecionada) return;
    setEnviandoCanalAprovacao('email');
    try {
      await enviarEmailAprovacao(aprovacaoSelecionada.id_registro, {
        ...dadosAprovacao,
        assunto: `Aprovação no processo seletivo - ${processo?.vaga || aprovacaoSelecionada.vaga || ''}`,
      });
    } finally {
      setEnviandoCanalAprovacao('');
    }
  };

  const enviarCv = async () => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (!arquivoCv) {
      alert('Selecione um CV antes de analisar.');
      return;
    }

    const extensaoCv = `.${String(arquivoCv.name || '').split('.').pop() || ''}`.toLowerCase();
    if (!['.pdf', '.doc', '.docx'].includes(extensaoCv)) {
      alert('Formato de currículo não suportado. Envie um arquivo PDF, DOC ou DOCX.');
      return;
    }

    try {
      setAnalisandoCv(true);
      const formData = new FormData();
      formData.append('arquivo', arquivoCv);
      formData.append('guardar_cv_original', guardarCvOriginal ? '1' : '0');
      await analisarCvProcesso(idProcesso, formData);
      setArquivoCv(null);
      await carregar(1);
    } catch (error) {
      alert(error.message || 'Não foi possível analisar o CV.');
    } finally {
      setAnalisandoCv(false);
    }
  };

  const salvarEdicao = async () => {
    if (!preAnaliseSelecionada) return;
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    try {
      await atualizarPreAnaliseCv(preAnaliseSelecionada.id_pre_analise, {
        nome_candidato: preAnaliseSelecionada.nome_candidato,
        email: preAnaliseSelecionada.email,
        telefone: preAnaliseSelecionada.telefone,
        whatsapp: preAnaliseSelecionada.whatsapp,
      });

      setPreAnaliseSelecionada(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível salvar a edição.');
    }
  };

  const abrirEdicaoCandidato = (candidato) => {
    const estadoAcoes =
      candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');
    if (estadoAcoes.processClosed || !estadoAcoes.canEdit) {
      setErro('Processo encerrado. Movimentações não são permitidas.');
      return;
    }
    if (!candidato?.id_teste) {
      setErro('Candidato sem identificador de prova para edição.');
      return;
    }

    setCandidatoEditando(candidato);
    setFormularioCandidato(montarFormularioCandidato(candidato));
  };

  const atualizarCampoCandidato = (campo, valor) => {
    setFormularioCandidato((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  };

  const salvarEdicaoCandidato = async () => {
    if (!candidatoEditando?.id_teste) return;
    const estadoAcoes =
      candidatoEditando?.acoes_fluxo ||
      getCandidateActionState(candidatoEditando, processo?.status || '');
    if (estadoAcoes.processClosed || !estadoAcoes.canEdit) {
      setErro('Processo encerrado. Movimentações não são permitidas.');
      return;
    }

    try {
      await atualizarPerfilCandidato(candidatoEditando.id_teste, {
        ...formularioCandidato,
      });
      setCandidatoEditando(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível salvar os dados do candidato.');
    }
  };

  const excluirPreAnalise = async (idPreAnalise) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (!window.confirm('Deseja excluir esta pré-análise?')) return;

    try {
      await excluirPreAnaliseCv(idPreAnalise);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível excluir a pré-análise.');
    }
  };

  const incluirNoProcesso = async (item, opcoes = {}) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (Number(item?.ja_adicionado_ao_processo || 0) === 1) {
      setErro('Este candidato já está vinculado a este processo.');
      return;
    }

    try {
      await adicionarPreAnaliseAoProcesso(item.id_pre_analise, opcoes);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível adicionar ao processo.');
    }
  };

  const utilizarCandidatoNaoQualificado = async (item) => {
    const confirmar = window.confirm(
      `Este candidato foi classificado como ${item.classificacao || 'Não qualificado'}, com score de ${item.score_final ?? '-'}. Deseja utilizar este candidato mesmo assim?`,
    );
    if (!confirmar) return;
    await incluirNoProcesso(item, {
      manual_override: true,
      motivo_override:
        'Utilizado manualmente pelo RH apesar da classificação automática.',
    });
  };

  const enviarPreAnaliseAoBancoTalentos = async (item) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (Number(item?.ja_adicionado_ao_processo || 0) === 1) {
      setErro('Este candidato já está vinculado a este processo.');
      return;
    }

    const confirmar = window.confirm(
      'Este candidato será enviado para o Banco de Talentos e poderá ser utilizado em outro processo. Deseja continuar?',
    );
    if (!confirmar) return;

    try {
      const resultado = await enviarPreAnaliseParaBancoTalentos(item.id_pre_analise);
      window.alert(
        resultado?.duplicate
          ? 'Este candidato já está no Banco de Talentos.'
          : 'Candidato enviado para o Banco de Talentos.',
      );
      await carregar(paginaPreAnalises);
    } catch (error) {
      window.alert(error?.message || 'Não foi possível enviar para o Banco de Talentos.');
    }
  };

  const aplicarFiltrosPreAnalise = async (novosFiltros = filtrosPreAnalises) => {
    setFiltrosPreAnalises(novosFiltros);
    await carregar(1, novosFiltros);
  };

  const limparFiltrosPreAnalise = async () => {
    const filtrosLimpos = {
      nome: '',
      scoreMin: '',
      scoreMax: '',
      classificacao: '',
      mostrarOcultos: false,
    };
    setFiltrosPreAnalises(filtrosLimpos);
    await carregar(1, filtrosLimpos);
  };

  const limparListaPreAnalise = async () => {
    const confirmar = window.confirm(
      'Esta ação apenas limpará a visualização da lista. Os currículos e históricos não serão excluídos.',
    );
    if (!confirmar) return;

    try {
      const filtrosAposLimpeza = { ...filtrosPreAnalises, mostrarOcultos: false };
      await limparListaPreAnalisesCv(obterReferenciaProcesso(processo) || idProcesso);
      setFiltrosPreAnalises(filtrosAposLimpeza);
      await carregar(1, filtrosAposLimpeza);
    } catch (error) {
      setErro(error?.message || 'Não foi possível limpar a visualização da pré-análise.');
    }
  };

  const atualizarFiltroDossie = (campo, valor) => {
    setFiltrosDossie((anteriores) => ({
      ...anteriores,
      [campo]: valor,
    }));
  };

  const limparFiltrosDossie = () => {
    setFiltrosDossie({
      processo: '',
      candidato: '',
      data: '',
      etapa: '',
      classificacao: '',
      status: '',
      notaMin: '',
      notaMax: '',
      scoreMin: '',
      scoreMax: '',
    });
  };

  const recarregarAnotacoesDossie = async () => {
    const referencia = obterReferenciaProcesso(processo) || idProcesso;
    if (!referencia) return;
    const lista = await lerAnotacoesDossieProcesso(referencia);
    setAnotacoesDossie(Array.isArray(lista) ? lista : []);
  };

  const atualizarCampoAnotacaoDossie = (campo, valor) => {
    setFormularioAnotacaoDossie((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
    setErroDossie('');
    setMensagemDossie('');
  };

  const selecionarCandidatoAnotacaoDossie = (idTeste) => {
    const candidato = candidatosDossie.find(
      (item) =>
        String(item.id_teste || item.id || '').trim() ===
        String(idTeste || '').trim(),
    );
    setFormularioAnotacaoDossie((anterior) => ({
      ...anterior,
      id_teste: idTeste,
      nome_candidato: candidato?.nome || '',
    }));
    setErroDossie('');
  };

  const cancelarEdicaoAnotacaoDossie = () => {
    setAnotacaoDossieEditandoId('');
    setFormularioAnotacaoDossie({
      id_teste: '',
      nome_candidato: '',
      texto: '',
    });
    setErroDossie('');
  };

  const editarAnotacaoDossie = (anotacao) => {
    setAnotacaoDossieEditandoId(String(anotacao?.id_anotacao || ''));
    setFormularioAnotacaoDossie({
      id_teste: anotacao?.id_teste || '',
      nome_candidato: anotacao?.nome_candidato || '',
      texto: anotacao?.texto || '',
    });
    setErroDossie('');
    setMensagemDossie('');
  };

  const salvarAnotacaoDossie = async () => {
    const texto = String(formularioAnotacaoDossie.texto || '').trim();
    if (!texto) {
      setErroDossie('Informe uma anotação antes de salvar.');
      return;
    }

    const referencia = obterReferenciaProcesso(processo) || idProcesso;
    if (!referencia) {
      setErroDossie('Processo não identificado para salvar a anotação.');
      return;
    }

    setSalvandoAnotacaoDossie(true);
    setErroDossie('');
    setMensagemDossie('');

    try {
      if (anotacaoDossieEditandoId) {
        await atualizarAnotacaoDossieProcesso(anotacaoDossieEditandoId, {
          texto,
        });
      } else {
        await criarAnotacaoDossieProcesso(referencia, {
          id_teste: formularioAnotacaoDossie.id_teste,
          nome_candidato: formularioAnotacaoDossie.nome_candidato,
          texto,
        });
      }
      cancelarEdicaoAnotacaoDossie();
      await recarregarAnotacoesDossie();
      setMensagemDossie('Anotação salva no dossiê.');
    } catch (error) {
      setErroDossie(error?.message || 'Não foi possível salvar a anotação do dossiê.');
    } finally {
      setSalvandoAnotacaoDossie(false);
    }
  };

  const analisarCvDoEmail = async (emailItem, anexo = null) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (!emailItem?.possui_anexo) {
      setErro('Sem anexo de CV neste e-mail.');
      return;
    }

    try {
      setErro('');
      setAnalisandoEmailUid(emailItem.uid);
      await analisarCvEmailRecebido(obterReferenciaProcesso(processo) || idProcesso, {
        uid: emailItem.uid,
        attachment_name: anexo?.nome || emailItem.nome_anexo || '',
      });
      await carregar(1);
      await carregarEmailsDoProcesso();
    } catch (error) {
      setErro(error?.message || 'Não foi possível analisar o CV recebido por e-mail.');
    } finally {
      setAnalisandoEmailUid('');
    }
  };

  const abrirAgendamento = (candidato) => {
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');

    if (estadoAcoes.processClosed || !estadoAcoes.isActive) {
      setErro('Somente candidatos ativos em processo aberto podem seguir para agendamento.');
      return;
    }

    const referenciaProcesso =
      obterReferenciaProcesso(processo) ||
      obterReferenciaProcessoDoCandidato(candidato) ||
      idProcesso;
    const idProcessoVisual =
      processo?.id_processo ||
      candidato.id_processo ||
      '';

    setErro('');
    setSlotsEntrevista([]);
    setAgendamentoSelecionado(candidato);
    setDocumentosEntrevista([]);
    setFormularioEntrevista({
      id_registro: candidato.id_registro,
      id_processo: idProcessoVisual,
      id_processo_ref: referenciaProcesso,
      id_slot: '',
      data_entrevista: '',
      status_entrevista: CANDIDATE_STATUS_PENDING_CONFIRMATION,
      link_agendamento: '',
      observacoes_rh: '',
      mensagem_personalizada: '',
      email: candidato.email || '',
      telefone: candidato.telefone || '',
      whatsapp: candidato.whatsapp || candidato.telefone || '',
    });
    setMensagemEntrevistaEditada(false);
    carregarSlotsEntrevistaDoProcesso(referenciaProcesso);
  };

  const montarMensagemEntrevistaPadrao = (
    idSlot = formularioEntrevista.id_slot,
    documentos = documentosEntrevista,
  ) => {
    const nome = agendamentoSelecionado?.nome_candidato || 'candidato(a)';
    const slot = slotsDisponiveisEntrevista.find(
      (item) => Number(obterIdSlotEntrevista(item)) === Number(idSlot),
    );
    if (!slot) {
      return atualizarDocumentosNaMensagem(
        `Olá ${nome}! Gostaríamos de convocá-lo para o nosso processo seletivo para a vaga de: ${processo?.vaga || agendamentoSelecionado?.vaga || ''} no dia _data_ às _horário_.

Compareça levando os seguintes documentos:

_lista_documentos_

Nosso endereço fica na Rua Victor Civita, 77 - Bloco 1, 3° Andar. Se precisar de apoio, responda esta mensagem.`,
        documentos,
      );
    }

    const dataInicio = obterDataInicioSlotEntrevista(slot);
    const data = dataInicio.toLocaleDateString('pt-BR');
    const hora = dataInicio.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return atualizarDocumentosNaMensagem(
      `Olá ${nome}! Gostaríamos de convocá-lo para o nosso processo seletivo para a vaga de: ${processo?.vaga || agendamentoSelecionado?.vaga || ''} no dia ${data} às ${hora}.

Compareça levando os seguintes documentos:

_lista_documentos_

Nosso endereço fica na Rua Victor Civita, 77 - Bloco 1, 3° Andar. Se precisar de apoio, responda esta mensagem.`,
      documentos,
    );
  };

  const montarMensagemEntrevista = () => {
    const mensagemPersonalizada = String(formularioEntrevista.mensagem_personalizada || '').trim();
    return mensagemPersonalizada || montarMensagemEntrevistaPadrao();
  };

  const alternarDocumentoEntrevista = (documento, marcado) => {
    const proximos = marcado
      ? [...documentosEntrevista, documento]
      : documentosEntrevista.filter((item) => item !== documento);
    setDocumentosEntrevista(proximos);
    setFormularioEntrevista((atual) => ({
      ...atual,
      mensagem_personalizada: mensagemEntrevistaEditada
        ? atualizarDocumentosNaMensagem(atual.mensagem_personalizada, proximos)
        : montarMensagemEntrevistaPadrao(atual.id_slot, proximos),
    }));
  };

  const salvarAgendamento = async (canal = '') => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    const mensagemErro = validarFormularioEntrevista({
      ...formularioEntrevista,
      exige_slot: true,
    });
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvandoEntrevista(true);
    setErro('');

    try {
      if (canal === 'whatsapp') {
        const numeroBase = normalizarNumeroWhatsAppBrasil(formularioEntrevista.whatsapp || formularioEntrevista.telefone || '');
        if (!numeroBase) {
          throw new Error('O candidato não possui número de WhatsApp válido extraído do CV.');
        }
      }

      if (canal === 'email') {
        const emailDestino = String(formularioEntrevista.email || '').trim();
        if (!emailDestino) {
          throw new Error('O candidato não possui e-mail válido extraído do CV.');
        }
      }

      const slotSelecionado = slotsDisponiveisEntrevista.find(
        (item) =>
          Number(obterIdSlotEntrevista(item)) ===
          Number(formularioEntrevista.id_slot),
      );
      const dataEntrevista = montarDataEntrevistaIso(slotSelecionado);
      if (!dataEntrevista) {
        throw new Error('Selecione um horário válido para agendar a entrevista.');
      }
      const dataAgendada = new Date(dataEntrevista);
      if (Number.isNaN(dataAgendada.getTime()) || dataAgendada <= new Date()) {
        throw new Error('Selecione um horário futuro para agendar a entrevista.');
      }

      const mensagemFinal = montarMensagemEntrevista();
      const resultado = await agendarEntrevista({
        id_registro: Number(formularioEntrevista.id_registro),
        id_processo: formularioEntrevista.id_processo || '',
        id_processo_ref: formularioEntrevista.id_processo_ref || '',
        id_slot: Number(formularioEntrevista.id_slot),
        data_entrevista: dataEntrevista,
        status_entrevista: CANDIDATE_STATUS_PENDING_CONFIRMATION,
        link_agendamento: formularioEntrevista.link_agendamento || '',
        observacoes_rh: formularioEntrevista.observacoes_rh || '',
        mensagem_personalizada: mensagemFinal,
      });
      const mensagem = resultado?.mensagem_base || mensagemFinal;
      await copiarTexto(mensagem).catch(() => null);

      if (canal === 'whatsapp') {
        const numeroBase = normalizarNumeroWhatsAppBrasil(formularioEntrevista.whatsapp || formularioEntrevista.telefone || '');
        window.open(`https://wa.me/${numeroBase}?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener,noreferrer');
      }

      if (canal === 'email') {
        const emailDestino = String(formularioEntrevista.email || '').trim();
        const assunto = encodeURIComponent('Agendamento de entrevista');
        window.location.href = `mailto:${emailDestino}?subject=${assunto}&body=${encodeURIComponent(mensagem)}`;
      }

      if (!canal) {
        window.alert('Mensagem preparada com sucesso e copiada para a área de transferência.');
      }

      setAgendamentoSelecionado(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      setErro(error?.message || 'Não foi possível agendar a entrevista.');
    } finally {
      setSalvandoEntrevista(false);
    }
  };

  const abrirEdicaoEntrevista = (entrevista) => {
    if (isProcessClosed(entrevista?.status_processo)) {
      setErro('O processo seletivo desta entrevista está encerrado e não permite atualização operacional.');
      return;
    }

    setEntrevistaEdicao(entrevista);
    setFormularioEdicaoEntrevista({
      id_slot: '',
      status_entrevista: entrevista.status_entrevista || CANDIDATE_STATUS_PENDING_CONFIRMATION,
      observacoes_rh: entrevista.observacoes_rh || '',
      mensagem_personalizada: entrevista.mensagem_personalizada || '',
    });
  };

  const salvarEdicaoEntrevista = async () => {
    if (!entrevistaEdicao) return;
    if (isProcessClosed(entrevistaEdicao.status_processo)) {
      setErro('O processo seletivo desta entrevista está encerrado e não permite atualização operacional.');
      return;
    }

    const mensagemErro = validarFormularioEntrevista({
      id_registro: entrevistaEdicao.id_registro,
      ...formularioEdicaoEntrevista,
    });
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvandoEdicaoEntrevista(true);
    setErro('');
    try {
      const payload = {
        status_entrevista: formularioEdicaoEntrevista.status_entrevista,
        observacoes_rh: formularioEdicaoEntrevista.observacoes_rh,
        mensagem_personalizada: formularioEdicaoEntrevista.mensagem_personalizada,
      };
      if (formularioEdicaoEntrevista.id_slot) {
        payload.id_slot = Number(formularioEdicaoEntrevista.id_slot);
        if (Number(formularioEdicaoEntrevista.id_slot) !== Number(entrevistaEdicao.id_slot || 0)) {
          payload.status_entrevista = 'Reagendado';
        }
      }

      await atualizarEntrevista(entrevistaEdicao.id_entrevista, payload);
      setEntrevistaEdicao(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      setErro(error?.message || 'Não foi possível atualizar a entrevista selecionada.');
    } finally {
      setSalvandoEdicaoEntrevista(false);
    }
  };

  if (carregando) {
    return html`
      <${PainelRh}
        screenId="screen-process-details"
        navAtiva="screen-processes"
        subtituloMarca="Detalhes do processo"
        placeholderBusca="Detalhes do processo"
        controlador=${controlador}
        acaoPrimaria=${{
        label: 'Voltar para processos',
        onClick: () => controlador.irParaTelaProtegida('screen-processes'),
      }}
        acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
      >
        <div class="alert alert-info">Carregando detalhes do processo...</div>
      </${PainelRh}>
    `;
  }

  return html`
    <${PainelRh}
      screenId="screen-process-details"
      navAtiva="screen-processes"
      subtituloMarca="Detalhes do processo"
      placeholderBusca="Detalhes do processo"
      controlador=${controlador}
      acaoPrimaria=${{
      label: 'Gerenciar processos',
      onClick: () => controlador.irParaTelaProtegida('screen-processes'),
    }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Processo seletivo"
        title="Detalhes do processo"
        description="Acompanhe o fluxo completo do RH: pré-análise, qualificação, entrevistas, decisão final e fechamento do processo."
      />

      ${erro ? html`<div class="alert alert-danger">${erro}</div>` : null}
      ${processoEncerrado
      ? html`
            <div class="rh-inline-alert">
              Processo encerrado. As movimentações operacionais de candidatos ficam bloqueadas.
            </div>
          `
      : null}

      <div class="process-detail-top-grid">
        <${SectionCard}
          title="Resumo do processo"
          description=${processo
        ? `${processo.id_processo || '-'} • ${processo.vaga || '-'}`
        : 'Processo não localizado.'}
          className="process-summary-panel compact-dashboard-card"
          tourId="process-summary"
          actions=${html`
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
            >
              Voltar
            </button>
          `}
        >
          <div class="process-summary-grid">
            ${[
              {
                icon: 'flag',
                label: 'Status',
                value: processo?.status || '-',
              },
              {
                icon: 'work',
                label: 'Cargo/Vaga',
                value: processo?.vaga || '-',
              },
              {
                icon: 'groups',
                label: 'Vagas',
                value: processo?.quantidade_vagas || 0,
              },
              {
                icon: 'person_search',
                label: 'Candidatos no processo',
                value: candidatosOperacionais.length || 0,
              },
              {
                icon: 'verified',
                label: 'Aprovados',
                value: candidatosAprovados.length || 0,
              },
              {
                icon: 'event_available',
                label: 'Entrevistas registradas',
                value: entrevistas.length || resumo?.entrevistas || 0,
              },
              {
                icon: 'calendar_month',
                label: 'Abertura',
                value: formatarDataCurta(processo?.data_criacao),
              },
              {
                icon: 'event_busy',
                label: 'Encerramento',
                value: formatarDataCurta(processo?.data_encerramento),
              },
            ].map(
              (item) => html`
                <article class="process-summary-card summary-metric-card" key=${item.label}>
                  <span class="material-symbols-outlined summary-metric-icon">
                    ${item.icon}
                  </span>
                  <div class="summary-metric-content">
                    <span class="summary-metric-label">${item.label}</span>
                    <strong class="summary-metric-value">${item.value}</strong>
                  </div>
                </article>
              `,
            )}
          </div>

          <div class="process-summary-secondary process-meta-row">
            <span class="process-meta-chip">
              <span>Operação</span>
              <strong>${processo?.operacao || '-'}</strong>
            </span>
            <span class="process-meta-chip">
              <span>Trilha</span>
              <strong>${processo?.trilha || '-'}</strong>
            </span>
            <span class="process-meta-chip">
              <span>Nota de corte</span>
              <strong>
                ${Number(processo?.usa_nota_corte || 0)
                  ? processo?.nota_corte || '-'
                  : 'Não'}
              </strong>
            </span>
            ${processo?.link_agendamento
              ? html`
                  <a
                    href=${processo.link_agendamento}
                    target="_blank"
                    rel="noreferrer"
                    class="process-meta-chip process-meta-link"
                  >
                    <span>Link legado</span>
                    <strong>Abrir link</strong>
                  </a>
                `
              : html`
                  <span class="process-meta-chip">
                    <span>Link legado</span>
                    <strong>Não informado</strong>
                  </span>
                `}
          </div>
        </${SectionCard}>

        <${WidgetEntrevistasProcesso}
          entrevistas=${entrevistas}
          carregando=${carregando}
          onAbrirAgenda=${() => controlador.irParaTelaProtegida('screen-interviews')}
          onEditar=${abrirEdicaoEntrevista}
        />
      </div>

      <${SecaoDetalheExpansivel}
        aberto=${secoesExpandidas.dossieProcesso}
        titulo="Dossiê do Processo"
        description="Visão administrativa e analítica para comparar candidatos, registrar observações e preparar análise inteligente."
        className="process-dossier-section"
        tourId="process-dossier"
        onToggle=${() => alternarSecao('dossieProcesso')}
      >
        ${avisosSecoes.dossieProcesso
          ? html`<div class="alert alert-warning">${avisosSecoes.dossieProcesso}</div>`
          : null}
        <${DossieProcesso}
          processo=${processo}
          candidatos=${candidatosDossie}
          candidatosFiltrados=${candidatosDossieFiltrados}
          estatisticas=${estatisticasDossie}
          filtros=${filtrosDossie}
          onFiltroChange=${atualizarFiltroDossie}
          onLimparFiltros=${limparFiltrosDossie}
          analise=${analiseDossie}
          anotacoes=${anotacoesDossie}
          formularioAnotacao=${formularioAnotacaoDossie}
          anotacaoEditandoId=${anotacaoDossieEditandoId}
          salvandoAnotacao=${salvandoAnotacaoDossie}
          erro=${erroDossie}
          mensagem=${mensagemDossie}
          onChangeAnotacao=${atualizarCampoAnotacaoDossie}
          onSelecionarCandidatoAnotacao=${selecionarCandidatoAnotacaoDossie}
          onSalvarAnotacao=${salvarAnotacaoDossie}
          onEditarAnotacao=${editarAnotacaoDossie}
          onCancelarEdicao=${cancelarEdicaoAnotacaoDossie}
        />
      </${SecaoDetalheExpansivel}>

      ${EXIBIR_PAGINA_PUBLICA_CANDIDATURA
      ? html`<${SecaoDetalheExpansivel}
        aberto=${secoesExpandidas.paginaPublica}
        titulo="Página pública de candidatura"
        description="Gere um link exclusivo para esta vaga e acompanhe o status da página pública sem expor informações administrativas."
        onToggle=${() => alternarSecao('paginaPublica')}
      >
        <${MetricGrid}
          items=${[
          { label: 'Status', value: statusPaginaPublica },
          {
            label: 'Slug público',
            value: processo?.link_publico_slug || 'Ainda não gerado',
          },
          {
            label: 'Criado em',
            value: formatarDataHora(processo?.link_publico_criado_em),
          },
        ]}
        />

        <div class="row g-3 align-items-end mt-1">
          <div class="col-lg-8">
            <label class="form-label">Link público externo</label>
            <input
              class="form-control"
              readonly
              value=${processo?.link_publico_slug
          ? urlPublicaCandidatura || 'URL pública ainda não configurada.'
          : 'Gere a página para visualizar o link público.'}
            />
            <div class="form-text">
              ${urlPublicaCandidatura
          ? 'Link externo montado com PUBLIC_CANDIDATE_BASE_URL.'
          : AVISO_URL_PUBLICA_NAO_CONFIGURADA}
            </div>
            ${urlInternaCandidatura
          ? html`
                  <label class="form-label mt-3">Link interno</label>
                  <input
                    class="form-control"
                    readonly
                    value=${urlInternaCandidatura}
                  />
                `
          : null}
          </div>

          <div class="col-lg-4">
            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
              ${!processo?.link_publico_slug
          ? html`
                    <button
                      type="button"
                      class="btn btn-primary"
                      disabled=${processoEncerrado}
                      onClick=${gerarPaginaPublica}
                    >
                      Gerar página de CV
                    </button>
                  `
          : html`
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      disabled=${!linkPublicoAtivo}
                      onClick=${copiarLinkPublico}
                    >
                      Copiar link
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-primary"
                      disabled=${!urlPublicaCandidatura && !urlInternaCandidatura}
                      onClick=${abrirPaginaPublica}
                    >
                      Abrir página
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-danger"
                      disabled=${!linkPublicoAtivo}
                      onClick=${desativarPaginaPublica}
                    >
                      Desativar link
                    </button>
                    ${!linkPublicoAtivo && !processoEncerrado
              ? html`
                          <button
                            type="button"
                            class="btn btn-primary"
                            onClick=${gerarPaginaPublica}
                          >
                            Gerar nova página
                          </button>
                        `
              : null}
                  `}
            </div>
          </div>
        </div>

        <div class="row g-3 mt-2">
          <div class="col-lg-6">
            <label class="form-label">Requisitos da vaga</label>
            <div class="d-grid gap-2">
              ${requisitosPublicos.map(
                (item, indice) => html`
                  <label class="form-check" key=${`req-${indice}`}>
                    <input
                      class="form-check-input"
                      type="checkbox"
                      checked=${item.visivel !== false}
                      onChange=${(event) =>
                    setRequisitosPublicos((anteriores) =>
                      anteriores.map((atual, atualIndice) =>
                        atualIndice === indice
                          ? { ...atual, visivel: event.target.checked }
                          : atual,
                      ),
                    )}
                    />
                    <span class="form-check-label">${item.texto}</span>
                  </label>
                `,
              )}
            </div>
          </div>
          <div class="col-lg-6">
            <label class="form-label">Responsabilidades da vaga</label>
            <div class="d-grid gap-2">
              ${responsabilidadesPublicas.map(
                (item, indice) => html`
                  <label class="form-check" key=${`resp-${indice}`}>
                    <input
                      class="form-check-input"
                      type="checkbox"
                      checked=${item.visivel !== false}
                      onChange=${(event) =>
                    setResponsabilidadesPublicas((anteriores) =>
                      anteriores.map((atual, atualIndice) =>
                        atualIndice === indice
                          ? { ...atual, visivel: event.target.checked }
                          : atual,
                      ),
                    )}
                    />
                    <span class="form-check-label">${item.texto}</span>
                  </label>
                `,
              )}
            </div>
          </div>
          <div class="col-12">
            <label class="form-label">Observações específicas da vaga</label>
            <textarea
              class="form-control"
              rows="4"
              placeholder="Ex.: Necessário ter disponibilidade para escala 6x1."
              value=${observacoesPublicasVaga}
              onInput=${(event) =>
          setObservacoesPublicasVaga(event.target.value)}
            ></textarea>
            <div class="form-text">
              Campo opcional exibido na página pública somente quando preenchido.
            </div>
          </div>
          <div class="col-12 text-end">
            <button
              type="button"
              class="btn btn-outline-primary"
              disabled=${salvandoObservacoesPublicas}
              onClick=${salvarObservacoesPublicasVaga}
            >
              ${salvandoObservacoesPublicas ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </div>

        ${feedbackLinkPublico
          ? html`<div class="alert alert-success mt-3 mb-0">${feedbackLinkPublico}</div>`
          : null}
      </${SecaoDetalheExpansivel}>`
      : null}

      ${false ? html`<${SecaoDetalheExpansivel}
        aberto=${secoesExpandidas.recebimentoEmail}
        titulo="Recebimento de e-mail"
        description="Caixa de entrada configurável para currículos recebidos por e-mail."
        onToggle=${() => alternarSecao('recebimentoEmail')}
      >
        <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3">
          <div class="text-muted small">
            Endereço monitorado:
            ${statusEmailRecebido?.email_address || 'posilvahp7@gmail.com'}
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            disabled=${carregandoEmails}
            onClick=${carregarEmailsDoProcesso}
          >
            ${carregandoEmails ? 'Atualizando...' : 'Atualizar e-mails'}
          </button>
        </div>

        ${!statusEmailRecebido?.configured
        ? html`
              <div class="alert alert-warning">
                ${statusEmailRecebido?.message ||
          'Recebimento de e-mail ainda não configurado ou indisponível no momento.'}
              </div>
            `
        : null}

        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Remetente</th>
                <th>Assunto / resumo</th>
                <th>Data</th>
                <th>Dados encontrados</th>
                <th>Anexo</th>
                <th>Status</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${emailsRecebidos.length
        ? emailsRecebidos.map((emailItem) => {
          const anexos = Array.isArray(emailItem?.anexos)
            ? emailItem.anexos
            : [];
          const anexosCv = anexos.filter((anexo) => anexo?.cv_compativel);
          const anexoPrincipal = anexosCv[0] || null;
          return html`
                      <tr key=${emailItem.uid}>
                        <td>
                          <strong>${emailItem.remetente || '-'}</strong>
                          <div class="small text-muted">${emailItem.email_encontrado || '-'}</div>
                        </td>
                        <td>
                          <div>${emailItem.assunto || '-'}</div>
                          <div class="small text-muted">${emailItem.resumo || '-'}</div>
                        </td>
                        <td>${formatarDataHora(emailItem.data_hora)}</td>
                        <td>
                          <div>${emailItem.nome_candidato_possivel || '-'}</div>
                          <div class="small text-muted">${emailItem.vaga_pretendida_possivel || '-'}</div>
                          <div class="small text-muted">${emailItem.telefone_encontrado || '-'}</div>
                        </td>
                        <td>
                          ${emailItem.possui_anexo
              ? html`
                                <div>${emailItem.nome_anexo || 'Anexo recebido'}</div>
                                <div class="small text-muted">
                                  ${anexosCv.length ? 'CV compatível' : 'Sem anexo de CV compatível'}
                                </div>
                              `
              : 'Sem anexo'}
                        </td>
                        <td>
                          <span class="process-candidate-status-badge is-pending">
                            ${emailItem.status_analise || 'Pendente'}
                          </span>
                        </td>
                        <td class="text-end">
                          <div class="rh-table-actions">
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-dark rh-action-btn"
                              onClick=${() => setStatusEmailRecebido({
                ...(statusEmailRecebido || {}),
                message: emailItem.resumo || 'Sem corpo para exibir.',
              })}
                            >
                              <span class="material-symbols-outlined">visibility</span>
                              Detalhes
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-primary rh-action-btn"
                              disabled=${processoEncerrado || !anexoPrincipal || analisandoEmailUid === emailItem.uid}
                              onClick=${() => analisarCvDoEmail(emailItem, anexoPrincipal)}
                            >
                              <span class="material-symbols-outlined">auto_awesome</span>
                              ${analisandoEmailUid === emailItem.uid ? 'Analisando...' : 'Analisar CV'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
        })
        : html`
                    <${TabelaVazia}
                      colunas=${7}
                      texto=${carregandoEmails
            ? 'Carregando e-mails recebidos.'
            : 'Nenhum e-mail recebido para listar.'}
                    />
                  `}
            </tbody>
          </table>
        </div>
      </${SecaoDetalheExpansivel}>` : null}

      ${EXIBIR_CANDIDATOS_INSCRITOS ? html`<${SecaoDetalheExpansivel}
        aberto=${secoesExpandidas.candidatosInscritos}
        titulo="Candidatos inscritos"
        description="Candidatos recebidos pela página pública Envie seu currículo, ainda em triagem pelo RH."
        tourId="process-public-applicants"
        onToggle=${() => alternarSecao('candidatosInscritos')}
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Contato</th>
                <th>Localidade</th>
                <th>Inscrição</th>
                <th>Status / análise</th>
                <th>Score</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${candidatosInscritos.length
      ? candidatosInscritos.map((candidato) => {
        const analise = encontrarAnaliseDoInscrito(candidato);
        return html`
                      <tr key=${candidato.id_registro}>
                        <td>
                          <strong>${candidato.nome_candidato || '-'}</strong>
                          <div class="small text-muted">${candidato.vaga || '-'}</div>
                        </td>
                        <td>
                          <div>${candidato.email || '-'}</div>
                          <div class="small text-muted">
                            ${candidato.whatsapp || candidato.telefone || '-'}
                          </div>
                        </td>
                        <td>
                          <div>${candidato.cidade || '-'}</div>
                          <div class="small text-muted">${candidato.bairro || '-'}</div>
                        </td>
                        <td>${formatarDataHora(candidato.data_prova)}</td>
                        <td>
                          <span
                            class=${`process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_fluxo)}`}
                          >
                            ${analise?.classificacao || candidato.status_fluxo || '-'}
                          </span>
                          ${analise?.classificacao
            ? html`<div class="small text-muted mt-1">CV analisado</div>`
            : html`<div class="small text-muted mt-1">Aguardando análise</div>`}
                        </td>
                        <td>${analise?.score_final ?? '-'}</td>
                        <td class="text-end">
                          <div class="rh-table-actions">
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-secondary"
                              onClick=${() => abrirCurriculo(candidato)}
                            >
                              Ver CV
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-primary"
                              disabled=${processoEncerrado}
                              onClick=${() => analisarCvInscrito(candidato)}
                            >
                              ${processoEncerrado ? 'Processo encerrado' : 'Analisar CV'}
                            </button>
                            ${analise
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-dark"
                                    onClick=${() => setResultadoAnaliseSelecionado(analise)}
                                  >
                                    Resultado
                                  </button>
                                `
            : null}
                            ${analise &&
            isPreAnaliseNaoQualificada(analise) &&
            Number(analise.ja_adicionado_ao_processo || 1) !== 1 &&
            !processoEncerrado
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-warning"
                                    onClick=${() => utilizarCandidatoNaoQualificado(analise)}
                                  >
                                    Utilizar candidato
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary rh-action-btn"
                                    onClick=${() => enviarPreAnaliseAoBancoTalentos(analise)}
                                  >
                                    Banco de Talentos
                                  </button>
                                `
            : null}
                          </div>
                        </td>
                      </tr>
                    `;
      })
      : html`
                    <${TabelaVazia}
                      colunas=${7}
                      texto="Nenhum candidato inscrito pela página pública."
                    />
                  `}
            </tbody>
          </table>
        </div>
      </${SecaoDetalheExpansivel}>` : null}

      <div class="process-main-grid">
      <${SecaoDetalheExpansivel}
        aberto=${secoesExpandidas.preAnaliseCv}
        titulo="Pré-análise de CV"
        description="Análise automática com possibilidade de ajuste manual antes da inclusão no processo."
        className="process-preanalysis-section"
        tourId="process-cv-preanalysis"
        onToggle=${() => alternarSecao('preAnaliseCv')}
      >
        ${avisosSecoes.preAnaliseCv
      ? html`<div class="alert alert-warning">${avisosSecoes.preAnaliseCv}</div>`
      : null}
        <div class="process-cv-upload-row">
          <div class="process-cv-upload-field">
            <label class="form-label">Adicionar CV</label>
            <label class=${`process-cv-picker ${processoEncerrado || analisandoCv ? 'is-disabled' : ''}`.trim()}>
              <input
                key=${arquivoCv?.name || 'sem-cv-selecionado'}
                type="file"
                class="process-cv-native-input"
                accept=".pdf,.doc,.docx"
                disabled=${processoEncerrado || analisandoCv}
                onChange=${(event) => setArquivoCv(event.target.files?.[0] || null)}
              />
              <span class="material-symbols-outlined">upload_file</span>
              <span class="process-cv-picker-copy">
                <strong>Selecionar CV</strong>
                <small title=${arquivoCv?.name || ''}>
                  ${arquivoCv?.name || 'Nenhum arquivo selecionado'}
                </small>
              </span>
            </label>
          </div>
          <label class="process-cv-keep-original">
            <input
              type="checkbox"
              id="guardarCvOriginal"
              checked=${guardarCvOriginal}
              onChange=${(event) => setGuardarCvOriginal(!!event.target.checked)}
            />
            <span class="process-cv-toggle-box" aria-hidden="true"></span>
            <span>Guardar CV original</span>
          </label>
          <button
            type="button"
            class="btn btn-primary btn-sm process-cv-action-btn rh-action-btn"
            onClick=${enviarCv}
            disabled=${processoEncerrado || analisandoCv}
          >
            <span class="material-symbols-outlined">auto_awesome</span>
            ${processoEncerrado
      ? 'Processo encerrado'
      : analisandoCv
        ? 'Analisando...'
        : 'Analisar CV'}
          </button>
        </div>

        <div class="process-preanalysis-filter-panel">
          <div class="process-preanalysis-filter-grid">
            <div class="rh-filter-field process-preanalysis-name-filter">
              <label>Nome</label>
              <input
                class="form-control"
                placeholder="Buscar candidato"
                value=${filtrosPreAnalises.nome}
                onInput=${(event) =>
        setFiltrosPreAnalises({
          ...filtrosPreAnalises,
          nome: event.target.value,
        })}
              />
            </div>
            <div class="rh-filter-field process-preanalysis-score-filter">
              <label>Score mínimo</label>
              <input
                class="form-control"
                type="number"
                min="0"
                max="10"
                step="0.1"
                placeholder="0"
                value=${filtrosPreAnalises.scoreMin}
                onInput=${(event) =>
        setFiltrosPreAnalises({
          ...filtrosPreAnalises,
          scoreMin: event.target.value,
        })}
              />
            </div>
            <div class="rh-filter-field process-preanalysis-score-filter">
              <label>Score máximo</label>
              <input
                class="form-control"
                type="number"
                min="0"
                max="10"
                step="0.1"
                placeholder="10"
                value=${filtrosPreAnalises.scoreMax}
                onInput=${(event) =>
        setFiltrosPreAnalises({
          ...filtrosPreAnalises,
          scoreMax: event.target.value,
        })}
              />
            </div>
            <div class="rh-filter-field">
              <label>Classificação</label>
              <select
                class="form-select"
                value=${filtrosPreAnalises.classificacao}
                onChange=${(event) =>
        setFiltrosPreAnalises({
          ...filtrosPreAnalises,
          classificacao: event.target.value,
        })}
              >
                <option value="">Todas</option>
                ${classificacoesPreAnalises.map(
          (classificacao) => html`
                    <option value=${classificacao} key=${classificacao}>
                      ${classificacao}
                    </option>
                  `,
        )}
              </select>
            </div>
          </div>
          <div class="process-preanalysis-filter-footer">
            <label class="process-preanalysis-compact-check">
              <input
                type="checkbox"
                checked=${filtrosPreAnalises.mostrarOcultos}
                onChange=${(event) =>
        aplicarFiltrosPreAnalise({
          ...filtrosPreAnalises,
          mostrarOcultos: event.target.checked,
        })}
              />
              <span class="process-cv-toggle-box" aria-hidden="true"></span>
              <span>Mostrar itens limpos</span>
            </label>
            <div class="process-preanalysis-filter-actions">
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                onClick=${limparFiltrosPreAnalise}
              >
                Limpar filtros
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                onClick=${() => aplicarFiltrosPreAnalise()}
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                class="btn btn-outline-danger btn-sm process-preanalysis-danger-btn"
                disabled=${processoEncerrado || !preAnalises.length}
                onClick=${limparListaPreAnalise}
              >
                Limpar lista
              </button>
            </div>
          </div>
        </div>

        <div class="table-responsive process-preanalysis-table-wrap">
          <table class="table align-middle rh-modern-history-table process-preanalysis-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Classificação</th>
                <th>Score</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${preAnalises.length
      ? preAnalises.map(
        (item) => html`
                      <tr key=${item.id_pre_analise}>
                        <td>
                          <strong
                            class="process-preanalysis-name"
                            title=${item.nome_candidato || ''}
                          >
                            ${item.nome_candidato || '-'}
                          </strong>
                        </td>
                        <td>
                          <span
                            class="process-preanalysis-contact"
                            title=${item.email || ''}
                          >
                            ${item.email || '-'}
                          </span>
                        </td>
                        <td>
                          <span
                            class="process-preanalysis-contact"
                            title=${item.telefone || item.whatsapp || ''}
                          >
                            ${item.telefone || item.whatsapp || '-'}
                          </span>
                        </td>
                        <td>
                          <span
                            class=${`cv-classification-badge ${item.classificacao_slug || ''}`}
                          >
                            ${item.classificacao || '-'}
                          </span>
                          ${Number(item.ja_adicionado_ao_processo || 0) === 1
            ? html`
                                <div class="small text-muted mt-1">
                                  ${item.situacao_pre_analise || 'Já incluído no processo'}
                                </div>
                              `
            : null}
                        </td>
                        <td class="process-preanalysis-score">${item.score_final ?? '-'}</td>
                        <td class="text-end">
                          <div class="process-preanalysis-actions">
                            ${!processoEncerrado
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary process-preanalysis-action-btn"
                                    onClick=${() => setPreAnaliseSelecionada({ ...item })}
                                  >
                                    Editar
                                  </button>
                                `
            : null}
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-dark rh-action-btn process-preanalysis-action-btn"
                              onClick=${() => setResultadoAnaliseSelecionado(item)}
                            >
                              Resultado
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-info rh-action-btn process-preanalysis-action-btn"
                              onClick=${() => setVisualizacaoCv(item)}
                            >
                              Ver CV
                            </button>
                            ${!processoEncerrado &&
            Number(item.ja_adicionado_ao_processo || 0) !== 1 &&
            isPreAnaliseUtilizavelDireto(item)
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-success rh-action-btn process-preanalysis-action-btn"
                                    onClick=${() =>
                incluirNoProcesso(item)}
                                  >
                                    Adicionar
                                  </button>
                                `
            : null}
                            ${!processoEncerrado &&
            Number(item.ja_adicionado_ao_processo || 0) !== 1 &&
            isPreAnaliseNaoQualificada(item)
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-warning rh-action-btn process-preanalysis-action-btn"
                                    onClick=${() =>
                utilizarCandidatoNaoQualificado(item)}
                                  >
                                    Utilizar candidato
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary rh-action-btn process-preanalysis-action-btn"
                                    onClick=${() =>
                enviarPreAnaliseAoBancoTalentos(item)}
                                  >
                                    Banco de Talentos
                                  </button>
                                `
            : null}
                            ${!processoEncerrado
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger rh-action-btn process-preanalysis-action-btn"
                                    onClick=${() => excluirPreAnalise(item.id_pre_analise)}
                                  >
                                    Excluir
                                  </button>
                                `
            : null}
                          </div>
                        </td>
                      </tr>
                    `,
      )
      : html`
                    <tr>
                      <td colspan="6">
                        <div class="process-preanalysis-empty">
                          <span class="material-symbols-outlined">plagiarism</span>
                          <strong>Nenhuma pré-análise encontrada.</strong>
                          <p>Adicione um CV para iniciar a análise.</p>
                        </div>
                      </td>
                    </tr>
                  `}
            </tbody>
          </table>
        </div>

        <${PaginacaoCompacta}
          paginaAtual=${paginaPreAnalises}
          totalPaginas=${totalPaginasPreAnalises}
          totalItens=${totalItensPreAnalises}
          tamanhoPagina=${TAMANHO_PAGINA_PRE_ANALISE_DETALHE}
          itensNaPagina=${preAnalises.length}
          onChange=${(pagina) => carregar(pagina)}
        />
      </${SecaoDetalheExpansivel}>

      <div class="process-candidates-grid">
        <${SecaoDetalheExpansivel}
          aberto=${secoesExpandidas.candidatosProcesso}
          titulo="Candidatos no processo"
          description="As ações aparecem somente quando a etapa do candidato permite movimentação dentro do fluxo do RH."
          className="process-candidates-section"
          tourId="process-candidates"
          onToggle=${() => alternarSecao('candidatosProcesso')}
        >
        <div class="process-section-toolbar">
          <label class="process-search-field" aria-label="Buscar candidato no processo">
            <span class="material-symbols-outlined">search</span>
            <input
              class="form-control"
              placeholder="Buscar candidato..."
              value=${buscaCandidatosProcesso}
              onInput=${(event) => setBuscaCandidatosProcesso(event.target.value)}
            />
          </label>
          <span class="process-list-counter">
            ${candidatosOperacionaisFiltrados.length} de ${candidatosOperacionais.length}
          </span>
        </div>
        ${candidatosOperacionaisFiltrados.length
      ? html`
            <div class="candidate-list process-candidate-list">
              ${candidatosProcessoPaginados.itens.map((candidato) => {
                const tagsCandidato = Array.isArray(candidato?.tags)
                  ? candidato.tags
                  : [];
                const nome = candidato.nome_candidato || '-';
                const origem = formatarOrigemCandidato(candidato);
                const idCandidato =
                  candidato.id_registro ||
                  candidato.id_teste ||
                  candidato.id_candidato ||
                  '-';
                const localidade = [candidato.cidade, candidato.bairro]
                  .map((valor) => String(valor || '').trim())
                  .filter(Boolean)
                  .join(' / ') || '-';
                const temProvaSalva = candidatoTemProvaSalva(candidato);
                const carregandoDetalhe =
                  carregandoDetalheProva ===
                  String(candidato.id_registro || candidato.id_teste || '');
                const podeBaixarCv =
                  candidato.cv_disponivel &&
                  controlador.possuiPermissao('candidatos.baixar_curriculo');
                const idMenuCandidato = String(
                  candidato.id_registro ||
                  candidato.id_teste ||
                  candidato.id_candidato ||
                  '',
                );

                return html`
                  <article class="candidate-card process-candidate-card" key=${candidato.id_registro}>
                    <div class="candidate-main process-candidate-person">
                      <span class="candidate-avatar process-candidate-avatar">
                        ${String(nome).trim().slice(0, 2).toUpperCase()}
                      </span>
                      <div class="candidate-info">
                        <strong class="candidate-name">${nome}</strong>
                        <span class="candidate-role">${candidato.vaga || '-'}</span>
                        <span class="candidate-id">ID: ${idCandidato}</span>
                        <span class="candidate-origin">Origem: ${origem}</span>
                        <span class="candidate-location">Localidade: ${localidade}</span>
                        ${tagsCandidato.length
                          ? html`
                              <div class="rh-chip-wrap mt-2">
                                ${tagsCandidato.slice(0, 3).map(
                                  (tag) => html`
                                    <span key=${tag} class="rh-chip">${tag}</span>
                                  `,
                                )}
                              </div>
                            `
                          : null}
                        ${origem === 'Banco de Talentos' &&
                        (candidato.processo_origem || candidato.id_processo_origem)
                          ? html`
                              <span class="candidate-origin">
                                Processo anterior:
                                ${candidato.processo_origem || candidato.id_processo_origem}
                              </span>
                            `
                          : null}
                      </div>
                    </div>

                    <div class="candidate-meta process-candidate-meta-grid">
                      <span class=${`candidate-status-chip process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_fluxo)}`}>
                        ${candidato.status_fluxo || '-'}
                      </span>
                      <span class="candidate-meta-chip">
                        Prova
                        <strong>${temProvaSalva ? obterNotaProvaCandidato(candidato) : 'Sem prova'}</strong>
                      </span>
                      <span class="candidate-meta-chip">
                      ${candidato.cv_disponivel ? 'CV disponível' : 'Sem CV'}
                      </span>
                    </div>

                    <div class="candidate-actions process-candidate-actions">
                      ${renderizarAcoesCompactasDoCandidato({
                        candidato,
                        onAgendarEntrevista: abrirAgendamento,
                        onAprovar: abrirAprovacao,
                        onEditar: abrirEdicaoCandidato,
                        onFicha: abrirFichaCandidato,
                        onDetalheProva: abrirDetalheProva,
                        onCurriculo: abrirCurriculo,
                        onWhatsapp: abrirWhatsappCandidato,
                        fichaCarregandoId: carregandoFichaCandidato,
                        carregandoDetalhe,
                        temProvaSalva,
                        podeBaixarCv,
                        onAtualizarStatus: (item, status) =>
                          atualizarStatus(item.id_registro, status),
                        controlador,
                        menuAberto: menuAcoesCandidatoAberto === idMenuCandidato,
                        onToggleMenu: () =>
                          setMenuAcoesCandidatoAberto((atual) =>
                            atual === idMenuCandidato ? '' : idMenuCandidato,
                          ),
                        onCloseMenu: () => setMenuAcoesCandidatoAberto(''),
                      })}
                    </div>
                  </article>
                `;
              })}
            </div>
            <${PaginacaoCompacta}
              paginaAtual=${candidatosProcessoPaginados.paginaAtual}
              totalPaginas=${candidatosProcessoPaginados.totalPaginas}
              totalItens=${candidatosProcessoPaginados.totalItens}
              tamanhoPagina=${TAMANHO_PAGINA_CANDIDATOS_DETALHE}
              itensNaPagina=${candidatosProcessoPaginados.itens.length}
              onChange=${setPaginaCandidatosProcesso}
            />
          `
      : html`
            <div class="c24-empty-state c24-empty-state-horizontal">
              <span class="material-symbols-outlined">person_search</span>
              <div>
                <h3>${candidatosOperacionais.length ? 'Nenhum candidato encontrado' : 'Nenhum candidato vinculado'}</h3>
                <p>
                  ${candidatosOperacionais.length
                    ? 'Ajuste a busca para visualizar os candidatos deste processo.'
                    : 'Nenhum candidato vinculado a este processo.'}
                </p>
              </div>
            </div>
          `}
        </${SecaoDetalheExpansivel}>

        <${SecaoDetalheExpansivel}
          aberto=${secoesExpandidas.candidatosAprovados}
          titulo="Candidatos aprovados"
          description="Aprovados ficam fora do fluxo ativo e permanecem disponíveis para consulta, resultado e relatórios."
          className="process-approved-section"
          tourId="process-approved-candidates"
          onToggle=${() => alternarSecao('candidatosAprovados')}
        >
        ${candidatosAprovados.length
      ? html`
            <div class="approved-candidate-list">
              ${candidatosAprovadosPaginados.itens.map(
                (candidato) => html`
                  <article class="approved-candidate-card" key=${`aprovado-${candidato.id_registro}`}>
                    <div>
                      <strong>${candidato.nome_candidato || '-'}</strong>
                      <span>${candidato.vaga || '-'}</span>
                    </div>
                    <div>
                      <span>Contato</span>
                      <strong>${candidato.email || '-'}</strong>
                      <small>${candidato.whatsapp || candidato.telefone || '-'}</small>
                    </div>
                    <div>
                      <span>Nota</span>
                      <strong>${obterNotaProvaCandidato(candidato) || 'Sem prova'}</strong>
                    </div>
                    <div>
                      <span>Data de aprovação</span>
                      <strong>
                        ${formatarDataHora(
                          candidato.aprovado_em ||
                          candidato.data_aprovacao ||
                          candidato.data_atualizacao_pipeline,
                        )}
                      </strong>
                    </div>
                    <div class="approved-candidate-actions">
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-primary"
                        disabled=${carregandoFichaCandidato === String(candidato.id_teste || '')}
                        onClick=${() => abrirFichaCandidato(candidato)}
                      >
                        ${carregandoFichaCandidato === String(candidato.id_teste || '')
                          ? 'Abrindo...'
                          : 'Detalhes'}
                      </button>
                      ${candidatoTemProvaSalva(candidato)
                        ? html`
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-dark"
                              disabled=${carregandoDetalheProva ===
                              String(candidato.id_registro || candidato.id_teste || '')}
                              onClick=${() => abrirDetalheProva(candidato)}
                            >
                              Ver resultado
                            </button>
                          `
                        : null}
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
                        : null}
                    </div>
                  </article>
                `,
              )}
            </div>
            <${PaginacaoCompacta}
              paginaAtual=${candidatosAprovadosPaginados.paginaAtual}
              totalPaginas=${candidatosAprovadosPaginados.totalPaginas}
              totalItens=${candidatosAprovadosPaginados.totalItens}
              tamanhoPagina=${TAMANHO_PAGINA_APROVADOS_DETALHE}
              itensNaPagina=${candidatosAprovadosPaginados.itens.length}
              onChange=${setPaginaCandidatosAprovados}
            />
          `
      : html`
            <div class="c24-empty-state">
              <span class="material-symbols-outlined">groups</span>
              <h3>Nenhum candidato aprovado neste processo.</h3>
              <p>Aprovados ficam disponíveis aqui para consulta e relatórios.</p>
            </div>
          `}
        </${SecaoDetalheExpansivel}>
      </div>
      </div>

      <${ModalPadrao}
        aberto=${!!agendamentoSelecionado}
        titulo="Agendar entrevista"
        subtitulo="A entrevista será vinculada ao candidato e ao processo selecionado."
        onClose=${() => setAgendamentoSelecionado(null)}
      >
        ${agendamentoSelecionado
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${agendamentoSelecionado.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Processo</label>
                    <input
                      class="form-control"
                      readonly
                      value=${agendamentoSelecionado.id_processo || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Vaga</label>
                    <input
                      class="form-control"
                      readonly
                      value=${agendamentoSelecionado.vaga || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Status inicial</label>
                    <input
                      class="form-control"
                      readonly
                      value=${CANDIDATE_STATUS_PENDING_CONFIRMATION}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Horário disponível</label>
                    <select
                      class="form-select"
                      value=${formularioEntrevista.id_slot}
                      disabled=${carregandoSlotsEntrevista}
                      onChange=${(event) => {
          const idSlotSelecionado = event.target.value;
          setFormularioEntrevista({
            ...formularioEntrevista,
            id_slot: idSlotSelecionado,
            mensagem_personalizada: mensagemEntrevistaEditada
              ? formularioEntrevista.mensagem_personalizada
              : montarMensagemEntrevistaPadrao(idSlotSelecionado),
          });
        }}
                    >
                      ${carregandoSlotsEntrevista
          ? html`<option value="">Carregando horários...</option>`
          : slotsDisponiveisEntrevista.length
            ? html`<option value="">Selecione um slot</option>`
            : html`
                <option value="" disabled>
                  Nenhum horário disponível para este processo
                </option>
              `}
                      ${slotsDisponiveisEntrevista.map(
          (slot) => html`
                          <option
                            key=${obterIdSlotEntrevista(slot)}
                            value=${obterIdSlotEntrevista(slot)}
                          >
                            ${formatarHorarioSlotEntrevista(slot)}
                          </option>
                        `,
        )}
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">WhatsApp extraído do CV</label>
                    <input
                      class="form-control"
                      placeholder="21999999999"
                      value=${formularioEntrevista.whatsapp || formularioEntrevista.telefone || ''}
                      onInput=${(event) =>
          setFormularioEntrevista({
            ...formularioEntrevista,
            whatsapp: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">E-mail extraído do CV</label>
                    <input
                      class="form-control"
                      placeholder="candidato@email.com"
                      value=${formularioEntrevista.email || ''}
                      onInput=${(event) =>
          setFormularioEntrevista({
            ...formularioEntrevista,
            email: event.target.value,
                      })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Documentos solicitados</label>
                    <div class="row g-2">
                      ${DOCUMENTOS_APROVACAO_PADRAO.map(
                        (documento) => html`
                          <label class="form-check col-md-6" key=${documento}>
                            <input
                              class="form-check-input"
                              type="checkbox"
                              checked=${documentosEntrevista.includes(documento)}
                              onChange=${(event) =>
                                alternarDocumentoEntrevista(
                                  documento,
                                  event.target.checked,
                                )}
                            />
                            <span class="form-check-label">${documento}</span>
                          </label>
                        `,
                      )}
                    </div>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Mensagem que será enviada</label>
                    <textarea
                      class="form-control"
                      rows="6"
                      value=${montarMensagemEntrevista()}
                      onInput=${(event) => {
          setMensagemEntrevistaEditada(true);
          setFormularioEntrevista({
            ...formularioEntrevista,
            mensagem_personalizada: event.target.value,
          });
        }}
                    ></textarea>
                    <div class="form-text">
                      Este texto será usado exatamente no envio.
                    </div>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observações RH</label>
                    <textarea
                      class="form-control"
                      rows="4"
                      value=${formularioEntrevista.observacoes_rh}
                      onInput=${(event) =>
          setFormularioEntrevista({
            ...formularioEntrevista,
            observacoes_rh: event.target.value,
          })}
                    ></textarea>
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setAgendamentoSelecionado(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  disabled=${salvandoEntrevista || processoEncerrado || !formularioEntrevista.id_slot}
                  onClick=${() => salvarAgendamento()}
                >
                  ${salvandoEntrevista ? 'Salvando...' : 'Salvar e copiar'}
                </button>
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  disabled=${salvandoEntrevista || processoEncerrado || !formularioEntrevista.id_slot}
                  onClick=${() => salvarAgendamento('email')}
                >
                  ${salvandoEntrevista ? 'Salvando...' : 'Enviar por e-mail'}
                </button>
                <button
                  type="button"
                  class="btn btn-success"
                  disabled=${salvandoEntrevista || processoEncerrado || !formularioEntrevista.id_slot}
                  onClick=${() => salvarAgendamento('whatsapp')}
                >
                  ${salvandoEntrevista
          ? 'Salvando...'
          : processoEncerrado
            ? 'Processo encerrado'
            : 'Enviar por WhatsApp'}
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>

      <${ModalAprovacaoCandidato}
        aberto=${!!aprovacaoSelecionada}
        candidato=${aprovacaoSelecionada}
        processo=${processo}
        salvando=${salvandoAprovacao}
        enviandoCanal=${enviandoCanalAprovacao}
        onClose=${() => setAprovacaoSelecionada(null)}
        onConfirm=${confirmarAprovacao}
        onSendWhatsApp=${enviarAprovacaoWhatsApp}
        onSendEmail=${enviarAprovacaoEmail}
      />

      <${ModalRegistroWhatsapp}
        candidato=${whatsappSelecionado}
        formulario=${formularioWhatsapp}
        salvando=${registrandoWhatsapp}
        erro=${erroWhatsapp}
        onClose=${() => {
          setWhatsappSelecionado(null);
          setErroWhatsapp('');
        }}
        onChange=${atualizarCampoWhatsapp}
        onSave=${salvarRegistroWhatsapp}
      />

      <${ModalPadrao}
        aberto=${!!eliminacaoSelecionada}
        titulo="Eliminar candidato"
        subtitulo="Informe o motivo antes de confirmar a eliminação."
        onClose=${() => setEliminacaoSelecionada(null)}
      >
        ${eliminacaoSelecionada
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-12">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${eliminacaoSelecionada.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Motivo da eliminação</label>
                    <select
                      class="form-select"
                      value=${formularioEliminacao.motivo_eliminacao}
                      onChange=${(event) =>
                        setFormularioEliminacao({
                          motivo_eliminacao: event.target.value,
                          etapa_eliminacao:
                            event.target.value === 'Eliminado na entrevista'
                              ? formularioEliminacao.etapa_eliminacao
                              : '',
                        })}
                    >
                      <option value="">Selecione...</option>
                      ${MOTIVOS_ELIMINACAO.map(
                        (motivo) => html`
                          <option key=${motivo} value=${motivo}>${motivo}</option>
                        `,
                      )}
                    </select>
                  </div>
                  ${formularioEliminacao.motivo_eliminacao === 'Eliminado na entrevista'
                    ? html`
                        <div class="col-md-12">
                          <label class="form-label">Em qual entrevista?</label>
                          <select
                            class="form-select"
                            value=${formularioEliminacao.etapa_eliminacao}
                            onChange=${(event) =>
                              setFormularioEliminacao({
                                ...formularioEliminacao,
                                etapa_eliminacao: event.target.value,
                              })}
                          >
                            <option value="">Selecione...</option>
                            ${ETAPAS_ELIMINACAO_ENTREVISTA.map(
                              (etapa) => html`
                                <option key=${etapa} value=${etapa}>${etapa}</option>
                              `,
                            )}
                          </select>
                        </div>
                      `
                    : null}
                </div>
                ${erroEliminacao
                  ? html`<div class="alert alert-warning mt-3 mb-0">${erroEliminacao}</div>`
                  : null}
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setEliminacaoSelecionada(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-danger"
                  onClick=${confirmarEliminacao}
                >
                  Confirmar eliminação
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>

      <${ModalEdicaoEntrevista}
        aberto=${!!entrevistaEdicao}
        entrevista=${entrevistaEdicao}
        formulario=${formularioEdicaoEntrevista}
        slotsDisponiveis=${slotsDisponiveisEntrevista}
        salvando=${salvandoEdicaoEntrevista}
        onClose=${() => setEntrevistaEdicao(null)}
        onChange=${setFormularioEdicaoEntrevista}
        onSave=${salvarEdicaoEntrevista}
      />

      <${ModalFichaCandidato}
        ficha=${fichaCandidatoSelecionada}
        formulario=${formularioFichaCandidato}
        salvando=${salvandoFichaCandidato}
        erro=${erroFichaCandidato}
        mensagem=${mensagemFichaCandidato}
        onClose=${() => {
          setFichaCandidatoSelecionada(null);
          setErroFichaCandidato('');
          setMensagemFichaCandidato('');
        }}
        onChange=${atualizarCampoFichaCandidato}
        onSave=${salvarFichaCandidato}
        onPrint=${imprimirFichaSelecionada}
        onAbrirCurriculo=${abrirCurriculo}
      />

      <${ModalPadrao}
        aberto=${!!candidatoEditando}
        titulo=${`Editar candidato | ${candidatoEditando?.nome_candidato || 'Candidato'}`}
        subtitulo="Atualize dados cadastrais sem alterar o vínculo com o processo."
        onClose=${() => setCandidatoEditando(null)}
      >
        ${candidatoEditando
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Nome</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.nome_candidato}
                      onInput=${(event) =>
          atualizarCampoCandidato('nome_candidato', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">E-mail</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.email}
                      onInput=${(event) =>
          atualizarCampoCandidato('email', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Telefone</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.telefone}
                      onInput=${(event) =>
          atualizarCampoCandidato('telefone', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">WhatsApp</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.whatsapp}
                      onInput=${(event) =>
          atualizarCampoCandidato('whatsapp', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Cidade</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.cidade}
                      onInput=${(event) =>
          atualizarCampoCandidato('cidade', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Bairro</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.bairro}
                      onInput=${(event) =>
          atualizarCampoCandidato('bairro', event.target.value)}
                    />
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setCandidatoEditando(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${salvarEdicaoCandidato}
                >
                  Salvar
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>

      <${ModalDetalhesProva}
        detalhe=${detalheProvaSelecionado}
        onClose=${() => setDetalheProvaSelecionado(null)}
        onDownload=${() =>
      detalheProvaSelecionado?.linha?.id_teste
        ? baixarPacoteHistorico(
          detalheProvaSelecionado.linha.id_teste,
          detalheProvaSelecionado.linha.nome_candidato,
        )
        : null}
      />

      <${ModalPadrao}
        aberto=${!!preAnaliseSelecionada}
        titulo="Editar pré-cadastro"
        subtitulo="Ajuste as informações extraídas do CV antes de seguir."
        onClose=${() => setPreAnaliseSelecionada(null)}
      >
        ${preAnaliseSelecionada
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Nome</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.nome_candidato || ''}
                      onInput=${(event) =>
          setPreAnaliseSelecionada({
            ...preAnaliseSelecionada,
            nome_candidato: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">E-mail</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.email || ''}
                      onInput=${(event) =>
          setPreAnaliseSelecionada({
            ...preAnaliseSelecionada,
            email: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Telefone</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.telefone || ''}
                      onInput=${(event) =>
          setPreAnaliseSelecionada({
            ...preAnaliseSelecionada,
            telefone: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">WhatsApp</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.whatsapp || ''}
                      onInput=${(event) =>
          setPreAnaliseSelecionada({
            ...preAnaliseSelecionada,
            whatsapp: event.target.value,
          })}
                    />
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setPreAnaliseSelecionada(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${salvarEdicao}
                >
                  Salvar
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!visualizacaoCv}
        titulo="Visualização do CV"
        subtitulo="Texto bruto extraído do currículo."
        onClose=${() => setVisualizacaoCv(null)}
        className="cv-preview-dialog"
      >
        ${visualizacaoCv
      ? html`
              <div class="rh-details-body">
                <div class="cv-preview-box">
                  ${visualizacaoCv.texto_extraido || 'Sem conteúdo extraído.'}
                </div>
                ${visualizacaoCv.arquivo_original_base64
          ? html`
                      <div class="mt-3 text-end">
                        <button
                          type="button"
                          class="btn btn-outline-primary"
                          onClick=${() => {
              const link = document.createElement('a');
              link.href = `data:${visualizacaoCv.mime_type || 'application/octet-stream'};base64,${visualizacaoCv.arquivo_original_base64}`;
              link.download = visualizacaoCv.nome_arquivo || 'cv';
              link.click();
            }}
                        >
                          Baixar original
                        </button>
                      </div>
                    `
          : null}
              </div>
            `
      : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!resultadoAnaliseSelecionado}
        titulo="Resultado da análise"
        subtitulo="Resumo analítico da classificação automática do CV."
        onClose=${() => setResultadoAnaliseSelecionado(null)}
      >
        ${resultadoAnaliseSelecionado
      ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
          {
            label: 'Score',
            value: resultadoAnaliseSelecionado.score_final ?? '-',
          },
          {
            label: 'Classificação',
            value: html`
                        <span
                          class=${`cv-classification-badge ${resultadoAnaliseSelecionado.classificacao_slug || ''}`}
                        >
                          ${resultadoAnaliseSelecionado.classificacao || '-'}
                        </span>
                      `,
          },
        ]}
                />

                <${SectionCard}
                  title="Palavras-chave identificadas"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${(() => {
          try {
            const palavras = JSON.parse(
              resultadoAnaliseSelecionado.palavras_chave || '[]',
            );
            return Array.isArray(palavras) && palavras.length
              ? palavras.join(', ')
              : 'Nenhuma palavra-chave relevante foi identificada.';
          } catch (error) {
            return (
              resultadoAnaliseSelecionado.palavras_chave ||
              'Nenhuma palavra-chave relevante foi identificada.'
            );
          }
        })()}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Pontos observados pelo sistema"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${(() => {
          const dados = lerProblemasCv(resultadoAnaliseSelecionado);
          const linhas = [
            ...(dados.pontos_fortes || []),
            ...(dados.problemas || []),
          ];
          return linhas.length
            ? linhas.join('\n')
            : resultadoAnaliseSelecionado.problemas ||
            'Nenhum problema crítico foi apontado.';
        })()}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Experiências e competências"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${(() => {
          const dados = lerProblemasCv(resultadoAnaliseSelecionado);
          const competencias = dados.competencias || {};
          const experiencias = dados.experiencias || [];
          const linhas = [];
          if (dados.confianca_nome) {
            linhas.push(`Nome: ${dados.nome_detectado || resultadoAnaliseSelecionado.nome_candidato || '-'} (${dados.confianca_nome})`);
          }
          if (experiencias.length) {
            linhas.push(`Experiências: ${experiencias.join(' | ')}`);
          }
          if (competencias.comportamentais?.length) {
            linhas.push(`Comportamentais: ${competencias.comportamentais.join(', ')}`);
          }
          if (competencias.tecnicas?.length) {
            linhas.push(`Técnicas: ${competencias.tecnicas.join(', ')}`);
          }
          return linhas.length
            ? linhas.join('\n')
            : 'Sem experiências ou competências claras no texto extraído.';
        })()}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Resumo analítico"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${lerProblemasCv(resultadoAnaliseSelecionado).justificativa ||
        montarResumoAnaliticoCv(resultadoAnaliseSelecionado)}
                  </div>
                </${SectionCard}>
              </div>
            `
      : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
