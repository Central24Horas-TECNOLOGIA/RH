# 08 - Manual do Usuario RH

## Como acessar

1. Abra a URL local do frontend.
2. Entre com usuario e senha cadastrados no `.env`.
3. Apos o login, use o menu lateral para navegar.

## Login

1. Informe o login corporativo configurado.
2. Informe a senha.
3. Clique em `Acessar sistema`.

Se for a primeira visita, o tour guiado da tela pode aparecer automaticamente.

## Painel inicial

- Veja os registros recentes.
- Use os atalhos para abrir historico, processos ou iniciar nova prova.
- Se quiser rever a orientacao da tela, clique em `Ver orientacoes`.

## Como cadastrar processo

1. Acesse `Processos` e clique em `Novo processo`.
2. Informe vaga, quantidade de vagas e data de encerramento.
3. Preencha operacao e trilha quando aplicavel.
4. Ative nota de corte apenas se a vaga exigir esse filtro.
5. Informe o link de agendamento se a entrevista usara um link padrao.
6. Salve o processo.

## Como iniciar prova

1. Acesse `Configuracao`.
2. Selecione o processo.
3. Escolha vaga, nivel, trilha e tempo.
4. Avance para identificar o candidato.
5. Inicie a prova.

## Como ver resultados

1. Abra `Historico`.
2. Filtre por nome, vaga ou data.
3. Abra o detalhe salvo.
4. Baixe o pacote quando precisar de evidencias.

## Como acompanhar processos

1. Acesse `Processos`.
2. Filtre a lista de processos abertos.
3. Clique em `Detalhes`.
4. Na tela de detalhe, acompanhe:
   - resumo do processo
   - pre-analise de CV
   - candidatos no processo
   - entrevistas agendadas

## Como usar pre-analise de CV

1. Abra os detalhes do processo.
2. Envie o arquivo do CV.
3. Aguarde a classificacao.
4. Revise nome, contato e score.
5. Clique em `Adicionar` quando o candidato estiver aprovado para entrar no processo.

## Como usar pipeline

1. Abra `Pipeline`.
2. Filtre por processo ou nome.
3. Avance ou retorne cards conforme a etapa.
4. Use `Novo card` para candidatos inseridos manualmente.

## Como mover candidato para banco de talentos

1. Na tela de processo ou de analise, escolha a acao `Banco de talentos`.
2. O candidato passa a aparecer na tela `Banco de talentos`.
3. Use filtros por nome, habilidade ou tag para localizar o perfil depois.

## Como reutilizar candidato do banco

1. Abra `Banco de talentos`.
2. Localize o candidato.
3. Clique em usar ou reaproveitar.
4. Escolha o processo de destino.
5. Confirme.

## Como agendar entrevista

1. A partir do processo, clique em `Agendar entrevista`.
2. Informe data e hora futuras.
3. Revise o link de agendamento.
4. Salve.
5. A agenda geral sera atualizada automaticamente.

## Como lidar com erros comuns

### Sessao expirada

- Faca login novamente.

### Falha de conexao com a API

- Confirme se o backend esta ativo em `127.0.0.1:8000`.

### Processo nao carrega

- Atualize a tela.
- Se a mensagem mencionar indisponibilidade temporaria do banco, aguarde alguns segundos e tente novamente.

### Tour nao abriu

- A tela pode ja ter sido marcada como vista.
- Use o botao `Ver orientacoes`.
