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

## Testes E2E (Playwright)

Além dos smoke tests em `tests/` (scripts `.cjs` executados manualmente),
há uma suíte de testes end-to-end com Playwright em `tests-e2e/`, cobrindo
o app real rodando em um navegador. Veja `tests-e2e/README.md` para como
instalar, rodar localmente e a limitação conhecida de autenticação via
Microsoft SSO em CI.

Resumo rápido:

```powershell
cd apps/frontend
npm install
npx playwright install chromium
npm run test:e2e
```

## Vite (build/dev opcional)

O **modo de produção suportado por padrão continua sendo o atual**: arquivos
estáticos servidos diretamente pelo backend (`python run.py`), sem nenhuma
etapa de build. Ninguém precisa instalar ou rodar Vite para o app funcionar —
isso não muda até que uma decisão consciente de migrar de vez seja tomada.

O Vite foi adicionado apenas como uma ferramenta **opcional** para quem
quiser um dev server com hot-reload mais rápido durante o desenvolvimento, ou
gerar um bundle de produção otimizado como alternativa ao modo estático.

```powershell
cd apps/frontend
npm install

# Dev server com hot-reload, fazendo proxy das chamadas de API para o
# backend Python (que precisa estar rodando, ex.: `python run.py` na raiz,
# padrão em http://127.0.0.1:8000):
npm run dev
# abre em http://localhost:5173

# Build de produção opcional (gera apps/frontend/dist/, isolado dos
# arquivos-fonte servidos hoje; o backend não lê nada dessa pasta):
npm run build
```

Notas:

- O código em `fonte/` usa apenas imports relativos (`./x.js`, `../x.js`) ou
  URLs absolutas de CDN (`https://esm.sh/...`); não há "bare specifiers", por
  isso o Vite processa o grafo de módulos sem que nenhum import precisasse
  ser reescrito.
- `vite.config.js` define `build.target: 'esnext'` porque o código-fonte usa
  top-level `await` (ex.: `fonte/banco-questoes.js`) — o mesmo recurso que já
  exige um navegador moderno no modo sem-build via `<script type="module">`.
- O proxy do dev server (`server.proxy` em `vite.config.js`) encaminha uma
  lista de prefixos de rota conhecidos da API para o backend. Como a
  navegação do SPA é por hash (`#/tela`, ver `fonte/rotas.js`), não há
  colisão com rotas de tela. Uma rota de backend nova com prefixo fora dessa
  lista não seria proxeada automaticamente em dev — é só adicionar o
  prefixo em `vite.config.js`; isso não afeta o modo de produção padrão.
