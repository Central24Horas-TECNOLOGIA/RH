# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Requisitos funcionais

| Código | Requisito |
|---|---|
| RF01 | Autenticar usuário administrativo do RH. |
| RF02 | Criar, listar, atualizar e encerrar processos seletivos. |
| RF03 | Gerar e desativar link público de candidatura. |
| RF04 | Receber candidatura pública com dados básicos e currículo. |
| RF05 | Listar candidatos vinculados a processos. |
| RF06 | Atualizar status do candidato: análise, aprovado, eliminado, desistente ou banco de talentos. |
| RF07 | Registrar perfil, contato, observações e origem do candidato. |
| RF08 | Analisar CV de e-mail, candidatura pública ou upload/manual. |
| RF09 | Enviar candidato para banco de talentos e reutilizá-lo em processo. |
| RF10 | Criar slots e agendar entrevistas. |
| RF11 | Aplicar prova por vaga, nível e trilha. |
| RF12 | Salvar histórico, gabarito e arquivos de resposta da prova. |
| RF13 | Exibir relatórios de processos e candidatos. |
| RF14 | Exportar relatórios. |
| RF15 | Excluir/ignorar e-mails recebidos quando necessário. |

## Requisitos não funcionais

| Código | Requisito |
|---|---|
| RNF01 | Frontend deve rodar como arquivo estático servido localmente. |
| RNF02 | Backend deve separar routers, schemas, services e repositories. |
| RNF03 | SQL deve ficar nos repositories, não nos routers. |
| RNF04 | Segredos não devem ficar no código-fonte. |
| RNF05 | Erros devem retornar mensagens controladas. |
| RNF06 | Testes devem rodar sem depender do banco real. |
| RNF07 | Sistema deve preservar compatibilidade com imports legados enquanto evolui. |
| RNF08 | Dados pessoais devem ter acesso restrito e retenção controlada. |

## Regras de negócio

### Autenticação

- Módulos administrativos exigem login.
- Endpoints administrativos usam validação do usuário atual.
- Sessão inválida/expirada deve direcionar o usuário ao login.

### Processos

- Processo aberto permite inclusão, análise e entrevista de candidatos.
- Processo encerrado deve bloquear novas movimentações operacionais.
- Link público deve ser invalidado/desativado quando o processo fechar ou quando o RH solicitar.

### Candidatos

- Todo candidato deve ter origem identificável quando possível: página pública, e-mail, análise direta, banco de talentos ou processo único.
- Ações de aprovação, eliminação e envio ao banco devem manter histórico/movimentação.
- Candidato aprovado/eliminado não deve continuar como ativo no fluxo operacional do processo.

### CV

- A análise automática apoia decisão, mas não substitui revisão do RH.
- RH pode usar candidato mesmo com baixa classificação, desde que confirme conscientemente.
- Dados extraídos automaticamente devem poder ser revisados.

### Provas

- Prova considera vaga, nível e trilha.
- Resultado deve salvar nota final, etapas, pendências e observações do RH.
- Entrega incompleta deve gerar alerta ou pendência.

### Entrevistas

- Slot possui capacidade e status.
- Agendamento deve consumir vaga no slot.
- Alterações de status devem ser salvas para acompanhamento.
