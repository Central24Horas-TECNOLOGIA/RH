# Validacoes

| Contexto | Validacao esperada | Estado observado |
| --- | --- | --- |
| Login | usuario e senha obrigatorios | campos presentes |
| Novo processo | vaga, quantidade, data, operacao, trilha | campos presentes, obrigatoriedade visual pode melhorar |
| Nota de corte | nota minima habilitada somente com checkbox | campo desabilitado inicialmente |
| Entrevista | inicio < fim, duracao, capacidade | campos presentes |
| Agendamento | slot disponivel e candidato elegivel | regra documentada, nao executada |
| Aprovacao | candidato, mensagem/documentos | modal documentado |
| Eliminacao | motivo obrigatorio; entrevista condicional | modal documentado |
| Usuario | nome/e-mail obrigatorios | required observado |
| Alteracao sensivel | justificativa recomendada | campo existe, tornar obrigatorio |
| Catalogo | nome obrigatorio | required observado |
| Logs | filtros nao obrigatorios | ok |
| Conecta Provas | codigo/token obrigatorio | campo presente sem label clara |

