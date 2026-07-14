# Relacionamento dos dados

```mermaid
%%{init: {"theme": "dark"}}%%
flowchart TD
  Email["E-mail"] --> CV["CV/anexo"]
  CV --> Analise["Analise CV"]
  Analise --> Candidato["Candidato"]
  Processo["Processo"] --> CandidatoProcesso["Candidato no processo"]
  Candidato --> CandidatoProcesso
  CandidatoProcesso --> Entrevista
  Slot --> Entrevista
  CandidatoProcesso --> Prova
  Prova --> Resultado
  Resultado --> Historico
  CandidatoProcesso --> Decisao["Aprovado/Eliminado/Banco"]
  Decisao --> Banco["Banco de Talentos"]
  Usuario --> Log
  Decisao --> Log
```

## Pontos de sincronizacao

- Alterar contato do candidato deve refletir em ficha, processo, banco e comunicacao.
- Alterar status do candidato afeta listas, filtros, acoes permitidas e relatorios.
- Encerrar processo deve bloquear acoes em detalhes, entrevistas e prova vinculada.
- Alterar perfil/permissao afeta menu e botoes no proximo carregamento/sessao.
