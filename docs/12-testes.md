# 12 - Testes

## Objetivo

Garantir que a plataforma continue integrada entre frontend, backend e banco sem regressao em rotas criticas.

## Testes automatizados existentes

Arquivo atual:

- `api/tests/test_auth_and_pipeline.py`

Cobre:

- autenticacao local
- leitura de historico
- criacao, movimentacao e exclusao de cards do pipeline
- criacao e atualizacao de entrevista
- identificacao de erro de deadlock

## Comando de execucao

```powershell
python -m pytest api\tests\test_auth_and_pipeline.py -q
```

## Casos de teste manuais recomendados

### Login

- Login valido deve abrir o painel.
- Login invalido deve retornar mensagem amigavel.
- Sessao expirada deve exigir novo login.

### Historico

- Listagem sem filtros deve carregar.
- Filtro por nome deve retornar subconjunto correto.
- Abertura de detalhe salvo deve funcionar.

### Processo

- Criar processo com nota de corte valida.
- Editar processo existente.
- Encerrar processo manualmente.
- Abrir detalhes do processo sem erro 500.

### Deadlock e estabilidade

- Abrir detalhes do mesmo processo em mais de uma aba.
- Repetir recarga da tela de detalhe rapidamente.
- Confirmar que nao ocorre mais erro estrutural por `ensure_interviews_table` em leitura.
- Se houver disputa transitoria, a API deve retornar mensagem amigavel e sem stack trace bruto.

### CV

- Enviar arquivo de CV valido.
- Editar dados da pre-analise.
- Adicionar pre-analise ao processo.

### Pipeline

- Criar card manual.
- Mover card entre etapas.
- Excluir card.
- Confirmar reflexo do status nas telas relacionadas.

### Banco de talentos

- Enviar candidato para banco de talentos.
- Confirmar aparicao na tela de talentos.
- Reutilizar candidato em processo aberto.

### Entrevistas

- Agendar entrevista futura.
- Atualizar status para `Confirmado`.
- Validar exibicao no detalhe do processo e na agenda geral.

### Analise

- Abrir ranking analitico.
- Abrir detalhe do candidato.
- Validar parecer final quando houver nota de corte ativa.

### Tour guiado

- Primeira visita deve abrir o tour automaticamente.
- Segunda visita na mesma tela e navegador nao deve abrir automaticamente.
- Botao `Ver orientacoes` deve reabrir o tour.

### Layout

- Validar uso em notebook sem zoom.
- Validar menu lateral, tabelas, cards, filtros e botoes.
- Validar telas em largura reduzida.

## Criterios de aceitacao

- Nenhuma rota principal quebrada.
- Erros retornam JSON padronizado.
- Tela de detalhes do processo carrega com estabilidade.
- Tour aparece apenas quando esperado.
- Interface fica mais compacta sem prejuizo de leitura.

## Evidencias esperadas

- Captura do login.
- Captura da lista de processos.
- Captura do detalhe do processo.
- Captura do pipeline.
- Captura da agenda de entrevistas.
- Log de execucao dos testes automatizados.
