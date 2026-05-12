# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Testes automatizados

Comando:

```powershell
python -m pytest
```

Arquivos identificados:

- `api/tests/test_auth_and_pipeline.py`
- `api/tests/test_cv_extraction.py`
- `api/tests/test_history_and_process_rules.py`
- `api/tests/test_interview_schema.py`
- `api/tests/test_public_candidacy.py`

## QA manual mínimo

| Área | Teste | Resultado esperado |
|---|---|---|
| Login | Credencial correta/incorreta | Entra ou mostra erro. |
| Processo | Criar/listar/encerrar | Status correto. |
| Link público | Gerar e abrir candidatura | Vaga pública carrega. |
| Candidatura | Enviar CV | Candidato/anexo registrados. |
| E-mails | Listar, abrir, analisar, excluir | Operações sem erro 500. |
| CV | Analisar PDF/DOCX | Score e dados extraídos. |
| Banco talentos | Enviar e reutilizar | Candidato entra no processo. |
| Entrevista | Criar slot e agendar | Entrevista salva. |
| Prova | Iniciar e finalizar | Histórico salvo. |
| Relatórios | Filtrar/exportar | Arquivo/resultado correto. |

## Critérios de aceite

- API sobe sem erro.
- Frontend abre e navega.
- Login funcional.
- Banco conectado.
- Fluxos principais sem erro 500.
- Logs sem secrets.
- Anexos acessíveis.
- Testes automatizados passando.
