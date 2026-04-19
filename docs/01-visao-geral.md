# 01 - Visao Geral do Projeto

## Nome do sistema

Conexa RH - Plataforma local de provas, processos seletivos e acompanhamento operacional de candidatos.

## Objetivo

Centralizar em uma unica plataforma o fluxo de RH que hoje depende de avaliacao, triagem, acompanhamento de candidatos e tomada de decisao baseada em dados.

## Publico-alvo

- Equipe de RH operacional
- Liderancas que acompanham processos seletivos
- TI interno responsavel por suporte e manutencao

## Problema que resolve

- Evita controles paralelos em planilhas e mensagens avulsas.
- Mantem historico unificado de prova, processo, pipeline e entrevista.
- Permite reaproveitamento de candidatos via banco de talentos.
- Apoia decisao do RH com analise de desempenho e afinidade.

## Escopo atual

- Autenticacao local por usuario e senha.
- Dashboard com atalhos e historico recente.
- Configuracao e aplicacao de provas.
- Persistencia do historico e do gabarito.
- Cadastro e manutencao de processos seletivos.
- Vinculo de candidatos a processos.
- Analise automatica de CV para processos.
- Pipeline de candidatos em formato kanban.
- Agenda de entrevistas integrada ao processo.
- Banco de talentos para reaproveitamento.
- Analise comparativa por candidato.

## Tecnologias utilizadas

### Frontend

- HTML estatico
- JavaScript modular em `Front/fonte/`
- React 18 via ESM
- HTM para templates
- Bootstrap 5
- CSS modular em `Front/estilos/`

### Backend

- Python 3
- FastAPI
- Pydantic v2
- pyodbc
- Uvicorn

### Banco e integracoes

- SQL Server com `Trusted_Connection=yes`
- `python-multipart` para upload de CV
- `pypdf` e `python-docx` para extracao de texto
- `openpyxl` para apoio a fluxo de prova/planilha

## Status do projeto

- Sistema em operacao local.
- Backend e frontend integrados.
- Modulos principais em uso.
- Atualizacao atual focada em estabilidade de detalhe de processo, usabilidade orientada por tour e refinamento visual.

## Responsavel pelo sistema

- Operacao funcional: RH interno da Central 24 Horas
- Sustentacao tecnica: TI interno do projeto RH

## Modulos disponiveis

- Login
- Painel inicial
- Historico de provas
- Processos seletivos
- Criacao de processo
- Detalhes de processo
- Pipeline de candidatos
- Entrevistas
- Banco de talentos
- Configuracao de prova
- Fluxo de candidato
- Prova
- Resultado
- Analise de candidatos
