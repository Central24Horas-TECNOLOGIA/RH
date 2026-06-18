import { html, useEffect, useMemo, useState } from '../../infraestrutura-react.js';
import {
  acessarProvaPorCodigo,
  acessarProvaPorEmail,
  acessarProvaPorTelefone,
  confirmarDadosConectaProvas,
  finalizarConectaProvas,
  iniciarConectaProvas,
  lerSessaoConectaProvas,
  marcarRevisaoConectaProvas,
  salvarRespostasConectaProvas,
} from '../../servico-api.js';
import { formatarTempoRestante } from '../../shared/helpers-visuais.js';
import {
  EditorTextoRich,
  PerguntaExcel,
  PerguntaMultipla,
} from '../../ui/componentes-compartilhados.js';

const CHAVE_TOKEN_PUBLICO = 'conecta_provas_token';
const CHAVE_TIMER_PUBLICO = 'conecta_provas_timer';
const ERRO_GENERICO =
  'Não encontramos uma prova disponível com os dados informados. Verifique as informações ou tente outro mÃ©todo de acesso.';
const ERRO_GENERICO_TELEFONE =
  'Não encontramos uma prova disponível com os dados informados. Verifique as informações ou solicite apoio ao RH.';
const LIMITE_LINHAS_REDACAO = 20;
const LIMITE_CARACTERES_REDACAO = 2200;
const ORIENTACAO_REDACAO =
  `Seu texto deve ter introdução, desenvolvimento e conclusão. Escreva uma redação de até ${LIMITE_LINHAS_REDACAO} linhas.`;
const CRITERIOS_REDACAO = [
  'Clareza',
  'Coerência',
  'Coesão',
  'Ortografia',
  'Organização das ideias',
  'Adequação ao tema',
  'Argumentação',
  `Cumprimento do limite de até ${LIMITE_LINHAS_REDACAO} linhas`,
];
const FRASES_PROMPT_INTERNO_BLOQUEADAS = [
  'Imagine uma situação',
  'Use linguagem humanizada',
  'A resposta deve mostrar',
  'Avalie organização',
  'sem cobrar experiência prévia',
  'Use atendimento, rotina operacional',
  'O cenário pode usar como referência',
  'A personalização deve',
  'Considere o cliente',
  'Considere a operação',
  'com foco em empatia',
  'capacidade de aprender',
  'use linguagem simples e situações de primeiro emprego',
  'Use como eixo da questão',
  'Use tom',
  'A demanda deve considerar conhecimentos',
];

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function textoSemAcentos(valor) {
  return normalizarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function textoContaminadoPorPromptInterno(texto) {
  const base = textoSemAcentos(texto);
  if (!base) return false;
  return FRASES_PROMPT_INTERNO_BLOQUEADAS.some((frase) =>
    base.includes(textoSemAcentos(frase)),
  );
}

function limparTextoVisivelCandidato(texto) {
  const limpo = normalizarTexto(texto)
    .replace(/^\s*Texto-(base|motivador)\s*\d+\s*:\s*/i, '')
    .replace(/^\s*Texto\s+motivador\s*\d+\s*:\s*/i, '')
    .replace(/^\s*Contexto\s*:\s*/i, '')
    .replace(/\b(central de agendamento)\s+\1\b/gi, '$1')
    .replace(/\s+([,.?!;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  if (!limpo || textoContaminadoPorPromptInterno(limpo)) return '';
  return limpo;
}

function normalizarCriteriosRedacao(criterios = []) {
  const visiveis = Array.isArray(criterios)
    ? criterios
      .map((criterio) => normalizarTexto(criterio))
      .filter(Boolean)
      .filter((criterio) => !/400\s+caracteres/i.test(criterio))
    : [];
  return Array.from(new Set([...visiveis, ...CRITERIOS_REDACAO])).filter(
    (criterio) => !/caracteres/i.test(criterio),
  );
}

function validarEmail(valor) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizarTexto(valor));
}

function normalizarTelefone(valor) {
  return normalizarTexto(valor).replace(/\D/g, '');
}

function validarTelefone(valor) {
  const digitos = normalizarTelefone(valor);
  return digitos.length >= 10 && digitos.length <= 13;
}

function validarCodigo(valor) {
  return /^[A-Z]{2}\d{2}$/.test(normalizarTexto(valor).toUpperCase().replace(/\s+/g, ''));
}

function removerHtml(valor) {
  return String(valor || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escaparHtml(valor) {
  return String(valor || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function obterTextoResposta(resposta = {}) {
  return normalizarTexto(resposta.content || resposta.text || '');
}

function obterLimiteCaracteresRedacao(questao = {}) {
  if (!etapaEhRedacao(questao)) return 0;
  const configurado = Number(
    questao.essay?.maxCharacters ||
    questao.expected?.maxCharacters ||
    LIMITE_CARACTERES_REDACAO,
  );
  if (Number.isFinite(configurado) && configurado >= 1800) return configurado;
  return LIMITE_CARACTERES_REDACAO;
}

function limitarConteudoTexto(content, limiteCaracteres = 0) {
  const limite = Number(limiteCaracteres || 0);
  const texto = removerHtml(content);
  if (!limite || texto.length <= limite) {
    return {
      content,
      text: texto,
    };
  }
  const text = texto.slice(0, limite);
  return {
    content: escaparHtml(text).replace(/\n/g, '<br>'),
    text,
  };
}

function respostaPreenchida(resposta) {
  if (resposta === null || resposta === undefined || resposta === '') return false;
  if (typeof resposta === 'number') return true;
  if (typeof resposta === 'string') return resposta.trim().length > 0;
  if (typeof resposta === 'object') {
    return Object.values(resposta).some((valor) => {
      if (Array.isArray(valor)) return valor.length > 0;
      return valor !== null && valor !== undefined && String(valor).trim() !== '';
    });
  }
  return true;
}

function questaoObrigatoria(questao) {
  return questao?.required !== false;
}

function respostaQuestaoPreenchida(questao, resposta) {
  if (!questaoObrigatoria(questao)) return true;
  if (questao?.type === 'multiple') {
    return resposta?.selected !== null && resposta?.selected !== undefined;
  }
  if (questao?.type === 'excel_external') {
    return Boolean(
      resposta?.uploaded &&
      resposta?.filename &&
      (resposta?.validation || resposta?.contentBase64),
    );
  }
  if (questao?.type === 'word') {
    return removerHtml(obterTextoResposta(resposta)).length > 0;
  }
  return respostaPreenchida(resposta);
}

function obterPendenciasObrigatorias(questoes = [], respostas = []) {
  return questoes
    .map((questao, indice) => ({
      indice,
      questao,
      pendente: !respostaQuestaoPreenchida(questao, respostas[indice]),
    }))
    .filter((item) => item.pendente);
}

function obterLabelEtapa(questao = {}) {
  return questao.stage || questao.stageKey || questao.category || 'Etapa';
}

const ROTULOS_RESUMO_ETAPAS = {
  word_basic: 'WORD',
  word_advanced: 'WORD',
  excel_basic: 'EXCEL',
  excel_mid: 'EXCEL',
  excel_advanced: 'EXCEL',
  general_basic: 'CONHECIMENTOS GERAIS',
  general_advanced: 'CONHECIMENTOS GERAIS',
  general_adv_people: 'CONHECIMENTOS GERAIS',
  tech_ti_basic: 'CONHECIMENTOS TECNICOS',
  tech_rh_basic: 'CONHECIMENTOS TECNICOS',
  tech_adm_basic: 'CONHECIMENTOS TECNICOS',
  tech_commercial_basic: 'CONHECIMENTOS TECNICOS',
  tech_finance_basic: 'CONHECIMENTOS TECNICOS',
  tech_operation_basic: 'CONHECIMENTOS TECNICOS',
  tech_ti_specific: 'CONHECIMENTOS TECNICOS',
  tech_adm_specific: 'CONHECIMENTOS TECNICOS',
  tech_logic: 'CONHECIMENTOS TECNICOS',
  professional_essay: 'REDACAO',
  writing_logic: 'ESCRITA E LOGICA',
  analysis_eval: 'ANALISE',
};

function normalizarChaveEtapa(valor = '') {
  return normalizarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatarLabelResumoEtapa(valor = '') {
  const chave = normalizarChaveEtapa(valor);
  if (ROTULOS_RESUMO_ETAPAS[chave]) return ROTULOS_RESUMO_ETAPAS[chave];
  if (chave.includes('word')) return 'WORD';
  if (chave.includes('excel')) return 'EXCEL';
  if (chave.includes('general') || chave.includes('conhecimentos_gerais')) {
    return 'CONHECIMENTOS GERAIS';
  }
  if (chave.includes('tech') || chave.includes('tecnico')) {
    return 'CONHECIMENTOS TECNICOS';
  }
  if (chave.includes('essay') || chave.includes('redacao')) return 'REDACAO';
  return normalizarTexto(valor).replace(/_/g, ' ').toUpperCase() || 'ETAPA';
}

function obterTituloQuestao(questao = {}, indice = 0) {
  return etapaEhRedacao(questao) ? 'Redação' : questao.title || `Questão ${indice + 1}`;
}

function obterResumoEtapas(prova = {}) {
  const questoes = Array.isArray(prova.questoes) ? prova.questoes : [];
  const etapasConfiguradas = Array.isArray(prova.etapas) ? prova.etapas : [];
  const mapa = new Map();

  etapasConfiguradas.forEach((etapa) => {
    const chave = normalizarTexto(etapa.key || etapa.stageKey || etapa.label);
    if (!chave) return;
    mapa.set(chave, {
      key: chave,
      label: formatarLabelResumoEtapa(etapa.label || etapa.stage || chave),
      quantidade: Number(etapa.questionCount || etapa.quantidade || 0),
    });
  });

  questoes.forEach((questao) => {
    const chave = normalizarTexto(questao.stageKey || obterLabelEtapa(questao));
    const atual = mapa.get(chave) || {
      key: chave,
      label: formatarLabelResumoEtapa(questao.stageKey || obterLabelEtapa(questao)),
      quantidade: 0,
    };
    atual.quantidade += 1;
    mapa.set(chave, atual);
  });

  return Array.from(mapa.values()).map((etapa) => ({
    ...etapa,
    quantidade: etapa.quantidade || questoes.filter((questao) =>
      normalizarTexto(questao.stageKey || obterLabelEtapa(questao)) === etapa.key
    ).length,
  }));
}

function etapaEhRedacao(questao = {}) {
  return questao.stageKey === 'professional_essay' || Boolean(questao.expected?.essay || questao.essay);
}

function etapaEhWord(questao = {}) {
  return questao.type === 'word' && !etapaEhRedacao(questao);
}

function questaoEhEmailCorporativo(questao = {}) {
  const titulo = textoSemAcentos(questao.title || questao.titulo);
  return titulo.includes('e-mail') || titulo.includes('email');
}

function questaoEhAtendimentoPaciente(questao = {}) {
  const base = textoSemAcentos(
    [
      questao.stage,
      questao.category,
      questao.categoria,
      questao.description,
      questao.enunciadoCandidato,
      questao.instrucaoCandidato,
      questao.personalizacaoInteligente?.operacao,
      questao.personalizacaoInteligente?.cliente,
      questao.personalizacaoInteligente?.nicho_operacao,
      ...(questao.personalizacaoInteligente?.termos_publicos || []),
    ].join(' '),
  );
  return (
    base.includes('davita') ||
    base.includes('paciente') ||
    base.includes('agendamento') ||
    base.includes('consulta')
  );
}

function obterFallbackQuestaoVisivel(questao = {}) {
  if (questaoEhEmailCorporativo(questao) && questaoEhAtendimentoPaciente(questao)) {
    return {
      enunciado:
        'Você trabalha em uma central de agendamento. Um paciente informou que está com dúvida sobre o horário e a unidade da consulta. A equipe precisa registrar a situação com atenção para evitar informações incorretas.',
      instrucao:
        'Escreva um e-mail curto para a equipe explicando o ocorrido e orientando que os dados da consulta sejam conferidos antes do atendimento.',
    };
  }

  const titulo = textoSemAcentos(questao.title || questao.titulo);
  if (titulo.includes('comunicado')) {
    return {
      enunciado:
        'A equipe recebeu uma orientação simples que precisa ser comunicada de forma clara para manter a rotina organizada e evitar dúvidas.',
      instrucao:
        'Escreva um comunicado curto, com título adequado, explicando a orientação principal de maneira objetiva e profissional.',
    };
  }
  if (titulo.includes('lista') || titulo.includes('procedimento')) {
    return {
      enunciado:
        'Antes de iniciar uma atividade de atendimento, a equipe precisa organizar informações, conferir ferramentas e seguir passos básicos.',
      instrucao:
        'Crie uma lista com pelo menos três procedimentos simples que ajudem a preparar a rotina antes do atendimento.',
    };
  }

  if (questao.type === 'multiple') {
    return {
      enunciado:
        'Uma orientação de trabalho chegou com informação incompleta e pode gerar erro se for seguida sem conferência.',
      instrucao: 'Marque a alternativa que melhor demonstra cuidado, responsabilidade e comunicação clara.',
    };
  }

  return {
    enunciado:
      'Durante uma rotina de trabalho, uma pessoa precisa registrar uma informação simples para que a equipe consiga dar continuidade sem dúvida.',
    instrucao: 'Responda explicando o que deve ser comunicado e qual próximo passo precisa ser acompanhado.',
  };
}

function obterCamposQuestaoVisivel(questao = {}) {
  const enunciadoEstruturado = limparTextoVisivelCandidato(
    questao.enunciadoCandidato || questao.enunciado_candidato,
  );
  const instrucaoEstruturada = limparTextoVisivelCandidato(
    questao.instrucaoCandidato || questao.instrucao_candidato,
  );
  const descricaoLimpa = limparTextoVisivelCandidato(questao.description || '');
  const contaminada =
    textoContaminadoPorPromptInterno(questao.description) ||
    textoContaminadoPorPromptInterno(questao.enunciadoCandidato) ||
    textoContaminadoPorPromptInterno(questao.instrucaoCandidato);

  if ((enunciadoEstruturado || instrucaoEstruturada) && !contaminada) {
    return {
      enunciado: enunciadoEstruturado || descricaoLimpa,
      instrucao: instrucaoEstruturada,
    };
  }

  if (descricaoLimpa && !contaminada) {
    return {
      enunciado: descricaoLimpa,
      instrucao: '',
    };
  }

  return obterFallbackQuestaoVisivel(questao);
}

function descreverRespostaRevisao(questao, resposta) {
  if (!respostaQuestaoPreenchida(questao, resposta)) return 'Pendente';
  if (questao.type === 'multiple') {
    const indice = Number(resposta?.selected);
    return questao.options?.[indice] || `Alternativa ${indice + 1}`;
  }
  if (questao.type === 'excel_external') {
    return resposta?.filename || 'Arquivo anexado';
  }
  return removerHtml(obterTextoResposta(resposta)).slice(0, 280) || 'Texto preenchido';
}

function obterRespostaInicial(questao) {
  if (questao?.type === 'multiple') return { type: 'multiple', selected: null };
  if (questao?.type === 'excel_external') {
    return { type: 'excel_external', filename: '', contentBase64: '', validation: null };
  }
  return { type: 'word', content: '', text: '' };
}

function obterTempoTotalSegundos(sessao = {}) {
  const prova = sessao?.prova || {};
  const configuracao = prova.configuracao || {};
  const minutos = [
    prova.tempo_total,
    prova.tempo_minutos,
    configuracao.tempo_total,
    configuracao.tempo_minutos,
    40,
  ]
    .map((valor) => Number(valor || 0))
    .find((valor) => Number.isFinite(valor) && valor > 0);

  return Math.max(60, Math.round((minutos || 40) * 60));
}

function obterChaveTimer(token = '') {
  return `${CHAVE_TIMER_PUBLICO}:${normalizarTexto(token) || 'ativo'}`;
}

function lerTimestampTimer(token = '') {
  try {
    const valor = Number(sessionStorage.getItem(obterChaveTimer(token)) || 0);
    return Number.isFinite(valor) && valor > Date.now() ? valor : null;
  } catch (error) {
    return null;
  }
}

function salvarTimestampTimer(token = '', timestamp = 0) {
  try {
    if (timestamp > Date.now()) {
      sessionStorage.setItem(obterChaveTimer(token), String(timestamp));
    }
  } catch (error) {
    // Sem persistência, o cronômetro ainda funciona em memória.
  }
}

function limparTimestampTimer(token = '') {
  try {
    sessionStorage.removeItem(obterChaveTimer(token));
  } catch (error) {
    // Nada a limpar quando sessionStorage não está disponível.
  }
}

function calcularTimestampTermino(sessao = {}, token = '') {
  const salvo = lerTimestampTimer(token);
  if (salvo) return salvo;

  const totalSegundos = obterTempoTotalSegundos(sessao);
  const inicio = new Date(sessao?.prova?.iniciada_em || '').getTime();
  if (Number.isFinite(inicio) && inicio > 0) {
    const fim = inicio + totalSegundos * 1000;
    if (fim > Date.now()) return fim;
  }

  return Date.now() + totalSegundos * 1000;
}

function TelaAcesso({
  metodo,
  valor,
  erro,
  carregando,
  tentativasEmail,
  tentativasTelefone,
  provas,
  onValor,
  onSubmit,
  onSelecionar,
  onMetodo,
}) {
  const tituloCampo =
    metodo === 'telefone' ? 'Telefone' : metodo === 'codigo' ? 'código da prova' : 'E-mail';
  const textoAjuda =
    metodo === 'telefone'
      ? 'Tente acessar usando o telefone cadastrado pelo RH.'
      : metodo === 'codigo'
        ? 'Se vocÃª Não souber os dados cadastrados, solicite ao RH o código da sua prova.'
        : 'Informe o email cadastrado pelo RH para localizar sua avaliação.';

  return html`
    <section class="conecta-provas-card">
      <div class="conecta-provas-brand">
        <span class="material-symbols-outlined">assignment</span>
        <strong>Conecta Provas</strong>
      </div>
      <h1>Acesse sua prova</h1>
      <p>${textoAjuda}</p>

      <form
        onSubmit=${(event) => {
      event.preventDefault();
      onSubmit();
    }}
      >
        <label class="form-label">${tituloCampo}</label>
        <input
          class="form-control conecta-provas-input"
          value=${valor}
          autocomplete=${metodo === 'email' ? 'email' : 'off'}
          inputmode=${metodo === 'telefone' ? 'tel' : 'text'}
          maxlength=${metodo === 'codigo' ? 4 : null}
          onInput=${(event) => onValor(event.target.value)}
        />
        ${erro ? html`<div class="alert alert-warning mt-3">${erro}</div>` : null}
        <button type="submit" class="btn btn-primary conecta-provas-primary" disabled=${carregando}>
          ${carregando ? 'Validando...' : 'Continuar'}
        </button>
      </form>

      ${provas.length > 1
      ? html`
            <div class="conecta-provas-list">
              <strong>Selecione a avaliação</strong>
              ${provas.map(
        (prova) => html`
                  <button
                    type="button"
                    key=${prova.token}
                    class="conecta-provas-list-item"
                    onClick=${() => onSelecionar(prova)}
                  >
                    <span>${prova.vaga || 'avaliação'}</span>
                    <small>${prova.operacao || '-'} â€¢ ${prova.status || '-'} â€¢ ${prova.gerada_em || '-'}</small>
                  </button>
                `,
      )}
            </div>
          `
      : null}

      <div class="conecta-provas-alt-actions">
        ${tentativasEmail >= 3 && metodo !== 'telefone'
      ? html`
              <button type="button" class="btn btn-link" onClick=${() => onMetodo('telefone')}>
                Acessar com telefone
              </button>
            `
      : null}
        ${tentativasTelefone >= 3 && metodo !== 'codigo'
      ? html`
              <button type="button" class="btn btn-link" onClick=${() => onMetodo('codigo')}>
                Acessar com código da prova
              </button>
            `
      : null}
      </div>
    </section>
  `;
}

function TelaConfirmacao({ sessao, formulario, erro, salvando, onChange, onConfirmar }) {
  return html`
    <section class="conecta-provas-card">
      <div class="conecta-provas-step">Comfirmação</div>
      <h1>Confirme seus dados</h1>
      <p>Verifique se as informações abaixo estão corretas antes de iniciar a avaliação.</p>
      ${erro ? html`<div class="alert alert-warning">${erro}</div>` : null}
      <div class="row g-3">
        <div class="col-md-12">
          <label class="form-label">Nome completo</label>
          <input
            class="form-control"
            value=${formulario.nome_candidato}
            onInput=${(event) => onChange({ ...formulario, nome_candidato: event.target.value })}
          />
        </div>
        <div class="col-md-6">
          <label class="form-label">E-mail</label>
          <input
            class="form-control"
            value=${formulario.email}
            onInput=${(event) => onChange({ ...formulario, email: event.target.value })}
          />
        </div>
        <div class="col-md-6">
          <label class="form-label">Telefone</label>
          <input
            class="form-control"
            value=${formulario.telefone}
            onInput=${(event) => onChange({ ...formulario, telefone: event.target.value })}
          />
        </div>
      </div>
      <button type="button" class="btn btn-primary conecta-provas-primary" disabled=${salvando} onClick=${onConfirmar}>
        ${salvando ? 'Salvando...' : 'Confirmar e continuar'}
      </button>
      <div class="Comfirmação">
        <span>${sessao?.prova?.vaga || '-'}</span>
        <span>${sessao?.prova?.operacao || '-'}</span>
      </div>
    </section>
  `;
}

function TelaRegras({ sessao, onIniciar, carregando, erro }) {
  const prova = sessao?.prova || {};
  const questoes = Array.isArray(prova.questoes) ? prova.questoes : [];
  const etapas = obterResumoEtapas(prova);
  const possuiExcel = questoes.some((questao) => questao.type === 'excel_external');
  const possuiRedacao = questoes.some(etapaEhRedacao);
  const possuiWord = questoes.some(etapaEhWord);
  const quantidadeQuestoes = prova.quantidade_questoes || questoes.length;
  const resumoQuantitativo = etapas.map((etapa) => ({
    label: etapa.label,
    value: `${etapa.quantidade || 0} ${Number(etapa.quantidade || 0) === 1 ? 'Questão' : 'questões'}`,
  }));

  return html`
    <section class="conecta-provas-card conecta-provas-card-wide">
      <div class="conecta-provas-step">Regras</div>
      <h1>Regras da prova</h1>
      ${erro ? html`<div class="alert alert-warning">${erro}</div>` : null}
      <div class="conecta-provas-rules-grid">
        <span><strong>Vaga</strong>${prova.vaga || '-'}</span>
        ${prova.operacao
      ? html`<span><strong>Operação/cliente</strong>${prova.operacao}</span>`
      : null}
        <span><strong>Tempo total</strong>${prova.tempo_total || 0} min</span>
        <span><strong>Etapas</strong>${etapas.length}</span>
        <span><strong>Questões</strong>${quantidadeQuestoes}</span>
        <span><strong>Redação</strong>${possuiRedacao ? 'Sim' : 'Não'}</span>
        <span><strong>Excel</strong>${possuiExcel ? 'Sim' : 'Não'}</span>
        <span><strong>Word/texto</strong>${possuiWord ? 'Sim' : 'Não'}</span>
      </div>

      <section>
          <h3>Resumo quantitativo da prova</h3>
          <div class="conecta-provas-rules-grid">
            ${resumoQuantitativo.map(
        (item) => html`
                <span key=${item.label}><strong>${item.label}</strong>${item.value}</span>
              `,
      )}
            <span><strong>Tempo total</strong>${prova.tempo_total || 0} minutos</span>
          </div>
        </section>

      <div class="conecta-provas-section-list">
        <section>
          <h2>Regras gerais</h2>
          <ul class="conecta-provas-rules">
            <li>Preencha todas as etapas obrigatórias antes de finalizar.</li>
            <li>Não atualize a página durante a prova.</li>
            <li>Não feche o navegador durante a prova.</li>
            <li>Acompanhe o cronômetro no topo da tela.</li>
            <li>Revise suas respostas antes do envio final.</li>
            <li>Ao finalizar, suas respostas serão enviadas ao RH para análise.</li>
            <li>O resultado da avaliação não será exibido ao candidato nesta tela.</li>
            <li>Avise o RH quando concluir a prova, se estiver realizando presencialmente.</li>
          </ul>
        </section>

        <section>
          <h2>O que será avaliado</h2>
          <ul class="conecta-provas-rules">
            <li>Interpretação de enunciado.</li>
            <li>Organização das respostas.</li>
            <li>Escrita e clareza.</li>
            <li>Conhecimentos básicos ou técnicos conforme a vaga.</li>
            <li>Uso correto das ferramentas solicitadas.</li>
            <li>Atenção às instruções.</li>
            <li>Capacidade de resolver situações práticas.</li>
            ${possuiRedacao
      ? html`<li>Na redação: coerência, coesão, estrutura, ortografia e argumentação.</li>`
      : null}
            ${possuiExcel
      ? html`<li>No Excel: preenchimento correto, organização, fórmulas quando aplicável, filtros, edição e formatação conforme a atividade.</li>`
      : null}
            ${possuiWord
      ? html`<li>No Word/texto: formatação, clareza, organização visual, uso dos recursos solicitados e cumprimento do enunciado.</li>`
      : null}
          </ul>
        </section>

        
      </div>
      <button type="button" class="btn btn-primary conecta-provas-primary" disabled=${carregando} onClick=${onIniciar}>
        ${carregando ? 'Iniciando...' : 'Iniciar prova'}
      </button>
    </section>
  `;
}


function BlocoRedacao({ questao }) {
  if (!etapaEhRedacao(questao)) return null;
  const dados = questao.essay || {};
  const textos = Array.isArray(dados.supportTexts)
    ? dados.supportTexts
    : Array.isArray(dados.motivatingTexts)
      ? dados.motivatingTexts
      : [];
  const textosVisiveis = textos
    .map(limparTextoVisivelCandidato)
    .filter(Boolean);
  const proposta =
    limparTextoVisivelCandidato(dados.proposal || questao.enunciadoCandidato) ||
    'Com base nos textos-base e em seus conhecimentos, escreva um texto explicando a importância de agir com organização, clareza e responsabilidade em situações profissionais.';
  const orientacao = limparTextoVisivelCandidato(dados.orientation) || ORIENTACAO_REDACAO;
  const textosFallback = [
    'O início da vida profissional costuma ser marcado por descobertas, dúvidas e aprendizados. Para muitos jovens, esse período representa o primeiro contato com regras, horários, responsabilidades e formas de comunicação próprias do ambiente de trabalho. Atitudes simples, como ouvir com atenção, anotar orientações, confirmar informações e cumprir combinados, ajudam a construir confiança e demonstram disposição para aprender. Elas também tornam a rotina mais segura para a pessoa e para a equipe.',
    'Em uma situação cotidiana, uma pessoa recebeu uma lista curta de tarefas e percebeu que uma orientação estava incompleta. Antes de seguir adiante, ela decidiu conferir a informação com a pessoa responsável, evitando retrabalho e reduzindo o risco de repassar dados incorretos. Essa postura mostra que responsabilidade não depende apenas de experiência, mas também de cuidado, comunicação respeitosa e organização. Mesmo uma atividade simples pode exigir atenção aos detalhes.',
  ];

  return html`
    <div class="conecta-provas-essay-panel">
      <div class="conecta-provas-essay-theme">
        <strong>Tema da redação</strong>
        <span>${dados.theme || questao.title || 'Tema da redação'}</span>
      </div>
      <div class="conecta-provas-motivators">
        ${(textosVisiveis.length >= 2
      ? textosVisiveis
      : textosFallback
    ).slice(0, 2).map(
      (texto, indiceTexto) => html`
            <article key=${indiceTexto}>
              <strong>${`Texto-base ${indiceTexto + 1}`}</strong>
              <p>${texto}</p>
            </article>
          `,
    )}
      </div>
      <div class="conecta-provas-essay-proposal">
        <strong>Proposta de redação</strong>
        <p>${proposta}</p>
        <span>${orientacao}</span>
      </div>
    </div>
  `;
}

function QuestaoProva({
  questao,
  resposta,
  indice,
  total,
  tempoRestante,
  progresso,
  nomeCandidato,
  onResposta,
}) {
  const tipo = questao?.type || 'multiple';
  const limiteCaracteres = obterLimiteCaracteresRedacao(questao);
  const ehRedacao = etapaEhRedacao(questao);
  const camposVisiveis = obterCamposQuestaoVisivel(questao);
  return html`
    <section class="conecta-provas-card conecta-provas-card-wide">
      <div class="conecta-provas-exam-head">
        <div>
          <span class="conecta-provas-step">${questao.stage || 'Etapa'}</span>
          <h1>${ehRedacao ? 'Redação' : questao.title || `Questão ${indice + 1}`}</h1>
        </div>
        <div class="conecta-provas-status-card">
          <span>${`Questão ${indice + 1} de ${total}`}</span>
          <strong>${`Tempo restante: ${formatarTempoRestante(tempoRestante)}`}</strong>
          <div class="conecta-provas-status-track">
            <div style=${{ width: `${progresso}%` }}></div>
          </div>
        </div>
      </div>
      ${ehRedacao
      ? html`<${BlocoRedacao} questao=${questao} />`
      : html`
            <div class="conecta-provas-question-text">
              <p>${camposVisiveis.enunciado}</p>
              ${camposVisiveis.instrucao
          ? html`<p><strong>Instrução:</strong> ${camposVisiveis.instrucao}</p>`
          : null}
            </div>
          `}

      ${tipo === 'multiple'
      ? html`
            <${PerguntaMultipla}
              questao=${questao}
              resposta=${resposta}
              onChange=${(selected) => onResposta({ type: 'multiple', selected })}
            />
          `
      : tipo === 'excel_external'
        ? html`
              <div class="conecta-provas-excel-rules">
                <strong>Regras da etapa de Excel</strong>
                <ul>
                  <li>Baixe a planilha da prova.</li>
                  <li>Responda no arquivo baixado.</li>
                  <li>Execute a atividade no Excel ou LibreOffice Calc.</li>
                  <li>Não altere o nome do arquivo.</li>
                  <li>Não envie arquivo de outro candidato.</li>
                  <li>Salve antes de anexar.</li>
                  <li>Confira o arquivo antes de avançãr.</li>
                  <li>Envie apenas o arquivo final.</li>
                </ul>
              </div>
              <${PerguntaExcel}
                questao=${questao}
                resposta=${resposta}
                nomeCandidato=${nomeCandidato}
                onChange=${(respostaExcel) => {
            const { uploadedArrayBuffer: _buffer, ...serializavel } = respostaExcel || {};
            onResposta(serializavel);
          }}
              />
            `
        : html`
              <${EditorTextoRich}
                valor=${resposta?.content || resposta?.text || ''}
                limiteCaracteres=${limiteCaracteres}
                textoAjuda=${ehRedacao ? ORIENTACAO_REDACAO : ''}
                mostrarContador=${!ehRedacao}
                onChange=${(content) => {
            const limitado = limitarConteudoTexto(content, limiteCaracteres);
            onResposta({ type: 'word', content: limitado.content, text: limitado.text });
          }}
              />
            `}
    </section>
  `;
}

function TelaRevisao({
  sessao,
  respostas,
  onEditar,
  onVoltar,
  onFinalizar,
  carregando,
  erro,
}) {
  const questoes = sessao?.prova?.questoes || [];
  const pendencias = obterPendenciasObrigatorias(questoes, respostas);
  const respondidas = questoes.length - pendencias.length;
  const possuiRedacao = questoes.some(etapaEhRedacao);
  const possuiExcel = questoes.some((questao) => questao.type === 'excel_external');
  const possuiWord = questoes.some(etapaEhWord);

  return html`
    <section class="conecta-provas-card conecta-provas-card-wide">
      <div class="conecta-provas-step">Revisão</div>
      <h1>Revise sua prova</h1>
      <p>Confira o preenchimento antes do envio final.</p>
      ${erro ? html`<div class="alert alert-warning">${erro}</div>` : null}
      <div class="conecta-provas-review-grid">
        <span><strong>Etapas</strong>${obterResumoEtapas(sessao?.prova || {}).length}</span>
        <span><strong>Itens completos</strong>${respondidas}/${questoes.length}</span>
        <span><strong>Pendentes</strong>${pendencias.length}</span>
        <span><strong>redação</strong>${possuiRedacao ? 'Incluída' : 'Não incluída'}</span>
        <span><strong>Excel</strong>${possuiExcel ? 'Incluído' : 'Não incluído'}</span>
        <span><strong>Word/texto</strong>${possuiWord ? 'Incluído' : 'Não incluído'}</span>
      </div>

      <div class="conecta-provas-review-list">
        ${questoes.map((questao, indice) => {
    const completa = respostaQuestaoPreenchida(questao, respostas[indice]);
    return html`
            <article class=${`conecta-provas-review-item ${completa ? 'is-complete' : 'is-pending'}`} key=${indice}>
              <div>
                <small>${obterLabelEtapa(questao)}</small>
                <strong>${etapaEhRedacao(questao) ? 'redação' : questao.title || `Questão ${indice + 1}`}</strong>
                <p>${descreverRespostaRevisao(questao, respostas[indice])}</p>
              </div>
              <div class="conecta-provas-review-actions">
                <span>${completa ? 'Completa' : 'Pendente'}</span>
                <button type="button" class="btn btn-sm btn-outline-primary" onClick=${() => onEditar(indice)}>
                  Editar
                </button>
              </div>
            </article>
          `;
  })}
      </div>

      <div class="conecta-provas-actions">
        <button type="button" class="btn btn-outline-secondary" disabled=${carregando} onClick=${onVoltar}>
          Voltar e revisar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          disabled=${carregando}
          onClick=${onFinalizar}
        >
          ${carregando ? 'Finalizando...' : 'Finalizar prova'}
        </button>
      </div>
    </section>
  `;
}

function AvisoPendenciasFinalizacao({
  pendencias,
  carregando,
  onFinalizarMesmoAssim,
  onContinuar,
}) {
  const lista = Array.isArray(pendencias) ? pendencias : [];
  return html`
    <div class="conecta-provas-modal-backdrop" role="presentation">
      <section
        class="conecta-provas-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conecta-provas-pendencias-title"
      >
        <div class="conecta-provas-modal-head">
          <span class="material-symbols-outlined">warning</span>
          <h2 id="conecta-provas-pendencias-title">Existem pendências na sua prova</h2>
        </div>
        <p>Você deseja finalizar mesmo assim ou voltar para revisar?</p>
        ${lista.length
      ? html`
              <ul class="conecta-provas-pending-list">
                ${lista.slice(0, 6).map(
        (item) => html`
                    <li key=${item.indice}>
                      ${`Questão ${item.indice + 1}: ${obterTituloQuestao(item.questao, item.indice)}`}
                    </li>
                  `,
      )}
                ${lista.length > 6
          ? html`<li>${`Mais ${lista.length - 6} pendência(s).`}</li>`
          : null}
              </ul>
            `
      : null}
        <div class="conecta-provas-modal-actions">
          <button
            type="button"
            class="btn btn-outline-secondary"
            disabled=${carregando}
            onClick=${onContinuar}
          >
            Continuar respondendo
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${carregando}
            onClick=${onFinalizarMesmoAssim}
          >
            ${carregando ? 'Finalizando...' : 'Finalizar mesmo assim'}
          </button>
        </div>
      </section>
    </div>
  `;
}

function TelaFinalizacao({ onInicio }) {
  return html`
    <section class="conecta-provas-card">
      <div class="conecta-provas-step">Conclusão</div>
      <h1>Sua prova foi finalizada com sucesso.</h1>
      <p>Avise ao RH que você concluiu a avaliação.</p>
      <button type="button" class="btn btn-primary conecta-provas-primary" onClick=${onInicio}>
        Voltar à tela inicial
      </button>
    </section>
  `;
}

export function TelaConectaProvas() {
  const [etapa, setEtapa] = useState('acesso');
  const [metodo, setMetodo] = useState('email');
  const [valorAcesso, setValorAcesso] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [tentativasEmail, setTentativasEmail] = useState(0);
  const [tentativasTelefone, setTentativasTelefone] = useState(0);
  const [provasEncontradas, setProvasEncontradas] = useState([]);
  const [token, setToken] = useState('');
  const [sessao, setSessao] = useState(null);
  const [formularioDados, setFormularioDados] = useState({
    nome_candidato: '',
    email: '',
    telefone: '',
  });
  const [respostas, setRespostas] = useState([]);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [timestampTermino, setTimestampTermino] = useState(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [pendenciasFinalizacao, setPendenciasFinalizacao] = useState([]);

  useEffect(() => {
    const salvo = sessionStorage.getItem(CHAVE_TOKEN_PUBLICO) || '';
    if (!salvo) return;
    selecionarToken(salvo, { silencioso: true });
  }, []);

  useEffect(() => {
    if (!timestampTermino || etapa !== 'prova') return undefined;
    const atualizar = () => {
      const restante = Math.max(0, Math.floor((timestampTermino - Date.now()) / 1000));
      setSegundosRestantes(restante);
    };
    atualizar();
    const intervalo = window.setInterval(atualizar, 1000);
    return () => window.clearInterval(intervalo);
  }, [timestampTermino, etapa]);

  const questoes = sessao?.prova?.questoes || [];
  const questaoAtual = questoes[indiceAtual] || null;
  const progresso = useMemo(
    () => (questoes.length ? Math.round(((indiceAtual + 1) / questoes.length) * 100) : 0),
    [indiceAtual, questoes.length],
  );

  const selecionarToken = async (tokenSelecionado, opcoes = {}) => {
    if (!tokenSelecionado) return;
    setCarregando(true);
    setErro('');
    try {
      const dados = await lerSessaoConectaProvas(tokenSelecionado);
      setToken(tokenSelecionado);
      sessionStorage.setItem(CHAVE_TOKEN_PUBLICO, tokenSelecionado);
      setSessao(dados);
      setFormularioDados({
        nome_candidato: dados?.candidato?.nome_candidato || '',
        email: dados?.candidato?.email || '',
        telefone: dados?.candidato?.telefone || '',
      });
      const listaQuestoes = dados?.prova?.questoes || [];
      setRespostas(listaQuestoes.map(obterRespostaInicial));
      setSegundosRestantes(obterTempoTotalSegundos(dados));
      setTimestampTermino(null);
      if (dados?.prova?.finalizada) {
        setEtapa('finalizacao');
      } else {
        setEtapa('confirmacao');
      }
    } catch (error) {
      sessionStorage.removeItem(CHAVE_TOKEN_PUBLICO);
      if (!opcoes.silencioso) {
        setErro(error?.message || ERRO_GENERICO);
      }
    } finally {
      setCarregando(false);
    }
  };

  const executarAcesso = async () => {
    setCarregando(true);
    setErro('');
    setProvasEncontradas([]);
    try {
      let resposta;
      if (metodo === 'email') {
        if (!validarEmail(valorAcesso)) {
          setErro('Informe um e-mail vÃ¡lido.');
          setTentativasEmail((valor) => valor + 1);
          return;
        }
        resposta = await acessarProvaPorEmail(valorAcesso.trim().toLowerCase());
      } else if (metodo === 'telefone') {
        if (!validarTelefone(valorAcesso)) {
          setErro('Informe um telefone vÃ¡lido.');
          setTentativasTelefone((valor) => valor + 1);
          return;
        }
        resposta = await acessarProvaPorTelefone(valorAcesso);
      } else {
        const codigo = valorAcesso.toUpperCase().replace(/\s+/g, '');
        if (!validarCodigo(codigo)) {
          setErro('Código inválido ou prova indisponível. Verifique com o RH.');
          return;
        }
        resposta = await acessarProvaPorCodigo(codigo);
      }

      if (!resposta?.success || !resposta?.provas?.length) {
        if (metodo === 'email') setTentativasEmail((valor) => valor + 1);
        if (metodo === 'telefone') setTentativasTelefone((valor) => valor + 1);
        setErro(
          metodo === 'telefone'
            ? ERRO_GENERICO_TELEFONE
            : resposta?.message || ERRO_GENERICO,
        );
        return;
      }

      if (resposta.provas.length === 1) {
        await selecionarToken(resposta.provas[0].token);
        return;
      }
      setProvasEncontradas(resposta.provas);
    } catch (error) {
      if (metodo === 'email') setTentativasEmail((valor) => valor + 1);
      if (metodo === 'telefone') setTentativasTelefone((valor) => valor + 1);
      setErro(error?.message || ERRO_GENERICO);
    } finally {
      setCarregando(false);
    }
  };

  const confirmarDados = async () => {
    if (!normalizarTexto(formularioDados.nome_candidato)) {
      setErro('Informe seu nome completo.');
      return;
    }
    if (!validarEmail(formularioDados.email)) {
      setErro('Informe um e-mail vÃ¡lido.');
      return;
    }
    if (!validarTelefone(formularioDados.telefone)) {
      setErro('Informe um telefone vÃ¡lido.');
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      await confirmarDadosConectaProvas({ token, ...formularioDados });
      setSessao((anterior) => ({
        ...anterior,
        candidato: { ...formularioDados },
      }));
      setEtapa('regras');
    } catch (error) {
      setErro(error?.message || 'Não foi possível confirmar seus dados.');
    } finally {
      setCarregando(false);
    }
  };

  const iniciar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const inicio = await iniciarConectaProvas(token);
      const sessaoAtualizada = {
        ...sessao,
        prova: {
          ...(sessao?.prova || {}),
          iniciada_em: inicio?.iniciada_em || sessao?.prova?.iniciada_em || new Date().toISOString(),
          tempo_total: inicio?.tempo_total || sessao?.prova?.tempo_total || 40,
        },
      };
      setSessao(sessaoAtualizada);
      const timestamp = calcularTimestampTermino(sessaoAtualizada, token);
      salvarTimestampTimer(token, timestamp);
      setTimestampTermino(timestamp);
      setSegundosRestantes(Math.max(1, Math.floor((timestamp - Date.now()) / 1000)));
      setIndiceAtual(0);
      setEtapa('prova');
    } catch (error) {
      setErro(error?.message || 'Não foi possível iniciar a prova.');
    } finally {
      setCarregando(false);
    }
  };

  const salvarParcial = async (proximIndice = indiceAtual) => {
    if (
      proximIndice > indiceAtual &&
      questaoAtual?.type === 'excel_external' &&
      !respostaQuestaoPreenchida(questaoAtual, respostas[indiceAtual])
    ) {
      setErro('Anexe o arquivo Excel respondido antes de avançar nesta etapa.');
      return;
    }

    await salvarRespostasConectaProvas(token, respostas);
    setIndiceAtual(Math.max(0, Math.min(questoes.length - 1, proximIndice)));
    setErro('');
  };

  const irParaRevisao = async () => {
    setCarregando(true);
    setErro('');
    try {
      const pendencias = obterPendenciasObrigatorias(questoes, respostas);
      if (pendencias.length) {
        setIndiceAtual(pendencias[0].indice);
        setErro('Preencha todas as etapas obrigatórias antes de revisar a prova.');
        setCarregando(false);
        return;
      }
      await marcarRevisaoConectaProvas(token, respostas);
      setEtapa('revisao');
    } catch (error) {
      setErro(error?.message || 'Não foi possível preparar a revisão.');
    } finally {
      setCarregando(false);
    }
  };

  const finalizar = async ({ finalizarMesmoComPendencias = false } = {}) => {
    setCarregando(true);
    setErro('');
    try {
      const pendencias = obterPendenciasObrigatorias(questoes, respostas);
      if (pendencias.length && !finalizarMesmoComPendencias) {
        setPendenciasFinalizacao(pendencias);
        setCarregando(false);
        return;
      }
      await finalizarConectaProvas(token, respostas, {
        finalizarMesmoAssim: finalizarMesmoComPendencias,
      });
      sessionStorage.removeItem(CHAVE_TOKEN_PUBLICO);
      limparTimestampTimer(token);
      setPendenciasFinalizacao([]);
      setEtapa('finalizacao');
    } catch (error) {
      setErro(error?.message || 'Não foi possível finalizar a prova.');
    } finally {
      setCarregando(false);
    }
  };

  const solicitarFinalizacao = async () => {
    setCarregando(true);
    setErro('');
    try {
      await salvarRespostasConectaProvas(token, respostas);
      const pendencias = obterPendenciasObrigatorias(questoes, respostas);
      if (pendencias.length) {
        setPendenciasFinalizacao(pendencias);
        return;
      }
      await finalizar({ finalizarMesmoComPendencias: false });
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar suas respostas antes de finalizar.');
    } finally {
      setCarregando(false);
    }
  };

  const continuarRespondendoPendencias = () => {
    const primeira = pendenciasFinalizacao[0];
    setPendenciasFinalizacao([]);
    if (primeira) {
      setIndiceAtual(primeira.indice);
      setEtapa('prova');
      setErro('Revise as pendências destacadas antes de finalizar.');
    }
  };

  const voltarInicio = () => {
    sessionStorage.removeItem(CHAVE_TOKEN_PUBLICO);
    limparTimestampTimer(token);
    setEtapa('acesso');
    setMetodo('email');
    setValorAcesso('');
    setErro('');
    setToken('');
    setSessao(null);
    setRespostas([]);
    setIndiceAtual(0);
    setTentativasEmail(0);
    setTentativasTelefone(0);
    window.history.replaceState(null, '', '/conecta-provas');
  };

  return html`
    <main class="conecta-provas-shell">
      ${etapa === 'acesso'
      ? html`
            <${TelaAcesso}
              metodo=${metodo}
              valor=${valorAcesso}
              erro=${erro}
              carregando=${carregando}
              tentativasEmail=${tentativasEmail}
              tentativasTelefone=${tentativasTelefone}
              provas=${provasEncontradas}
              onValor=${setValorAcesso}
              onSubmit=${executarAcesso}
              onSelecionar=${(prova) => selecionarToken(prova.token)}
              onMetodo=${(novoMetodo) => {
          setMetodo(novoMetodo);
          setValorAcesso('');
          setErro('');
        }}
            />
          `
      : null}
      ${etapa === 'confirmacao'
      ? html`
            <${TelaConfirmacao}
              sessao=${sessao}
              formulario=${formularioDados}
              erro=${erro}
              salvando=${carregando}
              onChange=${setFormularioDados}
              onConfirmar=${confirmarDados}
            />
          `
      : null}
      ${etapa === 'regras'
      ? html`
            <${TelaRegras}
              sessao=${sessao}
              onIniciar=${iniciar}
              carregando=${carregando}
              erro=${erro}
            />
          `
      : null}
      ${etapa === 'prova' && questaoAtual
      ? html`
            <div class="conecta-provas-progress-wrap">
              <div class="conecta-provas-progress-bar" style=${{ width: `${progresso}%` }}></div>
            </div>
            <${QuestaoProva}
              questao=${questaoAtual}
              resposta=${respostas[indiceAtual]}
              indice=${indiceAtual}
              total=${questoes.length}
              tempoRestante=${timestampTermino ? segundosRestantes : obterTempoTotalSegundos(sessao)}
              progresso=${progresso}
              nomeCandidato=${formularioDados.nome_candidato || sessao?.candidato?.nome_candidato}
              onResposta=${(resposta) =>
          setRespostas((anteriores) => {
            const proximas = [...anteriores];
            proximas[indiceAtual] = resposta;
            return proximas;
          })}
            />
            ${erro ? html`<div class="alert alert-warning conecta-provas-error">${erro}</div>` : null}
            <div class="conecta-provas-nav">
              <button
                type="button"
                class="btn btn-outline-secondary-avr"
                disabled=${indiceAtual <= 0 || carregando}
                onClick=${() => salvarParcial(indiceAtual - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary-avr"
                disabled=${carregando}
                onClick=${() =>
          indiceAtual === questoes.length - 1
            ? salvarParcial(indiceAtual)
            : salvarParcial(Math.min(questoes.length - 1, indiceAtual + 1))}
              >
                ${indiceAtual === questoes.length - 1 ? 'Salvar' : 'Avançar'}
              </button>
              ${indiceAtual === questoes.length - 1
          ? html`
                    <button
                      type="button"
                      class="btn btn-primary"
                      disabled=${carregando}
                      onClick=${solicitarFinalizacao}
                    >
                      ${carregando ? 'Finalizando...' : 'Finalizar prova'}
                    </button>
                  `
          : null}
            </div>
          `
      : null}
      ${etapa === 'revisao'
      ? html`
            <${TelaRevisao}
              sessao=${sessao}
              respostas=${respostas}
              carregando=${carregando}
              erro=${erro}
              onVoltar=${() => setEtapa('prova')}
              onEditar=${(indice) => {
          setIndiceAtual(indice);
          setEtapa('prova');
          setErro('');
        }}
              onFinalizar=${solicitarFinalizacao}
            />
          `
      : null}
      ${etapa === 'finalizacao' ? html`<${TelaFinalizacao} onInicio=${voltarInicio} />` : null}
      ${pendenciasFinalizacao.length
      ? html`
            <${AvisoPendenciasFinalizacao}
              pendencias=${pendenciasFinalizacao}
              carregando=${carregando}
              onContinuar=${continuarRespondendoPendencias}
              onFinalizarMesmoAssim=${() => finalizar({ finalizarMesmoComPendencias: true })}
            />
          `
      : null}
    </main>
  `;
}
