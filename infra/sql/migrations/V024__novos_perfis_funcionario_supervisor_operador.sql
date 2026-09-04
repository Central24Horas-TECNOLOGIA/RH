/*
  Conecta RH - Correcoes.txt (rodada de 03/set/2026): o modal "Criar usuario"
  nao listava todos os perfis esperados. Adiciona os perfis Funcionario,
  Supervisor e Operador (ver rh_api/rbac.py, ROLE_DEFINITIONS/ROLE_PERMISSIONS),
  mantendo os perfis existentes (Administrador, Gestor, Estagiario, DP, RH,
  Candidato) inalterados em nivel e permissoes.

  Permissoes padrao de cada perfil novo sao minimas (autoatendimento e Central
  de Treinamentos para Funcionario/Operador; acompanhamento operacional para
  Supervisor) e podem ser ajustadas a qualquer momento pelo administrador em
  Configuracoes > Perfis, sem precisar de nova migracao.

  Migracao estritamente aditiva e idempotente. Nenhum perfil existente e
  alterado/removido. Reflete o mesmo seed que o bootstrap runtime
  (rh_api/repositories/bootstrap.py, laco sobre ROLE_DEFINITIONS) aplica
  automaticamente; mantenha os dois em sincronia caso este arquivo seja
  executado manualmente.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.perfis WHERE id_perfil = 'funcionario')
        INSERT INTO dbo.perfis (id_perfil, nome, nivel, descricao, ativo, sistema, criado_em, atualizado_em)
        VALUES ('funcionario', 'Funcionário', 'Básico', 'Colaborador com acesso de autoatendimento e à Central de Treinamentos.', 1, 1, GETDATE(), GETDATE());

    IF NOT EXISTS (SELECT 1 FROM dbo.perfis WHERE id_perfil = 'supervisor')
        INSERT INTO dbo.perfis (id_perfil, nome, nivel, descricao, ativo, sistema, criado_em, atualizado_em)
        VALUES ('supervisor', 'Supervisor', 'Intermediário', 'Acompanhamento de equipe, entrevistas e aplicação de treinamentos.', 1, 1, GETDATE(), GETDATE());

    IF NOT EXISTS (SELECT 1 FROM dbo.perfis WHERE id_perfil = 'operador')
        INSERT INTO dbo.perfis (id_perfil, nome, nivel, descricao, ativo, sistema, criado_em, atualizado_em)
        VALUES ('operador', 'Operador', 'Básico', 'Colaborador operacional com acesso de autoatendimento e à Central de Treinamentos.', 1, 1, GETDATE(), GETDATE());

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
