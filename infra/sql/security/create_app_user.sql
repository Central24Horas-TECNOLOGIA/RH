-- Execute como DBA e substitua as variáveis via sqlcmd. Nunca conceda db_owner.
USE [$(DATABASE_NAME)];

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(APP_USER)')
    CREATE USER [$(APP_USER)] FOR LOGIN [$(APP_USER)];

ALTER ROLE db_datareader ADD MEMBER [$(APP_USER)];
ALTER ROLE db_datawriter ADD MEMBER [$(APP_USER)];

-- DDL, BACKUP, RESTORE e db_owner são proibidos ao usuário da aplicação.
