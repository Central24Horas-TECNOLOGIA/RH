import { html, useState } from '../../infraestrutura-react.js';
import { copiarTexto } from '../browser-utils.js';
import { ModalPadrao } from '../../ui/componentes-compartilhados.js';
import { quebrarListaTexto } from '../../shared/validacoes.js';

export const REQUISITOS_PUBLICOS_PADRAO = [
  'Ensino médio completo ou formação compatível com a vaga.',
  'Experiência anterior em atividades relacionadas será considerada um diferencial.',
  'Boa comunicação verbal e escrita.',
  'Organização, responsabilidade e postura profissional.',
  'Facilidade para aprender sistemas, processos internos e rotinas operacionais.',
  'Disponibilidade para cumprir a jornada e os horários definidos pelo RH.',
];

export const RESPONSABILIDADES_PUBLICAS_PADRAO = [
  'Executar as atividades da função conforme orientação da liderança.',
  'Atender demandas internas e externas com cordialidade, clareza e agilidade.',
  'Registrar informações de forma correta nos sistemas e controles definidos.',
  'Cumprir procedimentos, prazos, políticas internas e orientações do processo.',
  'Apoiar a equipe na manutenção da qualidade e continuidade das operações.',
];

function temValorProcesso(valor) {
  if (Array.isArray(valor)) return valor.some(temValorProcesso);
  return String(valor ?? '').trim() !== '';
}

function formatarDataCurtaCompartilhamento(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    const texto = String(valor);
    return texto.includes('-') ? texto.slice(0, 10).split('-').reverse().join('/') : texto || '-';
  }
  return data.toLocaleDateString('pt-BR');
}

function obterItensTextoProcesso(valor) {
  if (Array.isArray(valor)) {
    return valor
      .filter((item) => !(typeof item === 'object' && item !== null && item.visivel === false))
      .map((item) => (typeof item === 'object' && item !== null ? item.texto : item))
      .filter(temValorProcesso)
      .map((item) => String(item).trim());
  }
  return quebrarListaTexto(valor);
}

export function montarItensPublicosPadrao(textos) {
  return textos.map((texto) => ({ texto, visivel: true }));
}

export function montarTextoCompartilhamentoVaga({ processo = {}, requisitos = [], responsabilidades = [] } = {}) {
  const linhas = [];
  const tituloVaga = String(processo?.vaga || processo?.cargo || 'Processo seletivo')
    .trim()
    .toUpperCase();
  linhas.push(`*PROCESSO SELETIVO - ${tituloVaga}*`);
  linhas.push('Não perca a oportunidade de fazer parte do nosso time 🚀');

  const requisitosTexto = obterItensTextoProcesso(requisitos)
    .filter((item) => item && item !== '-')
    .slice(0, 8);
  const responsabilidadesTexto = obterItensTextoProcesso(responsabilidades)
    .filter((item) => item && item !== '-')
    .slice(0, 8);
  if (requisitosTexto.length) {
    linhas.push('', 'Requisitos:');
    requisitosTexto.forEach((item) => linhas.push(`✅ ${item}`));
  }
  if (responsabilidadesTexto.length) {
    linhas.push('', 'Responsabilidades:');
    responsabilidadesTexto.forEach((item) => linhas.push(`- ${item}`));
  }
  const dataInscricao = formatarDataCurtaCompartilhamento(
    processo?.data_limite_inscricao || processo?.data_encerramento || processo?.data_fim,
  );
  linhas.push('', 'Inscreva-se em nosso site: https://central24horas.com.br/trabalhe-conosco');
  if (temValorProcesso(dataInscricao) && dataInscricao !== '-') {
    linhas.push('', `*Inscrições até: ${dataInscricao}*`);
  }

  return linhas.join('\n');
}

export function ModalCompartilharVaga({
  aberto = false,
  processo = {},
  texto = '',
  requisitos = [],
  responsabilidades = [],
  onClose,
  onCopied,
}) {
  const [feedback, setFeedback] = useState('');
  const requisitosVisiveis = obterItensTextoProcesso(requisitos).filter((item) => item && item !== '-');
  const responsabilidadesVisiveis = obterItensTextoProcesso(responsabilidades).filter((item) => item && item !== '-');
  const textoFinal = texto || montarTextoCompartilhamentoVaga({
    processo,
    requisitos: requisitosVisiveis,
    responsabilidades: responsabilidadesVisiveis,
  });

  const copiar = async () => {
    try {
      await copiarTexto(textoFinal);
      setFeedback('Texto da vaga copiado para a área de transferência.');
      onCopied?.();
    } catch (error) {
      setFeedback('Não foi possível copiar agora. Selecione o texto e copie manualmente.');
    }
  };

  return html`
    <${ModalPadrao}
      aberto=${aberto}
      titulo="Compartilhar vaga"
      subtitulo=${processo?.vaga || 'Processo seletivo'}
      onClose=${onClose}
    >
      <div class="rh-details-body process-share-modal">
        <p>Revise o texto antes de enviar aos candidatos.</p>
        <div class="process-share-lists">
          ${requisitosVisiveis.length
            ? html`
                <section class="process-share-list-card">
                  <h3><span class="material-symbols-outlined">verified</span>Requisitos da vaga</h3>
                  <ul>
                    ${requisitosVisiveis.map((item, indice) => html`
                      <li key=${`req-${indice}`}>
                        <span class="material-symbols-outlined">check_circle</span>
                        ${item}
                      </li>
                    `)}
                  </ul>
                </section>
              `
            : null}
          ${responsabilidadesVisiveis.length
            ? html`
                <section class="process-share-list-card">
                  <h3><span class="material-symbols-outlined">assignment_turned_in</span>Responsabilidades</h3>
                  <ul>
                    ${responsabilidadesVisiveis.map((item, indice) => html`
                      <li key=${`resp-${indice}`}>
                        <span class="material-symbols-outlined">arrow_right_alt</span>
                        ${item}
                      </li>
                    `)}
                  </ul>
                </section>
              `
            : null}
        </div>
        <textarea
          class="form-control"
          rows="12"
          readOnly
          value=${textoFinal}
          onFocus=${(event) => event.currentTarget.select()}
        ></textarea>
        ${feedback ? html`<div class="alert alert-success">${feedback}</div>` : null}
      </div>
      <footer class="rh-modal-footer">
        <button type="button" class="btn btn-outline-secondary" onClick=${onClose}>
          Fechar
        </button>
        <button type="button" class="btn btn-primary" onClick=${copiar}>
          <span class="material-symbols-outlined">content_copy</span>Copiar texto da vaga
        </button>
      </footer>
    </${ModalPadrao}>
  `;
}
