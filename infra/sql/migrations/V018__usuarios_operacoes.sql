/*
  Conecta RH - programa de evolucao pos-auditoria (docs/connecta-evolution/,
  achado SEC-002): RBAC hoje valida apenas permissao de modulo, nunca escopo
  de recurso -- qualquer usuario com uma permissao de modulo acessa dado de
  qualquer operacao (IDOR sistemico).

  Esta migration cria a tabela que passa a guardar, por usuario, a lista de
  operacoes as quais ele tem acesso. E estritamente aditiva:

  - Tabela vazia por padrao para todo usuario ja existente == sem nenhuma
    restricao nova (identico ao comportamento de hoje). So passa a
    restringir o acesso de um usuario especifico quando alguem inserir
    linhas aqui explicitamente (fora do escopo desta migration -- nao ha
    tela de administracao ainda, isso e o proximo passo do achado SEC-002).
  - Nenhuma tabela ou coluna existente e alterada/removida.
  - Sem FK para dbo.operacoes.chave: a coluna chave nao tem constraint
    UNIQUE (e uma tabela de catalogo generico via SETTINGS_CATALOGS) --
    mesmo padrao sem FK ja usado no restante do schema criado pelo
    bootstrap (achado DB-004, tratamento incremental a parte).

  Reflete o mesmo schema que rh_api/repositories/bootstrap.py
  (ensure_user_operacoes_table) cria automaticamente em DEV/HML -- mantenha
  os dois em sincronia caso este arquivo seja executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.usuarios_operacoes', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.usuarios_operacoes (
            id_usuario INT NOT NULL,
            operacao NVARCHAR(60) NOT NULL,
            criado_em DATETIME NOT NULL CONSTRAINT DF_usuarios_operacoes_criado_em DEFAULT GETDATE(),
            CONSTRAINT PK_usuarios_operacoes PRIMARY KEY (id_usuario, operacao)
        );
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
