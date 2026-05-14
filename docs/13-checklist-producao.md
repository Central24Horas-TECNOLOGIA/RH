# 13 — Checklist de produção/estabilização

## Segurança

- [ ] Trocar usuário/senha padrão do RH.
- [ ] Gerar `RH_AUTH_TOKEN_SECRET` forte.
- [ ] Remover `.env` de qualquer repositório.
- [ ] Garantir que `data/private/` não seja público.
- [ ] Restringir CORS ao domínio/IP real do frontend.
- [ ] Validar permissões NTFS da pasta de anexos.
- [ ] Guardar client secret em variável de ambiente ou cofre, nunca em arquivo.

## Banco

- [ ] Backup completo antes da subida.
- [ ] Confirmar SQL Server/instância.
- [ ] Confirmar database correto.
- [ ] Confirmar ODBC Driver instalado.
- [ ] Testar conexão da API.
- [ ] Validar bootstrap de schema sem erro.
- [ ] Validar identities e dados de teste removidos, se for produção limpa.

## API

- [ ] Instalar dependências em `.venv`.
- [ ] Subir API em porta definida.
- [ ] Testar endpoint `/`.
- [ ] Testar login.
- [ ] Testar chamada protegida.
- [ ] Conferir logs.
- [ ] Configurar execução como serviço/central de controle, se aplicável.

## Frontend

- [ ] Conferir `runtime-config.js` apontando para API correta.
- [ ] Abrir `Front/index.html#/login`.
- [ ] Testar menu lateral.
- [ ] Testar telas principais.
- [ ] Testar responsividade mínima.

## Caixa de e-mail

- [ ] IMAP habilitado na caixa.
- [ ] Permissão da aplicação/usuário confirmada.
- [ ] Tenant ID e Client ID corretos.
- [ ] Secret cadastrado via `setx`.
- [ ] API reiniciada após secret.
- [ ] Pasta de anexos com permissão de escrita.
- [ ] Teste com e-mail real contendo CV.

## RH funcional

- [ ] Criar processo de teste.
- [ ] Receber/analisar currículo.
- [ ] Vincular candidato.
- [ ] Criar slot.
- [ ] Agendar entrevista.
- [ ] Aprovar candidato.
- [ ] Eliminar candidato.
- [ ] Enviar candidato ao banco de talentos.
- [ ] Gerar relatório.
- [ ] Encerrar processo.

## Documentação e governança

- [ ] Documentar versão entregue.
- [ ] Registrar alterações feitas.
- [ ] Salvar backup do pacote estável.
- [ ] Treinar RH com o manual de usuário.
- [ ] Definir responsável por suporte.
