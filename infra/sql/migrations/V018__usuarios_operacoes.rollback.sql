/*
  Rollback de V018__usuarios_operacoes.sql.

  A tabela so tem efeito pratico quando alguem insere linhas nela (ver
  comentario da migration principal) -- se estiver vazia, remove-la e seguro
  e nao afeta nenhum usuario. Se ja existirem atribuicoes de operacao
  cadastradas, o DROP e deliberadamente bloqueado aqui para nao apagar
  configuracao de escopo real sem decisao explicita.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID('dbo.usuarios_operacoes', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.usuarios_operacoes)
        DROP TABLE dbo.usuarios_operacoes;
    ELSE
        THROW 50000, 'usuarios_operacoes tem dados: remova a restricao de escopo manualmente antes do rollback, se for isso que deseja.', 1;
END;
