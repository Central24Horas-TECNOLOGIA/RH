# Relatório de atualizações do Conecta desde 07/07/2026

**Data da análise:** 21/07/2026  
**Data-base obrigatória:** 07/07/2026  
**Período analisado:** 08/07/2026 a 21/07/2026  
**Repositório:** Conecta — Central24Horas-TECNOLOGIA/RH  
**Escopo:** histórico Git, diferença entre a versão de produção de 07/07/2026 e o estado atual versionado, mais inspeção separada das alterações locais ainda não commitadas.

> **Conclusão principal.** A referência mais defensável para a produção de 07/07/2026 é o commit `041304602172e1c3825ed5eedb6bed4803393e69`, de 06/07/2026 às 12:47:15 (UTC-3). Não existe tag criada em 07/07/2026 nem commit nessa data. O primeiro commit posterior, de 08/07/2026, é filho direto dessa referência. O estado versionado atual é `ac8a3892bbaee9bc4109f854d92df44373405565`, na branch `main`, igual a `origin/main`. Entre os dois pontos existem 5 commits, sendo 4 commits de conteúdo e 1 merge.

## 1. Versão de referência identificada

| Campo | Resultado |
|---|---|
| Data-base da comparação | **07/07/2026** |
| Commit correspondente à produção | `041304602172e1c3825ed5eedb6bed4803393e69` |
| Commit abreviado | `0413046` |
| Data do commit-base | 06/07/2026 12:47:15 (UTC-3) |
| Mensagem do commit-base | `refactor: otimização e melhoramento do modal de detalhes` |
| Tag da produção de 07/07/2026 | **Não existe tag associada a essa data no repositório local** |
| Tag mais próxima, não utilizada como base | `v1.1.0`, apontando para `883624d1f1cd6dee27aaa1f933d093d6994ebbde`, de 26/06/2026 |
| Branch utilizada no deploy | `main`, identificada pela evidência do repositório; não há registro externo de implantação no escopo analisado |
| Commit imediatamente anterior às alterações pós-07/07 | `0413046` — o próprio commit-base |
| Primeiro commit posterior | `62eaa35e0bba39a95b37e50dfd3d680b25b287c7`, de 08/07/2026 10:24:10 (UTC-3) |
| Commit atual analisado | `ac8a3892bbaee9bc4109f854d92df44373405565` |
| Data do commit atual | 20/07/2026 14:08:49 (UTC-3) |
| Branch atual | `main` |
| Sincronismo da branch | `HEAD`, `main` e `origin/main` apontam para `ac8a389` |
| Quantidade de commits após 07/07 | **5**, incluindo 1 merge; **4** commits de conteúdo |
| Estado do diretório de trabalho | Sujo: 33 arquivos rastreados modificados e 16 arquivos não rastreados preexistentes, analisados separadamente; após a geração, este próprio relatório é o 17º arquivo não rastreado |

### Evidências para a escolha do commit-base

1. `0413046` é o último commit alcançável em todas as referências antes de `2026-07-08 00:00:00`.
2. Não há commit datado de 07/07/2026.
3. O primeiro commit a partir de 08/07, `62eaa35`, tem `0413046` como pai direto.
4. `0413046` é ancestral do `HEAD` atual.
5. As únicas referências de branch encontradas contendo o commit-base são `main` e `origin/main`.
6. A única tag encontrada é `v1.1.0`, criada em 26/06/2026 e apontando para o pai de `0413046`; portanto, ela antecede a versão em produção em 07/07 e não foi usada como marco.
7. O valor de versão da aplicação é configurável por ambiente (`RH_APP_VERSION`/`APP_VERSION`) e o valor padrão versionado continua `0.1.0`; ele não fornece uma evidência mais confiável do deploy que o histórico Git.

### Limite da evidência

O repositório não contém log de pipeline, manifesto de release ou registro de implantação que demonstre externamente qual SHA foi publicado em 07/07/2026. A branch de deploy `main` é a conclusão mais consistente com as referências Git disponíveis, mas continua sendo uma inferência do repositório. A data oficial da implantação foi fornecida como marco desta análise. O conteúdo literal do e-mail de 07/07/2026 também não está disponível no repositório; para evitar repetição, a exclusão foi feita comparando o código com `0413046`: tudo o que já existia nesse commit foi tratado como preexistente, mesmo quando voltou a ser citado em commits posteriores.

## 2. Metodologia e comandos utilizados

A análise foi realizada em quatro camadas:

1. reconstrução da referência histórica de produção;
2. leitura do grafo de commits e dos diffs por commit;
3. comparação líquida `0413046..HEAD` e inspeção dos arquivos relevantes;
4. análise separada do diretório de trabalho, sem atribuir alterações locais a uma versão publicada.

Comandos-base executados ou equivalentes diretos:

```bash
git log --all --before="2026-07-08 00:00:00" --decorate --oneline
git log --all --since="2026-07-08 00:00:00" --decorate --oneline
git tag --sort=-creatordate
git show 041304602172e1c3825ed5eedb6bed4803393e69
git diff 041304602172e1c3825ed5eedb6bed4803393e69..HEAD
git diff --stat 041304602172e1c3825ed5eedb6bed4803393e69..HEAD
git log 041304602172e1c3825ed5eedb6bed4803393e69..HEAD
git branch -a --contains 041304602172e1c3825ed5eedb6bed4803393e69
git status --short --branch
git diff HEAD
git ls-files --others --exclude-standard
```

Também foram examinados os arquivos de backend, frontend, testes, documentação, configuração e migrations atingidos pelo intervalo. Foram desconsiderados como novidade: comportamento já presente no commit-base, propostas documentais sem implementação, arquivos temporários de navegador criados e removidos no próprio período e alterações locais não versionadas.

## 3. Resumo quantitativo

### 3.1 Alterações versionadas entre a produção e o `HEAD`

| Métrica | Valor |
|---|---:|
| Commits no intervalo | 5 |
| Commits de conteúdo | 4 |
| Merges | 1 |
| Arquivos afetados na comparação líquida | 139 |
| Arquivos adicionados | 70 |
| Arquivos alterados | 69 |
| Arquivos removidos | 0 |
| Linhas adicionadas | 15.594 |
| Linhas removidas | 2.124 |

Os números são da comparação líquida `0413046..ac8a389`. Durante o período, 157 arquivos temporários do perfil `.edge-headless-syntax-debug` foram adicionados em 14/07 e removidos em 20/07. Como não existiam na base e não existem no `HEAD`, não aparecem nos 139 arquivos líquidos e não representam atualização do produto.

### 3.2 Estado local ainda não versionado

| Métrica | Valor |
|---|---:|
| Arquivos rastreados modificados após o `HEAD` | 33 |
| Arquivos não rastreados do produto, antes deste relatório | 16 |
| Arquivo gerado por esta análise | 1 — `RELATORIO_ATUALIZACOES_CONECTA_DESDE_07_07_2026.md` |
| Linhas nas mudanças rastreadas locais | 618 adições e 68 remoções |
| Estado total rastreado contra o commit-base | 147 arquivos: 70 adicionados, 77 alterados, 0 removidos |
| Linhas totais rastreadas contra o commit-base | 16.193 adições e 2.173 remoções |

Essas alterações locais foram consideradas apenas para identificar trabalho em andamento. Elas não foram somadas às entregas commitadas e não devem ser divulgadas como atualização já disponibilizada. As contagens de produto foram registradas antes da criação deste relatório e, portanto, não o tratam como mudança funcional do Conecta.

## 4. Histórico de commits após a produção

| Commit | Data (UTC-3) | Papel no histórico | Escopo observado |
|---|---|---|---|
| `62eaa35` | 08/07/2026 10:24 | Conteúdo | Criação de `SECURITY.md`; texto ainda genérico e com marcadores de exemplo. |
| `4871851` | 14/07/2026 08:45 | Conteúdo, ramo paralelo | Fluxo estruturado do Trabalhe Conosco, ampliação cadastral, relatórios, gestão de usuários/perfis, documentação de mapeamento e migration V002. |
| `45a551a` | 14/07/2026 08:47 | Merge | Integração dos ramos que partiram de `0413046`; incorpora `SECURITY.md` ao histórico principal. |
| `74b3c5e` | 14/07/2026 14:06 | Conteúdo | Pausa/retomada/cancelamento de processos, alerta de inatividade, navegação, cache, modais sensíveis, V003 e artefatos temporários de navegador. |
| `ac8a389` | 20/07/2026 14:08 | Conteúdo | Autenticação Microsoft, evolução do Conecta Provas, retenção da caixa de e-mails, banco de questões, personalização, análise de Word, compartilhamento e novo visual. |

### Observação sobre as mensagens dos commits

As mensagens não descrevem integralmente o conteúdo. `74b3c5e` repete o título “Versão 1.3.0”, embora acrescente outro conjunto de mudanças. `ac8a389` menciona somente o fundo da tela de provas, mas contém autenticação Microsoft, migrations, regras de abandono de etapas, retenção de e-mails e outras alterações funcionais. A classificação deste relatório se baseia no diff e no código, não apenas nos títulos.

## 5. Alterações detalhadas por módulo

### 5.1 Candidaturas recebidas pelo Trabalhe Conosco

- **Módulo:** E-mails, candidatos, banco de talentos e processos seletivos.
- **Título:** Leitura estruturada do formulário enviado por e-mail.
- **Como era em 07/07:** A integração com caixa de e-mail e Microsoft Graph/IMAP já existia. O tratamento era concentrado em mensagem, remetente e currículo/anexo, sem o conjunto estruturado dos campos do formulário atual.
- **Alteração pós-07/07:** O serviço passou a reconhecer e extrair nome, e-mail, telefone, endereço, escolaridade, experiência, música, prato, futebol, time, rede social e indicação de currículo anexado. Também identifica campos obrigatórios ausentes, e-mail inválido, telefone ausente e divergência entre currículo informado e anexo efetivamente recebido.
- **Situação atual:** Os dados podem ser persistidos na caixa de entrada e importados para candidato/processo/banco de talentos, inclusive quando não há anexo, com deduplicação por e-mail ou telefone e preservação cautelosa de dados já cadastrados.
- **Tipo:** Evolução de funcionalidade existente e correção de comportamento.
- **Impacto para o usuário:** Reduz digitação manual, deixa inconsistências explícitas e melhora a triagem de candidaturas.
- **Arquivos principais:** `apps/backend/rh_api/services/email_inbox_service.py`, `apps/backend/rh_api/repositories/email_inbox.py`, `apps/backend/rh_api/repositories/candidate_sheet.py`, `apps/backend/rh_api/repositories/talent_bank.py`, `apps/frontend/fonte/features/gestao/index.js`, `infra/sql/migrations/V002__trabalhe_conosco_email_candidate_fields.sql`.
- **Commits:** `4871851`, complementado por `ac8a389`.
- **Data aproximada:** 14/07/2026 e 20/07/2026.
- **Status e dependências:** Concluído no código versionado; depende da aplicação da migration V002 e da configuração operacional da caixa de e-mail. A execução em produção não foi comprovada.

### 5.2 Ampliação dos dados do perfil do candidato

- **Módulo:** Central de Candidatos, detalhe de processo e Banco de Talentos.
- **Título:** Novos dados profissionais e preferências do candidato.
- **Como era em 07/07:** O cadastro do candidato já existia, mas não persistia de forma integrada todos os campos recebidos pelo formulário do Trabalhe Conosco.
- **Alteração pós-07/07:** Inclusão de endereço, escolaridade, experiência e preferências culturais/esportivas nas camadas de schema, repositório, importação e interface.
- **Situação atual:** Os campos podem ser visualizados, editados e reaproveitados entre caixa de entrada, candidato, processo e banco de talentos, com validações de tamanho e normalização de respostas “Sim/Não”.
- **Tipo:** Evolução de funcionalidade existente.
- **Impacto para o usuário:** Perfil mais completo e menor perda de contexto entre captação e seleção.
- **Arquivos principais:** `apps/backend/rh_api/repositories/profiles.py`, `candidate_sheet.py`, `talent_bank.py`, `email_inbox.py`, `apps/frontend/fonte/features/candidatos/index.js`, `apps/frontend/fonte/features/gestao/index.js`, migration V002.
- **Commit:** `4871851`.
- **Data aproximada:** 14/07/2026.
- **Status e dependências:** Concluído no código; requer V002 aplicada no banco.

### 5.3 Relatórios de processos, candidatos e ranking

- **Módulo:** Gestão — Relatórios.
- **Título:** Reorganização da área de relatórios e exportação.
- **Como era em 07/07:** Já existiam consultas e exportações de relatórios, mas com menos filtros, colunas e separação visual.
- **Alteração pós-07/07:** A tela foi dividida em Relatório de Processos, Relatório de Candidatos e Ranking Analítico, com busca, período, status, paginação, indicadores de atualização, colunas ampliadas e exportação local em CSV e XLSX.
- **Situação atual:** Processos exibem datas, vagas e totais por resultado; candidatos exibem contatos, processo/vaga, movimentações, notas, documentos, justificativas e resultado final.
- **Tipo:** Evolução de funcionalidade existente e ajuste visual.
- **Impacto para o usuário:** Consulta operacional mais detalhada e exportação pronta para análise em planilha.
- **Arquivos principais:** `apps/backend/rh_api/repositories/analytics.py`, `apps/frontend/fonte/features/gestao/index.js`, `apps/frontend/fonte/services/api/analytics.js`, `apps/frontend/estilos/screens.css`.
- **Commit:** `4871851`.
- **Data aproximada:** 14/07/2026.
- **Status e dependências:** Implementado com ressalva: o campo `data_saida` é calculado no código como 60 dias após a entrada, e não a partir de uma movimentação real de saída. PDF não foi implementado; as exportações observadas são CSV e XLSX.

### 5.4 Gestão visual de usuários, perfis e auditoria

- **Módulo:** Configurações e segurança administrativa.
- **Título:** Nova experiência de manutenção de usuários e perfis.
- **Como era em 07/07:** Usuários, perfis, permissões e logs já existiam.
- **Alteração pós-07/07:** Foram acrescentados filtros, paginação, menu de ações, painel lateral para criação/edição, ativação, exclusão justificada, cartões de perfil, usuários vinculados, matriz e comparação de permissões, indicadores críticos e nova apresentação dos logs.
- **Situação atual:** A manutenção administrativa está mais concentrada e explicativa; o cadastro também diferencia o provedor Microsoft do provedor local.
- **Tipo:** Evolução de funcionalidade existente e ajuste visual.
- **Impacto para o usuário:** Administração de acesso mais clara, com melhor visualização de consequências e vínculos.
- **Arquivos principais:** `apps/frontend/fonte/features/configuracoes/index.js`, `apps/frontend/fonte/features/gestao/index.js`, `apps/backend/rh_api/repositories/security.py`, `apps/backend/rh_api/schemas/security.py`, `apps/frontend/estilos/screens.css`.
- **Commits:** `4871851`, `74b3c5e` e `ac8a389`.
- **Data aproximada:** 14/07/2026 a 20/07/2026.
- **Status e dependências:** Concluído no código; a criação de usuário Microsoft depende da configuração do Entra ID.

### 5.5 Autenticação corporativa com Microsoft Entra ID

- **Módulo:** Autenticação e segurança.
- **Título:** Entrada pela conta corporativa Microsoft.
- **Como era em 07/07:** Havia login local e integração Microsoft para e-mail; não havia fluxo de login corporativo da aplicação por OpenID Connect.
- **Alteração pós-07/07:** Inclusão de endpoints de início, callback e conclusão do login Microsoft usando MSAL, validação de tenant e usuário, sessão assinada de curta duração, vínculo por e-mail corporativo no primeiro acesso, auditoria e proteção contra conflito de identidades.
- **Situação atual:** A interface prioriza “Entrar com Microsoft” e mantém login local como alternativa. Usuários continuam sujeitos a situação ativa, perfil e permissões atuais do banco.
- **Tipo:** Evolução de autenticação e ajuste de regra de segurança.
- **Impacto para o usuário:** Acesso com identidade corporativa, redução de senhas locais e mensagens específicas para expiração ou falha do fluxo.
- **Arquivos principais:** `apps/backend/rh_api/services/microsoft_auth_service.py`, `apps/backend/rh_api/routers/auth.py`, `apps/backend/rh_api/auth.py`, `apps/backend/rh_api/config.py`, `apps/frontend/fonte/services/api/auth.js`, `apps/frontend/fonte/aplicacao.js`, `infra/sql/migrations/V004__microsoft_entra_authentication.sql`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Concluído no código, mas a implantação requer V004, segredo de sessão, tenant, client ID, client secret e URI de redirecionamento. Não há evidência de que essas configurações tenham sido aplicadas em produção.

### 5.6 Pausar, retomar e cancelar processos seletivos

- **Módulo:** Recrutamento — Processos Seletivos.
- **Título:** Novos controles de estado do processo.
- **Como era em 07/07:** O ciclo do processo existia, sem o fluxo completo de pausa, retomada e cancelamento com justificativa e auditoria observado agora.
- **Alteração pós-07/07:** Inclusão de endpoints e ações de interface para pausar, retomar e cancelar. A justificativa é obrigatória, o estado operacional anterior é preservado e movimentações incompatíveis são bloqueadas.
- **Situação atual:** As mudanças de estado são auditadas com situação anterior, nova situação e motivo; processos pausados ou cancelados ficam protegidos contra ações operacionais indevidas.
- **Tipo:** Evolução de funcionalidade existente e ajuste de regra de negócio.
- **Impacto para o usuário:** Maior controle do ciclo seletivo e rastreabilidade das decisões.
- **Arquivos principais:** `apps/backend/rh_api/routers/processes.py`, `apps/backend/rh_api/repositories/processes.py`, `apps/backend/rh_api/services/process_flow.py`, `apps/frontend/fonte/features/processos/index.js`, `apps/frontend/fonte/services/api/processes.js`, `infra/sql/migrations/V003__process_status_and_inactivity_alerts.sql`.
- **Commit:** `74b3c5e`.
- **Data aproximada:** 14/07/2026.
- **Status e dependências:** Concluído no código; requer V003 aplicada e permissões correspondentes.

### 5.7 Alertas de processos sem movimentação por 30 dias

- **Módulo:** Processos e notificações.
- **Título:** Identificação de inatividade.
- **Como era em 07/07:** Não foi localizado alerta persistido e idempotente para processos sem movimentação por 30 dias.
- **Alteração pós-07/07:** Inclusão de rotina que identifica processos operacionais inativos, exclui pausados/cancelados/encerrados e registra alertas sem duplicação.
- **Situação atual:** Há endpoint e persistência do alerta, mas o envio externo e a execução periódica ainda dependem de agendador e integração de e-mail/Graph/SMTP.
- **Tipo:** Evolução de funcionalidade existente.
- **Impacto para o usuário:** Potencial de sinalizar processos parados, mas sem entrega automática confirmada.
- **Arquivos principais:** `apps/backend/rh_api/routers/processes.py`, `apps/backend/rh_api/repositories/processes.py`, migration V003, `docs/checklist-atualizacao-conecta-2026-07-14.md`.
- **Commit:** `74b3c5e`.
- **Data aproximada:** 14/07/2026.
- **Status e dependências:** **Parcial / presente no código, não operacionalizado integralmente.** Não deve ser comunicado como alerta automático já ativo.

### 5.8 Confirmações para ações sensíveis

- **Módulo:** Componentes compartilhados e fluxos críticos.
- **Título:** Modal padronizado com motivo e consequências.
- **Como era em 07/07:** Parte das ações usava `prompt`/`confirm` nativos ou confirmações menos informativas.
- **Alteração pós-07/07:** Criação de modal compartilhado para pausar, retomar e cancelar processo, além de cancelar e reabrir provas, com carregamento, erro, justificativa, consequência e indicação de reversibilidade.
- **Situação atual:** Os fluxos citados usam o novo componente; não houve migração comprovada de todas as confirmações nativas da plataforma.
- **Tipo:** Evolução de funcionalidade existente e ajuste visual.
- **Impacto para o usuário:** Reduz ações acidentais e explica melhor o resultado de decisões críticas.
- **Arquivos principais:** `apps/frontend/fonte/ui/components/modals.js`, `apps/frontend/fonte/features/processos/index.js`, `apps/frontend/fonte/features/provas-geradas/index.js`.
- **Commit:** `74b3c5e`.
- **Data aproximada:** 14/07/2026.
- **Status e dependências:** Concluído nos fluxos enumerados; adoção global não confirmada.

### 5.9 Navegação e organização do menu de recrutamento

- **Módulo:** Navegação geral.
- **Título:** Rotas sem hash e reorganização dos acessos.
- **Como era em 07/07:** A aplicação utilizava rotas com `#`; Processos ficava em uma organização anterior e o acesso “Regras reutilizáveis” ainda era exposto.
- **Alteração pós-07/07:** Migração do frontend para History API com normalização de links antigos, reorganização para `Recrutamento > Processos Seletivos`, retirada do acesso ativo a Regras reutilizáveis e atalhos para adicionar candidato pela Central de Candidatos.
- **Situação atual:** URLs ficam mais limpas e o fluxo de recrutamento mais concentrado. Estruturas internas das regras foram mantidas por compatibilidade, mas menu, rota e aba ativos foram removidos.
- **Tipo:** Evolução de funcionalidade existente, ajuste visual e remoção de acesso obsoleto.
- **Impacto para o usuário:** Navegação mais direta e menor duplicidade de caminhos.
- **Arquivos principais:** `apps/frontend/fonte/rotas.js`, `apps/frontend/fonte/app/controlador-aplicacao.js`, `apps/frontend/fonte/ui/components/layout.js`, `apps/frontend/fonte/features/processos/index.js`, `apps/frontend/fonte/features/configuracoes/index.js`.
- **Commit:** `74b3c5e`.
- **Data aproximada:** 14/07/2026.
- **Status e dependências:** Concluído no frontend; o servidor de produção precisa redirecionar rotas desconhecidas para `index.html`, o que não foi validado nesta análise.

### 5.10 Fluxo de etapas do Conecta Provas

- **Módulo:** Conecta Provas — experiência do candidato.
- **Título:** Conclusão somente na última questão.
- **Como era em 07/07:** A jornada por etapas, os rótulos de situação e a tela de etapas já existiam. Havia botão “Ver etapas” e a experiência não aplicava a nova restrição em todas as camadas.
- **Alteração pós-07/07:** Remoção do botão “Ver etapas”; apresentação de “Avançar” nas questões intermediárias e “Concluir etapa” somente na última. O backend também rejeita conclusão antes da questão final.
- **Situação atual:** A etapa é percorrida sequencialmente e a regra não depende apenas da interface.
- **Tipo:** Correção de comportamento e evolução de funcionalidade existente.
- **Impacto para o usuário:** Evita encerramento prematuro e torna o avanço da prova mais previsível.
- **Arquivos principais:** `apps/frontend/fonte/features/conecta-provas/index.js`, `apps/frontend/fonte/services/api/generated-exams.js`, `apps/backend/rh_api/routers/generated_exams.py`, `apps/backend/rh_api/repositories/generated_exams.py`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Concluído no código versionado e coberto pelo smoke test do fluxo.

### 5.11 Abandono de etapa com nota zero

- **Módulo:** Conecta Provas e resultado da prova.
- **Título:** Interrupção definitiva de etapa ao sair da página.
- **Como era em 07/07:** Não havia o conjunto atual de persistência de interrupção, invalidação da etapa e zeragem explícita ao abandonar a execução.
- **Alteração pós-07/07:** Inclusão de aviso de saída, envio por beacon em `pagehide`, tratamento de navegação, salvamento possível das respostas e marcação idempotente de etapa interrompida. A etapa abandonada recebe zero e deixa de permanecer como pendência manual.
- **Situação atual:** O candidato é avisado; ao confirmar a saída, a etapa fica indisponível/realizada para retomada e o RH visualiza “Etapa interrompida - nota zerada”. O envio no fechamento abrupto do navegador é de melhor esforço, por limitação do próprio navegador.
- **Tipo:** Ajuste de regra de negócio e correção de comportamento.
- **Impacto para o usuário:** Regra clara para abandono e resultado consistente para RH e candidato.
- **Arquivos principais:** `apps/frontend/fonte/features/conecta-provas/index.js`, `apps/backend/rh_api/routers/generated_exams.py`, `apps/backend/rh_api/repositories/generated_exams.py`, `apps/frontend/fonte/features/provas-geradas/index.js`, `apps/frontend/fonte/rotulos-etapas.js`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Concluído no código; fechamento forçado sem oportunidade de rede continua sujeito às limitações do navegador.

### 5.12 Personalização de prova por etapas e níveis

- **Módulo:** Geração de provas.
- **Título:** Seleção de etapas e nível específico por etapa.
- **Como era em 07/07:** A personalização inteligente de provas já existia e não deve ser comunicada como recurso novo.
- **Alteração pós-07/07:** A evolução permite selecionar quais etapas entram na prova, manter o nível padrão ou definir nível por etapa; a configuração salva também as etapas e questões selecionadas. Área/operação passa a ser derivada da vaga.
- **Situação atual:** O RH tem controle mais granular sobre a composição da avaliação.
- **Tipo:** Evolução de funcionalidade existente e ajuste de regra de negócio.
- **Impacto para o usuário:** Provas mais aderentes à vaga sem exigir montagem inteiramente manual.
- **Arquivos principais:** `apps/frontend/fonte/features/prova/services/personalizacao-inteligente.js`, `apps/frontend/fonte/perguntas.js`, `apps/frontend/fonte/regras-prova.js`, `apps/backend/rh_api/repositories/generated_exams.py`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Concluído no código versionado. A configuração específica de Qualidade encontrada no diretório local é posterior e não versionada, sendo tratada separadamente.

### 5.13 Compartilhamento padronizado da vaga

- **Módulo:** Processos seletivos.
- **Título:** Texto reutilizável para divulgação.
- **Como era em 07/07:** O comando de compartilhar vaga já aparecia na interface; portanto, compartilhamento não é novidade.
- **Alteração pós-07/07:** Foi criado modal compartilhado que monta texto com vaga, requisitos, responsabilidades e URL corporativa fixa de carreiras, com cópia para a área de transferência.
- **Situação atual:** O mesmo padrão é usado na criação e no detalhe do processo. Não foi criado link único por vaga.
- **Tipo:** Evolução de funcionalidade existente e ajuste visual.
- **Impacto para o usuário:** Divulgação mais consistente e rápida.
- **Arquivos principais:** `apps/frontend/fonte/shared/components/share-job-modal.js`, `apps/frontend/fonte/features/processos/index.js`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Concluído no código; depende da URL corporativa configurada no texto.

### 5.14 Sugestão de correção para respostas de Word

- **Módulo:** Provas geradas e correção.
- **Título:** Análise de formatação e sugestão de nota.
- **Como era em 07/07:** A correção e a personalização da prova já existiam, sem o conjunto atual de sinais de formatação para Word.
- **Alteração pós-07/07:** Detecção de itálico, sublinhado, tachado, tamanho da fonte, alinhamento e listas; comparação com requisitos; geração local de nota sugerida, pontos positivos, pontos de atenção e aderência ao cenário.
- **Situação atual:** O resultado aparece no detalhe da prova como apoio à decisão. O próprio fluxo marca revisão humana como necessária.
- **Tipo:** Evolução de funcionalidade existente.
- **Impacto para o usuário:** Mais evidência para corrigir tarefas de Word e reduzir avaliação puramente manual.
- **Arquivos principais:** `apps/frontend/fonte/features/prova/services/analise-resposta.js`, `apps/frontend/fonte/features/provas-geradas/index.js`, `apps/frontend/fonte/perguntas.js`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Implementado como heurística local de apoio; não é correção autônoma por IA externa nem substitui validação humana.

### 5.15 Banco de questões e critérios de avaliação

- **Módulo:** Banco de questões e importador.
- **Título:** Questões de Planejamento e metadados estruturados.
- **Como era em 07/07:** O arquivo possuía 66 questões e 11 fontes. As questões existentes não tinham de forma uniforme os campos estruturados agora usados para avaliação.
- **Alteração pós-07/07:** O banco passou a 74 questões e 13 fontes. Foram incluídas 8 questões neutras de Planejamento — 7 de Word e 1 de Redação — e adicionados campos como `oQueDeveSerAvaliado`, tema e instruções de redação às questões existentes. Duas questões antigas receberam correções pontuais de conteúdo/estrutura.
- **Situação atual:** O importador reconhece os novos campos e mantém uma cópia em `runtime/tools`. Não foram identificadas questões de Excel nesse JSON específico.
- **Tipo:** Evolução de funcionalidade existente e correção de conteúdo.
- **Impacto para o usuário:** Maior variedade de avaliação e critérios mais explícitos para correção.
- **Arquivos principais:** `apps/frontend/data/bancoQuestoesReformuladas.json`, `apps/frontend/fonte/banco-questoes.js`, `apps/frontend/fonte/perguntas.js`, `tools/importar_provas_reformuladas.py`, `runtime/tools/importar_provas_reformuladas.py`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Concluído no código; a carga efetiva no banco depende da execução controlada do importador.

### 5.16 Novo fundo e ajustes visuais do Conecta Provas

- **Módulo:** Conecta Provas.
- **Título:** Identidade visual das telas de acesso e execução.
- **Como era em 07/07:** Fundo azul/gradiente anterior e composição visual distinta.
- **Alteração pós-07/07:** Uso de `Fundo Provas.png` na execução e `Fundo Provas inicial.png` no acesso, reposicionamento do cartão, remoção de marca duplicada, favicon e ajustes nas cores de estados, incluindo “Não iniciada” em vermelho e indisponível em cinza.
- **Situação atual:** As telas têm nova imagem de fundo e diferenciação visual de estado.
- **Tipo:** Ajuste visual.
- **Impacto para o usuário:** Interface mais alinhada à identidade definida e melhor leitura de estados.
- **Arquivos principais:** `apps/frontend/estilos/Fundo Provas.png`, `apps/frontend/estilos/Fundo Provas inicial.png`, `apps/frontend/estilos/favicon.png`, `apps/frontend/estilos/estilos.css`, `apps/frontend/estilos/exam-steps.css`, `apps/frontend/index.html`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Concluído no código versionado.

### 5.17 Retenção da caixa de entrada e cache de consultas

- **Módulo:** Caixa de e-mails e acesso a dados.
- **Título:** Retenção de 60 dias e cache de 1 hora.
- **Como era em 07/07:** A caixa e sua integração já existiam, sem a regra atual de descarte local aos 60 dias e sem o cache específico observado agora.
- **Alteração pós-07/07:** Antes das listagens, registros com mais de 60 dias são excluídos localmente, anexos salvos são removidos e há tentativa de exclusão no servidor IMAP. As listagens e detalhes usam cache de 1 hora e consolidação de requisições simultâneas.
- **Situação atual:** A API informa o prazo e a quantidade removida. Se a exclusão remota falhar, a limpeza local ainda ocorre.
- **Tipo:** Ajuste de regra de negócio, melhoria de performance e ajuste de segurança/operação.
- **Impacto para o usuário:** Menor tempo de recarga e limitação do acúmulo local de dados; exige que a política de retenção esteja formalmente aprovada.
- **Arquivos principais:** `apps/backend/rh_api/repositories/email_inbox.py`, `apps/frontend/fonte/services/api/processes.js`, `apps/frontend/fonte/servico-api.js`, `apps/frontend/tests/run-refresh-performance-smoke.cjs`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Implementado no código. Há uma inconsistência de teste: o smoke ainda procura 30 minutos (`1800000`), enquanto o código usa 1 hora (`60 * 60 * 1000`). A regra de exclusão deve ser validada operacional e juridicamente antes da implantação.

### 5.18 Cache central e redução de chamadas repetidas

- **Módulo:** Serviços de API do frontend.
- **Título:** Cache em memória, invalidação seletiva e deduplicação.
- **Como era em 07/07:** As consultas eram feitas com menor reaproveitamento centralizado.
- **Alteração pós-07/07:** Inclusão de TTL padrão de 60 segundos, TTL sensível de até 30 minutos, limite de 80 entradas, limpeza de expirados, invalidação seletiva e compartilhamento de requisições em andamento para processos, candidatos, banco de talentos, e-mails, provas e relatórios.
- **Situação atual:** Leituras repetidas podem reaproveitar resposta; mutações invalidam grupos relacionados.
- **Tipo:** Melhoria de performance e alteração interna sem impacto funcional direto.
- **Impacto para o usuário:** Menos recargas redundantes e telas potencialmente mais rápidas.
- **Arquivos principais:** `apps/frontend/fonte/services/api/core.js`, `processes.js`, `generated-exams.js`, `analytics.js`, `apps/frontend/fonte/servico-api.js`, `apps/frontend/tests/run-refresh-performance-smoke.cjs`.
- **Commits:** `74b3c5e` e `ac8a389`.
- **Data aproximada:** 14/07/2026 a 20/07/2026.
- **Status e dependências:** Implementado; a suíte rápida de performance está desatualizada quanto ao TTL específico da caixa de e-mails.

### 5.19 Proteção de dados internos das questões

- **Módulo:** API pública do Conecta Provas.
- **Título:** Remoção de gabarito e critérios do payload público.
- **Como era em 07/07:** A sanitização existia parcialmente, sem a lista atual de metadados internos.
- **Alteração pós-07/07:** `rubrica`, `gabarito`, `oQueDeveSerAvaliado` e outros campos internos passaram a ser classificados e removidos do payload público da prova; o estado público também é reduzido ao necessário.
- **Situação atual:** O candidato recebe enunciado e dados de execução, sem critérios internos de correção.
- **Tipo:** Correção de comportamento e ajuste de segurança.
- **Impacto para o usuário:** Menor risco de exposição de resposta ou critério de avaliação.
- **Arquivos principais:** `apps/backend/rh_api/repositories/generated_exams.py`, `apps/backend/rh_api/routers/generated_exams.py`, `apps/frontend/fonte/features/conecta-provas/index.js`.
- **Commit:** `ac8a389`.
- **Data aproximada:** 20/07/2026.
- **Status e dependências:** Concluído no código; não substitui teste dinâmico de segurança em ambiente integrado.

### 5.20 Documentação técnica e política de segurança

- **Módulo:** Documentação e governança.
- **Título:** Mapa completo do produto, relatórios de atualização e `SECURITY.md`.
- **Como era em 07/07:** Esses arquivos não estavam no commit-base.
- **Alteração pós-07/07:** Foram adicionados 53 documentos em `MAPA_COMPLETO_CONECTA`, relatório/checklist técnico da atualização e uma política de segurança.
- **Situação atual:** O mapa registra telas, elementos, fluxos, regras, dados, riscos e backlog. O `SECURITY.md`, porém, mantém tabela de versões e texto de reporte com valores genéricos de modelo, sem contato e SLA reais do Conecta.
- **Tipo:** Alteração interna sem impacto direto para o usuário.
- **Impacto para o usuário:** Melhora rastreabilidade para manutenção; não cria funcionalidade da plataforma.
- **Arquivos principais:** `MAPA_COMPLETO_CONECTA/**`, `docs/checklist-atualizacao-conecta-2026-07-14.md`, `docs/relatorio-tecnico-atualizacao-conecta-2026-07-14.md`, `SECURITY.md`.
- **Commits:** `62eaa35`, `45a551a`, `4871851` e `74b3c5e`.
- **Data aproximada:** 08/07/2026 a 14/07/2026.
- **Status e dependências:** Mapa e relatórios concluídos como documentação. Política de segurança **presente no código, mas não finalizada**; não deve ser anunciada como processo operacional vigente.

### 5.21 Dependências, migrations, importador e limpeza de artefatos

- **Módulo:** Infraestrutura e manutenção.
- **Título:** Suporte interno às mudanças pós-07/07.
- **Como era em 07/07:** Não existiam V002–V004, cópia runtime do importador e conjunto atual de dependências para Microsoft Auth.
- **Alteração pós-07/07:** Adição das migrations de candidaturas, estados de processo e Microsoft Auth; atualização das dependências Python; cópia do importador para runtime; ajustes de `.env.example` e `.gitignore`; remoção no commit seguinte de 157 artefatos temporários do Edge.
- **Situação atual:** O código contém os recursos de implantação, mas o Git não comprova execução das migrations nem provisionamento de segredos.
- **Tipo:** Alteração interna sem impacto direto para o usuário.
- **Impacto para o usuário:** Habilita tecnicamente as funcionalidades descritas quando o deploy é concluído corretamente.
- **Arquivos principais:** `.env.example`, `.gitignore`, `requirements.txt`, `infra/sql/migrations/V002*`, `V003*`, `V004*`, `runtime/tools/importar_provas_reformuladas.py`.
- **Commits:** `4871851`, `74b3c5e`, `ac8a389`.
- **Data aproximada:** 14/07/2026 a 20/07/2026.
- **Status e dependências:** Concluído no repositório; execução operacional não confirmada. Os arquivos `.edge-headless-syntax-debug` eram temporários e foram corretamente excluídos da lista de atualizações do produto.

## 6. Trabalho local em andamento, não versionado

### 6.1 Resultados analíticos de provas

- **Módulo:** Análise de avaliações.
- **Título:** Camada analítica explicável, sem alterar a nota oficial.
- **Como era no `HEAD`:** Não existe no commit `ac8a389` o módulo completo de resultados analíticos encontrado localmente.
- **Alteração local:** Foram criados repositórios, schemas, serviço, worker, endpoints e tela para score analítico, percentil, ranking, aderência, indicadores de execução, alertas, comparação de 2 a 3 candidatos e configuração versionada de pesos/categorias/perfil ideal. A telemetria proposta registra tempo ativo estimado, alterações, ordem e tamanho das respostas e quantidade de colagens, sem guardar o conteúdo da área de transferência.
- **Situação atual:** A implementação está presente no diretório de trabalho e possui migration V005, worker, Compose, testes e documentação, mas parte essencial está em arquivos não rastreados.
- **Tipo:** Evolução em andamento.
- **Impacto potencial:** Apoio analítico ao RH mantendo `dbo.resultados_provas` como fonte oficial e sem sobrescrever notas.
- **Arquivos principais:** `apps/backend/rh_api/repositories/exam_analytics.py`, `services/exam_analytics.py`, `routers/exam_analytics.py`, `workers/exam_analytics.py`, `apps/frontend/fonte/features/resultados-analiticos/index.js`, `infra/sql/migrations/V005__exam_analytical_results.sql`, `docs/modulo-analitico-resultados-provas.md`.
- **Commit:** Nenhum.
- **Data de observação:** 21/07/2026.
- **Status e dependências:** **Em andamento, não versionado e não comprovado em ambiente integrado.** Requer inclusão dos arquivos no controle de versão, migration V005 e worker em execução. Não deve compor o próximo comunicado como recurso entregue.

### 6.2 Composição de prova para a área de Qualidade

- **Módulo:** Personalização de provas.
- **Título:** Blueprint específico de Qualidade.
- **Como era no `HEAD`:** A personalização por etapas e níveis está versionada, mas a composição local específica de Qualidade não está.
- **Alteração local:** Foram definidos pesos e níveis para Word, Excel, Redação, Conhecimentos Técnicos Administrativos e Conhecimentos Gerais, além de regras de ordem e simplificação de campos conforme a vaga.
- **Situação atual:** Existe apenas nas mudanças locais rastreadas; não há commit.
- **Tipo:** Ajuste de regra de negócio em andamento.
- **Impacto potencial:** Avaliação mais padronizada para vagas de Qualidade.
- **Arquivos principais:** `apps/frontend/fonte/perguntas.js`, `apps/frontend/fonte/features/processos/index.js`, `apps/frontend/fonte/features/prova/services/personalizacao-inteligente.js` e integrações relacionadas.
- **Commit:** Nenhum.
- **Data de observação:** 21/07/2026.
- **Status e dependências:** **Em andamento / não versionado.** Não deve ser divulgado como atualização concluída.

## 7. Tabela consolidada de alterações

| ID | Módulo | Alteração pós-07/07 | Classificação | Status no código | Impacto direto |
|---:|---|---|---|---|---|
| 1 | Trabalhe Conosco | Extração e validação estruturada das candidaturas por e-mail | Evolução / correção | Commitado; requer V002 | Sim |
| 2 | Candidatos | Novos dados de perfil integrados entre captação e seleção | Evolução | Commitado; requer V002 | Sim |
| 3 | Relatórios | Abas, filtros, colunas, CSV e XLSX | Evolução / visual | Commitado; `data_saida` tem ressalva | Sim |
| 4 | Usuários e perfis | Nova manutenção visual, matriz e comparação de permissões | Evolução / visual | Commitado | Sim |
| 5 | Autenticação | Login Microsoft Entra ID | Evolução / segurança | Commitado; requer V004 e configuração | Sim |
| 6 | Processos | Pausar, retomar e cancelar com justificativa | Evolução / regra de negócio | Commitado; requer V003 | Sim |
| 7 | Processos | Alertas após 30 dias sem movimentação | Evolução | Parcial; sem agendamento/envio confirmado | Potencial |
| 8 | UI compartilhada | Modal para ações sensíveis | Evolução / visual | Commitado em fluxos específicos | Sim |
| 9 | Navegação | History API, menu de recrutamento e retirada de Regras reutilizáveis | Evolução / visual | Commitado; fallback do servidor não validado | Sim |
| 10 | Conecta Provas | Concluir somente na última questão | Correção de comportamento | Commitado | Sim |
| 11 | Conecta Provas | Abandono invalida etapa e zera nota | Regra de negócio / correção | Commitado; beacon é melhor esforço | Sim |
| 12 | Geração de provas | Seleção de etapas e nível por etapa | Evolução | Commitado | Sim |
| 13 | Processos | Modal e texto padronizado para compartilhar vaga | Evolução / visual | Commitado | Sim |
| 14 | Correção | Análise de formatação e sugestão para Word | Evolução | Commitado; exige revisão humana | Sim |
| 15 | Banco de questões | 8 questões de Planejamento e metadados de avaliação | Evolução / correção | Commitado; carga depende de importação | Sim |
| 16 | Conecta Provas | Novas imagens de fundo, favicon e estados visuais | Ajuste visual | Commitado | Sim |
| 17 | E-mails | Retenção local de 60 dias e cache de 1 hora | Regra de negócio / performance | Commitado; teste de TTL desatualizado | Sim |
| 18 | APIs frontend | Cache central, invalidação e deduplicação | Performance / interno | Commitado | Indireto |
| 19 | Segurança de prova | Remoção de gabarito e critérios do payload público | Correção / segurança | Commitado | Indireto |
| 20 | Documentação | Mapa completo e relatórios técnicos | Interno | Commitado | Não |
| 21 | Segurança | `SECURITY.md` genérico | Interno | Não finalizado | Não |
| 22 | Infraestrutura | V002–V004, dependências e importador runtime | Interno | Commitado; execução não confirmada | Indireto |
| 23 | Resultados analíticos | Score, ranking, telemetria e comparação | Evolução | Local, não versionado | Ainda não |
| 24 | Provas de Qualidade | Blueprint e regras específicas | Regra de negócio | Local, não versionado | Ainda não |

## 8. Validação técnica executada nesta análise

Foram executados testes focados no estado atual do diretório de trabalho, sem aplicar migrations e sem modificar a aplicação:

| Verificação | Resultado |
|---|---|
| `test_microsoft_auth.py`, `test_email_inbox_service.py`, `test_generated_exams_score.py` e `test_exam_analytics.py` | **61 testes aprovados** em 10,54 s |
| `run-rh-business-rules-smoke.cjs` | Aprovado |
| `run-conecta-provas-flow-smoke.cjs` | Aprovado |
| `run-exam-analytics-smoke.cjs` | Aprovado, mas apenas sobre o código local não versionado |
| `run-refresh-performance-smoke.cjs` | **Falhou**: o teste espera `TEMPO_CACHE_EMAIL_INBOX_MS = 1800000`, enquanto a implementação usa `60 * 60 * 1000` |

Esses resultados aumentam a confiança na lógica isolada, mas não comprovam deploy, execução das migrations, autenticação real com o tenant Microsoft, integração com caixa de e-mail, comportamento completo do navegador ou execução do worker analítico.

## 9. Inventário de arquivos no período

### 9.1 Arquivos adicionados na comparação `0413046..HEAD` — 70

```text
MAPA_COMPLETO_CONECTA/00_LEIA_PRIMEIRO.md
MAPA_COMPLETO_CONECTA/01_VISAO_GERAL/arquitetura_funcional.md
MAPA_COMPLETO_CONECTA/01_VISAO_GERAL/mapa_de_navegacao.md
MAPA_COMPLETO_CONECTA/01_VISAO_GERAL/mapa_macro.md
MAPA_COMPLETO_CONECTA/01_VISAO_GERAL/relacionamento_entre_modulos.md
MAPA_COMPLETO_CONECTA/02_TELAS/analise_por_tela.md
MAPA_COMPLETO_CONECTA/02_TELAS/estrutura_das_telas.md
MAPA_COMPLETO_CONECTA/02_TELAS/inventario_de_telas.md
MAPA_COMPLETO_CONECTA/02_TELAS/wireframes_atuais.md
MAPA_COMPLETO_CONECTA/03_ELEMENTOS/botoes.md
MAPA_COMPLETO_CONECTA/03_ELEMENTOS/campos.md
MAPA_COMPLETO_CONECTA/03_ELEMENTOS/componentes.md
MAPA_COMPLETO_CONECTA/03_ELEMENTOS/filtros.md
MAPA_COMPLETO_CONECTA/03_ELEMENTOS/formularios.md
MAPA_COMPLETO_CONECTA/03_ELEMENTOS/indicadores.md
MAPA_COMPLETO_CONECTA/03_ELEMENTOS/menus.md
MAPA_COMPLETO_CONECTA/03_ELEMENTOS/modais.md
MAPA_COMPLETO_CONECTA/03_ELEMENTOS/tabelas.md
MAPA_COMPLETO_CONECTA/04_FLUXOS/diagramas.md
MAPA_COMPLETO_CONECTA/04_FLUXOS/fluxos_principais.md
MAPA_COMPLETO_CONECTA/04_FLUXOS/fluxos_secundarios.md
MAPA_COMPLETO_CONECTA/04_FLUXOS/jornada_do_candidato.md
MAPA_COMPLETO_CONECTA/04_FLUXOS/jornada_do_rh.md
MAPA_COMPLETO_CONECTA/04_FLUXOS/processos_seletivos.md
MAPA_COMPLETO_CONECTA/05_REGRAS/dependencias.md
MAPA_COMPLETO_CONECTA/05_REGRAS/permissoes.md
MAPA_COMPLETO_CONECTA/05_REGRAS/regras_de_negocio.md
MAPA_COMPLETO_CONECTA/05_REGRAS/status_e_transicoes.md
MAPA_COMPLETO_CONECTA/05_REGRAS/validacoes.md
MAPA_COMPLETO_CONECTA/06_DADOS/ciclo_das_informacoes.md
MAPA_COMPLETO_CONECTA/06_DADOS/inventario_de_informacoes.md
MAPA_COMPLETO_CONECTA/06_DADOS/origem_e_destino.md
MAPA_COMPLETO_CONECTA/06_DADOS/relacionamento_dos_dados.md
MAPA_COMPLETO_CONECTA/07_DESIGN_E_USABILIDADE/acessibilidade.md
MAPA_COMPLETO_CONECTA/07_DESIGN_E_USABILIDADE/design_atual.md
MAPA_COMPLETO_CONECTA/07_DESIGN_E_USABILIDADE/inconsistencias.md
MAPA_COMPLETO_CONECTA/07_DESIGN_E_USABILIDADE/padroes_visuais.md
MAPA_COMPLETO_CONECTA/07_DESIGN_E_USABILIDADE/responsividade.md
MAPA_COMPLETO_CONECTA/07_DESIGN_E_USABILIDADE/usabilidade.md
MAPA_COMPLETO_CONECTA/08_AUDITORIA/funcionalidades_operantes.md
MAPA_COMPLETO_CONECTA/08_AUDITORIA/itens_nao_testados.md
MAPA_COMPLETO_CONECTA/08_AUDITORIA/problemas_encontrados.md
MAPA_COMPLETO_CONECTA/08_AUDITORIA/riscos.md
MAPA_COMPLETO_CONECTA/08_AUDITORIA/testes_realizados.md
MAPA_COMPLETO_CONECTA/09_MELHORIAS/backlog_de_ajustes.md
MAPA_COMPLETO_CONECTA/09_MELHORIAS/melhorias_de_fluxo.md
MAPA_COMPLETO_CONECTA/09_MELHORIAS/melhorias_por_tela.md
MAPA_COMPLETO_CONECTA/09_MELHORIAS/oportunidades_futuras.md
MAPA_COMPLETO_CONECTA/09_MELHORIAS/prioridades.md
MAPA_COMPLETO_CONECTA/10_MATRIZES/impactos.md
MAPA_COMPLETO_CONECTA/10_MATRIZES/rastreabilidade.md
MAPA_COMPLETO_CONECTA/10_MATRIZES/regras_e_fluxos.md
MAPA_COMPLETO_CONECTA/10_MATRIZES/telas_e_elementos.md
SECURITY.md
apps/backend/rh_api/services/microsoft_auth_service.py
apps/backend/tests/test_microsoft_auth.py
apps/frontend/estilos/Fundo Provas inicial.png
apps/frontend/estilos/Fundo Provas.png
apps/frontend/estilos/favicon.png
apps/frontend/fonte/features/prova/services/analise-resposta.js
apps/frontend/fonte/rotulos-etapas.js
apps/frontend/fonte/shared/components/share-job-modal.js
apps/frontend/fonte/shared/status-catalog.js
docs/checklist-atualizacao-conecta-2026-07-14.md
docs/relatorio-tecnico-atualizacao-conecta-2026-07-14.md
infra/sql/migrations/V002__trabalhe_conosco_email_candidate_fields.sql
infra/sql/migrations/V003__process_status_and_inactivity_alerts.sql
infra/sql/migrations/V004__microsoft_entra_authentication.rollback.sql
infra/sql/migrations/V004__microsoft_entra_authentication.sql
runtime/tools/importar_provas_reformuladas.py
```

### 9.2 Arquivos alterados na comparação `0413046..HEAD` — 69

```text
.env.example
.gitignore
apps/backend/rh_api/auth.py
apps/backend/rh_api/config.py
apps/backend/rh_api/main.py
apps/backend/rh_api/rbac.py
apps/backend/rh_api/repositories/analytics.py
apps/backend/rh_api/repositories/base.py
apps/backend/rh_api/repositories/bootstrap.py
apps/backend/rh_api/repositories/candidate_sheet.py
apps/backend/rh_api/repositories/email_inbox.py
apps/backend/rh_api/repositories/generated_exams.py
apps/backend/rh_api/repositories/processes.py
apps/backend/rh_api/repositories/profiles.py
apps/backend/rh_api/repositories/security.py
apps/backend/rh_api/repositories/talent_bank.py
apps/backend/rh_api/routers/auth.py
apps/backend/rh_api/routers/generated_exams.py
apps/backend/rh_api/routers/processes.py
apps/backend/rh_api/schemas/generated_exams.py
apps/backend/rh_api/schemas/processes.py
apps/backend/rh_api/schemas/security.py
apps/backend/rh_api/services/email_inbox_service.py
apps/backend/rh_api/services/process_flow.py
apps/backend/tests/test_email_inbox_service.py
apps/backend/tests/test_generated_exams_score.py
apps/frontend/data/bancoQuestoesReformuladas.json
apps/frontend/estilos/estilos.css
apps/frontend/estilos/exam-steps.css
apps/frontend/estilos/screens.css
apps/frontend/fonte/aplicacao.js
apps/frontend/fonte/app/aplicacao-raiz.js
apps/frontend/fonte/app/controlador-aplicacao.js
apps/frontend/fonte/banco-questoes.js
apps/frontend/fonte/features/candidatos/index.js
apps/frontend/fonte/features/conecta-provas/index.js
apps/frontend/fonte/features/configuracoes/index.js
apps/frontend/fonte/features/entrevistas/index.js
apps/frontend/fonte/features/gestao/index.js
apps/frontend/fonte/features/processos/index.js
apps/frontend/fonte/features/prova/index.js
apps/frontend/fonte/features/prova/services/personalizacao-inteligente.js
apps/frontend/fonte/features/provas-geradas/index.js
apps/frontend/fonte/features/telas-gestao.js
apps/frontend/fonte/perguntas.js
apps/frontend/fonte/principal.js
apps/frontend/fonte/regras-prova.js
apps/frontend/fonte/rotas.js
apps/frontend/fonte/services/api/analytics.js
apps/frontend/fonte/services/api/auth.js
apps/frontend/fonte/services/api/core.js
apps/frontend/fonte/services/api/generated-exams.js
apps/frontend/fonte/services/api/processes.js
apps/frontend/fonte/servico-api.js
apps/frontend/fonte/shared/components/empty-table-row.js
apps/frontend/fonte/shared/helpers-visuais.js
apps/frontend/fonte/shared/process-flow.js
apps/frontend/fonte/shared/tour-config.js
apps/frontend/fonte/ui/busca-global.js
apps/frontend/fonte/ui/componentes-compartilhados.js
apps/frontend/fonte/ui/components/feedback.js
apps/frontend/fonte/ui/components/layout.js
apps/frontend/fonte/ui/components/modals.js
apps/frontend/index.html
apps/frontend/tests/run-conecta-provas-flow-smoke.cjs
apps/frontend/tests/run-refresh-performance-smoke.cjs
apps/frontend/tests/run-rh-business-rules-smoke.cjs
requirements.txt
tools/importar_provas_reformuladas.py
```

### 9.3 Arquivos removidos na comparação `0413046..HEAD`

**Nenhum.** Os 157 arquivos de `.edge-headless-syntax-debug` foram criados e removidos dentro do próprio período e, por isso, são apenas artefatos transitórios sem alteração líquida contra a produção de 07/07.

### 9.4 Arquivos rastreados modificados localmente após o `HEAD` — 33

```text
apps/backend/Dockerfile
apps/backend/rh_api/main.py
apps/backend/rh_api/rbac.py
apps/backend/rh_api/repositories/bootstrap.py
apps/backend/rh_api/repositories/db_repository.py
apps/backend/rh_api/repositories/generated_exams.py
apps/backend/rh_api/routers/generated_exams.py
apps/backend/rh_api/schemas/generated_exams.py
apps/frontend/estilos/estilos.css
apps/frontend/fonte/aplicacao.js
apps/frontend/fonte/app/aplicacao-raiz.js
apps/frontend/fonte/app/controlador-aplicacao.js
apps/frontend/fonte/features/candidatos/analise-curriculo-ia.js
apps/frontend/fonte/features/candidatos/index.js
apps/frontend/fonte/features/conecta-provas/index.js
apps/frontend/fonte/features/gestao/index.js
apps/frontend/fonte/features/processos/index.js
apps/frontend/fonte/features/provas-geradas/index.js
apps/frontend/fonte/features/public-candidacy/index.js
apps/frontend/fonte/perguntas.js
apps/frontend/fonte/principal.js
apps/frontend/fonte/rotas.js
apps/frontend/fonte/services/api/generated-exams.js
apps/frontend/fonte/servico-api.js
apps/frontend/fonte/ui/busca-global.js
apps/frontend/fonte/ui/components/layout.js
apps/frontend/index.html
apps/frontend/tests/run-conecta-provas-flow-smoke.cjs
apps/frontend/tests/run-rh-business-rules-smoke.cjs
docs/testes.md
infra/docker/compose.dev.yml
infra/docker/compose.hml.yml
infra/docker/compose.prod.yml
```

### 9.5 Arquivos não rastreados do produto — 16

Esta lista representa o estado encontrado antes da geração do presente relatório e exclui o próprio arquivo `RELATORIO_ATUALIZACOES_CONECTA_DESDE_07_07_2026.md`.

```text
apps/backend/rh_api/repositories/exam_analytics.py
apps/backend/rh_api/repositories/exam_analytics_schema.py
apps/backend/rh_api/routers/exam_analytics.py
apps/backend/rh_api/schemas/exam_analytics.py
apps/backend/rh_api/services/exam_analytics.py
apps/backend/rh_api/workers/__init__.py
apps/backend/rh_api/workers/exam_analytics.py
apps/backend/tests/test_exam_analytics.py
apps/frontend/estilos/exam-analytics.css
apps/frontend/fonte/features/resultados-analiticos/index.js
apps/frontend/fonte/services/api/exam-analytics.js
apps/frontend/tests/run-exam-analytics-smoke.cjs
docs/modulo-analitico-resultados-provas.md
infra/sql/migrations/V005__exam_analytical_results.rollback.sql
infra/sql/migrations/V005__exam_analytical_results.sql
tools/processar_resultados_analiticos.py
```

## 10. Itens parciais, internos ou não confirmados

### Presentes no código, mas não finalizados ou não comprovados

- alerta de inatividade de 30 dias: persistência e endpoint existem, mas não foi comprovado agendamento nem envio externo;
- `SECURITY.md`: contém texto de modelo e precisa de versões suportadas, contato, canal e SLA reais;
- campo `data_saida` do relatório: usa cálculo de 60 dias, não evento real de saída;
- History API: depende de fallback do servidor web para acesso direto às rotas;
- autenticação Microsoft: depende de V004 e configuração do tenant/segredos/redirect URI;
- migrations V002–V004: existem no repositório, mas a aplicação em produção não foi demonstrada;
- importação do banco reformulado: código pronto, execução da carga não comprovada;
- retenção de e-mails: código implementado, mas a aprovação operacional/LGPD e o comportamento no servidor remoto devem ser confirmados;
- teste rápido de performance: está incompatível com o TTL de 1 hora da implementação;
- análise de Word: é sugestão heurística com revisão humana, não correção automática definitiva.

### Trabalho não versionado e excluído da lista de entregas

- módulo de resultados analíticos, telemetria, ranking, comparação, V005 e worker;
- blueprint de prova para Qualidade e regras locais associadas;
- integrações locais do módulo analítico em backend, frontend e Docker Compose.

### Itens deliberadamente não tratados como novidade

- fluxo básico por etapas e rótulos do Conecta Provas, já existentes em `0413046`;
- personalização inteligente de provas, já existente na base;
- comando de compartilhar vaga, já existente na base;
- integração com Microsoft Graph/IMAP para caixa de e-mail, já existente na base;
- telas de usuários, perfis, relatórios, candidatos, processos e provas, já existentes e apenas evoluídas;
- ideias e backlog registrados em `MAPA_COMPLETO_CONECTA`;
- 157 arquivos temporários do Edge, criados e removidos no intervalo.

## 11. Resumo executivo para o próximo comunicado

**Assunto sugerido:** Atualizações do Conecta implementadas após 07/07/2026

**Texto-base, sujeito à confirmação do deploy e das migrations:**

Desde a atualização de 07/07, o Conecta recebeu evoluções nos fluxos de recrutamento, candidatos e provas. As candidaturas do Trabalhe Conosco passaram a ter leitura estruturada e validação de inconsistências; o cadastro de candidatos ganhou informações adicionais; e os relatórios foram ampliados com novos filtros, colunas e exportações em CSV e Excel. Processos seletivos agora contam com pausa, retomada e cancelamento justificados, além de navegação e confirmações mais claras.

No Conecta Provas, a conclusão de etapa ficou restrita à última questão, o abandono passou a zerar e invalidar a etapa, a composição de prova ganhou seleção de etapas e níveis e a correção de Word passou a oferecer análise de formatação como apoio ao RH. Também foram adicionadas questões de Planejamento, novos critérios estruturados de avaliação e uma nova identidade visual. O código inclui ainda acesso corporativo pelo Microsoft Entra ID, condicionado à configuração e à migration de implantação.

Não devem entrar no comunicado como entregues: alertas automáticos de inatividade, política de segurança operacional, módulo de resultados analíticos e blueprint de Qualidade, pois estão parciais, não configurados ou ainda não versionados.

## Atualizações realizadas após a produção de 07/07/2026

As atualizações abaixo são exclusivamente alterações implementadas em commits posteriores ao marco de produção `0413046`. Recursos que já existiam em 07/07 são descritos como evolução, nunca como novidade. A presença no repositório não comprova, por si só, que o `HEAD` e as migrations já foram implantados em produção.

- **Trabalhe Conosco:** evolução da caixa de entrada para interpretar os campos estruturados da candidatura, validar inconsistências e importar os dados para candidato, processo e banco de talentos.
- **Cadastro de candidatos:** ampliação do perfil com endereço, escolaridade, experiência e preferências recebidas no formulário, preservadas entre os módulos.
- **Relatórios:** evolução das consultas de processos e candidatos com novas abas, filtros, paginação, colunas e exportação em CSV e XLSX.
- **Administração de acesso:** evolução das telas de usuários, perfis, permissões e auditoria, com filtros, painel de edição, ações justificadas e comparação de permissões.
- **Autenticação:** inclusão no código do login corporativo pelo Microsoft Entra ID, com vínculo controlado de identidade, validação do tenant e auditoria.
- **Processos seletivos:** inclusão de pausa, retomada e cancelamento com justificativa, auditoria e bloqueio de movimentações incompatíveis.
- **Ações sensíveis:** substituição de confirmações simples por modal explicativo nos fluxos de processo e de provas abrangidos pela mudança.
- **Navegação:** adoção de rotas sem hash, reorganização do menu de Recrutamento e retirada do acesso ativo a Regras reutilizáveis.
- **Conecta Provas — progressão:** correção para permitir concluir uma etapa somente na última questão, com validação também no backend.
- **Conecta Provas — abandono:** nova regra que interrompe, invalida e zera a etapa quando o candidato confirma a saída durante a execução.
- **Personalização de provas:** evolução do recurso já existente para permitir seleção de etapas e definição de nível por etapa.
- **Compartilhamento de vaga:** evolução do comando existente para gerar texto padronizado em modal e copiá-lo para divulgação.
- **Correção de Word:** inclusão de análise de formatação e sugestão explicável de resultado, sempre sujeita à revisão humana.
- **Banco de questões:** inclusão de 8 questões de Planejamento, passando de 66 para 74 questões, e estruturação de critérios de avaliação nas questões existentes.
- **Visual das provas:** substituição do fundo azul pelas novas imagens, inclusão de favicon e ajuste visual dos estados das etapas.
- **Caixa de e-mails:** implementação da retenção local de 60 dias e cache de 1 hora para reduzir recargas repetidas.
- **Performance:** implementação de cache central, invalidação seletiva e deduplicação de requisições nas principais consultas do frontend.
- **Segurança das avaliações:** reforço da sanitização do payload público para não expor gabaritos, rubricas e critérios internos de correção.
