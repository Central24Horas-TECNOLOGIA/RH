# Testes

## Estado atual

Os testes automatizados ativos ficam em `apps/backend/tests/` e `apps/frontend/tests/`.

O foco principal atual e validar:

- autenticacao;
- historico com paginacao;
- pipeline de candidatos;
- entrevistas;
- deteccao de deadlock.

## Estrategia adotada

Os testes usam `FakeRepository` para evitar dependencia de banco real. Isso reduz fragilidade e deixa a validacao executavel em maquina local sem SQL Server.

## Como executar

```powershell
python -m pytest
```

Validacao focada do modulo analitico:

```powershell
.\.venv\Scripts\python.exe -m pytest apps\backend\tests\test_exam_analytics.py -q
node apps\frontend\tests\static-checks\run-exam-analytics-smoke.cjs
```

O arquivo `pytest.ini` desabilita o cache do pytest para evitar warnings e conflitos de escrita em ambientes com OneDrive.

## Arquivos importantes

- `apps/backend/tests/test_auth_and_pipeline.py`
- `apps/backend/tests/conftest.py`
- `apps/backend/tests/test_exam_analytics.py`
- `apps/frontend/tests/static-checks/run-exam-analytics-smoke.cjs` (checagem estática — ver [`apps/frontend/tests/static-checks/README.md`](../apps/frontend/tests/static-checks/README.md))

## Como evoluir os testes

1. Prefira fake, mock ou stub para regras unitarias.
2. Use banco real apenas em testes de integracao explicitamente separados.
3. Se adicionar repository novo, cubra o comportamento observado pelo router ou service.
4. Mantenha os testes curtos e orientados a comportamento.
