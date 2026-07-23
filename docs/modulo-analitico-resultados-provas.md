# Módulo analítico de correção e resultados

## Objetivo e limites

Este módulo adiciona uma leitura analítica ao Conecta Provas sem substituir, recalcular ou reinterpretar a correção oficial. A fonte soberana continua sendo `dbo.resultados_provas`; `pontuacao_final`, `scores_conecta`, os fluxos de processo/candidato e a tela atual **Provas e Resultados** permanecem com a semântica anterior.

A nova leitura serve como apoio explicável ao RH. Score analítico, percentil, ranking, aderência, indicadores de execução e alertas são persistidos em tabelas próprias, versionados e sempre condicionados a completude e comparabilidade.

## Arquitetura

1. A jornada pública envia telemetria mínima somente nos salvamentos já existentes e no início/conclusão da etapa.
2. A finalização e a avaliação manual confirmam primeiro a operação oficial.
3. Um job idempotente é incluído em `dbo.analise_jobs_provas`. Falhas analíticas não revertem a correção oficial.
4. O worker reserva jobs com `UPDLOCK`, `READPAST` e `ROWLOCK`, fecha a reserva e serializa a consolidação por processo com `sp_getapplock`.
5. Até 20 jobs prontos do mesmo processo são coalescidos; o processamento deriva métricas complementares, cria o resultado por categoria e atualiza ranking/read model uma única vez no lote.
6. A transação de consolidação preserva a versão anterior válida em caso de falha e armazena snapshot antes de uma substituição bem-sucedida.
7. A API do RH consulta apenas o read model; o detalhe não retorna redação/texto livre bruto, arquivo Excel, base64 ou conteúdo da área de transferência. Em objetivas, retorna somente seleção, gabarito e metadados necessários à explicação, sob RBAC interno.

Objetos novos:

- `categorias_analiticas`: catálogo central de categorias;
- `configuracoes_analiticas_processos`: configuração ativa e histórico de versões;
- `mapeamentos_categorias_analiticas`: associação versionada de etapas às categorias;
- `pesos_analiticos_processos`: pesos 0–1, sem redistribuição silenciosa;
- `perfis_ideais_analiticos`: perfil opcional por categoria;
- `analise_sessoes_etapas`: início/fim/status por etapa;
- `analise_metricas_respostas`: tempo ativo estimado, alterações, ordem, tamanho final e evento de colagem;
- `analise_excel_detalhes` e `analise_texto_detalhes`: evidências derivadas sem conteúdo bruto;
- `analise_jobs_provas`: fila persistente, tentativas e backoff;
- `resultados_analiticos_categorias`: nota oficial normalizada e estatísticas de coorte;
- `resultados_analiticos_processos`: leitura consolidada da tela.
- `historico_resultados_analiticos`: snapshots imutáveis anteriores do read model;
- `historico_correcoes_manuais_provas`: valores oficiais anteriores/novos e responsável, sem duplicar respostas.

## Contrato dos indicadores

### Comparabilidade

A assinatura SHA-256 usa somente o contrato da avaliação: IDs/tipos/pontos/categorias das questões, etapas, pesos oficiais e versões explícitas de configuração/gabarito. Uma categoria só entra na coorte quando o resultado oficial está completo, a prova não está reaberta/cancelada/expirada e a assinatura coincide.

Quando o contrato oficial não possui versão explícita de gabarito, o módulo grava literalmente `legado`; não cria uma versão histórica artificial. A versão aparece no job, resultado por categoria, read model e detalhes complementares.

### Percentil, z-score e ranking

- Percentil usa midrank dentro do mesmo processo, categoria e assinatura.
- Uma única observação produz percentil `NULL`.
- Empates recebem o mesmo percentil; se todos os valores forem iguais, todos recebem 50.
- Z-score é `NULL` quando a amostra tem uma observação ou desvio-padrão zero.
- Ranking é denso e decrescente. Empates compartilham posição; dado pessoal e tempo nunca desempatem.
- Coortes com menos de cinco candidatos são marcadas como amostra pequena. O limiar está centralizado e exposto pela API de status.

### Score analítico

`score = Σ(peso_categoria × percentil_categoria)`

O score só existe quando os pesos ativos totalizam exatamente 100%, todas as categorias obrigatórias estão completas e todos os percentis necessários existem. Ausência nunca vira zero e pesos nunca são redistribuídos automaticamente.

### Aderência ao perfil ideal

Aderência só é calculada quando o processo possui perfil ideal configurado:

`100 × (1 - min(1, sqrt(Σ(peso × ((resultado - ideal) / 100)²))))`

Sem perfil, o valor permanece `NULL` e a interface mostra **Não configurada**.

### Execução e alertas

As faixas centralizadas são 30/70 para percentis de desempenho e tempo, com faixa intermediária entre elas. Etapa interrompida segue a nota oficial zero, é considerada realizada e nunca recebe rótulo de velocidade. Alertas usam linguagem descritiva e não acusatória. Um evento de colagem, isoladamente, não indica irregularidade.

### Texto e Excel

- Texto: caracteres, palavras, palavras únicas, sentenças, parágrafos, média por sentença, riqueza lexical e proxy local de legibilidade. Ortografia fica explicitamente `Indisponivel`; não há chamada externa nem inferência de personalidade.
- Excel: itens/status/pontuação/confiança já produzidos pela validação oficial do arquivo. Quando a validação atual fornece os dados, o módulo persiste célula, valor esperado/obtido, fórmula encontrada, método, tolerância e justificativa, todos limitados em tamanho. Arquivo, base64, macro e planilha bruta não são copiados.

## Privacidade e segurança

- Não existem chamadas por tecla.
- A telemetria viaja apenas nos salvamentos existentes e em eventos de etapa.
- O evento `paste` incrementa uma contagem; o frontend não chama `clipboardData.getData`.
- A API pública ignora campos extras, e o schema não possui campo de conteúdo de clipboard.
- Lista, status, configuração, detalhe e comparação exigem autenticação.
- Leitura exige `provas.visualizar`; alteração de categorias, pesos ou perfil exige `provas.configurar_pesos`.
- Consultas e alterações relevantes são registradas em `logs_auditoria`.
- Ordenação usa whitelist e paginação no banco. Não existe interpolação de filtros do usuário em colunas SQL.

## API

Base: `/processes/{process_id}/analytical-results`

- `GET /`: lista paginada com busca, status, etapa, categoria, flag, faixas de score/aderência, pendência, comparabilidade, correção manual, ordenação e direção;
- `GET /status`: contagens de resultados/jobs, versão e limiares;
- `GET /configuration`: categorias, pesos e perfil ativos;
- `GET /candidates/{candidate_id}`: detalhe sem respostas brutas;
- `GET /compare?candidate_ids=A&candidate_ids=B`: comparação de 2 a 3 candidatos;
- `PUT /weights`: cria nova versão de pesos;
- `PUT /categories`: cria nova versão dos mapeamentos de etapas para categorias;
- `PUT /ideal-profile`: cria nova versão do perfil ideal.

Telemetria pública aditiva:

- `POST /conecta-provas-api/iniciar-etapa`;
- os requests já existentes de respostas/conclusão/interrupção/revisão/finalização aceitam `telemetria`, timestamps de etapa e tempo ativo estimado.

## Migração e rollout

Pré-requisitos:

1. validar backup e janela conforme `docs/operacao/backup-restore.md`;
2. confirmar que V001–V004 já foram aplicadas;
3. executar `infra/sql/migrations/V005__exam_analytical_results.sql` com usuário de migração;
4. implantar backend/frontend;
5. iniciar um worker único e depois escalar conforme a fila;
6. executar backfill em lotes controlados;
7. liberar a tela por processo e acompanhar fila/erros.

Validação de um job:

```powershell
.\.venv\Scripts\python.exe tools\processar_resultados_analiticos.py --once
```

Worker contínuo:

```powershell
.\.venv\Scripts\python.exe tools\processar_resultados_analiticos.py --poll-seconds 5
```

Backfill incremental (somente dados oficiais já armazenados; nenhuma telemetria histórica é inventada):

```powershell
.\.venv\Scripts\python.exe tools\processar_resultados_analiticos.py --backfill --process-id "PROCESSO_OU_REF" --batch-size 500
```

Sem `--process-id`, o comando percorre processos em lotes. Jobs já enfileirados por backfill são ignorados de forma idempotente. Use `--once` junto com `--backfill` para validar apenas o primeiro job antes de iniciar o worker contínuo.

Reabrir de forma explícita e limitada jobs que esgotaram tentativas (preserva a mesma chave idempotente e o histórico da linha):

```powershell
.\.venv\Scripts\python.exe tools\processar_resultados_analiticos.py --retry-failed --process-id "PROCESSO_OU_REF" --batch-size 100 --once
```

## Observabilidade e suporte

```sql
SELECT status_job, COUNT(*) AS total, MIN(disponivel_em) AS mais_antigo
FROM dbo.analise_jobs_provas
GROUP BY status_job;

SELECT TOP 50 id_job, id_prova, tentativas, max_tentativas, ultimo_erro, atualizado_em
FROM dbo.analise_jobs_provas
WHERE status_job IN (N'Falhou', N'Cancelado')
ORDER BY atualizado_em DESC;

SELECT status_analitico, COUNT(*) AS total
FROM dbo.resultados_analiticos_processos
GROUP BY status_analitico;
```

O backoff é exponencial de 1 a 60 minutos, com máximo padrão de cinco tentativas. Locks de worker com mais de 15 minutos são recuperados. `ultimo_erro` é limitado a 1000 caracteres e não deve receber payloads/respostas.

O endpoint de status separa fila pendente, falhas, provas/candidatos, resultados concluídos, candidatos comparáveis e posições atualizadas. O GET da lista não recalcula percentil, aderência ou ranking.

Sinais para alerta operacional:

- job pendente além do SLA definido pela operação;
- crescimento de `Falhou`/`Cancelado`;
- worker sem reserva recente;
- aumento de resultados `Parcial` por correção manual pendente;
- divergência entre resultados oficiais finalizados e read models calculados.

## Rollback

O rollback padrão é preservador de dados:

1. retirar da interface o botão/rota na versão anterior do frontend;
2. parar o worker;
3. executar `V005__exam_analytical_results.rollback.sql`, que cancela jobs executáveis;
4. manter as tabelas para auditoria e eventual retomada.

O script não executa `DROP`. Remoção física exige backup validado, aprovação explícita, retenção LGPD definida e procedimento separado. Como todas as integrações são aditivas, a correção oficial e a página anterior continuam operacionais durante o rollback.

## Retenção e histórico

O módulo não define expurgo autônomo: os registros seguem a política de retenção e descarte LGPD já aprovada para provas e auditoria. Isso evita eliminar evidência necessária antes de existir prazo formal. Qualquer rotina futura de expurgo deve considerar em conjunto a prova oficial, métricas derivadas, snapshots, histórico manual e logs, com autorização e trilha de auditoria. Dados brutos não são duplicados para facilitar esse ciclo de vida.

## Limitações conhecidas

- Com menos de dois candidatos comparáveis, percentil, ranking analítico e score permanecem indisponíveis.
- Com menos de cinco, a interface marca amostra pequena.
- Ortografia automatizada não está disponível nesta versão.
- A telemetria histórica não pode ser reconstruída pelo backfill.
- Alterações oficiais futuras no contrato da prova geram nova assinatura e, portanto, outra coorte.
