# Como rodar o Conecta/RH

> **⚠️ Documento histórico, não é o guia vigente.** Descreve o layout anterior à reorganização do projeto (`api/`, `Front/`) — hoje é `apps/backend`/`apps/frontend`, e o deploy real de HML/PROD é containerizado (Docker Compose + Caddy). Para o guia atual, use:
> - **Execução local e Docker**: [README da raiz](../README.md);
> - **Release e rollback**: [docs/deploy/](deploy/);
> - **Operação (incidentes, backup)**: [docs/operacao/](operacao/).
>
> A seção 4 (ativar/desativar IA) e a seção 5 (testar análise de currículo) abaixo continuam descrevendo um comportamento de produto atual, mesmo que os comandos de execução estejam desatualizados. Mantido para referência — achado DEVOPS-003 do [programa de evolução do Conecta](connecta-evolution/README.md).

## 1. Configurar o ambiente

Na raiz do projeto, copie `.env.example` para `.env` e preencha somente os
valores do ambiente local. O `.env` contém segredos e não deve ser versionado.

Configuração mínima do servidor e banco:

```env
RH_API_HOST=127.0.0.1
RH_API_PORT=8000
RH_FRONT_SERVE_STATIC=true

RH_SQL_SERVER=
RH_SQL_DATABASE=RH_Provas
RH_SQL_DRIVER=ODBC Driver 18 for SQL Server
RH_SQL_TRUSTED_CONNECTION=true
RH_SQL_USERNAME=
RH_SQL_PASSWORD=
```

O Conecta não usa mais `config.ini`. `api/rh_api/config.py` centraliza a leitura
de `.env` e das variáveis definidas no processo. Os aliases antigos
`RH_SERVER_HOST`, `RH_SERVER_PORT` e `RH_SERVE_FRONTEND` continuam aceitos
temporariamente para compatibilidade, mas os nomes acima são os recomendados.

## 2. Instalar dependências

No Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

O driver ODBC configurado em `RH_SQL_DRIVER` também deve existir no Windows.

## 3. Subir API e Front com um comando

```powershell
.\start_conecta.ps1
```

O script usa caminhos relativos à própria pasta, prefere o Python da `.venv` e
inicia somente o Uvicorn/FastAPI. A API serve também a pasta `Front/`.

Acesse:

- sistema: `http://127.0.0.1:8000`
- documentação da API: `http://127.0.0.1:8000/docs`
- OpenAPI: `http://127.0.0.1:8000/openapi.json`
- status: `http://127.0.0.1:8000/api/status`

Alternativas:

```powershell
python run.py
python run.py --reload
python -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

Não é necessário iniciar `python -m http.server` ou outro servidor para o Front.

## 4. Ativar ou desativar a IA

A IA é opcional e fica desativada por padrão:

```env
AI_ENABLED=false
AI_PROVIDER=openai
AI_MODEL=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
AI_TIMEOUT_SECONDS=60
AI_MAX_CURRICULO_CHARS=30000
AI_DUPLICATE_WINDOW_SECONDS=30
```

Para ativar, configure `AI_ENABLED=true`, um `AI_MODEL` aceito pelo provedor e a
`OPENAI_API_KEY` somente no backend. Reinicie o servidor depois de alterar
`.env`. A chave nunca é enviada ao navegador nem gravada na análise.

Se `AI_ENABLED=false`, se o modelo estiver vazio ou se a chave estiver ausente,
o backend não chama o provedor e o botão fica indisponível/oculto. O restante do
sistema continua funcionando normalmente.

## 5. Testar análise de currículo

1. Entre com um usuário que possua `candidatos.avaliar_curriculo`.
2. Abra **Central de candidatos** e acesse a ficha de um candidato.
3. Confirme que existe currículo PDF, DOCX ou TXT com texto extraível.
4. Selecione um candidato vinculado ao processo desejado.
5. Clique em **Analisar currículo com IA**.
6. Confira nota de aderência, parecer, resumo, pontos fortes, pontos de atenção,
   riscos, justificativa e perguntas sugeridas.
7. Use **Reanalisar** somente quando uma nova análise for necessária.
8. Depois da leitura humana, clique em **Marcar como revisado pelo RH**.

A análise não aprova, reprova, elimina, ranqueia ou altera status do candidato.
Ela é apoio técnico e a decisão final continua sendo humana.

Para testar falhas com segurança, use uma chave inválida ou um endpoint de teste
controlado: a API deve registrar status `ERRO` e a ficha deve permanecer aberta.
Nunca faça esse teste com credenciais ou dados de produção.

## 6. Verificações de regressão

```powershell
python -m pytest
```

Depois, valide manualmente login, candidatos, processos, provas, banco de
questões, entrevistas, upload/download de currículo, `/docs` e `/openapi.json`.

## 7. O que saiu do config.ini

Host, porta, Front estático, SQL Server, autenticação, CORS, URLs públicas,
conversão de documentos e e-mail foram migrados para as variáveis descritas em
`.env.example`. O arquivo INI legado não é lido e seu exemplo foi colocado em
quarentena.

## 8. Quarentena de limpeza

Itens claramente descartáveis foram movidos para `_quarentena_limpeza/`,
separados em caches, logs antigos, arquivos obsoletos e pastas de teste. A pasta é
ignorada pelo Git. Nada foi apagado diretamente.

Foram mantidos `api/tests/`, fixtures, scripts, SQL/bootstrap, `.venv/`, provas,
bancos de questões, documentação com conteúdo único e a árvore `fonte/` da raiz,
cujo uso não é inequívoco.

O inventário completo, riscos e roteiro de validação estão em
`docs/RELATORIO_ORGANIZACAO_CONECTA.md`.
