# Estrutura das telas

## Layout interno padrao

```text
+--------------------------------------------------------------+
| Menu lateral | Topbar: busca global | acao principal | perfil |
|              +-----------------------------------------------+
|              | Conteudo principal                            |
|              | Intro da pagina                               |
|              | Cards / filtros / tabelas / formularios       |
|              | Modais sobrepostos quando acionados           |
+--------------------------------------------------------------+
```

Elementos fixos:

- Logo Conecta com acao de voltar ao painel.
- Botao de recolher/expandir menu.
- Busca global no topo.
- Acao principal quando existe: Gerar prova, Criar processo, Iniciar teste.
- Botao de ajuda/tour.
- Sair e menu do perfil.

## Padrao por tipo de tela

| Tipo | Estrutura | Telas |
| --- | --- | --- |
| Painel | saudacao, atalhos, cards, tabelas resumidas | Inicio |
| Lista operacional | intro, filtros, tabela/cards, acoes por linha | E-mails, Processos, Banco, Provas, Logs |
| Formulario guiado | titulo da etapa, blocos de campos, botoes voltar/cancelar/proximo | Novo processo, Configuracao da prova |
| Calendario | resumo, seletor semanal, criar disponibilidade, filtros, slots/agenda | Entrevistas |
| Detalhe | cabecalho do objeto, abas, tabelas por aba, acoes contextuais | Detalhes do processo, Ficha candidato |
| Governanca | abas/submenu, filtros, formularios laterais, listas | Configuracoes |
| Publica | tela isolada, campo de codigo/token, botao continuar | Conecta Provas |

