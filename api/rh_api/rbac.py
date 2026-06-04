from __future__ import annotations

import unicodedata
from dataclasses import dataclass


ROLE_INTERN = "estagiario"
ROLE_DP = "dp"
ROLE_MANAGER = "gestor"
ROLE_ADMIN = "administrador"


ACCESS_DENIED_MESSAGE = "Você não possui permissão para acessar esta área ou executar esta ação."


@dataclass(frozen=True)
class PermissionDefinition:
    key: str
    module: str
    description: str
    critical: bool = False


@dataclass(frozen=True)
class RoleDefinition:
    id: str
    name: str
    level: str
    description: str


ROLE_DEFINITIONS: dict[str, RoleDefinition] = {
    ROLE_INTERN: RoleDefinition(
        id=ROLE_INTERN,
        name="Estagiário",
        level="Básico",
        description="Operação principal do processo seletivo.",
    ),
    ROLE_DP: RoleDefinition(
        id=ROLE_DP,
        name="DP",
        level="Alto",
        description="Documentação, admissão e substituição operacional do processo seletivo.",
    ),
    ROLE_MANAGER: RoleDefinition(
        id=ROLE_MANAGER,
        name="Gestor",
        level="Avançado",
        description="Decisão, aprovação, análise e acompanhamento.",
    ),
    ROLE_ADMIN: RoleDefinition(
        id=ROLE_ADMIN,
        name="Administrador",
        level="Completo",
        description="Controle total do sistema.",
    ),
}


def _permission(
    key: str,
    module: str,
    description: str,
    *,
    critical: bool = False,
) -> PermissionDefinition:
    return PermissionDefinition(
        key=key,
        module=module,
        description=description,
        critical=critical,
    )


PERMISSION_DEFINITIONS: dict[str, PermissionDefinition] = {
    item.key: item
    for item in (
        _permission("inicio.visualizar", "Geral", "Acessar página inicial e resumo do dia."),
        _permission("dashboard.visualizar", "Geral", "Visualizar dashboard e indicadores iniciais."),
        _permission("notificacoes.visualizar", "Notificações", "Visualizar notificações permitidas."),
        _permission(
            "notificacoes.configurar",
            "Notificações",
            "Configurar eventos, destinatários e regras de alerta.",
            critical=True,
        ),
        _permission("vagas.visualizar", "Vagas", "Visualizar vagas e processos seletivos."),
        _permission("vagas.solicitar_abertura", "Vagas", "Solicitar abertura de vaga."),
        _permission("vagas.criar", "Vagas", "Criar vaga ou processo seletivo.", critical=True),
        _permission("vagas.editar", "Vagas", "Editar vaga ou processo seletivo.", critical=True),
        _permission("vagas.editar_limitado", "Vagas", "Editar dados limitados da vaga."),
        _permission("vagas.pausar", "Vagas", "Pausar vaga.", critical=True),
        _permission("vagas.encerrar", "Vagas", "Encerrar vaga com confirmação.", critical=True),
        _permission("vagas.cancelar", "Vagas", "Cancelar vaga com justificativa.", critical=True),
        _permission("vagas.excluir", "Vagas", "Excluir vaga quando permitido.", critical=True),
        _permission("processos.visualizar", "Processos", "Visualizar processos seletivos."),
        _permission("processos.criar", "Processos", "Criar processo seletivo.", critical=True),
        _permission("processos.editar", "Processos", "Editar processo seletivo.", critical=True),
        _permission("processos.excluir", "Processos", "Excluir processo seletivo.", critical=True),
        _permission("candidatos.visualizar", "Candidatos", "Visualizar candidatos permitidos."),
        _permission("candidatos.criar", "Candidatos", "Cadastrar candidato manualmente."),
        _permission("candidatos.editar", "Candidatos", "Editar dados do candidato.", critical=True),
        _permission("candidatos.editar_basico", "Candidatos", "Editar dados básicos do candidato."),
        _permission("candidatos.editar_admissional", "Candidatos", "Editar dados admissionais do candidato."),
        _permission("candidatos.excluir", "Candidatos", "Excluir candidato quando permitido.", critical=True),
        _permission("candidatos.anonimizar", "Candidatos", "Anonimizar candidato.", critical=True),
        _permission("candidatos.avaliar_curriculo", "Candidatos", "Avaliar currículo e dar nota."),
        _permission("candidatos.baixar_curriculo", "Candidatos", "Baixar currículo quando permitido."),
        _permission("candidatos.consultar_historico", "Candidatos", "Consultar histórico do candidato."),
        _permission("candidatos.mover_etapa", "Candidatos", "Mover candidato entre etapas operacionais.", critical=True),
        _permission("candidatos.aprovar_operacional", "Candidatos", "Aprovar candidato para etapa operacional."),
        _permission("candidatos.aprovar_final", "Candidatos", "Aprovar candidato final.", critical=True),
        _permission("candidatos.eliminar", "Candidatos", "Eliminar candidato com motivo obrigatório.", critical=True),
        _permission("candidatos.reverter_eliminacao", "Candidatos", "Reverter eliminação com log.", critical=True),
        _permission("candidatos.alterar_nota", "Candidatos", "Alterar nota final consolidada.", critical=True),
        _permission("candidatos.dados_sensiveis", "Candidatos", "Acessar dados sensíveis autorizados."),
        _permission("entrevistas.visualizar", "Entrevistas", "Visualizar entrevistas."),
        _permission("entrevistas.criar", "Entrevistas", "Agendar entrevista."),
        _permission("entrevistas.editar", "Entrevistas", "Reagendar ou editar entrevista."),
        _permission("entrevistas.cancelar", "Entrevistas", "Cancelar entrevista com motivo.", critical=True),
        _permission("entrevistas.marcar_presenca", "Entrevistas", "Marcar presença ou ausência."),
        _permission("entrevistas.avaliar", "Entrevistas", "Avaliar entrevista e registrar parecer."),
        _permission("entrevistas.configurar", "Entrevistas", "Configurar tipos, horários e lembretes.", critical=True),
        _permission("provas.visualizar", "Provas", "Visualizar provas e resultados."),
        _permission("provas.enviar", "Provas", "Enviar prova ao candidato."),
        _permission("provas.corrigir", "Provas", "Corrigir prova manual quando permitido.", critical=True),
        _permission("provas.criar", "Provas", "Criar prova.", critical=True),
        _permission("provas.editar", "Provas", "Editar prova.", critical=True),
        _permission("provas.excluir", "Provas", "Excluir ou desativar prova.", critical=True),
        _permission("provas.questoes_criar", "Provas", "Criar questão.", critical=True),
        _permission("provas.questoes_editar", "Provas", "Editar questão.", critical=True),
        _permission("provas.questoes_excluir", "Provas", "Excluir ou desativar questão.", critical=True),
        _permission("provas.configurar_criterios", "Provas", "Alterar critérios de aprovação.", critical=True),
        _permission("provas.configurar_pesos", "Provas", "Alterar pesos de etapas e provas.", critical=True),
        _permission("documentos.visualizar", "Documentos", "Visualizar documentos permitidos."),
        _permission("documentos.solicitar", "Documentos", "Solicitar documentos usando pacotes prontos."),
        _permission("documentos.marcar_recebido", "Documentos", "Marcar documento como recebido ou pendente."),
        _permission("documentos.validar", "Documentos", "Validar documentos oficialmente.", critical=True),
        _permission("documentos.recusar", "Documentos", "Recusar documentos com motivo.", critical=True),
        _permission("documentos.reenvio", "Documentos", "Solicitar reenvio de documentos."),
        _permission("documentos.configurar", "Documentos", "Configurar tipos e pacotes documentais.", critical=True),
        _permission("emails.enviar_modelo", "E-mails", "Enviar e-mail usando modelos aprovados."),
        _permission("emails.enviar_livre", "E-mails", "Enviar e-mail livre quando permitido."),
        _permission("emails.configurar_modelos", "E-mails", "Configurar modelos de e-mail.", critical=True),
        _permission("configuracoes.visualizar", "Configurações", "Visualizar configurações globais."),
        _permission("configuracoes.editar", "Configurações", "Editar configurações globais.", critical=True),
        _permission("usuarios.visualizar", "Usuários", "Listar e consultar usuários."),
        _permission("usuarios.criar", "Usuários", "Cadastrar ou adicionar usuário.", critical=True),
        _permission("usuarios.editar", "Usuários", "Editar usuário.", critical=True),
        _permission("usuarios.excluir", "Usuários", "Excluir ou desativar usuário.", critical=True),
        _permission("usuarios.ativar", "Usuários", "Ativar usuário.", critical=True),
        _permission("usuarios.desativar", "Usuários", "Desativar usuário.", critical=True),
        _permission("usuarios.bloquear", "Usuários", "Bloquear usuário.", critical=True),
        _permission("usuarios.desbloquear", "Usuários", "Desbloquear usuário.", critical=True),
        _permission("usuarios.redefinir_senha", "Usuários", "Definir ou redefinir senha.", critical=True),
        _permission("usuarios.alterar_email", "Usuários", "Definir, alterar ou redefinir e-mail.", critical=True),
        _permission("usuarios.alterar_perfil", "Usuários", "Definir ou alterar perfil.", critical=True),
        _permission("usuarios.ver_logs", "Usuários", "Consultar logs de acesso de usuários."),
        _permission("lgpd.visualizar", "LGPD", "Consultar informações LGPD permitidas."),
        _permission("lgpd.registrar_solicitacao", "LGPD", "Registrar solicitação LGPD operacional.", critical=True),
        _permission("lgpd.configurar", "LGPD", "Configurar aviso de privacidade e retenção.", critical=True),
        _permission("lgpd.anonimizar", "LGPD", "Executar anonimização.", critical=True),
        _permission("lgpd.exportar_dados", "LGPD", "Exportar dados pessoais.", critical=True),
        _permission("logs.visualizar", "Logs", "Visualizar logs de auditoria."),
        _permission("logs.exportar", "Logs", "Exportar logs de auditoria.", critical=True),
        _permission("relatorios.visualizar", "Relatórios", "Visualizar relatórios."),
        _permission("relatorios.exportar", "Relatórios", "Exportar relatórios.", critical=True),
        _permission("etapas.configurar", "Etapas e Trilhas", "Configurar etapas do processo.", critical=True),
        _permission("trilhas.configurar", "Etapas e Trilhas", "Configurar trilhas de avaliação.", critical=True),
    )
}


OPERATIONAL_SELECTION_PERMISSIONS = {
    "inicio.visualizar",
    "dashboard.visualizar",
    "notificacoes.visualizar",
    "vagas.visualizar",
    "processos.visualizar",
    "candidatos.visualizar",
    "candidatos.criar",
    "candidatos.editar",
    "candidatos.editar_basico",
    "candidatos.avaliar_curriculo",
    "candidatos.baixar_curriculo",
    "candidatos.consultar_historico",
    "candidatos.mover_etapa",
    "candidatos.aprovar_operacional",
    "candidatos.eliminar",
    "entrevistas.visualizar",
    "entrevistas.criar",
    "entrevistas.editar",
    "entrevistas.cancelar",
    "entrevistas.marcar_presenca",
    "provas.visualizar",
    "provas.enviar",
    "provas.corrigir",
    "documentos.visualizar",
    "documentos.solicitar",
    "documentos.marcar_recebido",
    "emails.enviar_modelo",
}


DOCUMENTATION_PERMISSIONS = {
    "documentos.visualizar",
    "documentos.solicitar",
    "documentos.marcar_recebido",
    "documentos.validar",
    "documentos.recusar",
    "documentos.reenvio",
    "candidatos.editar_admissional",
    "lgpd.visualizar",
    "lgpd.registrar_solicitacao",
    "relatorios.visualizar",
    "relatorios.exportar",
}


ROLE_PERMISSIONS: dict[str, set[str]] = {
    ROLE_INTERN: set(OPERATIONAL_SELECTION_PERMISSIONS),
    ROLE_DP: set(OPERATIONAL_SELECTION_PERMISSIONS) | set(DOCUMENTATION_PERMISSIONS),
    ROLE_MANAGER: {
        "inicio.visualizar",
        "dashboard.visualizar",
        "notificacoes.visualizar",
        "vagas.visualizar",
        "vagas.solicitar_abertura",
        "vagas.criar",
        "vagas.editar_limitado",
        "vagas.pausar",
        "vagas.encerrar",
        "vagas.cancelar",
        "processos.visualizar",
        "candidatos.visualizar",
        "candidatos.avaliar_curriculo",
        "candidatos.baixar_curriculo",
        "candidatos.consultar_historico",
        "candidatos.mover_etapa",
        "candidatos.aprovar_operacional",
        "candidatos.aprovar_final",
        "candidatos.eliminar",
        "candidatos.reverter_eliminacao",
        "entrevistas.visualizar",
        "entrevistas.criar",
        "entrevistas.editar",
        "entrevistas.cancelar",
        "entrevistas.avaliar",
        "provas.visualizar",
        "emails.enviar_modelo",
        "relatorios.visualizar",
        "relatorios.exportar",
        "lgpd.visualizar",
    },
    ROLE_ADMIN: set(PERMISSION_DEFINITIONS.keys()),
}


SCREEN_PERMISSIONS: dict[str, str] = {
    "screen-menu": "inicio.visualizar",
    "screen-email-inbox": "candidatos.criar",
    "screen-history": "candidatos.consultar_historico",
    "screen-process-create": "vagas.criar",
    "screen-processes": "vagas.visualizar",
    "screen-candidates": "candidatos.visualizar",
    "screen-candidate-pipeline": "candidatos.mover_etapa",
    "screen-process-details": "processos.visualizar",
    "screen-interviews": "entrevistas.visualizar",
    "screen-analysis-candidates": "relatorios.visualizar",
    "screen-talent-bank": "candidatos.visualizar",
    "screen-settings": "configuracoes.visualizar",
    "screen-config": "provas.enviar",
    "screen-candidate": "provas.enviar",
    "screen-exam": "provas.enviar",
    "screen-result": "provas.visualizar",
    "screen-thanks": "provas.enviar",
}


SETTINGS_CATALOGS: dict[str, dict[str, str]] = {
    "geral": {"table": "configuracoes_sistema", "label": "Geral"},
    "lgpd": {"table": "configuracoes_lgpd", "label": "LGPD e Retenção"},
    "motivos_eliminacao": {"table": "motivos_eliminacao", "label": "Motivos de eliminação"},
    "status_candidatos": {"table": "status_candidatos", "label": "Status dos candidatos"},
    "modelos_email": {"table": "modelos_email", "label": "Modelos de e-mail"},
    "tipos_documentos": {"table": "documentos_tipos", "label": "Tipos de documentos"},
    "documentos_pacotes": {"table": "documentos_pacotes", "label": "Pacotes documentais"},
    "etapas": {"table": "etapas", "label": "Etapas do processo"},
    "trilhas": {"table": "trilhas", "label": "Trilhas de avaliação"},
    "provas": {"table": "provas", "label": "Banco de provas"},
    "questoes": {"table": "questoes", "label": "Questões"},
    "notificacoes": {"table": "notificacoes_regras", "label": "Regras de notificação"},
}


def normalize_role_id(value: str | None) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""

    normalized = "".join(
        char
        for char in unicodedata.normalize("NFD", text)
        if unicodedata.category(char) != "Mn"
    )
    normalized = normalized.replace(" ", "_").replace("-", "_")

    aliases = {
        "estagiario": ROLE_INTERN,
        "estagiario_nivel_basico": ROLE_INTERN,
        "dp": ROLE_DP,
        "departamento_pessoal": ROLE_DP,
        "gestor": ROLE_MANAGER,
        "administrador": ROLE_ADMIN,
        "admin": ROLE_ADMIN,
        "rh": ROLE_ADMIN,
    }
    return aliases.get(normalized, normalized)


def get_role_definition(role_id: str | None) -> RoleDefinition:
    return ROLE_DEFINITIONS.get(normalize_role_id(role_id), ROLE_DEFINITIONS[ROLE_ADMIN])


def get_role_permissions(role_id: str | None) -> set[str]:
    return set(ROLE_PERMISSIONS.get(normalize_role_id(role_id), set()))


def is_known_permission(permission: str | None) -> bool:
    return str(permission or "").strip() in PERMISSION_DEFINITIONS


def is_critical_permission(permission: str | None) -> bool:
    definition = PERMISSION_DEFINITIONS.get(str(permission or "").strip())
    return bool(definition and definition.critical)


def sanitize_permissions(permissions: list[str] | set[str] | tuple[str, ...] | None) -> set[str]:
    return {
        item
        for item in (str(value or "").strip() for value in (permissions or []))
        if item in PERMISSION_DEFINITIONS
    }
