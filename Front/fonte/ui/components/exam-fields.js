import {
  html,
  useEffect,
  useRef,
  useState,
} from '../../infraestrutura-react.js';
import {
  baixarModeloExcel,
  obterCapacidadesDaTarefa,
  validarArquivoExcel,
} from '../../regras-prova.js';

export function EditorTextoRich({ valor, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    const editor = editorRef.current;
    const proximoValor = valor || '';

    if (editor && editor.innerHTML !== proximoValor) {
      editor.innerHTML = proximoValor;
    }
  }, [valor]);

  const executarComando = (comando) => {
    document.execCommand(comando, false, null);
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      onChange(editor.innerHTML || '');
    }
  };

  const acoes = [
    ['bold', html`<strong>B</strong>`],
    ['italic', html`<em>I</em>`],
    ['underline', html`<u>U</u>`],
    ['justifyLeft', 'Esq'],
    ['justifyCenter', 'Centro'],
    ['insertUnorderedList', 'Lista'],
  ];

  return html`
    <div class="rh-editor-card">
      <div class="toolbar rh-editor-toolbar">
        ${acoes.map(
          ([comando, rotulo]) => html`
            <button
              key=${comando}
              type="button"
              class="btn btn-outline-secondary"
              onClick=${() => executarComando(comando)}
            >
              ${rotulo}
            </button>
          `,
        )}
      </div>
      <div
        ref=${editorRef}
        class="word-editor"
        contenteditable=${true}
        suppressContentEditableWarning=${true}
        spellcheck=${false}
        onInput=${(event) => onChange(event.currentTarget.innerHTML || '')}
      ></div>
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
          'Nao foi possivel localizar o arquivo-base da prova de Excel.',
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
        statusText: 'Nao foi possivel ler o arquivo enviado.',
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
              <li>Envie o arquivo respondido para validacao.</li>
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
