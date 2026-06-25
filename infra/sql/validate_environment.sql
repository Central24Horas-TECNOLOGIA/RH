DECLARE @ExpectedDatabase sysname = N'$(EXPECTED_DATABASE)';
DECLARE @ActualDatabase sysname = DB_NAME();

IF @ExpectedDatabase IS NULL OR @ExpectedDatabase = N''
    THROW 51000, 'EXPECTED_DATABASE deve ser informado ao sqlcmd.', 1;

IF @ActualDatabase <> @ExpectedDatabase
    THROW 51001, 'Banco conectado não corresponde ao ambiente esperado.', 1;

SELECT @ActualDatabase AS database_name, @@SERVERNAME AS server_name, GETDATE() AS checked_at;
