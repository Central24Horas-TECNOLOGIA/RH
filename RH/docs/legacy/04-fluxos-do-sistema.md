# 04 - Fluxos do Sistema

## Fluxo macro

```text
Login
  -> Painel inicial
     -> Configuracao de prova
        -> Identificacao do candidato
           -> Prova
              -> Resultado
                 -> Historico
                 -> Vinculo ao processo
                    -> Pipeline
                    -> Entrevista
                    -> Banco de talentos
                    -> Analise do candidato
```

## Jornada 1 - Prova vinculada a processo

1. RH acessa o login.
2. RH abre a configuracao de prova.
3. RH seleciona processo, vaga, nivel, trilha e tempo.
4. RH informa o nome do candidato.
5. Candidato realiza a prova.
6. O sistema calcula nota, monta resumo por etapa e salva historico.
7. O resultado pode ser vinculado a `candidatos_processos`.
8. O candidato passa a ser visivel em processos, pipeline e analise.

## Jornada 2 - Criacao e acompanhamento de processo

1. RH cria um processo seletivo.
2. RH define quantidade de vagas, data de encerramento e nota de corte quando necessario.
3. O processo passa a aparecer na lista de processos.
4. RH abre os detalhes do processo.
5. RH acompanha resumo, pre-analises, candidatos e entrevistas ligadas.
6. Aprovacoes atualizam `vagas_preenchidas`.
7. Ao atingir o limite de vagas, o processo pode ser encerrado automaticamente.

## Jornada 3 - Pre-analise de CV

1. RH abre detalhes do processo.
2. RH envia o arquivo do CV.
3. O backend extrai o texto e calcula score por aderencia.
4. RH revisa nome, email, telefone, score e classificacao.
5. RH adiciona o candidato ao processo quando a analise estiver validada.

## Jornada 4 - Pipeline

1. RH abre o pipeline.
2. RH filtra por processo ou busca por nome.
3. RH cria um card manual ou movimenta um card existente.
4. A etapa atual reflete o status operacional.
5. Ao chegar em entrevista, o processo pode seguir para agenda e retorno final.

## Jornada 5 - Banco de talentos

1. RH envia um candidato para `Banco de talentos`.
2. O registro passa a compor a lista de reaproveitamento.
3. RH filtra por nome, habilidade ou tag.
4. RH reutiliza o candidato em um processo aberto.
5. O candidato volta para `candidatos_processos` em triagem.

## Jornada 6 - Entrevista

1. RH agenda entrevista a partir do processo ou da tela de entrevistas.
2. O backend valida candidato, processo e data.
3. O sistema gera mensagem base e reutiliza o link do processo quando necessario.
4. RH acompanha status `Agendado`, `Confirmado`, `Compareceu` ou `Faltou`.

## Casos de uso principais

- UC01: autenticar usuario do RH.
- UC02: iniciar uma nova prova.
- UC03: consultar historico de provas.
- UC04: criar e manter processo seletivo.
- UC05: vincular candidato ao processo.
- UC06: analisar CV e adicionar candidato ao funil.
- UC07: mover candidato no pipeline.
- UC08: enviar candidato ao banco de talentos.
- UC09: reutilizar candidato em novo processo.
- UC10: agendar e atualizar entrevista.
- UC11: analisar afinidade e parecer do candidato.

## Mapa de telas

- `#/login`
- `#/inicio`
- `#/historico`
- `#/processos`
- `#/novo-processo`
- `#/detalhes-processo`
- `#/pipeline-candidatos`
- `#/entrevistas`
- `#/banco-talentos`
- `#/configuracao`
- `#/candidato`
- `#/prova`
- `#/conclusao`
- `#/resultado`
- `#/analise-candidatos`
