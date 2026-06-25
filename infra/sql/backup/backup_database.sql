-- Execute com uma conta operacional autorizada, nunca com o usuário da aplicação.
DECLARE @Database sysname = N'$(DATABASE_NAME)';
DECLARE @BackupPath nvarchar(4000) = N'$(BACKUP_PATH)';
DECLARE @Sql nvarchar(max) = N'BACKUP DATABASE ' + QUOTENAME(@Database)
    + N' TO DISK = ' + QUOTENAME(@BackupPath, '''')
    + N' WITH CHECKSUM, COMPRESSION, INIT;';
EXEC sys.sp_executesql @Sql;
