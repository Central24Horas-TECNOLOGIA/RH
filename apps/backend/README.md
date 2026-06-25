# Backend Conecta

Backend FastAPI oficial do projeto. O entrypoint canônico é
`conecta.interfaces.http.main:app`; a implementação compatível existente permanece
em `rh_api/` enquanto os domínios são incorporados à arquitetura em `conecta/`.

```powershell
cd apps/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn conecta.interfaces.http.main:app --reload --host 127.0.0.1 --port 8000
```

Os testes ficam em `tests/` e também podem ser executados da raiz com
`python -m pytest`.
