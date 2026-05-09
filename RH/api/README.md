# Backend

## Pastas principais

- `app.py`: entrypoint do servidor.
- `rh_api/main.py`: composicao da aplicacao FastAPI.
- `rh_api/routers/`: endpoints.
- `rh_api/schemas/`: contratos.
- `rh_api/services/`: regras auxiliares.
- `rh_api/repositories/`: persistencia por dominio.
- `tests/`: testes automatizados.

## Estrategia adotada

O backend segue separacao clara entre HTTP, servico e persistencia. O antigo repositorio monolitico foi quebrado em modulos menores, mantendo `DatabaseRepository` apenas como fachada de compatibilidade.
