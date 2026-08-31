# Dependências vendorizadas (achado S-21)

Estes arquivos substituem o carregamento de React/ReactDOM/htm via CDN externo (`esm.sh`) por builds ESM baixados uma vez e servidos como arquivo estático pelo próprio Caddy (`apps/frontend/Dockerfile` copia `apps/frontend/` inteiro para `/srv`). Reduz uma dependência de disponibilidade/latência de terceiros no caminho crítico de carregamento da aplicação (achado PERF-007).

## Origem e integridade

Cada arquivo é o build ESM oficial (código de produção minificado do próprio pacote npm, sem transformação de conteúdo além de reescrever os caminhos de import para apontarem para os outros arquivos vendorizados nesta mesma pasta), obtido de `https://esm.sh/<pacote>@<versão>` em 31/ago/2026:

| Arquivo | Pacote/versão | Licença |
|---|---|---|
| `react@18.3.1.mjs` | `react@18.3.1` | MIT (Meta/Facebook) |
| `react-dom@18.3.1.mjs` | `react-dom@18.3.1` | MIT (Meta/Facebook) |
| `react-dom-client@18.3.1.mjs` | `react-dom@18.3.1/client` | MIT (Meta/Facebook) |
| `scheduler@0.23.2.mjs` | `scheduler@0.23.2` (dependência interna do react-dom) | MIT (Meta/Facebook) |
| `htm@3.1.1.mjs` | `htm@3.1.1` | Apache-2.0 (developit) |

Cada arquivo mantém o comentário de proveniência original (`/* esm.sh - pacote@versão */`) na primeira linha — não remova, é o registro de origem.

## Grafo de imports (por que 5 arquivos, não 3)

`react-dom` depende de `react` e de `scheduler`; `react-dom/client` depende de `react-dom`. O CDN resolve essa cadeia em tempo de requisição; vendorizado, a cadeia precisa existir como arquivos locais com imports relativos entre si:

```
react-dom-client@18.3.1.mjs → react-dom@18.3.1.mjs → react@18.3.1.mjs
                                                     → scheduler@0.23.2.mjs
htm@3.1.1.mjs (sem dependências)
```

## Como atualizar a versão

1. Repetir o `curl` para a nova versão de cada pacote (mesmo caminho `es2022` do esm.sh), sobrescrevendo o arquivo correspondente com o novo sufixo de versão no nome.
2. Reaplicar as duas edições de import relativo (`react-dom@X.mjs` → `./react@X.mjs` + `./scheduler@X.mjs`; `react-dom-client@X.mjs` → `./react-dom@X.mjs`) — o esm.sh sempre entrega esses dois arquivos com o import apontando de volta para o CDN, então isso precisa ser refeito a cada atualização.
3. Atualizar os caminhos importados em `fonte/infraestrutura-react.js`.
4. Verificar a aplicação real no navegador antes de publicar — não há bundler/testes automatizados que peguem uma cadeia de import quebrada aqui.
