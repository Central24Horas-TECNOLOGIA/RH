import {
  html,
  useEffect,
  useRef,
  useState,
} from '../../infraestrutura-react.js';
import {
  baixarModeloExcel,
  formatarDocumentoRichText,
  obterCapacidadesDaTarefa,
  validarArquivoExcel,
} from '../../regras-prova.js';

function escaparHtml(valor) {
  return String(valor || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function normalizarConteudoRichText(valor) {
  const conteudo = String(valor || '');
  if (!conteudo.trim()) return '';

  if (/<\/?[a-z][\s\S]*>/i.test(conteudo)) {
    return conteudo;
  }

  return escaparHtml(conteudo).replace(/\n/g, '<br>');
}

function limparHtmlVazio(valor) {
  const conteudo = String(valor || '').trim();
  if (
    !conteudo ||
    /^((<div><br><\/div>)|(<br\s*\/?>)|(&nbsp;)|\s)+$/i.test(conteudo)
  ) {
    return '';
  }
  return conteudo;
}

export function EditorTextoRich({ valor, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;
    const valorSeguro = normalizarConteudoRichText(valor);
    if (editorRef.current.innerHTML !== valorSeguro) {
      editorRef.current.innerHTML = valorSeguro;
    }
  }, [valor]);

  const aplicarComando = (comando) => (event) => {
    event.preventDefault();
    if (!editorRef.current) return;
    editorRef.current.focus();
    formatarDocumentoRichText(comando);
    onChange(limparHtmlVazio(editorRef.current.innerHTML));
  };

  const sincronizarConteudo = () => {
    if (!editorRef.current) return;
    onChange(limparHtmlVazio(editorRef.current.innerHTML));
  };

  return html`
    <div class="rh-editor-card">
      <label class="form-label fw-semibold" for="word-answer-textarea">
        Digite sua resposta
      </label>
      <div class="rh-editor-toolbar">
        <button
          type="button"
          class="rh-editor-toolbar-btn"
          title="Negrito"
          aria-label="Aplicar negrito"
          onMouseDown=${aplicarComando('bold')}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          class="rh-editor-toolbar-btn"
          title="Italico"
          aria-label="Aplicar italico"
          onMouseDown=${aplicarComando('italic')}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          class="rh-editor-toolbar-btn"
          title="Alinhar a esquerda"
          aria-label="Alinhar a esquerda"
          onMouseDown=${aplicarComando('justifyLeft')}
        >
          <span class="material-symbols-outlined">format_align_left</span>
        </button>
        <button
          type="button"
          class="rh-editor-toolbar-btn"
          title="Centralizar"
          aria-label="Centralizar"
          onMouseDown=${aplicarComando('justifyCenter')}
        >
          <span class="material-symbols-outlined">format_align_center</span>
        </button>
        <button
          type="button"
          class="rh-editor-toolbar-btn"
          title="Alinhar a direita"
          aria-label="Alinhar a direita"
          onMouseDown=${aplicarComando('justifyRight')}
        >
          <span class="material-symbols-outlined">format_align_right</span>
        </button>
        <button
          type="button"
          class="rh-editor-toolbar-btn"
          title="Lista com marcadores"
          aria-label="Lista com marcadores"
          onMouseDown=${aplicarComando('insertUnorderedList')}
        >
          <span class="material-symbols-outlined">format_list_bulleted</span>
        </button>
        <button
          type="button"
          class="rh-editor-toolbar-btn"
          title="Lista numerada"
          aria-label="Lista numerada"
          onMouseDown=${aplicarComando('insertOrderedList')}
        >
          <span class="material-symbols-outlined">format_list_numbered</span>
        </button>
      </div>
      <div
        ref=${editorRef}
        id="word-answer-textarea"
        class="form-control word-editor"
        contentEditable="true"
        data-placeholder="Escreva sua resposta aqui..."
        spellcheck="true"
        suppressContentEditableWarning=${true}
        onInput=${sincronizarConteudo}
        onBlur=${sincronizarConteudo}
      ></div>
      <div class="form-text mt-2">
        Campo de resposta em texto livre. O sistema considera o conteúdo digitado para a avaliação.
      </div>
    </div>
  `;
}

export function PerguntaMultipla({ questao, resposta, onChange }) {
  const selecionado = resposta?.selected;

  return html`
    <div class="rh-option-list">
      ${questao.options.map(
        (opcao, indice) => html`
          <label
            key=${`${questao.title}-${indice}`}
            class=${`rh-option-card ${selecionado === indice ? 'is-selected' : ''}`}
          >
            <input
              class="form-check-input"
              type="radio"
              name="mcq"
              checked=${selecionado === indice}
              onChange=${() => onChange(indice)}
            />
            <span class="exam-option-letter"
              >${String.fromCharCode(65 + indice)}</span
            >
            <span class="exam-option-text">${opcao}</span>
          </label>
        `,
      )}
    </div>
  `;
}

export function PerguntaExcel({ questao, resposta, nomeCandidato, onChange }) {
  const inputRef = useRef(null);
  const [processando, setProcessando] = useState(false);

  const baixarArquivoBase = async () => {
    try {
      await baixarModeloExcel(questao.taskId, nomeCandidato || 'candidato');
    } catch (error) {
      window.alert(
        error?.message ||
          'Não foi possível localizar o arquivo-base da prova de Excel.',
      );
    }
  };

  const processarUpload = async (event) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setProcessando(true);

    try {
      const respostaValidada = await validarArquivoExcel(
        questao.taskId,
        arquivo,
        questao.points,
      );
      onChange(respostaValidada);
    } catch (error) {
      onChange({
        type: 'excel_external',
        uploaded: false,
        validation: null,
        statusText: 'Não foi possível ler o arquivo enviado.',
        statusClass: 'excel-status-error',
      });
    } finally {
      setProcessando(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return html`
    <div class="excel-card">
      <div class="row g-4">
        <div class="col-lg-7">
          <div class="excel-step">
            <h4>Como funciona esta etapa</h4>
            <ol class="mb-0">
              <li>Baixe a planilha da etapa.</li>
              <li>Execute a atividade no Excel ou LibreOffice Calc.</li>
              <li>Salve o arquivo corretamente.</li>
              <li>Envie o arquivo respondido para validação.</li>
            </ol>
          </div>

          <div class="excel-step">
            <h4>O que sera avaliado</h4>
            <ul class="muted-list">
              ${obterCapacidadesDaTarefa(questao.taskId).map(
                (item, indice) => html`<li key=${indice}>${item}</li>`,
              )}
            </ul>
          </div>

          <button
            type="button"
            class="btn btn-success"
            onClick=${baixarArquivoBase}
          >
            Baixar arquivo .xlsx
          </button>
        </div>

        <div class="col-lg-5">
          <div class="excel-upload-box">
            <label class="form-label fw-semibold"
              >Enviar arquivo respondido</label
            >
            <input
              ref=${inputRef}
              class="upload-hidden-input"
              type="file"
              accept=".xlsx,.xlsm"
              onChange=${processarUpload}
            />
            <div class="d-grid gap-2">
              <button
                type="button"
                class="btn btn-outline-secondary"
                disabled=${processando}
                onClick=${() => inputRef.current?.click()}
              >
                ${processando ? 'Processando arquivo...' : 'Selecionar arquivo'}
              </button>
            </div>
            <span class="upload-file-name">
              ${resposta?.filename
                ? `Arquivo selecionado: ${resposta.filename}`
                : 'Nenhum arquivo selecionado.'}
            </span>
            <div class=${`${resposta?.statusClass || 'text-muted'} mt-2`}>
              ${resposta?.statusText || 'Nenhum arquivo enviado ainda.'}
            </div>
            ${resposta?.validation?.completedTasks?.length
              ? html`
                  <div class="small text-muted mt-3">
                    ${resposta.validation.completedTasks.map(
                      (item, indice) => html`<div key=${indice}>${item}</div>`,
                    )}
                  </div>
                `
              : null}
            <div class="small text-muted mt-2">
              Formatos aceitos: .xlsx e .xlsm
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
