-- Execute somente em janela autorizada, após RESTORE VERIFYONLY e com a aplicação parada.
RESTORE DATABASE [$(DATABASE_NAME)]
FROM DISK = N'$(BACKUP_PATH)'
WITH REPLACE, RECOVERY, STATS = 10;
