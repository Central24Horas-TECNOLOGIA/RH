import { html, useEffect, useRef, useState } from '../../infraestrutura-react.js';
import {
  listarDocumentosRh,
  criarPastaDocumentoRh,
  uploadArquivoDocumentoRh,
  obterConteudoDocumentoRh,
  baixarDocumentoRh,
  renomearDocumentoRh,
  excluirDocumentoRh,
} from '../../app/controlador-aplicacao.js';
import { baixarBlob } from '../../utilitarios.js';
import { formatarDataHora } from '../../shared/helpers-visuais.js';
import { AcaoSair } from '../../shared/components/actions.js';
import {
  LoadingState,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';

const CHAVE_MODO_VISUALIZACAO = 'rh_documentos_modo_visualizacao_v1';

const ICONES_POR_CATEGORIA = {
  pdf: 'picture_as_pdf',
  documento: 'description',
  texto: 'article',
  planilha: 'table_chart',
  apresentacao: 'slideshow',
  imagem: 'image',
  compactado: 'folder_zip',
  outro: 'insert_drive_file',
};

const OPCOES_CATEGORIA = [
  { valor: '', label: 'Todos os tipos de arquivo' },
  { valor: 'pdf', label: 'PDF' },
  { valor: 'documento', label: 'Documentos' },
  { valor: 'texto', label: 'Texto' },
  { valor: 'planilha', label: 'Planilhas' },
  { valor: 'apresentacao', label: 'Apresentações' },
  { valor: 'imagem', label: 'Imagens' },
  { valor: 'compactado', label: 'Compactados' },
  { valor: 'outro', label: 'Outros' },
];

function lerModoVisualizacaoSalvo() {
  try {
    const valor = window.localStorage.getItem(CHAVE_MODO_VISUALIZACAO);
    if (['grade-grande', 'grade-pequena', 'lista'].includes(valor)) return valor;
  } catch (error) {
    // ignora falha de leitura do localStorage
  }
  return 'grade-grande';
}

function salvarModoVisualizacao(modo) {
  try {
    window.localStorage.setItem(CHAVE_MODO_VISUALIZACAO, modo);
  } catch (error) {
    // ignora falha de escrita no localStorage
  }
}

function formatarTamanho(bytes) {
  const valor = Number(bytes || 0);
  if (!valor) return '-';
  if (valor < 1024) return `${valor} B`;
  if (valor < 1024 * 1024) return `${(valor / 1024).toFixed(1)} KB`;
  if (valor < 1024 * 1024 * 1024) return `${(valor / (1024 * 1024)).toFixed(1)} MB`;
  return `${(valor / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function iconeDoItem(item) {
  if (item.tipo === 'pasta') return 'folder';
  return ICONES_POR_CATEGORIA[item.categoria_extensao] || 'insert_drive_file';
}

export function TelaDocumentosRh({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [itens, setItens] = useState([]);
  const [trilha, setTrilha] = useState([]);
  const [pastaAtual, setPastaAtual] = useState(null);
  const [modoVisualizacao, setModoVisualizacao] = useState(() => lerModoVisualizacaoSalvo());
  const [menuAbertoId, setMenuAbertoId] = useState(null);
  const [modalCriarPastaAberto, setModalCriarPastaAberto] = useState(false);
  const [nomeNovaPasta, setNomeNovaPasta] = useState('');
  const [itemRenomear, setItemRenomear] = useState(null);
  const [novoNome, setNovoNome] = useState('');
  const [itemVisualizado, setItemVisualizado] = useState(null);
  const [conteudoVisualizado, setConteudoVisualizado] = useState(null);
  const [carregandoConteudo, setCarregandoConteudo] = useState(false);
  const [filtros, setFiltros] = useState({
    busca: '',
    tipo: '',
    categoriaExtensao: '',
    criadoPor: '',
    dataCriacaoDe: '',
    dataCriacaoAte: '',
    dataModificacaoDe: '',
    dataModificacaoAte: '',
  });
  const inputArquivoRef = useRef(null);

  const podeGerenciar = controlador?.possuiPermissao?.('documentos_rh.gerenciar');

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const resultado = await listarDocumentosRh({
        idPastaPai: pastaAtual,
        tipo: filtros.tipo,
        categoriaExtensao: filtros.categoriaExtensao,
        busca: filtros.busca,
        criadoPor: filtros.criadoPor,
        dataCriacaoDe: filtros.dataCriacaoDe,
        dataCriacaoAte: filtros.dataCriacaoAte,
        dataModificacaoDe: filtros.dataModificacaoDe,
        dataModificacaoAte: filtros.dataModificacaoAte,
      });
      setItens(Array.isArray(resultado?.itens) ? resultado.itens : []);
      setTrilha(Array.isArray(resultado?.trilha) ? resultado.trilha : []);
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar os itens do Drive-Conecta.');
      setItens([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pastaAtual,
    filtros.tipo,
    filtros.categoriaExtensao,
    filtros.busca,
    filtros.criadoPor,
    filtros.dataCriacaoDe,
    filtros.dataCriacaoAte,
    filtros.dataModificacaoDe,
    filtros.dataModificacaoAte,
  ]);

  const alterarModoVisualizacao = (modo) => {
    setModoVisualizacao(modo);
    salvarModoVisualizacao(modo);
  };

  const abrirPasta = (item) => {
    setMenuAbertoId(null);
    setPastaAtual(item.id);
  };

  const irParaTrilha = (idPasta) => {
    setMenuAbertoId(null);
    setPastaAtual(idPasta);
  };

  const abrirCriarPasta = () => {
    setNomeNovaPasta('');
    setModalCriarPastaAberto(true);
  };

  const confirmarCriarPasta = async () => {
    const nome = nomeNovaPasta.trim();
    if (!nome) {
      window.alert('Informe um nome para a pasta.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await criarPastaDocumentoRh({ nome, idPastaPai: pastaAtual });
      setModalCriarPastaAberto(false);
      await carregar();
    } catch (error) {
      setErro(error?.message || 'Não foi possível criar a pasta.');
    } finally {
      setSalvando(false);
    }
  };

  const acionarUpload = () => {
    inputArquivoRef.current?.click();
  };

  const enviarArquivos = async (event) => {
    const arquivos = Array.from(event.target.files || []);
    event.target.value = '';
    if (!arquivos.length) return;

    setSalvando(true);
    setErro('');
    try {
      for (const arquivo of arquivos) {
        // eslint-disable-next-line no-await-in-loop
        await uploadArquivoDocumentoRh(arquivo, pastaAtual);
      }
      await carregar();
    } catch (error) {
      setErro(error?.message || 'Não foi possível enviar o arquivo.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirRenomear = (item) => {
    setMenuAbertoId(null);
    setItemRenomear(item);
    setNovoNome(item.nome);
  };

  const confirmarRenomear = async () => {
    if (!itemRenomear) return;
    const nome = novoNome.trim();
    if (!nome) {
      window.alert('Informe um novo nome.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await renomearDocumentoRh(itemRenomear.id, nome);
      setItemRenomear(null);
      await carregar();
    } catch (error) {
      setErro(error?.message || 'Não foi possível renomear o item.');
    } finally {
      setSalvando(false);
    }
  };

  const excluirItem = async (item) => {
    setMenuAbertoId(null);
    const mensagem =
      item.tipo === 'pasta'
        ? `Deseja excluir a pasta "${item.nome}" e todo o seu conteúdo?`
        : `Deseja excluir o arquivo "${item.nome}"?`;
    if (!window.confirm(mensagem)) return;

    setSalvando(true);
    setErro('');
    try {
      await excluirDocumentoRh(item.id);
      await carregar();
    } catch (error) {
      setErro(error?.message || 'Não foi possível excluir o item.');
    } finally {
      setSalvando(false);
    }
  };

  const baixarItem = async (item) => {
    setMenuAbertoId(null);
    try {
      const arquivo = await baixarDocumentoRh(item.id);
      baixarBlob(arquivo.filename || item.nome, arquivo.blob);
    } catch (error) {
      setErro(error?.message || 'Não foi possível baixar o arquivo.');
    }
  };

  const abrirVisualizacao = async (item) => {
    setMenuAbertoId(null);
    setItemVisualizado(item);
    setConteudoVisualizado(null);
    setCarregandoConteudo(true);
    try {
      const conteudo = await obterConteudoDocumentoRh(item.id);
      setConteudoVisualizado(conteudo);
    } catch (error) {
      setConteudoVisualizado({
        modo_visualizacao: 'indisponivel',
        mensagem: error?.message || 'Não foi possível carregar o arquivo.',
      });
    } finally {
      setCarregandoConteudo(false);
    }
  };

  const fecharVisualizacao = () => {
    setItemVisualizado(null);
    setConteudoVisualizado(null);
  };

  const alternarMenu = (item) => {
    setMenuAbertoId((atual) => (atual === item.id ? null : item.id));
  };

  return html`
    <${PainelRh}
      screenId="screen-documents"
      navAtiva="screen-documents"
      subtituloMarca="Drive-Conecta"
      placeholderBusca="Pastas e arquivos do RH"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Drive-Conecta"
        title="Drive-Conecta"
        description="Repositório central de pastas e arquivos do RH."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard} title="Filtros" description="">
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Busca por nome</label>
            <input
              class="form-control"
              placeholder="Nome da pasta ou arquivo"
              value=${filtros.busca}
              onInput=${(event) => setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Tipo</label>
            <select
              class="form-select"
              value=${filtros.tipo}
              onChange=${(event) => setFiltros({ ...filtros, tipo: event.target.value })}
            >
              <option value="">Pastas e arquivos</option>
              <option value="pasta">Somente pastas</option>
              <option value="arquivo">Somente arquivos</option>
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Tipo de arquivo</label>
            <select
              class="form-select"
              value=${filtros.categoriaExtensao}
              onChange=${(event) =>
      setFiltros({ ...filtros, categoriaExtensao: event.target.value })}
            >
              ${OPCOES_CATEGORIA.map(
        (opcao) => html`
                  <option key=${opcao.valor} value=${opcao.valor}>${opcao.label}</option>
                `,
      )}
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Criado por</label>
            <input
              class="form-control"
              placeholder="Nome do usuário"
              value=${filtros.criadoPor}
              onInput=${(event) => setFiltros({ ...filtros, criadoPor: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Criado de</label>
            <input
              type="date"
              class="form-control"
              value=${filtros.dataCriacaoDe}
              onInput=${(event) =>
      setFiltros({ ...filtros, dataCriacaoDe: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Criado até</label>
            <input
              type="date"
              class="form-control"
              value=${filtros.dataCriacaoAte}
              onInput=${(event) =>
      setFiltros({ ...filtros, dataCriacaoAte: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Modificado de</label>
            <input
              type="date"
              class="form-control"
              value=${filtros.dataModificacaoDe}
              onInput=${(event) =>
      setFiltros({ ...filtros, dataModificacaoDe: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Modificado até</label>
            <input
              type="date"
              class="form-control"
              value=${filtros.dataModificacaoAte}
              onInput=${(event) =>
      setFiltros({ ...filtros, dataModificacaoAte: event.target.value })}
            />
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard} title="Itens" description="">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item">
                <button
                  type="button"
                  class="btn btn-link p-0"
                  onClick=${() => irParaTrilha(null)}
                >
                  Drive-Conecta
                </button>
              </li>
              ${trilha.map(
      (item) => html`
                  <li key=${item.id} class="breadcrumb-item">
                    <button
                      type="button"
                      class="btn btn-link p-0"
                      onClick=${() => irParaTrilha(item.id)}
                    >
                      ${item.nome}
                    </button>
                  </li>
                `,
    )}
            </ol>
          </nav>

          <div class="d-flex align-items-center gap-2 flex-wrap">
            <div class="btn-group" role="group" aria-label="Modo de visualização">
              <button
                type="button"
                class=${`btn btn-sm btn-outline-secondary ${modoVisualizacao === 'grade-grande' ? 'active' : ''}`}
                title="Grade grande"
                onClick=${() => alterarModoVisualizacao('grade-grande')}
              >
                <span class="material-symbols-outlined">grid_view</span>
              </button>
              <button
                type="button"
                class=${`btn btn-sm btn-outline-secondary ${modoVisualizacao === 'grade-pequena' ? 'active' : ''}`}
                title="Grade pequena"
                onClick=${() => alterarModoVisualizacao('grade-pequena')}
              >
                <span class="material-symbols-outlined">apps</span>
              </button>
              <button
                type="button"
                class=${`btn btn-sm btn-outline-secondary ${modoVisualizacao === 'lista' ? 'active' : ''}`}
                title="Lista"
                onClick=${() => alterarModoVisualizacao('lista')}
              >
                <span class="material-symbols-outlined">view_list</span>
              </button>
            </div>

            ${podeGerenciar
      ? html`
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-primary"
                    disabled=${salvando}
                    onClick=${abrirCriarPasta}
                  >
                    <span class="material-symbols-outlined">create_new_folder</span>
                    Nova pasta
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    disabled=${salvando}
                    onClick=${acionarUpload}
                  >
                    <span class="material-symbols-outlined">upload</span>
                    Enviar arquivo
                  </button>
                  <input
                    ref=${inputArquivoRef}
                    type="file"
                    multiple
                    class="d-none"
                    onChange=${enviarArquivos}
                  />
                `
      : null}
          </div>
        </div>

        ${carregando
      ? html`
              <${LoadingState}
                titulo="Carregando Drive-Conecta"
                descricao="Buscando pastas e arquivos."
              />
            `
      : itens.length === 0
        ? html`<p class="text-muted mb-0">Nenhum item nesta pasta.</p>`
        : modoVisualizacao === 'lista'
          ? html`
                <div class="table-responsive">
                  <table class="table align-middle rh-modern-history-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Tipo</th>
                        <th>Tamanho</th>
                        <th>Criado por</th>
                        <th>Criado em</th>
                        <th>Modificado em</th>
                        <th class="text-end">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itens.map(
              (item) => html`
                          <tr key=${item.id}>
                            <td>
                              <button
                                type="button"
                                class="btn btn-link p-0 text-start"
                                onClick=${() =>
                  item.tipo === 'pasta' ? abrirPasta(item) : abrirVisualizacao(item)}
                              >
                                <span class="material-symbols-outlined align-middle me-1">
                                  ${iconeDoItem(item)}
                                </span>
                                ${item.nome}
                              </button>
                            </td>
                            <td>${item.tipo === 'pasta' ? 'Pasta' : item.extensao || 'Arquivo'}</td>
                            <td>${item.tipo === 'pasta' ? '-' : formatarTamanho(item.tamanho_bytes)}</td>
                            <td>${item.criado_por || '-'}</td>
                            <td>${formatarDataHora(item.criado_em)}</td>
                            <td>${formatarDataHora(item.atualizado_em)}</td>
                            <td class="text-end">
                              <${MenuAcoesItem}
                                item=${item}
                                aberto=${menuAbertoId === item.id}
                                podeGerenciar=${podeGerenciar}
                                onAlternar=${() => alternarMenu(item)}
                                onAbrir=${() =>
                  item.tipo === 'pasta' ? abrirPasta(item) : abrirVisualizacao(item)}
                                onBaixar=${() => baixarItem(item)}
                                onRenomear=${() => abrirRenomear(item)}
                                onExcluir=${() => excluirItem(item)}
                              />
                            </td>
                          </tr>
                        `,
            )}
                    </tbody>
                  </table>
                </div>
              `
          : html`
                <div
                  class=${`rh-documentos-grid ${modoVisualizacao === 'grade-pequena' ? 'rh-documentos-grid--pequena' : 'rh-documentos-grid--grande'}`}
                >
                  ${itens.map(
              (item) => html`
                      <div key=${item.id} class="rh-documentos-card">
                        <button
                          type="button"
                          class="rh-documentos-card-corpo"
                          onClick=${() =>
                  item.tipo === 'pasta' ? abrirPasta(item) : abrirVisualizacao(item)}
                        >
                          <span class="material-symbols-outlined rh-documentos-card-icone">
                            ${iconeDoItem(item)}
                          </span>
                          <span class="rh-documentos-card-nome" title=${item.nome}>
                            ${item.nome}
                          </span>
                          ${item.tipo === 'arquivo'
                  ? html`<span class="rh-documentos-card-meta">${formatarTamanho(item.tamanho_bytes)}</span>`
                  : null}
                        </button>
                        <${MenuAcoesItem}
                          item=${item}
                          aberto=${menuAbertoId === item.id}
                          podeGerenciar=${podeGerenciar}
                          onAlternar=${() => alternarMenu(item)}
                          onAbrir=${() =>
                  item.tipo === 'pasta' ? abrirPasta(item) : abrirVisualizacao(item)}
                          onBaixar=${() => baixarItem(item)}
                          onRenomear=${() => abrirRenomear(item)}
                          onExcluir=${() => excluirItem(item)}
                        />
                      </div>
                    `,
            )}
                </div>
              `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${modalCriarPastaAberto}
        titulo="Nova pasta"
        subtitulo="Informe o nome da nova pasta."
        onClose=${() => setModalCriarPastaAberto(false)}
      >
        <div class="mb-3">
          <label class="form-label">Nome da pasta</label>
          <input
            class="form-control"
            value=${nomeNovaPasta}
            onInput=${(event) => setNomeNovaPasta(event.target.value)}
          />
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setModalCriarPastaAberto(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${salvando}
            onClick=${confirmarCriarPasta}
          >
            Criar pasta
          </button>
        </div>
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!itemRenomear}
        titulo="Renomear"
        subtitulo=${itemRenomear ? `Renomeando "${itemRenomear.nome}"` : ''}
        onClose=${() => setItemRenomear(null)}
      >
        <div class="mb-3">
          <label class="form-label">Novo nome</label>
          <input
            class="form-control"
            value=${novoNome}
            onInput=${(event) => setNovoNome(event.target.value)}
          />
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setItemRenomear(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${salvando}
            onClick=${confirmarRenomear}
          >
            Salvar
          </button>
        </div>
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!itemVisualizado}
        titulo=${itemVisualizado?.nome || ''}
        subtitulo="Visualização do arquivo"
        onClose=${fecharVisualizacao}
        className="rh-modal-dialog--wide"
      >
        ${carregandoConteudo
      ? html`
              <${LoadingState}
                titulo="Carregando arquivo"
                descricao="Buscando o conteúdo do arquivo."
              />
            `
      : html`<${VisualizadorArquivo} conteudo=${conteudoVisualizado} onBaixar=${() => itemVisualizado && baixarItem(itemVisualizado)} />`}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}

function MenuAcoesItem({
  item,
  aberto,
  podeGerenciar,
  onAlternar,
  onAbrir,
  onBaixar,
  onRenomear,
  onExcluir,
}) {
  return html`
    <div class="rh-documentos-menu">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        title="Ações"
        onClick=${onAlternar}
      >
        <span class="material-symbols-outlined">more_vert</span>
      </button>
      ${aberto
      ? html`
            <div class="rh-documentos-menu-lista">
              ${item.tipo === 'arquivo' && item.pode_visualizar
        ? html`
                    <button type="button" class="dropdown-item" onClick=${onAbrir}>
                      Visualizar arquivo
                    </button>
                  `
        : null}
              ${item.tipo === 'pasta'
        ? html`
                    <button type="button" class="dropdown-item" onClick=${onAbrir}>
                      Abrir pasta
                    </button>
                  `
        : null}
              ${item.tipo === 'arquivo'
        ? html`
                    <button type="button" class="dropdown-item" onClick=${onBaixar}>
                      Baixar
                    </button>
                  `
        : null}
              ${podeGerenciar
        ? html`
                    <button type="button" class="dropdown-item" onClick=${onRenomear}>
                      Renomear
                    </button>
                    <button type="button" class="dropdown-item text-danger" onClick=${onExcluir}>
                      Excluir
                    </button>
                  `
        : null}
            </div>
          `
      : null}
    </div>
  `;
}

function VisualizadorArquivo({ conteudo, onBaixar }) {
  if (!conteudo) return null;

  if (conteudo.modo_visualizacao === 'texto') {
    return html`<pre class="rh-documentos-preview-texto">${conteudo.conteudo}</pre>`;
  }

  if (conteudo.modo_visualizacao === 'pdf') {
    const src = `data:application/pdf;base64,${conteudo.conteudo_base64}`;
    return html`
      <iframe
        title="Visualização de PDF"
        src=${src}
        class="rh-documentos-preview-pdf"
      ></iframe>
    `;
  }

  return html`
    <div class="text-center py-4">
      <p class="mb-3">${conteudo.mensagem || 'Visualização não disponível para este tipo de arquivo.'}</p>
      <button type="button" class="btn btn-primary" onClick=${onBaixar}>
        Abrir para baixar
      </button>
    </div>
  `;
}
