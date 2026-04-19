import {
  html,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '../infraestrutura-react.js';
import {
  lerCandidatosProcessos,
  lerProcessos,
} from '../servico-api.js';
import { montarIndiceRequisitosBusca } from '../perguntas.js';
import {
  CHAVE_PIPELINE_CANDIDATO,
  CHAVE_PIPELINE_PROCESSO,
  CHAVE_PROCESSO_DETALHE,
} from '../features/processos-estado.js';

export const CHAVE_REQUISITO_BUSCA = 'rh_requisito_busca_atual';

const PAGINAS_BUSCA = [
  {
    id: 'pagina-inicio',
    tela: 'screen-menu',
    titulo: 'Painel executivo do RH',
    descricao: 'Visao geral, atalhos e provas recentes.',
  },
  {
    id: 'pagina-historico',
    tela: 'screen-history',
    titulo: 'Historico de provas',
    descricao: 'Consulta de resultados, filtros e detalhes salvos.',
  },
  {
    id: 'pagina-processos',
    tela: 'screen-processes',
    titulo: 'Processos seletivos',
    descricao: 'Gestao de processos, candidatos e encerramentos.',
  },
  {
    id: 'pagina-pipeline',
    tela: 'screen-candidate-pipeline',
    titulo: 'Pipeline de candidatos',
    descricao: 'Kanban por etapa com persistencia no backend.',
  },
  {
    id: 'pagina-entrevistas',
    tela: 'screen-interviews',
    titulo: 'Entrevistas agendadas',
    descricao: 'Agenda de entrevistas, status e mensagens base do RH.',
  },
  {
    id: 'pagina-analise',
    tela: 'screen-analysis-candidates',
    titulo: 'Analise de candidatos',
    descricao: 'Leitura analitica, afinidade e parecer final.',
  },
  {
    id: 'pagina-talentos',
    tela: 'screen-talent-bank',
    titulo: 'Banco de talentos',
    descricao: 'Reaproveitamento de candidatos.',
  },
  {
    id: 'pagina-configuracao',
    tela: 'screen-config',
    titulo: 'Configuracao da prova',
    descricao: 'Parametros da avaliacao e requisitos por vaga.',
  },
];

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function montarTextoBusca(item) {
  return [
    item.titulo,
    item.descricao,
    item.meta,
    item.idProcesso,
    item.nomeCandidato,
    item.vaga,
    item.status,
    item.stageLabel,
    item.blueprintLabel,
  ]
    .filter(Boolean)
    .join(' ');
}

async function carregarIndiceBuscaGlobal() {
  const [processos, candidatos] = await Promise.all([
    lerProcessos().catch(() => []),
    lerCandidatosProcessos().catch(() => []),
  ]);

  const requisitos = montarIndiceRequisitosBusca().map((item) => ({
    id: `requisito-${item.id}`,
    tipo: 'requisito',
    titulo: item.title,
    descricao: item.description,
    meta: `${item.blueprintLabel} • ${item.stageLabel}`,
    blueprintLabel: item.blueprintLabel,
    stageLabel: item.stageLabel,
    questionType: item.questionType,
  }));

  return {
    paginas: PAGINAS_BUSCA.map((item) => ({
      id: item.id,
      tipo: 'pagina',
      titulo: item.titulo,
      descricao: item.descricao,
      tela: item.tela,
    })),
    processos: (Array.isArray(processos) ? processos : []).map((item) => ({
      id: `processo-${item.id_processo}`,
      tipo: 'processo',
      titulo: item.id_processo || 'Processo',
      descricao: `${item.vaga || '-'} • ${item.operacao || item.trilha || '-'} • ${item.status || '-'}`,
      meta: `Vagas ${item.vagas_preenchidas || 0}/${item.quantidade_vagas || 0}`,
      idProcesso: item.id_processo,
    })),
    candidatos: (Array.isArray(candidatos) ? candidatos : [])
      .filter((item) => String(item.id_processo || '').trim())
      .map((item) => ({
        id: `candidato-${item.id_registro}`,
        tipo: 'candidato',
        titulo: item.nome_candidato || 'Candidato',
        descricao: `${item.vaga || '-'} • ${item.id_processo || '-'} • ${item.status_candidato || '-'}`,
        meta: item.origem || '',
        idRegistro: item.id_registro,
        idProcesso: item.id_processo,
        nomeCandidato: item.nome_candidato,
        vaga: item.vaga,
        status: item.status_candidato,
      })),
    requisitos,
  };
}

function filtrarResultados(query, indice) {
  if (!indice) return [];

  const termo = normalizarBusca(query);
  if (!termo) {
    return indice.paginas.slice(0, 5);
  }

  const colecoes = [
    ...indice.paginas,
    ...indice.processos,
    ...indice.candidatos,
    ...indice.requisitos,
  ];

  return colecoes
    .map((item) => ({
      ...item,
      _busca: normalizarBusca(montarTextoBusca(item)),
    }))
    .filter((item) => item._busca.includes(termo))
    .sort((a, b) => a._busca.indexOf(termo) - b._busca.indexOf(termo))
    .slice(0, 12);
}

function rotuloTipo(tipo) {
  if (tipo === 'pagina') return 'Pagina';
  if (tipo === 'processo') return 'Processo';
  if (tipo === 'candidato') return 'Candidato';
  return 'Requisito';
}

function selecionarResultado(resultado, controlador, limparBusca) {
  if (!resultado) return;

  if (resultado.tipo === 'pagina') {
    controlador.irParaTelaProtegida(resultado.tela);
    limparBusca();
    return;
  }

  if (resultado.tipo === 'processo') {
    sessionStorage.setItem(CHAVE_PROCESSO_DETALHE, resultado.idProcesso || '');
    sessionStorage.setItem(CHAVE_PIPELINE_PROCESSO, resultado.idProcesso || '');
    controlador.irParaTelaProtegida('screen-process-details');
    limparBusca();
    return;
  }

  if (resultado.tipo === 'candidato') {
    sessionStorage.setItem(CHAVE_PIPELINE_PROCESSO, resultado.idProcesso || '');
    sessionStorage.setItem(CHAVE_PIPELINE_CANDIDATO, String(resultado.idRegistro || ''));
    controlador.irParaTelaProtegida('screen-candidate-pipeline');
    limparBusca();
    return;
  }

  sessionStorage.setItem(CHAVE_REQUISITO_BUSCA, JSON.stringify(resultado));
  controlador.irParaTelaProtegida('screen-config');
  limparBusca();
}

export function BuscaGlobalTopbar({ placeholderBusca, controlador }) {
  const [termo, setTermo] = useState('');
  const [aberta, setAberta] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [indice, setIndice] = useState(null);
  const caixaRef = useRef(null);

  useEffect(() => {
    const fecharAoClicarFora = (event) => {
      if (!caixaRef.current?.contains(event.target)) {
        setAberta(false);
      }
    };

    window.addEventListener('mousedown', fecharAoClicarFora);
    return () => window.removeEventListener('mousedown', fecharAoClicarFora);
  }, []);

  const garantirIndice = async () => {
    if (indice || carregando) return;

    setCarregando(true);
    try {
      setIndice(await carregarIndiceBuscaGlobal());
    } finally {
      setCarregando(false);
    }
  };

  const resultados = useMemo(() => filtrarResultados(termo, indice), [indice, termo]);

  const limparBusca = () => {
    setTermo('');
    setAberta(false);
  };

  return html`
    <div class="rh-global-search" ref=${caixaRef}>
      <div class="rh-modern-search-shell">
        <span class="material-symbols-outlined">search</span>
        <input
          type="text"
          placeholder=${placeholderBusca}
          value=${termo}
          onFocus=${async () => {
            setAberta(true);
            await garantirIndice();
          }}
          onInput=${async (event) => {
            setTermo(event.target.value);
            setAberta(true);
            await garantirIndice();
          }}
        />
      </div>

      ${aberta
        ? html`
            <div class="rh-global-search-panel">
              ${carregando
                ? html`<div class="rh-global-search-empty">Carregando indice de busca...</div>`
                : resultados.length
                  ? html`
                      ${resultados.map(
                        (resultado) => html`
                          <button
                            key=${resultado.id}
                            type="button"
                            class="rh-global-search-result"
                            onClick=${() =>
                              selecionarResultado(
                                resultado,
                                controlador,
                                limparBusca,
                              )}
                          >
                            <div class="rh-global-search-result-head">
                              <strong>${resultado.titulo}</strong>
                              <span class="rh-global-search-tag">
                                ${rotuloTipo(resultado.tipo)}
                              </span>
                            </div>
                            <p>${resultado.descricao || 'Sem descricao adicional.'}</p>
                            ${resultado.meta
                              ? html`<span class="rh-global-search-meta">${resultado.meta}</span>`
                              : null}
                          </button>
                        `,
                      )}
                    `
                  : html`
                      <div class="rh-global-search-empty">
                        Nenhum resultado encontrado para "${termo}".
                      </div>
                    `}
            </div>
          `
        : null}
    </div>
  `;
}
