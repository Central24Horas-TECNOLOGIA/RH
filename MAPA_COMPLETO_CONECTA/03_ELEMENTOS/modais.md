# Modais

| Modal | Origem | Abertura | Campos/Conteudo | Botoes | Risco |
| --- | --- | --- | --- | --- | --- |
| Tour guiado | Botao Ver orientacoes | help | passos do guia, exemplo "Menu lateral" | Fechar, Seguinte | baixo |
| E-mail recebido | Caixa de e-mail | Abrir detalhes | data, anexo/CV, nome, experiencia, telefone, e-mail, inconsistencias, corpo | Fechar | baixo |
| Aprovar candidato | processo/candidato | Aprovar | candidato, data de comparecimento, documentos, mensagem, anexo | Cancelar, WhatsApp, E-mail, Confirmar | alto |
| Eliminar candidato | processo/candidato | Eliminar | candidato, motivo, entrevista condicional | Cancelar, Confirmar eliminacao | alto |
| Editar candidato | Central/Ficha | Editar | nome, e-mail, telefone, WhatsApp, endereco, cidade, bairro, classificacao, escolaridade, experiencia, preferencias, habilidades, tags, observacoes | Cancelar, Salvar | medio |
| Ficha do candidato | Central de candidatos | abrir ficha | dados pessoais, processo, CV, historico, acoes | Baixar ficha, Fechar, Editar | baixo/medio |
| Adicionar a processo | Banco/Ficha | Utilizar/Adicionar | processo seletivo | Cancelar, Confirmar | medio |
| Agendar entrevista | Detalhes processo | Agendar | candidato, processo, slot, mensagem, documentos, observacoes | Cancelar, WhatsApp, E-mail, Agendar | alto |
| Editar entrevista | Entrevistas/detalhe | editar | status, data/slot, observacoes | Cancelar, Salvar | medio |
| Detalhes de prova | Provas | Detalhes | prova, candidato, status, nota, alertas, respostas | Fechar/acoes contextuais | baixo |
| Gerar prova | Provas/Inicio | Gerar prova | candidato, processo, vaga, acesso, configuracao | Cancelar, Gerar | alto |
| Resumo da vaga | Detalhe processo | Ver resumo da vaga | dados publicos e internos da vaga | Voltar | baixo |
| Confirmacoes nativas | Provas | cancelar/reabrir | prompt de motivo | OK/Cancelar do navegador | medio, pouco padronizado |

## Problemas encontrados

- Acoes de alto impacto devem ter confirmacao padronizada e explicacao de reversao.
- Prompts nativos em provas quebram o padrao visual do sistema.
- Alguns modais concentram muitos campos; em celular precisam de rolagem clara e cabecalho fixo.

