# WhatsApp no modulo de Processos Seletivos

## Escopo atual

O recurso atual e um MVP operacional. O sistema abre uma conversa pelo link oficial `wa.me/55NUMERO` em nova aba e exibe uma mensagem sugerida para copia manual pelo RH.

Depois do contato, o usuario registra manualmente o evento no historico do candidato. Esse registro nao altera status, nao dispara automacoes, nao agenda entrevista e nao cria comunicacao em massa.

## Regras LGPD

- Usar o contato apenas para finalidade de recrutamento e selecao.
- Evitar inserir dados sensiveis na mensagem.
- Registrar somente eventos necessarios para auditoria do processo.
- Manter telefone e e-mail mascarados em listagens; dados completos devem ficar restritos a detalhes, dossies e acoes autorizadas.
- Exportacoes devem ser realizadas apenas por usuarios autorizados e quando houver necessidade operacional.

## Integracao futura recomendada

Uma integracao oficial deve ser feita pela WhatsApp Business Platform ou Cloud API da Meta, com homologacao do numero empresarial, templates aprovados e webhook de recebimento.

Arquitetura sugerida:

- Servico backend dedicado para envio e recebimento de mensagens.
- Variaveis de ambiente para `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, token de acesso e segredo do webhook.
- Templates transacionais aprovados para convite, lembrete, reagendamento e retorno de entrevista.
- Registro de consentimento/finalidade quando aplicavel.
- Fila de envio com retentativa e limite de taxa.
- Webhook validado por assinatura para registrar respostas recebidas.
- Auditoria por usuario, candidato, processo, payload minimo, status de entrega e erro.
- Politica de retencao para mensagens e logs.

## Fora do escopo deste MVP

- Envio automatico de mensagens.
- Leitura automatica de respostas.
- Mudanca automatica de status do candidato.
- Disparo em massa.
- Armazenamento de tokens ou credenciais da Meta.
- Webhooks publicos.

