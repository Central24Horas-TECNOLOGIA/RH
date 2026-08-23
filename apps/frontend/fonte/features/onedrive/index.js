import { html, useEffect, useRef, useState } from '../../infraestrutura-react.js';
import {
  baixarArquivoOneDrive,
  criarPastaOneDrive,
  enviarArquivoOneDrive,
  excluirItemOneDrive,
  listarArquivosOneDrive,
} from '../../servico-api.js';
import { baixarBlob } from '../../utilitarios.js';
import {
  EmptyState,
  LoadingState,
  ModalConfirmacaoAcao,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
  Table,
  ToastAlert,
} from '../../ui/componentes-compartilhados.js';
import { ModalComporEmail } from '../../shared/components/compose-email-modal.js';

function Icone({ name, className = '' }) {
  return html`<span class=${`material-symbols-outlined ${className}`.trim()} aria-hidden="true">${name}</span>`;
}

function formatarTamanho(bytes) {
  const valor = Number(bytes || 0);
  if (!valor) return '-';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  let indice = 0;
  let restante = valor;
  while (restante >= 1024 && indice < unidades.length - 1) {
    restante /= 1024;
    indice += 1;
  }
  return `${restante.toFixed(restante >= 10 || indice === 0 ? 0 : 1)} ${unidades[indice]}`;
}

function formatarData(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
}

export function TelaOneDriveArquivos({ controlador }) {
  const [caminho, setCaminho] = useState('');
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [modalNovaPastaAberto, setModalNovaPastaAberto] = useState(false);
  const [nomeNovaPasta, setNomeNovaPasta] = useState('');
  const [salvandoPasta, setSalvandoPasta] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [itemParaEnviarEmail, setItemParaEnviarEmail] = useState(null);
  const inputArquivoRef = useRef(null);

  const podeVisualizar = controlador?.possuiPermissao?.('onedrive.visualizar');
  const podeEnviar = controlador?.possuiPermissao?.('onedrive.upload');
  const podeExcluir = controlador?.possuiPermissao?.('onedrive.excluir');
  const podeComporEmail =
    controlador?.possuiPermissao?.('emails.enviar_modelo') ||
    controlador?.possuiPermissao?.('emails.enviar_livre');

  const carregarItens = async (caminhoAtual) => {
    setCarregando(true);
    setErro('');
    try {
      const resposta = await listarArquivosOneDrive(caminhoAtual);
      setItens(resposta?.items || []);
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar os arquivos do repositório M365.');
      setItens([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!podeVisualizar) return;
    carregarItens(caminho);
  }, [caminho, podeVisualizar]);

  if (!podeVisualizar) {
    return html`
      <${PainelRh} screenId="screen-onedrive-files" navAtiva="screen-onedrive-files" controlador=${controlador}>
        <${EmptyState}
          titulo="Sem acesso"
          descricao="Você não possui permissão para visualizar o repositório de arquivos M365."
        />
      </${PainelRh}>
    `;
  }

  const segmentosBreadcrumb = caminho ? caminho.split('/').filter(Boolean) : [];

  const abrirPasta = (nomePasta) => {
    const novoCaminho = [caminho, nomePasta].filter(Boolean).join('/');
    setCaminho(novoCaminho);
  };

  const irParaSegmento = (indice) => {
    setCaminho(segmentosBreadcrumb.slice(0, indice + 1).join('/'));
  };

  const criarPasta = async (event) => {
    event.preventDefault();
    if (!nomeNovaPasta.trim()) return;
    setSalvandoPasta(true);
    try {
      await criarPastaOneDrive(caminho, nomeNovaPasta.trim());
      setModalNovaPastaAberto(false);
      setNomeNovaPasta('');
      setMensagem('Pasta criada com sucesso.');
      await carregarItens(caminho);
    } catch (error) {
      setErro(error?.message || 'Não foi possível criar a pasta.');
    } finally {
      setSalvandoPasta(false);
    }
  };

  const enviarArquivoSelecionado = async (event) => {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    setEnviandoArquivo(true);
    setErro('');
    try {
      await enviarArquivoOneDrive(caminho, arquivo);
      setMensagem(`Arquivo "${arquivo.name}" enviado com sucesso.`);
      await carregarItens(caminho);
    } catch (error) {
      setErro(error?.message || 'Não foi possível enviar o arquivo.');
    } finally {
      setEnviandoArquivo(false);
    }
  };

  const baixarItem = async (item) => {
    const caminhoItem = [caminho, item.nome].filter(Boolean).join('/');
    try {
      const { blob, filename } = await baixarArquivoOneDrive(caminhoItem);
      baixarBlob(filename || item.nome, blob);
    } catch (error) {
      setErro(error?.message || 'Não foi possível baixar o arquivo.');
    }
  };

  const confirmarExclusao = async ({ justificativa }) => {
    if (!itemParaExcluir) return;
    const caminhoItem = [caminho, itemParaExcluir.nome].filter(Boolean).join('/');
    setExcluindo(true);
    try {
      await excluirItemOneDrive(caminhoItem, justificativa);
      setMensagem(`"${itemParaExcluir.nome}" excluído com sucesso.`);
      setItemParaExcluir(null);
      await carregarItens(caminho);
    } catch (error) {
      setErro(error?.message || 'Não foi possível excluir o item.');
    } finally {
      setExcluindo(false);
    }
  };

  const colunas = [
    { key: 'nome', label: 'Nome' },
    { key: 'tamanho_bytes', label: 'Tamanho' },
    { key: 'modificado_em', label: 'Modificado em' },
    { key: 'modificado_por', label: 'Modificado por' },
    { key: 'acoes', label: 'Ações' },
  ];

  const renderCell = (item, coluna) => {
    if (coluna.key === 'nome') {
      return item.tipo === 'pasta'
        ? html`
            <button type="button" class="btn btn-link p-0 text-decoration-none" onClick=${() => abrirPasta(item.nome)}>
              <${Icone} name="folder" /> ${item.nome}
            </button>
          `
        : html`<span><${Icone} name="description" /> ${item.nome}</span>`;
    }
    if (coluna.key === 'tamanho_bytes') {
      return item.tipo === 'pasta' ? '-' : formatarTamanho(item.tamanho_bytes);
    }
    if (coluna.key === 'modificado_em') {
      return formatarData(item.modificado_em);
    }
    if (coluna.key === 'modificado_por') {
      return item.modificado_por || '-';
    }
    if (coluna.key === 'acoes') {
      return html`
        <div class="d-flex gap-2">
          ${item.tipo !== 'pasta'
            ? html`
                <button type="button" class="btn btn-outline-secondary btn-sm" title="Baixar" onClick=${() => baixarItem(item)}>
                  <${Icone} name="download" />
                </button>
              `
            : null}
          ${item.tipo !== 'pasta' && podeComporEmail
            ? html`
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  title="Enviar por e-mail"
                  onClick=${() => setItemParaEnviarEmail(item)}
                >
                  <${Icone} name="forward_to_inbox" />
                </button>
              `
            : null}
          ${podeExcluir
            ? html`
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  title="Excluir"
                  onClick=${() => setItemParaExcluir(item)}
                >
                  <${Icone} name="delete" />
                </button>
              `
            : null}
        </div>
      `;
    }
    return null;
  };

  return html`
    <${PainelRh}
      screenId="screen-onedrive-files"
      navAtiva="screen-onedrive-files"
      controlador=${controlador}
      subtituloMarca="Plataforma de Recrutamento e Seleção"
    >
      <${PageIntro}
        kicker="Microsoft 365"
        title="OneDrive"
        description="Repositório de documentos do RH, hospedado no SharePoint/OneDrive corporativo. Nada fica armazenado localmente no Conecta."
        actions=${html`
          <div class="d-flex gap-2">
            ${podeEnviar
              ? html`
                  <button type="button" class="btn btn-outline-secondary" onClick=${() => setModalNovaPastaAberto(true)}>
                    <${Icone} name="create_new_folder" /> Nova pasta
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    disabled=${enviandoArquivo}
                    onClick=${() => inputArquivoRef.current?.click()}
                  >
                    <${Icone} name="upload" /> ${enviandoArquivo ? 'Enviando...' : 'Enviar arquivo'}
                  </button>
                  <input
                    ref=${inputArquivoRef}
                    type="file"
                    class="d-none"
                    onChange=${enviarArquivoSelecionado}
                  />
                `
              : null}
          </div>
        `}
      />

      ${mensagem ? html`<${ToastAlert} message=${mensagem} tone="success" onClose=${() => setMensagem('')} />` : null}
      ${erro ? html`<${ToastAlert} message=${erro} tone="danger" onClose=${() => setErro('')} />` : null}

      <${SectionCard}>
        <nav class="rh-breadcrumb mb-3">
          <button type="button" class="btn btn-link p-0 text-decoration-none" onClick=${() => setCaminho('')}>
            <${Icone} name="home" /> Repositório do RH
          </button>
          ${segmentosBreadcrumb.map(
            (segmento, indice) => html`
              <span key=${indice}> / </span>
              <button type="button" class="btn btn-link p-0 text-decoration-none" onClick=${() => irParaSegmento(indice)}>
                ${segmento}
              </button>
            `,
          )}
        </nav>

        ${carregando
          ? html`<${LoadingState} titulo="Carregando arquivos" descricao="Consultando o Microsoft Graph." />`
          : itens.length
            ? html`<${Table} columns=${colunas} rows=${itens} rowKey="id" renderCell=${renderCell} />`
            : html`<${EmptyState} titulo="Pasta vazia" descricao="Nenhum arquivo ou pasta encontrado neste local." />`}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${modalNovaPastaAberto}
        titulo="Nova pasta"
        onClose=${() => setModalNovaPastaAberto(false)}
      >
        <form onSubmit=${criarPasta} class="d-flex flex-column gap-3">
          <label class="form-field">
            <span class="form-label">Nome da pasta</span>
            <input
              class="form-control"
              required
              value=${nomeNovaPasta}
              onInput=${(event) => setNomeNovaPasta(event.target.value)}
            />
          </label>
          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-outline-secondary" onClick=${() => setModalNovaPastaAberto(false)}>
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary" disabled=${salvandoPasta}>
              ${salvandoPasta ? 'Criando...' : 'Criar pasta'}
            </button>
          </div>
        </form>
      </${ModalPadrao}>

      <${ModalConfirmacaoAcao}
        aberto=${Boolean(itemParaExcluir)}
        titulo=${`Excluir "${itemParaExcluir?.nome || ''}"`}
        descricao="Esta ação remove o item diretamente do SharePoint/OneDrive corporativo."
        consequencia=${itemParaExcluir?.tipo === 'pasta' ? 'Todo o conteúdo desta pasta também será excluído.' : ''}
        reversibilidade="Esta ação pode ser revertida pela Lixeira do SharePoint por tempo limitado, fora do Conecta."
        textoConfirmar="Excluir"
        tipo="perigo"
        carregando=${excluindo}
        onClose=${() => setItemParaExcluir(null)}
        onConfirm=${confirmarExclusao}
      />

      ${podeComporEmail
        ? html`
            <${ModalComporEmail}
              aberto=${Boolean(itemParaEnviarEmail)}
              controlador=${controlador}
              anexosIniciais=${itemParaEnviarEmail
                ? [{ caminho: [caminho, itemParaEnviarEmail.nome].filter(Boolean).join('/'), nome: itemParaEnviarEmail.nome }]
                : []}
              onClose=${() => setItemParaEnviarEmail(null)}
            />
          `
        : null}
    </${PainelRh}>
  `;
}
