"""Regras de decisão para notificações automáticas por mudança de etapa/status
do candidato (roadmap de expansão, respostas.txt: "e-mails automáticos por
etapa").

Este módulo é deliberadamente pequeno e sem acesso a banco: só decide QUANDO
uma transição de status é elegível para notificação automática. Quem executa o
disparo (hoje, e-mail; no futuro, WhatsApp também) é
CommunicationRepositoryMixin.disparar_notificacao_por_etapa, o ponto único
citado no roadmap — preparado para, quando o WhatsApp automático for aprovado,
plugar ali mesmo sem precisar mexer de novo no fluxo de mudança de status.

Decisão de produto (documentada por não haver spec exata): hoje o único canal
de e-mail manual já estabelecido no sistema é a aprovação (rota
`POST /process-candidates/{id}/approval-email`, que usa o texto que o próprio
RH prepara em `mensagem_aprovacao` ao mudar o status para "Aprovado"). Não
existe hoje nenhuma rota/template equivalente para "Reprovado/Eliminado" nem
para "Proposta enviada" — por isso, para não inventar um texto novo do zero
(e por instrução explícita de não adivinhar nesse caso), a automação abaixo
cobre SOMENTE a transição para "Aprovado". Se o RH quiser automatizar também a
reprovação ou outras etapas, será necessário antes definir/criar o
template/mecanismo manual correspondente.
"""

from __future__ import annotations

from .process_flow import CANDIDATE_STATUS_APPROVED, canonicalize_candidate_status

# Status para os quais já existe um canal de e-mail manual estabelecido e,
# portanto, é seguro automatizar reaproveitando o mesmo texto/mecanismo.
STATUSES_COM_EMAIL_AUTOMATICO_ELEGIVEL = {CANDIDATE_STATUS_APPROVED}


def transicao_elegivel_para_email_automatico(status_novo: str) -> bool:
    """True quando a transição para `status_novo` tem um canal manual
    equivalente hoje (e por isso pode ser automatizada com segurança)."""
    return canonicalize_candidate_status(status_novo) in STATUSES_COM_EMAIL_AUTOMATICO_ELEGIVEL
