# Problemas encontrados

| ID | Area | Tela | Elemento | Problema | Impacto | Prioridade | Recomendacao |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | Navegacao | Rotas legadas | `#/candidato`, `#/prova`, `#/resultado` | redirecionam sem contexto claro | confusao | Medio | mensagem explicativa ou remover |
| P02 | Status | Geral | nomenclatura | variacao com/sem acento/capitalizacao | erro de filtro | Alto | catalogo unico |
| P03 | Logs | Filtro modulo | Autenticacao duplicado | duplicidade com acento | filtro confuso | Baixo | normalizar |
| P04 | Provas | Cancelar/reabrir | prompt nativo | fora do padrao | experiencia ruim | Medio | usar modal |
| P05 | Banco | Acoes | Eliminar/Utilizar proximos | risco operacional | Alto | separar e confirmar |
| P06 | Config | Usuarios | justificativa | nao claramente obrigatoria | auditoria fraca | Medio | exigir para sensiveis |
| P07 | Mobile | Menu | 88px fixo | reduz area util | Medio | drawer/offcanvas |
| P08 | E-mails | Tabela mobile | muito estreita | leitura dificil | Medio | cards mobile |
| P09 | Acessibilidade | Campos | labels por icone | leitores podem falhar | Medio | label textual |
| P10 | Processo | Aprovados 0 | tabela renderizada | pode parecer registro vazio | Baixo | estado vazio |
| P11 | Processo | Grupo/subitem | Processos duplicado | menor clareza | Baixo | renomear subitem |
| P12 | Regras | Catalogos | 0/0 ativos | pouco orientativo | Baixo | call-to-action |
| P13 | Login | Esqueci senha | botao sem fluxo observado | expectativa falsa | Baixo | ocultar ou implementar |
| P14 | Entrevistas | Formulario/filtros juntos | alta densidade | aprendizado | Medio | separar painel |
| P15 | E-mails | Atualizando | botao desabilitado prolongado | percepcao de lentidao | Baixo | progress/timeout |
| P16 | Conecta Provas | Campo | sem label clara | acessibilidade | Medio | adicionar label |
| P17 | Compartilhar vaga | Link publico | sem slug ativo | fluxo publico nao testavel | Medio | indicar status e acao |
| P18 | Acoes destrutivas | geral | confirmacoes | nem todas comprovadas | risco | Alto | padrao unico |

