# Conecta C24h — Documentação Atualizada

Documentação gerada a partir da análise do projeto `RH(21).zip`, em **14/05/2026**.

Este pacote consolida a visão técnica, funcional e operacional do sistema Conecta C24h/Conecta RH. A documentação foi organizada para servir tanto a apresentação interna quanto manutenção por outro desenvolvedor.

## Índice recomendado

1. [`docs/01-visao-geral.md`](docs/01-visao-geral.md) — visão executiva, escopo e módulos.
2. [`docs/02-arquitetura.md`](docs/02-arquitetura.md) — arquitetura frontend/backend/banco.
3. [`docs/03-estrutura-projeto.md`](docs/03-estrutura-projeto.md) — mapa de pastas e responsabilidade de arquivos.
4. [`docs/04-regras-negocio.md`](docs/04-regras-negocio.md) — regras de processos, candidatos, CVs, entrevistas e prova.
5. [`docs/05-banco-dados.md`](docs/05-banco-dados.md) — entidades/tabelas e relacionamento lógico.
6. [`docs/06-api.md`](docs/06-api.md) — endpoints, contratos e observações.
7. [`docs/07-frontend.md`](docs/07-frontend.md) — telas, rotas, navegação e camada visual.
8. [`docs/08-backend.md`](docs/08-backend.md) — rotas, serviços, repositórios e configuração.
9. [`docs/09-manual-usuario-rh.md`](docs/09-manual-usuario-rh.md) — manual prático para o RH usar o sistema.
10. [`docs/10-manual-administrador-suporte.md`](docs/10-manual-administrador-suporte.md) — instalação, execução e sustentação.
11. [`docs/11-diagramas-uml.md`](docs/11-diagramas-uml.md) — UMLs/diagramas em Mermaid.
12. [`docs/12-testes-qualidade.md`](docs/12-testes-qualidade.md) — testes, riscos e validações.
13. [`docs/13-checklist-producao.md`](docs/13-checklist-producao.md) — checklist para estabilização/produção.

## Inventários anexos

- [`docs/anexos/inventario-endpoints.csv`](docs/anexos/inventario-endpoints.csv)
- Diagramas `.mmd` em [`docs/diagramas`](docs/diagramas)

## Observações importantes

- A documentação **não replica segredos** do `.env` real. Só usa nomes de variáveis e exemplos seguros.
- O projeto tem dados/artefatos privados em `data/private/`; essa pasta deve ser tratada como sensível.
- A tela pública de candidatura existe no código, mas a operação atual descrita no projeto prioriza a **caixa de e-mail de currículos** como entrada principal.
- Os testes não puderam ser executados neste ambiente porque faltou o pacote `pyodbc`, que é dependência obrigatória do backend.


## Documentação técnica

A documentação completa está na pasta `docs/`. Para manter o GitHub limpo, recomenda-se versionar apenas código, documentação e exemplos seguros, nunca `data/private/`, `.env` real ou anexos de candidatos.
