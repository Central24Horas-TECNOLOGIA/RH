# Checklist - Atualização Conecta

Legenda: Implementado / Validado / Testado.

1. Cache e otimização do carregamento: Implementado parcialmente / Validado por smoke / Testado por `run-refresh-performance-smoke.cjs`.
2. Indicador visual de carregamento: Parcial, com `LoadingState` existente e modal loading / Validado parcialmente / Testado por sintaxe.
3. Remoção da tela Regras reutilizáveis: Implementado / Validado por busca em frontend ativo / Testado por sintaxe.
4. Remoção do `#` das rotas: Implementado / Validado por sintaxe / Teste funcional em navegador não executado.
5. Rotas legadas de candidatos, provas e resultados: Parcial, compatibilidade de hashes e rota de regras / Validação completa pendente.
6. Busca global, labels e acessibilidade: Parcial, busca global e filtro de prova corrigidos / Auditoria total pendente.
7. Modal padrão para ações importantes: Implementado componente `ModalConfirmacaoAcao` / Validado em provas e processos / Testado por sintaxe.
8. Remoção dos prompts nativos das provas: Implementado para cancelamento/reabertura em Provas Geradas e Detalhe do Processo / Validado por `rg window.prompt` / Testado por sintaxe.
9. Catálogo único de status: Implementado catálogo inicial / Integração total em todas as telas pendente.
10. Logs INC-04 Autenticação duplicada: Implementado / Validado por normalização de leitura/gravação / Testado por backend selecionado.
11. Experiência de provas INC-05: Implementado modal para cancelamento/reabertura com justificativa / Log depende dos endpoints existentes de prova.
12. Campos identificados como ícones INC-06: Parcial, busca global e prova / Auditoria total pendente.
13. Menu INC-07: Implementado Recrutamento > Processos Seletivos / Validado por diff.
14. Tabelas vazias INC-08: Parcial, aprovados no detalhe do processo / Auditoria total pendente.
15. Separação Utilizar/Eliminar: Não concluído nesta rodada / Pendente.
16. Justificativas obrigatórias sensíveis: Implementado para pausar/retomar/cancelar processo e provas / Outras ações pendentes.
17. Melhoria da tela de entrevistas: Não concluído nesta rodada / Pendente.
18. Organização das configurações: Parcial, remoção da aba de regras / Reorganização ampla pendente.
19. Estados vazios explicativos: Parcial, aprovados e alguns estados existentes / Auditoria total pendente.
20. Responsividade das tabelas: Não concluído nesta rodada / Pendente.
21. Botão Adicionar candidato: Implementado para tela inicial e detalhe redesenhado apontarem à Central de Candidatos / Teste funcional navegador pendente.
22. Notificação vaga sem movimentação 30 dias: Implementado backend idempotente e migration / E-mail real depende de configuração externa / Teste unitário específico pendente.
23. Pausar processo seletivo: Implementado API e UI com justificativa/log / Testado por sintaxe e backend selecionado.
24. Cancelar processo seletivo: Implementado API e UI com justificativa/log / Testado por sintaxe e backend selecionado.
25. Padronização nomes, acentos e textos: Parcial, Autenticação e status principais / Auditoria total pendente.
26. Auditoria e logs: Implementado para novas ações de processo e monitor / Validado por testes backend selecionados.
27. Tratamento de erros: Implementado nos novos fluxos principais / Validação visual pendente.
28. Testes obrigatórios: Parcial, testes automatizados disponíveis executados / bateria completa E2E e responsiva pendente.
29. Critérios finais de aceite: Parcial, ver relatório técnico para itens concluídos e pendentes.
30. Entrega obrigatória: Implementado este checklist e relatório técnico.
