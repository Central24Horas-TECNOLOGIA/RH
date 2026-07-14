# Permissoes

Foram retornadas 87 permissoes e 6 perfis. A visibilidade do menu e das acoes muda conforme permissoes.

## Perfis observados

| Perfil | Papel funcional |
| --- | --- |
| Estagiario | operacao basica |
| DP | documentacao/admissao e apoio |
| Gestor | decisao e acompanhamento |
| RH | operacao avancada |
| Candidato | portal/visao restrita |
| Administrador | controle total |

## Modulos de permissao

| Modulo | Exemplos de acoes |
| --- | --- |
| Vagas | visualizar, criar, editar, encerrar |
| Candidatos | visualizar, criar, editar, eliminar |
| Entrevistas | visualizar, criar, cancelar, atualizar |
| Provas | visualizar, criar, enviar, cancelar |
| Relatorios | visualizar, exportar |
| Usuarios | visualizar, criar, editar, desativar |
| Configuracoes | visualizar, editar |
| Logs | visualizar, exportar |

## Regras

- Item de menu sem permissao nao deve aparecer.
- Botao sensivel sem permissao nao deve aparecer ou deve estar bloqueado.
- Tentativa sem permissao deve ir para `#/acesso-negado` e gerar log quando passar pelo backend.

