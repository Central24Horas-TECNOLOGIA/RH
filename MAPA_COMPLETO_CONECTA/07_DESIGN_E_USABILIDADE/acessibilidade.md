# Acessibilidade

## Pontos bons

- Menu usa `aria-current` para item ativo.
- Botoes de menu possuem `title` e alguns `aria-label`.
- Campos padrao sao navegaveis por teclado em geral.

## Pontos a melhorar

| Item | Problema | Ajuste |
| --- | --- | --- |
| Campos com label visual indireta | captura mostra "search" ou icone como label | associar label textual real |
| Botoes so com icone | "more_horiz", setas de pagina | aria-label descritivo em todos |
| Badges de status | cor pode ser unica pista | texto sempre visivel e contraste |
| Prompts nativos | experiencia inconsistente | modais acessiveis |
| Menu mobile | ocupa area e pode exigir muitos cliques | avaliar drawer/offcanvas |

