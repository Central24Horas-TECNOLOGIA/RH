# Formularios

## Novo processo

| Campo | Tipo | Obrigatorio | Regra | Origem | Destino |
| --- | --- | ---: | --- | --- | --- |
| Vaga do processo | select | Sim | escolher catalogo de vagas | RH | processo |
| Quantidade de vagas | numero | Sim | minimo recomendado 1 | RH | processo/resumo |
| Data de encerramento | data | Sim | deve ser coerente/futura | RH | processo |
| Operacao / Cliente | select | Sim | cliente da vaga | RH | processo/filtros |
| Area / Trilha | select | Sim | trilha avaliativa | RH | prova/processo |
| Ativar nota de corte | checkbox | Nao | habilita nota minima | RH | regra do processo |
| Nota minima | numero | Condicional | ativo somente com nota de corte | RH | triagem/resultado |

## Criar disponibilidade de entrevista

| Campo | Tipo | Obrigatorio | Regra | Destino |
| --- | --- | ---: | --- | --- |
| Processo | select | Sim operacional | slot pode ser geral ou por processo | calendario |
| Data | data | Sim | preferencialmente futura | slot |
| Inicio | hora | Sim | menor que fim | slot |
| Fim | hora | Sim | maior que inicio | slot |
| Duracao | numero | Sim | define particionamento | slots |
| Capacidade por slot | numero | Sim | vagas por horario | slots |

## Usuario

| Campo | Tipo | Obrigatorio | Regra | Destino |
| --- | --- | ---: | --- | --- |
| Nome | texto | Sim | identificacao humana | usuario/perfil |
| E-mail | e-mail | Sim | contato/login possivel | usuario |
| Login | texto | Nao | usa e-mail se vazio | autenticacao |
| Perfil | select | Sim | define permissoes | menu/acoes |
| Status | select | Sim | Ativo/Inativo/Bloqueado | acesso |
| Nova senha | senha | Condicional | redefine senha | autenticacao |
| Justificativa | texto longo | Recomendado | auditoria de alteracoes sensiveis | logs |

## Regras reutilizaveis / catalogo

| Campo | Tipo | Obrigatorio | Regra | Destino |
| --- | --- | ---: | --- | --- |
| Nome | texto | Sim | nome exibido | catalogo |
| Chave | texto | Nao | identificador | regras |
| Categoria | texto | Nao | agrupamento | catalogo |
| Criticidade | select | Nao | Operacional/Atencao/Critica | priorizacao |
| Descricao | textarea | Nao | contexto | catalogo |
| Tags | texto | Nao | separadas por virgula | filtros |
| Aplicavel a | select | Nao | todos/especificos/RH | regra |
| Permissoes relacionadas | texto | Nao | chaves separadas | controle |
| Item ativo | checkbox | Nao | habilita/desabilita | fluxos |
| Justificativa | texto | Recomendado | auditoria | logs |

## Aprovacao de candidato

| Campo | Tipo | Obrigatorio | Regra | Destino |
| --- | --- | ---: | --- | --- |
| Candidato | texto bloqueado | Sim | candidato selecionado | decisao |
| Data de comparecimento | data | Condicional | orienta admissao | mensagem |
| Documentos solicitados | checklist | Nao | pacote de documentos | comunicacao |
| Mensagem que sera enviada | textarea | Sim operacional | pode ser enviada por canal | WhatsApp/e-mail |
| Anexo da aprovacao | upload | Nao | arquivo complementar | comunicacao |

## Eliminacao de candidato

| Campo | Tipo | Obrigatorio | Regra | Destino |
| --- | --- | ---: | --- | --- |
| Candidato | texto bloqueado | Sim | candidato selecionado | decisao |
| Motivo da eliminacao | select | Sim | catalogo de motivos | historico |
| Em qual entrevista? | select condicional | Condicional | aparece quando motivo e entrevista | historico |

