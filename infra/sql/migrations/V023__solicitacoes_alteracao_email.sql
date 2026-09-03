/*
  Conecta RH - Correcoes.txt (rodada de 02/set/2026): aba Configuracoes >
  Ambiente > Perfil permite pedir troca do proprio e-mail, mas a troca so e
  aplicada apos aprovacao de um administrador (permissao
  "usuarios.alterar_email", ja existente).

  Esta migration cria a tabela que guarda essas solicitacoes. Estritamente
  aditiva: nenhuma tabela ou coluna existente e alterada/removida, e nenhum
  usuario tem o e-mail trocado sozinho por esta migration -- ela so cria a
  estrutura vazia.

  Reflete o mesmo schema que o bootstrap runtime (rh_api/repositories/
  bootstrap.py, ensure_email_change_requests_table) cria automaticamente;
  mantenha os dois em sincronia caso este arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.solicitacoes_alteracao_email', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.solicitacoes_alteracao_email (
            id INT IDENTITY(1,1) PRIMARY KEY,
            id_usuario INT NOT NULL,
            email_atual NVARCHAR(180) NULL,
            email_novo NVARCHAR(180) NOT NULL,
            status NVARCHAR(20) NOT NULL CONSTRAINT DF_solicitacoes_email_status DEFAULT 'pendente',
            solicitado_em DATETIME NOT NULL CONSTRAINT DF_solicitacoes_email_solicitado_em DEFAULT GETDATE(),
            decidido_em DATETIME NULL,
            decidido_por NVARCHAR(180) NULL,
            motivo_rejeicao NVARCHAR(500) NULL
        );

        CREATE INDEX IX_solicitacoes_email_usuario ON dbo.solicitacoes_alteracao_email(id_usuario);
        CREATE INDEX IX_solicitacoes_email_status ON dbo.solicitacoes_alteracao_email(status);
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
