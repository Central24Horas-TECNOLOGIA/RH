# Runbook de incidentes

1. Registre horário, ambiente, versão e `request_id`; não copie dados pessoais.
2. Verifique `/health`, `/ready`, logs JSON e disponibilidade do SQL Server.
3. Contenha o impacto: bloqueie credenciais comprometidas ou retire a versão do ar.
4. Para regressão, execute o rollback para a última imagem saudável.
5. Preserve evidências e comunique responsáveis por segurança/LGPD quando aplicável.
6. Após recuperação, documente causa raiz, impacto, ações e prevenção.

Nunca restaure backup sobre PROD sem validação, autorização e cópia de segurança atual.
