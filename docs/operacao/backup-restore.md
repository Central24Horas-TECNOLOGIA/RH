# Backup e restore do SQL Server

Use uma conta operacional separada; o login da aplicação não recebe `BACKUP`,
`RESTORE`, DDL ou `db_owner`.

1. Execute `infra/sql/backup/backup_database.sql` com `sqlcmd`.
2. Execute `verify_backup.sql` e registre a evidência.
3. Para restore, pare a aplicação, valide ambiente/destino e obtenha aprovação.
4. Execute `restore_database.sql`, aplique migrations pendentes e valide `/ready`.

Backups ficam em storage protegido fora do repositório e seguem a política de
retenção/LGPD da empresa.
