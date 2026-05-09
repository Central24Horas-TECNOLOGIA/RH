from __future__ import annotations

from .helpers import normalize_compare_text, normalize_text


DEFAULT_PUBLIC_JOB_TEXTS = {
    "default": {
        "descricao": (
            "Oportunidade aberta para atuar na vaga informada neste processo seletivo. "
            "A pessoa selecionada participará das rotinas da área, seguindo os procedimentos internos "
            "e contribuindo para uma entrega organizada, cordial e alinhada aos padrões da Central 24h."
        ),
        "requisitos": [
            "Ensino médio completo ou formação compatível com a vaga.",
            "Experiência anterior em atividades relacionadas será considerada um diferencial.",
            "Boa comunicação verbal e escrita.",
            "Organização, responsabilidade e postura profissional.",
            "Facilidade para aprender sistemas, processos internos e rotinas operacionais.",
            "Disponibilidade para cumprir a jornada e os horários definidos pelo RH.",
        ],
        "responsabilidades": [
            "Executar as atividades da função conforme orientação da liderança.",
            "Atender demandas internas e externas com cordialidade, clareza e agilidade.",
            "Registrar informações de forma correta nos sistemas e controles definidos.",
            "Cumprir procedimentos, prazos, políticas internas e orientações do processo.",
            "Apoiar a equipe na manutenção da qualidade e continuidade das operações.",
        ],
    },
    "atendimento": {
        "descricao": (
            "Oportunidade para atuar com atendimento ao cliente, prestando suporte, registrando informacoes "
            "e garantindo uma comunicacao clara, humanizada e eficiente durante a rotina operacional."
        ),
        "requisitos": [
            "Ensino medio completo.",
            "Experiencia com atendimento ao cliente, call center, suporte ou recepcao sera diferencial.",
            "Boa diccao, escuta ativa e comunicacao objetiva.",
            "Conhecimento basico em informatica e facilidade para utilizar sistemas.",
            "Capacidade de seguir scripts, procedimentos e orientacoes de qualidade.",
            "Postura cordial, resiliencia e foco na resolucao de demandas.",
        ],
        "responsabilidades": [
            "Realizar atendimento a clientes ou usuarios pelos canais definidos pela operacao.",
            "Registrar corretamente dados, solicitacoes e encaminhamentos nos sistemas.",
            "Seguir scripts, politicas de atendimento e orientacoes da lideranca.",
            "Acompanhar demandas dentro dos prazos e acionar areas responsaveis quando necessario.",
            "Contribuir para uma experiencia de atendimento clara, respeitosa e eficiente.",
        ],
    },
    "administrativo": {
        "descricao": (
            "Oportunidade para apoiar rotinas administrativas, controles internos, organizacao de informacoes "
            "e acompanhamento de demandas da area, mantendo qualidade, confidencialidade e regularidade nos processos."
        ),
        "requisitos": [
            "Ensino medio completo; formacao tecnica ou superior em andamento sera diferencial.",
            "Experiencia com rotinas administrativas, controles, planilhas ou atendimento interno.",
            "Conhecimento em pacote Office, especialmente Excel em nivel basico a intermediario.",
            "Organizacao, atencao a detalhes e boa gestao de prioridades.",
            "Boa comunicacao escrita e relacionamento interpessoal.",
            "Responsabilidade no tratamento de dados e documentos internos.",
        ],
        "responsabilidades": [
            "Apoiar controles, cadastros, acompanhamentos e atualizacoes administrativas.",
            "Organizar documentos, informacoes e registros conforme procedimentos internos.",
            "Atender solicitacoes da area e apoiar a comunicacao com equipes relacionadas.",
            "Preparar planilhas, relatorios simples e consolidacoes quando solicitado.",
            "Manter rotinas em dia, com atencao a prazos, qualidade e confidencialidade.",
        ],
    },
    "supervisao": {
        "descricao": (
            "Oportunidade para atuar na conducao de equipe e acompanhamento de indicadores, apoiando a operacao "
            "na organizacao da rotina, orientacao dos colaboradores e garantia dos padroes de atendimento."
        ),
        "requisitos": [
            "Ensino medio completo; superior em andamento ou completo sera diferencial.",
            "Experiencia anterior com lideranca, monitoria, supervisao ou apoio operacional.",
            "Conhecimento de indicadores, controles operacionais e rotina de atendimento.",
            "Boa comunicacao, organizacao e capacidade de orientar equipes.",
            "Perfil analitico, postura colaborativa e foco em resultados.",
            "Disponibilidade para acompanhar a escala e as necessidades da operacao.",
        ],
        "responsabilidades": [
            "Acompanhar a rotina da equipe e apoiar a distribuicao de atividades.",
            "Monitorar indicadores, qualidade, produtividade e aderencia aos processos.",
            "Orientar colaboradores, apoiar duvidas e conduzir alinhamentos operacionais.",
            "Registrar ocorrencias, acompanhar planos de acao e reportar pontos relevantes.",
            "Atuar junto a lideranca para manter a operacao organizada e dentro dos padroes definidos.",
        ],
    },
}


def _resolve_job_key(processo: dict | None) -> str:
    safe_process = processo or {}
    haystack = " ".join(
        [
            normalize_compare_text(safe_process.get("vaga")),
            normalize_compare_text(safe_process.get("operacao")),
            normalize_compare_text(safe_process.get("trilha")),
        ],
    )

    if any(term in haystack for term in ("supervisor", "supervisao", "lider")):
        return "supervisao"
    if any(term in haystack for term in ("administrativo", "assistente", "auxiliar", "backoffice", "excel")):
        return "administrativo"
    if any(term in haystack for term in ("atendimento", "operador", "call center", "teleatendimento", "sac", "suporte")):
        return "atendimento"
    return "default"


def get_default_public_job_texts(processo: dict | None) -> dict:
    texts = DEFAULT_PUBLIC_JOB_TEXTS.get(_resolve_job_key(processo), DEFAULT_PUBLIC_JOB_TEXTS["default"])
    return {
        "descricao": normalize_text(texts.get("descricao")),
        "requisitos": list(texts.get("requisitos", [])),
        "responsabilidades": list(texts.get("responsabilidades", [])),
    }
