import { ROTULOS_ETAPAS } from './perguntas.js';
import { obterDadosBaseExcel } from './features/prova/services/excel-base-data.js';
import {
  baixarBlob,
  contarFrases,
  contarItensListaNoHtml,
  removerHtml,
  sanitizarNomeArquivo,
  textoMaiusculoSeguro,
} from './utilitarios.js';

function obterBibliotecaXlsx() {
  if (!window.XLSX) {
    throw new Error('A biblioteca XLSX não foi carregada.');
  }

  return window.XLSX;
}

function criarResultadoPontuacao(
  score,
  max,
  notes = [],
  pendingManual = false,
  completedTasks = [],
) {
  return { score, max, notes, pendingManual, completedTasks };
}

function criarResultadoChecklist(tarefas, pontos, notas = []) {
  const listaValida = Array.isArray(tarefas) ? tarefas : [];
  const concluidas = listaValida.filter((tarefa) => !!tarefa.done).length;
  const score =
    listaValida.length > 0
      ? Math.round((concluidas / listaValida.length) * pontos)
      : 0;

  return {
    score,
    max: pontos,
    notes: notas,
    pendingManual: true,
    completedTasks: listaValida.map(
      (tarefa) => `${tarefa.done ? '[x]' : '[ ]'} ${tarefa.label}`,
    ),
  };
}

function resumirConclusaoChecklist(completedTasks = []) {
  const lista = Array.isArray(completedTasks) ? completedTasks : [];
  const total = lista.length;
  const concluidas = lista.filter((item) => String(item || '').startsWith('[x]')).length;

  return { total, concluidas };
}

function possuiValidacaoExcelImplementada(validation) {
  const notas = Array.isArray(validation?.notes) ? validation.notes : [];
  return !notas.some((item) =>
    String(item || '').toLowerCase().includes('validacao nao implementada'),
  );
}

function obterPlanilha(workbook, nome) {
  return workbook.Sheets[nome];
}

function obterValorCelula(planilha, endereco) {
  if (!planilha || !planilha[endereco]) return '';
  if (planilha[endereco].w !== undefined) return planilha[endereco].w;
  if (planilha[endereco].v !== undefined) return planilha[endereco].v;
  return '';
}

function obterCelula(planilha, endereco) {
  return planilha && planilha[endereco] ? planilha[endereco] : null;
}

function celulaTemDados(planilha, endereco) {
  const celula = obterCelula(planilha, endereco);
  if (!celula) return false;

  if (celula.f !== undefined && celula.f !== null && String(celula.f).trim()) {
    return true;
  }

  const valor = obterValorCelula(planilha, endereco);
  return String(valor ?? '').trim() !== '';
}

function planilhaTemAutofiltro(planilha) {
  return !!(planilha && planilha['!autofilter']);
}

function adicionarLinhas(planilha, linhas, origem = 'A1') {
  const XLSX = obterBibliotecaXlsx();
  XLSX.utils.sheet_add_aoa(planilha, linhas, { origin: origem });
}

function converterMatrizParaPlanilha(matriz) {
  const XLSX = obterBibliotecaXlsx();
  return XLSX.utils.aoa_to_sheet(matriz);
}

function coletarValoresAteLinhaVazia(
  planilha,
  coluna,
  linhaInicial,
  maximo = 500,
) {
  const valores = [];

  for (let linha = linhaInicial; linha <= maximo; linha += 1) {
    const valor = String(
      obterValorCelula(planilha, `${coluna}${linha}`) || '',
    ).trim();
    if (!valor) break;
    valores.push(valor);
  }

  return valores;
}

function htmlTemNegrito(html) {
  if (/<(b|strong)[^>]*>[\s\S]*?<\/(b|strong)>/i.test(html)) return true;
  if (/font-weight\s*:\s*(bold|[6-9]\d{2}|[1-9]\d{3})/i.test(html)) return true;
  return false;
}

function htmlTemCentralizacao(html) {
  if (/text-align\s*:\s*center/i.test(html)) return true;
  if (/align\s*=\s*["']?center["']?/i.test(html)) return true;
  if (/<div[^>]*style\s*=\s*["'][^"']*center[^"']*["']/i.test(html))
    return true;
  return false;
}

function tituloTemNegritoNoHtml(html, textoTitulo) {
  if (!textoTitulo) return false;
  const tituloEscapado = textoTitulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexTag = new RegExp(
    '<(b|strong)[^>]*>[\\s\\S]*?' +
      tituloEscapado +
      '[\\s\\S]*?<\\/(b|strong)>',
    'i',
  );

  if (regexTag.test(html)) return true;

  const regexEstilo = new RegExp(
    'font-weight\\s*:\\s*(bold|[6-9]\\d{2}|[1-9]\\d{3})[^"\']*["\'][^>]*>[\\s\\S]*?' +
      tituloEscapado,
    'i',
  );

  if (regexEstilo.test(html)) return true;

  return htmlTemNegrito(html);
}

function tituloTemCentralizacaoNoHtml(html, textoTitulo) {
  if (!textoTitulo) return false;
  const tituloEscapado = textoTitulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const regexAntes = new RegExp(
    '(text-align\\s*:\\s*center|align\\s*=\\s*["\']?center["\']?)[\\s\\S]{0,300}' +
      tituloEscapado,
    'i',
  );

  const regexDepois = new RegExp(
    tituloEscapado +
      '[\\s\\S]{0,300}(text-align\\s*:\\s*center|align\\s*=\\s*["\']?center["\']?)',
    'i',
  );

  return (
    regexAntes.test(html) ||
    regexDepois.test(html) ||
    htmlTemCentralizacao(html)
  );
}

export function avaliarRespostaTexto(resposta, esperado, pontos) {
  if (!resposta || !resposta.content) return 0;

  const html = resposta.content;
  const textoPlano = removerHtml(html);
  const textoMaiusculo = textoPlano.toUpperCase();

  if (textoPlano.trim().length < 5) return 0;

  let score = 0;
  let pesoTotal = 0;

  const verificacoes = [
    esperado.titleText
      ? {
          ok: textoMaiusculo.includes(esperado.titleText.toUpperCase()),
          weight: 2,
        }
      : null,
    esperado.titleBold
      ? {
          ok: tituloTemNegritoNoHtml(html, esperado.titleText),
          weight: 1.5,
        }
      : null,
    esperado.titleCenter
      ? {
          ok: tituloTemCentralizacaoNoHtml(html, esperado.titleText),
          weight: 1.5,
        }
      : null,
    esperado.minTextLength
      ? { ok: textoPlano.length >= esperado.minTextLength, weight: 1.5 }
      : null,
    esperado.requiresList
      ? {
          ok: /<(ul|ol)[^>]*>/i.test(html) || /^\s*[-*•]\s+/m.test(textoPlano),
          weight: 1.5,
        }
      : null,
    esperado.minListItems
      ? {
          ok:
            contarItensListaNoHtml(html) >= esperado.minListItems ||
            (textoPlano.match(/^\s*[-*•]\s+\S/gm) || []).length >=
              esperado.minListItems,
          weight: 1.5,
        }
      : null,
    esperado.anyBold ? { ok: htmlTemNegrito(html), weight: 1.2 } : null,
    esperado.minSentences
      ? { ok: contarFrases(textoPlano) >= esperado.minSentences, weight: 1.3 }
      : null,
  ].filter(Boolean);

  verificacoes.forEach((item) => {
    pesoTotal += item.weight;
    if (item.ok) score += item.weight;
  });

  if (!verificacoes.length) return 0;

  const scoreBruto = (score / pesoTotal) * pontos;
  return Math.max(textoPlano.trim().length >= 5 ? 1 : 0, Math.round(scoreBruto));
}

export function avaliarRespostaMultiplaEscolha(resposta, questao, pontos) {
  const indiceEsperado =
    questao?.answer !== undefined && questao?.answer !== null
      ? questao.answer
      : questao?.correctIndex;

  return resposta && resposta.selected === indiceEsperado ? pontos : 0;
}

export function obterCapacidadesDaTarefa(taskId) {
  const capacidades = {
    basic_exam: [
      'linhas de grade',
      'cópia da tabela para G9',
      'preenchimento de célula',
      'comentário',
      'filtro na tabela',
      'cálculo de total com fórmula',
    ],
    qualid_exam: [
      'ordenação por operador',
      'criação da coluna Valor Total',
      'multiplicação de Valor (R$) por Quantidade',
      'PROCV de supervisores',
      'lista de não encontrados a partir de BC255',
      'resumo do supervisor Lula',
      'copiar e colar',
      'filtro por Wesley Nunes',
      'gráfico de colunas agrupadas',
    ],
    planning_exam: [
      'CONT.SE',
      'ordenação decrescente',
      'PROCV de status',
      'tabela por DDD',
      'gráfico Pizza 3D',
      'média por zona',
      'percentual',
      'SE / condição lógica',
      'formatação condicional',
      'análise de vendas com PROCV e percentuais',
    ],
    advanced_exam: [
      'CONT.SE',
      'ordenação por cidade',
      'PROCV de status',
      'gráfico combinado com eixo secundário',
      'soma do RJ em F10',
      'análise completa de vendas',
      'totais e percentuais',
    ],
  };

  return capacidades[taskId] || ['atividade de planilha externa'];
}

export function obterGabaritoDaTarefa(taskId) {
  const gabaritos = {
    basic_exam: [
      'Criar coluna Subtotal ao final da tabela',
      'Calcular Subtotal = Valor do produto x Quantidade',
      'Formatar Valor Unitário e Subtotal como contábil',
      'Aplicar à nova coluna o mesmo estilo visual da planilha',
      'Alterar as cores de A1 e da linha A2',
      'Aplicar filtro e ordenar do maior para o menor valor unitário',
      'Criar linha de total e somar Quantidade e Valor R$',
    ],
    qualid_exam: [
      'Planilha A em ordem alfabética por Operador',
      'Coluna F com título Valor Total',
      'Valor Total = Valor (R$) x Quantidade',
      'PROCV preenchido na aba PROCV',
      'Operadores não encontrados listados a partir de BC255',
      'Resumo do supervisor Lula criado na aba TAB_DIN',
      'Tabela copiada e filtrada para Wesley Nunes',
      'Gráfico de colunas agrupadas criado com supervisores e março',
    ],
    planning_exam: [
      'CONT.SE preenchido por cidade e ordenado',
      'PROCV preenchido na aba Q2.',
      'Tabela por DDD e gráfico Pizza 3D',
      'Percentual e situação por zona',
      'Análise de vendas preenchida com totais e percentuais',
    ],
    advanced_exam: [
      'CONT.SE e ordenação por cidade',
      'PROCV preenchido',
      'Gráfico combinado com eixo secundário',
      'Soma do RJ em F10',
      'Análise de vendas completa',
    ],
  };

  return gabaritos[taskId] || [];
}

function obterConfiguracaoModeloExcel(taskId) {
  const pastaExames = 'Exames';

  const mapa = {
    basic_exam: {
      fileName: `${pastaExames}/exame_basico.xlsx`,
      outputBaseName: 'exame_basico',
    },
    qualid_exam: {
      fileName: `${pastaExames}/exame_medio.xlsx`,
      outputBaseName: 'exame_medio',
    },
    planning_exam: {
      fileName: `${pastaExames}/exame_avancado_nvl2.xlsx`,
      outputBaseName: 'exame_avancado_nvl2',
    },
    advanced_exam: {
      fileName: `${pastaExames}/exame_avancado.xlsx`,
      outputBaseName: 'exame_avancado',
    },
  };

  return mapa[taskId] || null;
}

async function carregarModeloExcel(taskId) {
  const configuracao = obterConfiguracaoModeloExcel(taskId);
  if (!configuracao) {
    throw new Error(`Nenhum arquivo-base configurado para o taskId: ${taskId}`);
  }

  const resposta = await fetch(configuracao.fileName, { cache: 'no-store' });
  if (!resposta.ok) {
    throw new Error(
      `Falha ao carregar o arquivo-base ${configuracao.fileName}. Status: ${resposta.status}`,
    );
  }

  return {
    ...configuracao,
    arrayBuffer: await resposta.arrayBuffer(),
  };
}

export async function baixarModeloExcel(taskId, nomeCandidato = 'candidato') {
  const info = await carregarModeloExcel(taskId);
  const nomeArquivo = sanitizarNomeArquivo(
    `${info.outputBaseName}_${nomeCandidato || 'candidato'}.xlsx`,
  );

  baixarBlob(
    nomeArquivo,
    new Blob([info.arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
}

async function adicionarPlanilhasBase(workbook) {
  const XLSX = obterBibliotecaXlsx();
  const dadosBaseExcel = await obterDadosBaseExcel();

  Object.entries(dadosBaseExcel).forEach(([nomePlanilha, linhas]) => {
    const nomeSeguro = `Base - ${nomePlanilha}`.slice(0, 31);
    if (workbook.SheetNames.includes(nomeSeguro)) return;

    const ws = converterMatrizParaPlanilha(
      linhas.map((linha) =>
        linha.map((celula) => (celula === undefined ? null : celula)),
      ),
    );

    XLSX.utils.book_append_sheet(workbook, ws, nomeSeguro);
  });
}

function montarPlanilhaBasica(workbook) {
  const XLSX = obterBibliotecaXlsx();
  const ws = converterMatrizParaPlanilha([]);

  adicionarLinhas(ws, [['Teste de conhecimentos de Excel']], 'B7');
  adicionarLinhas(
    ws,
    [
      ['Produto', 'Quantidade', 'Valor (R$)', 'Sub Total'],
      ['Processador', 2, 170, null],
      ['Indira', 4, 120, null],
      ['Placa mãe', 7, 250, null],
      ['TOTAL', null, null, null],
    ],
    'A9',
  );
  adicionarLinhas(
    ws,
    [
      ['1) Insira linhas de grade na planilha acima.'],
      ['2) Copie a planilha acima para a célula G9.'],
      ['3) Coloque o preenchimento Azul claro na célula D9.'],
      ['4) Insira um comentário na célula A11.'],
      ['5) Insira filtro na planilha.'],
      ['6) Calcule o total dos produtos inserindo fórmula.'],
    ],
    'A17',
  );

  XLSX.utils.book_append_sheet(workbook, ws, 'Teste de Excel');
  return workbook;
}

async function montarPlanilhaQualidade(workbook) {
  const XLSX = obterBibliotecaXlsx();

  const planilhaA = converterMatrizParaPlanilha([]);
  adicionarLinhas(
    planilhaA,
    [
      ['Operador', 'Supervisor', 'Produto', 'Valor (R$)', 'Quantidade'],
      ['Wesley Nunes', 'Tony', 'Net Fone', 8, 7],
      ['Amanda Gilena', 'Lula', 'Total Cine Plus HD', 60, 2],
      ['Rafael Luiz', 'Tony', 'Total Cine', 25, 8],
      ['Fatima Osorio', 'Angela', 'Premium Basico', 17, 1],
      ['Jorge Ponteio', 'Lula', 'Virtua 6 MB', 20, 3],
      ['Elenilda Hilda', 'Barack', 'Net Fone', 8, 12],
      ['Simone Maria', 'Lula', 'Premium Conforto', 18, 1],
      ['Antonio Carlos', 'Angela', 'Virtua 2 MB', 10, 3],
      ['Luis Mario', 'Barack', 'Virtua 2 MB', 10, 4],
      ['Mariana Souza', 'Angela', 'Total Cine Top HD', 80, 1],
    ],
    'A2',
  );
  adicionarLinhas(
    planilhaA,
    [
      ["1) Coloque a tabela em ordem alfabética crescente por 'Operador';"],
      [
        "2) Insira uma nova coluna a direita de 'Quantidade' e nomeie como 'Valor Total'.",
      ],
      [
        "3) Calcule o 'Valor Total' multiplicando 'Valor (R$)' por 'Quantidade'.",
      ],
      [
        "4) Formate os resultados da coluna 'Valor (R$)' e da coluna 'Valor Total' para o formato contabil.",
      ],
    ],
    'A16',
  );
  XLSX.utils.book_append_sheet(workbook, planilhaA, 'Planilha A');

  const procv = converterMatrizParaPlanilha([
    ['Operador', 'Supervisor', 'Resultado do PROCV'],
  ]);
  [
    'Fatima Osorio',
    'Antonio Carlos',
    'Elenilda Hilda',
    'Tania Santana',
    'Nancy Vanderley',
    'Jorge Ponteio',
    'Luis Mario',
    'Luzia Mendonca',
    'Eloisa Gouvea',
    'Rafael Luiz',
    'Amanda Gilena',
    'Simone Maria',
    'Wesley Nunes',
  ].forEach((nome, indice) => adicionarLinhas(procv, [[nome, '', '']], `A${indice + 2}`));
  adicionarLinhas(
    procv,
    [
      ['1) Utilize PROCV para localizar os supervisores existentes na Planilha A.'],
      ['2) Liste, a partir da celula BC255, os operadores que nao foram encontrados.'],
    ],
    'A17',
  );
  XLSX.utils.book_append_sheet(workbook, procv, 'PROCV');

  const tabdin = converterMatrizParaPlanilha([
    [
      '1) Crie abaixo, comecando na celula A5, um resumo dos produtos do supervisor Lula, contendo o Valor Total desse supervisor.',
    ],
    ['A tabela sera criada a partir da tabela da aba Planilha A.'],
  ]);
  XLSX.utils.book_append_sheet(workbook, tabdin, 'TAB_DIN');

  const copiar = converterMatrizParaPlanilha([
    [
      '1) Copie a tabela trabalhada na Planilha A e cole a partir da celula A5. Depois, filtre para exibir apenas Wesley Nunes.',
    ],
  ]);
  XLSX.utils.book_append_sheet(workbook, copiar, 'Copiar_Colar');

  const grafico = converterMatrizParaPlanilha([
    ['META (R$)', 'Jan', 'Fev', 'Mar', 'Abr'],
    ['Angela', 5000, 2000, 6000, 5000],
    ['Barack', 3200, 2500, 4700, 4000],
    ['Lula', 5000, 2000, 6000, 5000],
    ['Tony', 2000, 1200, 3000, 3000],
    [],
    [
      '1) Crie um grafico de colunas agrupadas com os supervisores e os valores do mes de marco.',
    ],
  ]);
  XLSX.utils.book_append_sheet(workbook, grafico, 'Grafico');

  await adicionarPlanilhasBase(workbook);
  return workbook;
}

async function montarPlanilhaPlanejamento(workbook) {
  const XLSX = obterBibliotecaXlsx();

  const q1 = converterMatrizParaPlanilha([
    ['Questao 1.'],
    ['* Utilize CONT.SE para descobrir quantos nomes foram listados para cada cidade abaixo.'],
    ['* Organize em ordem decrescente de acordo com a quantidade de nomes.'],
    [],
    ['Cidade', 'Qtde de Nomes'],
    ['Campinas', ''],
    ['Guarulhos', ''],
    ['Limeira', ''],
    ['Jacarei', ''],
    ['Embu', ''],
    ['Catanduva', ''],
    ['Lins', ''],
    ['Itapolis', ''],
    ['Jandira', ''],
    ['Lorena', ''],
    ['Guaratingueta', ''],
    ['Juquia', ''],
  ]);
  XLSX.utils.book_append_sheet(workbook, q1, 'Q1.');

  const q2 = converterMatrizParaPlanilha([
    ['Questao 2.'],
    ['Com base na planilha Dados, utilize PROCV e localize o volume de cada um dos status abaixo.'],
    [],
    ['Status da Chamada', 'Volume'],
    ['DISPONIBILIDADE / CSO', ''],
    ['ERRO DE CADASTRO', ''],
    ['FAX', ''],
    ['INSATISFACAO COM A TELEFONICA', ''],
    ['JA FOI CONTATADO', ''],
    ['LIGACOES NAO COMPLETADAS', ''],
    ['MENSAGEM DE OPERADORA (TELEFONIA)', ''],
    ['MUDANCA DE ENDERECO', ''],
    ['NAO ATENDE', ''],
    ['NAO AUTORIZOU RET DO MULTILINK', ''],
    ['NAO CONCORDA C/ A PERMANENCIA MINIMA', ''],
    ['NAO OBTEVE TODAS AS INFORMACOES DE PROMOCAO', ''],
    ['NAO POSSUI COMPUTADOR', ''],
    ['NAO POSSUI CONFIGURACAO MINIMA DO PC', ''],
    ['NAO TEM INTERNET', ''],
    ['NECESSIDADE E BENEFICIO EM BANDA LARGA', ''],
  ]);
  XLSX.utils.book_append_sheet(workbook, q2, 'Q2.');

  const q3 = converterMatrizParaPlanilha([
    ['Questao 3.'],
    ['* Crie uma tabela com todos os DDD e a quantidade de chamadas que cada um recebeu.'],
    ['* Utilizando a tabela criada, insira um grafico em Pizza 3D.'],
    ['* Titulo: Controle de Ligacao por DDD.'],
    ['* Exibir rotulo em percentual na extremidade externa.'],
  ]);
  XLSX.utils.book_append_sheet(workbook, q3, 'Q3.');

  const q4 = converterMatrizParaPlanilha([
    ['Questao 4.'],
    ['Calcule a media da quantidade de clientes por zona.'],
    ['Calcule o percentual de cada zona de acordo com o total de clientes.'],
    ['Utilize SE / logica para identificar a situacao de cada zona.'],
    ['Insira formatacao condicional de acordo com a situacao.'],
    [],
    ['Zonas', 'Qtde de Clientes', 'Percentual', 'Situacao'],
    ['OESTE', 506, '', ''],
    ['CENTRO SUL', 365, '', ''],
    ['SUDESTE', 361, '', ''],
    ['NORDESTE', 293, '', ''],
    ['SUL', 267, '', ''],
    ['CENTRO', 258, '', ''],
    ['LESTE2', 169, '', ''],
    ['LESTE1', 115, '', ''],
    ['NOROESTE', 76, '', ''],
    ['Media', ''],
    ['', 2410],
  ]);
  XLSX.utils.book_append_sheet(workbook, q4, 'Q4.');

  const q5 = converterMatrizParaPlanilha([
    ['Questao 5.'],
    ['Utilizando PROCV localize as informacoes dos status de venda.'],
    ['Calcule a quantidade nao vendida, total de contatos, % de vendido e % nao vendido.'],
    [],
    [
      'OPERADOR',
      'VENDA ATENDENTE',
      'NAO ATENDE',
      'CLIENTE INDISPONIVEL',
      'OCUPADO',
      'FAX',
      'QTDE NAO VENDIDA',
      'TOTAL DE CONTATOS',
      '% DE VENDIDO',
      '% NAO VENDIDO',
    ],
    ['ADIEL PASSOS DOS SANTOS', '', '', '', '', '', '', '', '', ''],
    ['NOEMI SOARES DE SOUZA', '', '', '', '', '', '', '', '', ''],
    ['NORMA SUELI SANTOS', '', '', '', '', '', '', '', '', ''],
    ['NUBIA ROSA PEREIRA', '', '', '', '', '', '', '', '', ''],
    ['ALINE MACIEL BARROSO', '', '', '', '', '', '', '', '', ''],
    ['VANIA ELISABETE GOMES', '', '', '', '', '', '', '', '', ''],
    ['ROGERIO FIRMO DE ALMEIDA', '', '', '', '', '', '', '', '', ''],
    ['CINTIA FERREIRA DE OLIVEIRA SILVA', '', '', '', '', '', '', '', '', ''],
    ['TAIS HERMESDORFF RODRIGUES', '', '', '', '', '', '', '', '', ''],
    ['DAVID LEANDRO SILVA', '', '', '', '', '', '', '', '', ''],
    ['ELAINE CRISTINA RISSO NISHIMARU', '', '', '', '', '', '', '', '', ''],
    ['TATIANE APARECIDA DE PAULA', '', '', '', '', '', '', '', '', ''],
    ['PEDRO', '', '', '', '', '', '', '', '', ''],
  ]);
  XLSX.utils.book_append_sheet(workbook, q5, 'Q5.');

  await adicionarPlanilhasBase(workbook);
  return workbook;
}

async function montarPlanilhaAvancada(workbook) {
  const XLSX = obterBibliotecaXlsx();
  await montarPlanilhaPlanejamento(workbook);

  const q6 = converterMatrizParaPlanilha([
    ['Questao 6.'],
    [
      'Crie um grafico analitico com colunas para os indicadores gerais e linhas em eixo secundario para Nivel de Servico e % Aban.',
    ],
    [],
    ['', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Janeiro'],
    ['Chamadas Realizadas', 2350, 2597, 2778, 3058, 2371, 3243, 4061, 1861],
    ['Chamadas Recebidas', 5614, 5528, 5582, 5025, 5162, 5078, 4691, 5103],
    ['Chamadas Atendidas', 4636, 4974, 4873, 4448, 4319, 4024, 3648, 4922],
    ['Nivel Servico', 0.81, 0.89, 0.8583, 0.8675, 0.81, 0.75, 0.7401256661, 0.9592374289],
    ['% Aban', 0.1742073388, 0.1002170767, 0.1270154066, 0.1148258706, 0.163308795, 0.2075620323, 0.2223406523, 0.0121497158],
  ]);
  XLSX.utils.book_append_sheet(workbook, q6, 'Q6.');

  const q7 = converterMatrizParaPlanilha([
    ['Questao 7: some todos os valores apenas do Estado do RJ e informe o resultado na celula F10.'],
    [],
    ['ESTADO', 'VALORES'],
    ['RJ', 10],
    ['SP', 20],
    ['SP', 30],
    ['SP', 54],
    ['SP', 87],
    ['RJ', 45],
    ['RJ', 2],
    ['RJ', 3],
    ['RJ', 5],
    ['RJ', 98],
    ['SP', 7],
    ['RJ', 5],
  ]);
  XLSX.utils.book_append_sheet(workbook, q7, 'Q7.');

  return workbook;
}

export async function montarWorkbookDaTarefa(taskId, titulo) {
  const XLSX = obterBibliotecaXlsx();
  const workbook = XLSX.utils.book_new();

  if (taskId === 'basic_exam') return { workbook: montarPlanilhaBasica(workbook) };
  if (taskId === 'qualid_exam') return { workbook: await montarPlanilhaQualidade(workbook) };
  if (taskId === 'planning_exam') return { workbook: await montarPlanilhaPlanejamento(workbook) };
  if (taskId === 'advanced_exam') return { workbook: await montarPlanilhaAvancada(workbook) };

  const planilha = converterMatrizParaPlanilha([['Arquivo de prova'], [titulo]]);
  XLSX.utils.book_append_sheet(workbook, planilha, 'Questao');
  return { workbook };
}

function validarExameBasico(workbook, pontos) {
  const planilha = obterPlanilha(workbook, 'Teste de Excel');

  if (!planilha) {
    return criarResultadoChecklist(
      [
        { label: 'Coluna Subtotal criada e preenchida', done: false },
        { label: 'Valor Unitario e Subtotal em formato contabil', done: false },
        { label: 'Nova coluna com estilo visual aplicado', done: false },
        { label: 'Cores alteradas em A1 e na linha A2', done: false },
        { label: 'Filtro aplicado e ordenacao por maior valor unitario', done: false },
        { label: 'Linha de total criada com soma final', done: false },
      ],
      pontos,
      ["Aba 'Teste de Excel' nao encontrada."],
    );
  }

  const notas = [
    'Formatacao visual, cores e estilo devem ser revisados visualmente pelo RH.',
  ];

  function normalizarCabecalho(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[()]/g, '')
      .trim()
      .toUpperCase();
  }

  function obterInformacoesCabecalho() {
    const XLSX = obterBibliotecaXlsx();
    const faixa = XLSX.utils.decode_range(planilha['!ref'] || 'A1:Z50');

    for (let linha = faixa.s.r + 1; linha <= Math.min(faixa.e.r + 1, 20); linha += 1) {
      let colunaProduto = null;
      let colunaQuantidade = null;
      let colunaValor = null;
      let colunaSubtotal = null;

      for (let coluna = faixa.s.c; coluna <= faixa.e.c; coluna += 1) {
        const letraColuna = XLSX.utils.encode_col(coluna);
        const cabecalho = normalizarCabecalho(
          obterValorCelula(planilha, `${letraColuna}${linha}`),
        );

        if (cabecalho === 'PRODUTO') colunaProduto = letraColuna;
        if (cabecalho === 'QUANTIDADE') colunaQuantidade = letraColuna;
        if (
          cabecalho === 'VALOR UNITARIO R$' ||
          cabecalho === 'VALOR UNITARIO R' ||
          cabecalho === 'VALOR UNITARIO' ||
          cabecalho === 'VALOR R$' ||
          cabecalho === 'VALOR R'
        ) {
          colunaValor = letraColuna;
        }
        if (cabecalho === 'SUBTOTAL') colunaSubtotal = letraColuna;
      }

      if (colunaProduto && colunaQuantidade && colunaValor) {
        return {
          headerRow: linha,
          produtoCol: colunaProduto,
          quantidadeCol: colunaQuantidade,
          valorCol: colunaValor,
          subtotalCol: colunaSubtotal,
        };
      }
    }

    return null;
  }

  function linhaEstaOculta(numeroLinha) {
    return !!(
      planilha &&
      planilha['!rows'] &&
      planilha['!rows'][numeroLinha - 1] &&
      planilha['!rows'][numeroLinha - 1].hidden
    );
  }

  function obterLinhasDados(colunaProduto, linhaInicial, maximo = 100) {
    const linhas = [];

    for (let linha = linhaInicial; linha <= linhaInicial + maximo; linha += 1) {
      const valor = String(
        obterValorCelula(planilha, `${colunaProduto}${linha}`) || '',
      ).trim();
      if (!valor) break;
      linhas.push(linha);
    }

    return linhas;
  }

  const info = obterInformacoesCabecalho();
  if (!info) {
    return criarResultadoChecklist(
      [
        { label: 'Coluna Subtotal criada e preenchida', done: false },
        { label: 'Valor Unitario e Subtotal em formato contabil', done: false },
        { label: 'Nova coluna com estilo visual aplicado', done: false },
        { label: 'Cores alteradas em A1 e na linha A2', done: false },
        { label: 'Filtro aplicado e ordenacao por maior valor unitario', done: false },
        { label: 'Linha de total criada com soma final', done: false },
      ],
      pontos,
      [
        'Nao foi possivel localizar a estrutura principal da tabela na aba Teste de Excel.',
      ],
    );
  }

  const { headerRow, produtoCol, quantidadeCol, valorCol, subtotalCol } = info;
  const linhaInicial = headerRow + 1;
  const linhasDados = obterLinhasDados(produtoCol, linhaInicial, 100);
  const ultimaLinha = linhasDados.length
    ? linhasDados[linhasDados.length - 1]
    : linhaInicial;
  const linhaTotal = ultimaLinha + 1;

  const subtotalCriado =
    !!subtotalCol &&
    normalizarCabecalho(obterValorCelula(planilha, `${subtotalCol}${headerRow}`)) ===
      'SUBTOTAL';

  const subtotalPreenchido =
    subtotalCriado &&
    linhasDados.length > 0 &&
    linhasDados.filter((linha) => celulaTemDados(planilha, `${subtotalCol}${linha}`))
      .length >= Math.max(1, linhasDados.length - 1);

  const formatoContabil =
    !!subtotalCol &&
    linhasDados.some((linha) => {
      const valorCell = planilha[`${valorCol}${linha}`];
      const subtotalCell = planilha[`${subtotalCol}${linha}`];
      const formatoValor = String(
        valorCell?.z || valorCell?.w || valorCell?.s?.numFmt || '',
      ).toUpperCase();
      const formatoSubtotal = String(
        subtotalCell?.z || subtotalCell?.w || subtotalCell?.s?.numFmt || '',
      ).toUpperCase();

      return (
        /R\$|_-\*|[$]/.test(formatoValor) ||
        /R\$|_-\*|[$]/.test(formatoSubtotal) ||
        /\d,\d{2}/.test(String(valorCell?.w || '')) ||
        /\d,\d{2}/.test(String(subtotalCell?.w || ''))
      );
    });

  const estiloAplicado =
    !!subtotalCol &&
    linhasDados.some(
      (linha) => !!(planilha[`${valorCol}${linha}`] && planilha[`${subtotalCol}${linha}`]),
    );

  const corAlterada =
    !!planilha['A1'] ||
    !!planilha[`${produtoCol}${headerRow}`] ||
    !!planilha[`${quantidadeCol}${headerRow}`];

  let ordenadoDesc = false;
  if (planilhaTemAutofiltro(planilha)) {
    const linhasVisiveis = linhasDados.filter((linha) => !linhaEstaOculta(linha));
    const linhasReferencia = linhasVisiveis.length ? linhasVisiveis : linhasDados;
    const valores = linhasReferencia
      .map((linha) => {
        const bruto = obterValorCelula(planilha, `${valorCol}${linha}`);
        const numero = Number(
          String(bruto).replace(/[^\d,.-]/g, '').replace(',', '.'),
        );
        return Number.isNaN(numero) ? null : numero;
      })
      .filter((numero) => numero !== null);

    if (valores.length >= 2) {
      ordenadoDesc = valores.every(
        (valor, indice) => indice === 0 || valores[indice - 1] >= valor,
      );
    } else {
      ordenadoDesc = true;
    }
  }

  const rotuloTotal = textoMaiusculoSeguro(
    obterValorCelula(planilha, `${produtoCol}${linhaTotal}`),
  ).includes('TOTAL');
  const totalQuantidade = celulaTemDados(planilha, `${quantidadeCol}${linhaTotal}`);
  const totalValor = celulaTemDados(planilha, `${subtotalCol || valorCol}${linhaTotal}`);

  return criarResultadoChecklist(
    [
      { label: 'Coluna Subtotal criada e preenchida', done: subtotalCriado && subtotalPreenchido },
      { label: 'Valor Unitario e Subtotal em formato contabil', done: formatoContabil },
      { label: 'Nova coluna com estilo visual aplicado', done: estiloAplicado },
      { label: 'Cores alteradas em A1 e na linha A2', done: corAlterada },
      {
        label: 'Filtro aplicado e ordenacao por maior valor unitario',
        done: planilhaTemAutofiltro(planilha) && ordenadoDesc,
      },
      { label: 'Linha de total criada com soma final', done: rotuloTotal && (totalQuantidade || totalValor) },
    ],
    pontos,
    notas,
  );
}

function validarExameQualidade(workbook, pontos) {
  const tarefas = [];
  const notas = [
    'Itens visuais, grafico e alguns posicionamentos podem precisar de revisao manual do RH.',
  ];

  const planilhaA = obterPlanilha(workbook, 'Planilha A');
  const procv = obterPlanilha(workbook, 'PROCV');
  const tabdin = obterPlanilha(workbook, 'TAB_DIN');
  const copiarColar = obterPlanilha(workbook, 'Copiar_Colar');
  const grafico = obterPlanilha(workbook, 'Grafico') || obterPlanilha(workbook, 'Gráfico');

  const operadoresOrdenados = coletarValoresAteLinhaVazia(planilhaA, 'A', 3).filter(
    (valor) => !textoMaiusculoSeguro(valor).includes('OPERADOR'),
  );
  const estaOrdenado =
    operadoresOrdenados.length > 1
      ? operadoresOrdenados.every(
          (valor, indice) =>
            indice === 0 ||
            textoMaiusculoSeguro(operadoresOrdenados[indice - 1]) <=
              textoMaiusculoSeguro(valor),
        )
      : false;

  tarefas.push({ label: 'Planilha A em ordem alfabetica por Operador', done: estaOrdenado });

  const cabecalhoValorTotal =
    textoMaiusculoSeguro(obterValorCelula(planilhaA, 'F2')) === 'VALOR TOTAL';
  const valorTotalCalculado = ['F3', 'F4', 'F5', 'F6', 'F7', 'F8'].some((endereco) =>
    celulaTemDados(planilhaA, endereco),
  );
  tarefas.push({ label: 'Coluna F com titulo Valor Total', done: cabecalhoValorTotal });
  tarefas.push({ label: 'Valor Total = Valor (R$) x Quantidade', done: valorTotalCalculado });

  const resultadosProcv = ['C2', 'C3', 'C4', 'C5', 'C6', 'C7'].filter((endereco) =>
    celulaTemDados(procv, endereco),
  ).length;
  tarefas.push({ label: 'PROCV preenchido na aba PROCV', done: resultadosProcv >= 4 });

  const listaNaoEncontrados =
    celulaTemDados(procv, 'BC255') ||
    celulaTemDados(procv, 'BD255') ||
    celulaTemDados(procv, 'BC256');
  tarefas.push({
    label: 'Operadores nao encontrados listados a partir de BC255',
    done: listaNaoEncontrados,
  });

  const resumoTabDin =
    celulaTemDados(tabdin, 'A5') ||
    celulaTemDados(tabdin, 'B5') ||
    celulaTemDados(tabdin, 'C5') ||
    celulaTemDados(tabdin, 'D5');
  tarefas.push({ label: 'Resumo do supervisor Lula criado na aba TAB_DIN', done: resumoTabDin });

  const tabelaCopiada =
    celulaTemDados(copiarColar, 'A5') &&
    celulaTemDados(copiarColar, 'B5') &&
    planilhaTemAutofiltro(copiarColar);
  tarefas.push({ label: 'Tabela copiada e filtrada para Wesley Nunes', done: tabelaCopiada });

  const possuiGrafico =
    celulaTemDados(grafico, 'A2') &&
    celulaTemDados(grafico, 'D2') &&
    (grafico['!images'] || grafico['!drawings'] || grafico['!charts']);
  tarefas.push({
    label: 'Grafico de colunas agrupadas criado com supervisores e marco',
    done: !!possuiGrafico,
  });

  return criarResultadoChecklist(tarefas, pontos, notas);
}

function validarExamePlanejamento(workbook, pontos) {
  const tarefas = [];
  const notas = [
    'Graficos, formatacao condicional e parte visual devem ser validados manualmente pelo RH.',
  ];

  const q1 = obterPlanilha(workbook, 'Q1.');
  const q2 = obterPlanilha(workbook, 'Q2.');
  const q3 = obterPlanilha(workbook, 'Q3.');
  const q4 = obterPlanilha(workbook, 'Q4.');
  const q5 = obterPlanilha(workbook, 'Q5.');

  const q1Pronto = ['B6', 'B7', 'B8', 'B9', 'B10'].filter((endereco) => celulaTemDados(q1, endereco)).length >= 3;
  tarefas.push({ label: 'CONT.SE preenchido por cidade e ordenado', done: q1Pronto });

  const q2Pronto = ['B4', 'B5', 'B6', 'B7', 'B8'].filter((endereco) => celulaTemDados(q2, endereco)).length >= 3;
  tarefas.push({ label: 'PROCV preenchido na aba Q2.', done: q2Pronto });

  const q3Pronto =
    celulaTemDados(q3, 'A5') ||
    celulaTemDados(q3, 'B5') ||
    q3['!images'] ||
    q3['!drawings'] ||
    q3['!charts'];
  tarefas.push({ label: 'Tabela por DDD e grafico Pizza 3D', done: !!q3Pronto });

  const q4Pronto = ['C7', 'C8', 'C9', 'D7', 'D8', 'D9'].filter((endereco) => celulaTemDados(q4, endereco)).length >= 4;
  tarefas.push({ label: 'Percentual e situacao por zona', done: q4Pronto });

  const q5Pronto = ['G5', 'H5', 'I5', 'J5', 'G6', 'H6', 'I6', 'J6'].filter((endereco) => celulaTemDados(q5, endereco)).length >= 4;
  tarefas.push({
    label: 'Analise de vendas preenchida com totais e percentuais',
    done: q5Pronto,
  });

  return criarResultadoChecklist(tarefas, pontos, notas);
}

function validarExameAvancado(workbook, pontos) {
  const base = validarExamePlanejamento(workbook, pontos);
  const tarefas = base.completedTasks.map((item) => ({
    label: item.replace(/^\[(x| )\]\s*/, ''),
    done: item.startsWith('[x]'),
  }));
  const notas = Array.isArray(base.notes) ? [...base.notes] : [];

  const q6 = obterPlanilha(workbook, 'Q6.');
  const q7 = obterPlanilha(workbook, 'Q7.');

  tarefas.push({
    label: 'Grafico combinado com eixo secundario',
    done: !!(q6 && (q6['!images'] || q6['!drawings'] || q6['!charts'])),
  });
  tarefas.push({ label: 'Soma do RJ em F10', done: celulaTemDados(q7, 'F10') });

  return criarResultadoChecklist(tarefas, pontos, notas);
}

export function validarWorkbookPorTarefa(taskId, workbook, pontos) {
  if (taskId === 'basic_exam') return validarExameBasico(workbook, pontos);
  if (taskId === 'qualid_exam') return validarExameQualidade(workbook, pontos);
  if (taskId === 'planning_exam') return validarExamePlanejamento(workbook, pontos);
  if (taskId === 'advanced_exam') return validarExameAvancado(workbook, pontos);

  return criarResultadoPontuacao(0, pontos, ['Validacao nao implementada.'], true);
}

export async function validarArquivoExcel(taskId, arquivo, pontos) {
  const XLSX = obterBibliotecaXlsx();
  const arrayBuffer = await arquivo.arrayBuffer();
  const dados = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(dados, {
    type: 'array',
    cellFormula: true,
    cellStyles: true,
    cellNF: true,
    cellHTML: false,
  });
  const validation = validarWorkbookPorTarefa(taskId, workbook, pontos);
  const resumoChecklist = resumirConclusaoChecklist(validation.completedTasks);
  const validacaoImplementada = possuiValidacaoExcelImplementada(validation);
  const statusText = validacaoImplementada
    ? `Arquivo analisado com sucesso. ${resumoChecklist.concluidas}/${resumoChecklist.total} tarefa(s) detectada(s).`
    : 'Arquivo recebido, mas esta etapa ainda nao possui validacao automatica completa.';

  return {
    type: 'excel_external',
    uploaded: true,
    filename: arquivo.name,
    validation,
    statusText,
    statusClass: validacaoImplementada ? 'excel-status-ok' : 'excel-status-warn',
    uploadedArrayBuffer: arrayBuffer,
  };
}

export function validarEntregaObrigatoriaDaProva({ questoes, respostas }) {
  const listaQuestoes = Array.isArray(questoes) ? questoes : [];
  const listaRespostas = Array.isArray(respostas) ? respostas : [];

  for (let indice = 0; indice < listaQuestoes.length; indice += 1) {
    const questao = listaQuestoes[indice];
    if (questao?.type !== 'excel_external') continue;

    const resposta = listaRespostas[indice];
    if (!resposta?.uploaded || !resposta?.validation || !resposta?.uploadedArrayBuffer) {
      return {
        ok: false,
        tipo: 'excel_nao_enviado',
        indice,
        mensagem: `Envie o arquivo Excel da etapa "${questao.stage || questao.title || 'Excel'}" antes de finalizar a prova.`,
      };
    }

    if (!possuiValidacaoExcelImplementada(resposta.validation)) {
      return {
        ok: false,
        tipo: 'excel_sem_validacao',
        indice,
        mensagem: `A etapa "${questao.stage || questao.title || 'Excel'}" ainda nao conseguiu ser analisada automaticamente. Envie novamente o arquivo ou valide o checklist configurado.`,
      };
    }
  }

  return { ok: true };
}

export function formatarDocumentoRichText(comando) {
  document.execCommand(comando, false, null);
}

export function obterDescricaoMacroEtapa(stageKey, candidato = {}) {
  const role = String(candidato?.role || '').trim();
  const track = String(candidato?.track || '').trim();
  const roleUpper = textoMaiusculoSeguro(role);
  const trackUpper = textoMaiusculoSeguro(track);

  const mapaBase = {
    word_basic:
      'Será avaliado formatação de texto, organização visual do conteúdo, digitação, interpretação escrita e nível de escrita do candidato.',
    word_intermediate:
      'Será avaliado formatação de texto, estruturação de conteúdo, clareza na escrita, organização de informações e domínio intermediário de edição de documentos.',
    word_advanced:
      'Será avaliado domínio avançado de edição de documentos, padronização visual, construção textual, coesão da escrita e aplicação de recursos de formatação.',
    excel_basic:
      'Será avaliado cálculos básicos, preenchimento de planilhas, organização de dados, formatação de tabelas e interpretação de informações.',
    excel_intermediate:
      'Será avaliado cálculos intermediários, organização e análise de dados, formatação de tabelas, uso de fórmulas e raciocínio em planilhas.',
    excel_advanced:
      'Será avaliado cálculos avançados, análise de dados, construção de tabelas, lógica em planilhas, fórmulas, gráficos e recursos avançados como PROCV.',
    excel_operational:
      'Será avaliado cálculos operacionais, organização de planilhas, controle de dados, formatação de tabelas e aplicação prática de fórmulas no contexto da operação.',
    excel_planning:
      'Será avaliado raciocínio analítico, cálculos em planilhas, organização de bases, construção de tabelas, gráficos, indicadores e uso de PROCV.',
    excel_quality:
      'Será avaliado manipulação de planilhas, cálculos, organização de dados, filtros, formatação de tabelas e uso de PROCV em contexto de controle de qualidade.',
    logic:
      'Será avaliado raciocínio lógico, interpretação de cenários, tomada de decisão e capacidade analítica.',
    technical_support:
      'Será avaliado conhecimento técnico, interpretação de incidentes, raciocínio de suporte, análise de causa e tomada de decisão em cenários práticos.',
    customer_service:
      'Será avaliado comunicação, interpretação de atendimento, postura profissional, clareza de resposta e raciocínio aplicado ao contexto operacional.',
    general_knowledge:
      'Será avaliado conhecimentos gerais, interpretação textual, atenção, raciocínio e repertório básico profissional.',
    adm:
      'Será avaliado organização, interpretação de informações, raciocínio administrativo, controles operacionais e análise de dados.',
    rh:
      'Será avaliado interpretação de cenário, organização de informações, escrita profissional, raciocínio analítico e conhecimentos aplicados à rotina de RH.',
  };

  if (
    roleUpper.includes('JOVEM APRENDIZ') ||
    roleUpper.includes('OPERADOR') ||
    roleUpper.includes('ESTAGIÁRIO')
  ) {
    if (stageKey.includes('word')) {
      return 'Será avaliado formatação de texto, digitação, organização do conteúdo, compreensão escrita e nível de escrita do candidato.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado cálculos, preenchimento de planilhas, formatação de tabelas, organização de dados e uso de fórmulas básicas e intermediárias, incluindo PROCV quando aplicável.';
    }
  }

  if (
    roleUpper.includes('SUPERVISOR') ||
    roleUpper.includes('CONTROL DESK') ||
    roleUpper.includes('PLANEJAMENTO')
  ) {
    if (stageKey.includes('word')) {
      return 'Será avaliado escrita profissional, clareza textual, organização de informações, estruturação de conteúdo e domínio de formatação de documentos.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado cálculos, análise de indicadores, construção e formatação de tabelas, organização de bases, gráficos e uso de fórmulas como PROCV.';
    }
  }

  if (
    roleUpper.includes('TI') ||
    roleUpper.includes('ANALISTA') ||
    trackUpper === 'TI'
  ) {
    if (stageKey.includes('word')) {
      return 'Será avaliado clareza técnica na escrita, organização de conteúdo, padronização textual, interpretação e estruturação de respostas profissionais.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado análise de dados, cálculos, organização de planilhas, formatação de tabelas, cruzamento de informações e uso de fórmulas como PROCV.';
    }
    if (stageKey.includes('technical')) {
      return 'Será avaliado raciocínio técnico, interpretação de problemas, análise de cenário, lógica de suporte e tomada de decisão.';
    }
  }

  if (trackUpper === 'RH') {
    if (stageKey.includes('word')) {
      return 'Será avaliado escrita corporativa, clareza textual, organização de informações e formatação de documentos.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado cálculos, organização de planilhas, controle de dados, formatação de tabelas e uso de fórmulas aplicadas à rotina administrativa.';
    }
  }

  if (trackUpper === 'ADM') {
    if (stageKey.includes('word')) {
      return 'Será avaliado escrita profissional, clareza, estruturação do conteúdo e padronização de documentos.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado cálculos, organização de dados, formatação de tabelas, análise de informações e uso de fórmulas como PROCV.';
    }
  }

  return (
    mapaBase[stageKey] ||
    'Será avaliado conhecimento prático da etapa, interpretação, organização de informações e domínio dos recursos exigidos para a vaga.'
  );
}

export function montarResumoRegrasDoCandidato(blueprint, candidato) {
  if (!blueprint?.stages?.length) return [];

  return blueprint.stages.map((stage) => ({
    key: stage.key,
    label: ROTULOS_ETAPAS[stage.key] || 'Etapa',
    description: obterDescricaoMacroEtapa(stage.key, candidato),
  }));
}

export function obterTextoGabaritoQuestao(questao) {
  if (questao.type === 'multiple') {
    const indiceEsperado =
      questao?.answer !== undefined && questao?.answer !== null
        ? questao.answer
        : questao?.correctIndex;

    if (
      indiceEsperado !== undefined &&
      indiceEsperado !== null &&
      Array.isArray(questao.options)
    ) {
      return (
        questao.options[indiceEsperado] ||
        'Alternativa correta definida no sistema.'
      );
    }

    return 'Alternativa correta definida no sistema.';
  }

  if (questao.type === 'word') {
    const criterios = [];
    if (questao.expected?.titleText)
      criterios.push(`Título esperado: ${questao.expected.titleText}`);
    if (questao.expected?.titleBold) criterios.push('Título em negrito');
    if (questao.expected?.titleCenter) criterios.push('Título centralizado');
    if (questao.expected?.minTextLength)
      criterios.push(
        `Texto com no mínimo ${questao.expected.minTextLength} caracteres`,
      );
    if (questao.expected?.minSentences)
      criterios.push(`Texto com pelo menos ${questao.expected.minSentences} frases`);
    if (questao.expected?.requiresList) criterios.push('Uso de lista');
    if (questao.expected?.minListItems)
      criterios.push(`Lista com ao menos ${questao.expected.minListItems} itens`);
    if (questao.expected?.anyBold) criterios.push('Uso de negrito no conteúdo');

    return criterios.length
      ? criterios.join(' | ')
      : 'Critérios práticos definidos no sistema.';
  }

  if (questao.type === 'excel_external') {
    const gabarito = obterGabaritoDaTarefa(questao.taskId);
    return gabarito.length ? gabarito.join(' | ') : 'Checklist prático do Excel.';
  }

  return '';
}

export function obterTextoRespostaCandidato(questao, resposta) {
  if (!resposta) return 'Sem resposta.';
  if (questao.type === 'multiple') {
    return resposta.selected === null || resposta.selected === undefined
      ? 'Sem resposta.'
      : questao.options?.[resposta.selected] ?? `Opção ${resposta.selected}`;
  }
  if (questao.type === 'word') {
    return removerHtml(resposta.content || '') || 'Sem resposta.';
  }
  if (questao.type === 'excel_external') {
    const partes = [
      resposta.filename
        ? `Arquivo enviado: ${resposta.filename}`
        : 'Arquivo não enviado.',
    ];
    if (resposta.validation?.completedTasks?.length) {
      partes.push(
        `Itens detectados: ${resposta.validation.completedTasks.join('; ')}`,
      );
    }
    if (resposta.validation?.notes?.length) {
      partes.push(`Observações: ${resposta.validation.notes.join('; ')}`);
    }
    return partes.join(' | ');
  }
  return 'Sem resposta.';
}

export function finalizarProva({ questoes, respostas, blueprint }) {
  const resultados = [];
  let totalScore = 0;
  let totalMax = 0;

  questoes.forEach((questao, indice) => {
    const resposta = respostas[indice];
    let resultado;

    if (questao.type === 'word') {
      const score = avaliarRespostaTexto(resposta, questao.expected, questao.points);
      resultado = criarResultadoPontuacao(score, questao.points, [], false);
    } else if (questao.type === 'multiple') {
      const score = avaliarRespostaMultiplaEscolha(resposta, questao, questao.points);
      resultado = criarResultadoPontuacao(score, questao.points, [], false);
    } else if (questao.type === 'excel_external') {
      if (!resposta || !resposta.uploaded || !resposta.validation) {
        resultado = criarResultadoPontuacao(
          0,
          questao.points,
          ['Arquivo não enviado ou inválido.'],
          true,
          [],
        );
      } else {
        resultado = {
          score: resposta.validation.score,
          max: resposta.validation.max,
          notes: resposta.validation.notes || [],
          pendingManual: !!resposta.validation.pendingManual,
          completedTasks: resposta.validation.completedTasks || [],
        };
      }
    } else {
      resultado = criarResultadoPontuacao(
        0,
        questao.points,
        ['Tipo de questão não suportado.'],
      );
    }

    resultados.push(resultado);
    totalScore += resultado.score;
    totalMax += resultado.max;
  });

  const agrupado = {};

  questoes.forEach((questao, indice) => {
    const stageKey = questao.stageKey || 'geral';
    if (!agrupado[stageKey]) {
      const configEtapa = blueprint?.stages?.find((stage) => stage.key === stageKey);
      agrupado[stageKey] = {
        key: stageKey,
        label: ROTULOS_ETAPAS[stageKey] || questao.stage || 'Etapa',
        weight: configEtapa?.weight || 0,
        rawScore: 0,
        rawMax: 0,
        questionCount: 0,
        pendings: 0,
      };
    }

    agrupado[stageKey].rawScore += resultados[indice].score;
    agrupado[stageKey].rawMax += resultados[indice].max;
    agrupado[stageKey].questionCount += 1;
    if (resultados[indice].pendingManual) agrupado[stageKey].pendings += 1;
  });

  const resumoEtapas = Object.values(agrupado).map((etapa) => {
    const percent = etapa.rawMax ? etapa.rawScore / etapa.rawMax : 0;
    const weightedScore = percent * 10;

    return {
      ...etapa,
      percent,
      weightedScore,
    };
  });

  const notaFinalPonderada =
    resumoEtapas.length > 0
      ? resumoEtapas.reduce((soma, etapa) => {
          const scoreEtapa = etapa.rawMax ? (etapa.rawScore / etapa.rawMax) * 10 : 0;
          return soma + scoreEtapa;
        }, 0) / resumoEtapas.length
      : 0;

  const pendenciasManuais = questoes
    .map((questao, indice) => ({
      q: questao,
      idx: indice,
      result: resultados[indice],
      answer: respostas[indice],
      title: questao.title,
      notes: resultados[indice].notes || [],
      completedTasks: resultados[indice].completedTasks || [],
      answerKey:
        questao.type === 'excel_external'
          ? obterGabaritoDaTarefa(questao.taskId)
          : [],
    }))
    .filter((item) => item.result.pendingManual);

  return {
    resultados,
    totalScore,
    totalMax,
    resumoEtapas,
    notaFinalPonderada,
    pendenciasManuais,
  };
}

export function converterArrayBufferParaBase64(buffer) {
  if (!buffer) return '';

  let binario = '';
  const bytes = new Uint8Array(buffer);
  const tamanhoBloco = 0x8000;

  for (let indice = 0; indice < bytes.length; indice += tamanhoBloco) {
    const bloco = bytes.subarray(indice, indice + tamanhoBloco);
    binario += String.fromCharCode(...bloco);
  }

  return btoa(binario);
}

export function converterBase64ParaUint8Array(base64) {
  if (!base64) return null;
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);

  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }

  return bytes;
}

export function montarTextoCompletoDoGabarito({
  candidato,
  questoes,
  respostas,
  resultados,
  notaFinalPonderada,
  observacaoRh,
}) {
  const linhas = [
    `Candidato: ${candidato?.name || ''}`,
    `Perfil: ${candidato?.role || ''}`,
    `Nível: ${candidato?.level || ''}`,
    `Nota final: ${notaFinalPonderada?.toFixed ? notaFinalPonderada.toFixed(2) : '0.00'}`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    `Observações do RH: ${(observacaoRh || '').trim() || 'Nenhuma observação registrada.'}`,
    '',
    '=== GABARITO COMPLETO ===',
  ];

  questoes.forEach((questao, indice) => {
    const resposta = respostas[indice];
    const resultado = resultados[indice];

    linhas.push(`Questão ${indice + 1}`);
    linhas.push(`Etapa: ${questao.stage}`);
    linhas.push(`Título: ${questao.title}`);
    linhas.push(`Enunciado: ${questao.description}`);
    linhas.push(`Gabarito / critério: ${obterTextoGabaritoQuestao(questao)}`);
    linhas.push(`Resposta do candidato: ${obterTextoRespostaCandidato(questao, resposta)}`);
    if (resultado) linhas.push(`Pontuação obtida: ${resultado.score}/${resultado.max}`);
    linhas.push('');
  });

  return linhas.join('\n');
}

export function montarResumoHistoricoDaProva({
  questoes,
  respostas,
  totalScore,
  totalMax,
}) {
  const partes = [`Pontuacao bruta: ${totalScore}/${totalMax}`];

  (Array.isArray(questoes) ? questoes : []).forEach((questao, indice) => {
    if (questao?.type !== 'excel_external') return;

    const resposta = Array.isArray(respostas) ? respostas[indice] : null;
    if (!resposta?.uploaded || !resposta?.validation) {
      partes.push(`${questao.stage || 'Excel'}: arquivo nao enviado.`);
      return;
    }

    const resumo = resumirConclusaoChecklist(resposta.validation.completedTasks);
    partes.push(
      `${questao.stage || 'Excel'}: ${resumo.concluidas}/${resumo.total} tarefa(s) detectada(s) em ${resposta.filename || 'arquivo enviado'}.`,
    );

    if (resposta.validation.completedTasks?.length) {
      partes.push(
        resposta.validation.completedTasks.slice(0, 4).join(" ; "),
      );
    }
  });

  return partes.join(' | ');
}

export function montarPayloadGabarito({
  idResultado,
  candidato,
  blueprint,
  resumoEtapas,
  totalScore,
  totalMax,
  notaFinalPonderada,
  observacaoRh,
  questoes,
  respostas,
  resultados,
}) {
  const arquivosEnviados = questoes
    .map((questao, indice) => {
      const resposta = respostas[indice];
      if (
        questao.type !== 'excel_external' ||
        !resposta?.uploadedArrayBuffer ||
        !resposta?.filename
      ) {
        return null;
      }

      return {
        questionIndex: indice,
        taskId: questao.taskId || '',
        filename: resposta.filename,
        contentBase64: converterArrayBufferParaBase64(resposta.uploadedArrayBuffer),
      };
    })
    .filter(Boolean);

  return {
    id_teste: idResultado,
    candidate: candidato,
    blueprint,
    stageSummary: resumoEtapas,
    totalScore,
    totalMax,
    weightedFinalScore: notaFinalPonderada,
    rhObservation: observacaoRh || '',
    generatedAt: new Date().toISOString(),
    textContent: montarTextoCompletoDoGabarito({
      candidato,
      questoes,
      respostas,
      resultados,
      notaFinalPonderada,
      observacaoRh,
    }),
    uploadedFiles: arquivosEnviados,
  };
}

export async function baixarPacoteDaProva({
  candidato,
  questoes,
  respostas,
  resultados,
  notaFinalPonderada,
  observacaoRh,
}) {
  if (!window.JSZip) {
    throw new Error('A biblioteca JSZip não foi carregada.');
  }

  const nomeBase = sanitizarNomeArquivo(
    `${candidato?.name || 'candidato'}_${candidato?.role || 'prova'}`,
  );

  const zip = new window.JSZip();
  zip.file(
    `gabarito_${nomeBase}.txt`,
    montarTextoCompletoDoGabarito({
      candidato,
      questoes,
      respostas,
      resultados,
      notaFinalPonderada,
      observacaoRh,
    }),
  );

  for (let indice = 0; indice < questoes.length; indice += 1) {
    const questao = questoes[indice];
    const resposta = respostas[indice];

    if (
      questao.type === 'excel_external' &&
      resposta?.uploadedArrayBuffer &&
      resposta?.filename
    ) {
      zip.file(
        `excel_respondido_${sanitizarNomeArquivo(resposta.filename)}`,
        resposta.uploadedArrayBuffer,
      );
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  baixarBlob(`prova_${nomeBase}.zip`, blob);
}
