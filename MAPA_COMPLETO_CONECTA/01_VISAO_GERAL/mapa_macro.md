# Mapa macro do Conecta

## Visao geral

```mermaid
%%{init: {"theme": "dark"}}%%
flowchart TD
  Login["Login RH"] --> Inicio["Inicio / painel"]
  Inicio --> Email["Caixa de E-mail"]
  Inicio --> Processos["Processos seletivos"]
  Inicio --> Entrevistas["Entrevistas"]
  Inicio --> Relatorios["Relatorios"]
  Inicio --> Config["Configuracoes"]
  Inicio --> ProvasGeradas["Provas e resultados"]

  Email --> EmailDetalhe["Detalhe do e-mail"]
  Email --> AnaliseCV["Analise de CV"]
  Email --> Vincular["Vincular a processo"]
  Email --> Banco["Banco de Talentos"]

  Processos --> NovoProcesso["Novo processo"]
  Processos --> Detalhe["Detalhes do processo"]
  Processos --> Encerrados["Processos encerrados"]
  Detalhe --> CandidatosProcesso["Candidatos no processo"]
  Detalhe --> Dossie["Dossie do processo"]
  Detalhe --> AbaEntrevistas["Entrevistas do processo"]
  Detalhe --> AbaProvas["Provas do processo"]
  Detalhe --> HistoricoProcesso["Historico do processo"]

  CandidatosProcesso --> Ficha["Ficha do candidato"]
  CandidatosProcesso --> Agendar["Agendar entrevista"]
  CandidatosProcesso --> Aprovar["Aprovar"]
  CandidatosProcesso --> Eliminar["Eliminar"]
  CandidatosProcesso --> Banco

  Entrevistas --> Slots["Disponibilidades / slots"]
  Slots --> Agendar
  Agendar --> Confirmar["Confirmar / reagendar / cancelar"]

  ProvasGeradas --> LinkProva["Link/codigo de prova"]
  LinkProva --> PortalProva["Conecta Provas"]
  PortalProva --> Resultado["Resultado / historico"]

  Config --> Usuarios["Usuarios"]
  Config --> Perfis["Perfis e permissoes"]
  Config --> Regras["Regras reutilizaveis"]
  Config --> Logs["Logs de auditoria"]
```

## Areas principais

| Area | Papel no produto | Entrada principal | Saidas |
| --- | --- | --- | --- |
| Inicio | Painel operacional e atalhos | Login | E-mails, processos, entrevistas, relatorios, configuracoes |
| E-mails | Triagem de curriculos recebidos | Menu ou painel | Analise de CV, vinculo, banco de talentos |
| Processos | Criacao e gestao de vagas | Menu Processos | Detalhes, candidatos, entrevistas, provas, encerramento |
| Candidatos | Visao consolidada da pessoa candidata | Relatorios > Candidatos | Ficha, edicao, status, processo, banco |
| Entrevistas | Calendario e slots | Menu Entrevistas | Disponibilidade e agenda |
| Banco de Talentos | Reaproveitamento | Menu ou acoes de candidato/e-mail | Uso em processo, edicao, eliminacao |
| Provas e Resultados | Gestao de provas geradas | Menu Processos | Detalhes, alertas, cancelamento/reabertura |
| Configuracoes | Governanca | Menu Configuracoes | Usuarios, perfis, catalogos, logs |
| Conecta Provas | Entrada externa do candidato | Link/codigo | Prova realizada e resultado |

## Pontos de entrada

- Login interno do RH.
- Menu lateral.
- Atalhos da pagina inicial.
- Busca global.
- Link publico de prova `#/conecta-provas`.
- Link publico de candidatura `#/candidatar/<slug>`, identificado mas sem link ativo na amostra.

## Pontos de saida

- Logout.
- Exportacao de logs.
- Downloads de prova/CV/anexos quando disponiveis.
- Links externos/compartilhamento de vaga e prova.
