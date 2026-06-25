# Frontend Conecta

Frontend estático oficial do projeto. A entrada é `index.html`; o código JavaScript
ESM fica em `fonte/`, os estilos e recursos visuais em `estilos/` e os smoke tests
em `tests/`.

Para executar isoladamente:

```powershell
cd apps/frontend
python -m http.server 5500
```

Para a experiência completa, prefira iniciar o backend pela raiz com
`python run.py`, pois ele serve este diretório e a API na mesma origem.
