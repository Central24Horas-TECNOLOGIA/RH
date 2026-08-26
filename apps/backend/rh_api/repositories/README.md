# Repositories — convenção de acesso a dados (SQL Server via pyodbc, sem ORM)

Este pacote implementa, na prática, um **Repository pattern manual**: cada arquivo
é um mixin de domínio (`ProcessRepositoryMixin`, `ScorecardRepositoryMixin`,
`SecurityRepositoryMixin`, etc.) com métodos que executam SQL cru (via `pyodbc`)
contra o SQL Server. `db_repository.py` compõe todos os mixins numa única classe
de fachada, `DatabaseRepository`, usada pelo resto da aplicação (routers/services).

Este documento existe para que **features novas sigam o padrão já estabelecido**
em vez de inventar uma variação ligeiramente diferente a cada PR.

## Como criar um mixin novo

1. Crie `apps/backend/rh_api/repositories/<dominio>.py` com uma classe
   `<Dominio>RepositoryMixin` **sem** herdar explicitamente de nada (os mixins
   contam com a composição múltipla feita em `DatabaseRepository` para herdar
   `BaseRepository` — ver `db_repository.py`). Isso já é assim para todos os
   mixins existentes; não adicione uma superclasse própria, ou o MRO de
   `DatabaseRepository` pode quebrar.
2. Se o mixin precisar criar/alterar tabelas, coloque as funções `ensure_*_table`
   / `ensure_*_columns` em `bootstrap.py` (idempotentes: sempre `IF OBJECT_ID(...)
   IS NULL` / `IF COL_LENGTH(...) IS NULL`), nunca dentro do próprio mixin.
3. Registre o mixin em `db_repository.py`: adicione o `import` e inclua a classe
   na lista de bases de `DatabaseRepository`. A ordem não costuma importar (os
   mixins não compartilham nomes de método entre si), mas mantenha
   `BaseRepository` sempre por último.
4. Exponha o mixin via `DatabaseRepository`, nunca acessando `pyodbc`/`get_connection`
   diretamente em routers ou services — a única exceção deliberada no projeto é o
   health-check (`rh_api/routers/system.py`, `SELECT 1`), que não é lógica de
   negócio e não precisa passar pela camada de repositório.

## Padrão de conexão e transação (siga isto)

Todo método público de mixin que acessa o banco segue este esqueleto:

```python
def minha_operacao(self, ...):
    conn = self._connect()
    try:
        cursor = conn.cursor()
        ensure_minha_tabela(cursor)          # se aplicável
        cursor.execute("...", (...,))
        conn.commit()                        # apenas se houver escrita
        return resultado
    finally:
        conn.close()
```

Pontos importantes, confirmados como consistentes em **todos** os 25 mixins
existentes ao investigar este refactor:

- **Cada método abre a própria conexão** via `self._connect()` (herdado de
  `BaseRepository._connect()`, que chama `rh_api.db.get_connection(self.settings)`).
  Não há um pool/conexão compartilhada entre chamadas — é o padrão do projeto,
  não um bug. Não mude isso sem medir o impacto em concorrência.
- **`try/finally: conn.close()`** é o padrão universal de liberação de conexão.
- **Commit explícito** (`conn.commit()`) após operações de escrita — o driver
  não está em autocommit. Métodos somente-leitura não chamam `commit()`.
- **Rollback explícito é raro** (usado só em alguns fluxos de `security.py`,
  `exam_analytics.py`, `talent_bank.py`) porque a maioria dos métodos não
  captura exceções no meio da transação — se `cursor.execute` levantar, a
  exceção sobe, `finally: conn.close()` libera a conexão, e a transação nunca
  chega ao commit (fica implicitamente revertida ao fechar a conexão sem commit).
  Isso é seguro, mas **não confunda com autocommit** — se você adicionar um
  `try/except` no meio de um método de escrita, garanta que ainda existe um
  caminho para `conn.close()` (ou `rollback()` explícito) antes de continuar.
- **Deadlocks**: para operações críticas com risco real de deadlock (conflitos de
  concorrência em update), use `self._run_with_deadlock_retry(acao, operation, ...)`
  (definido em `base.py`), já usado em vários mixins.

## Parametrização de SQL (regra de segurança, não negociável)

Nenhuma query deste pacote deve concatenar valor vindo de request/payload
diretamente na string SQL. O padrão obrigatório é `cursor.execute(sql, params)`
com `?` como placeholder (estilo pyodbc/SQL Server).

Ao investigar este refactor, todas as ocorrências de f-string dentro de
`cursor.execute(...)` foram revisadas uma a uma. Todas seguem um destes padrões
seguros — continue usando exatamente estes padrões em código novo:

1. **DDL de bootstrap** (`bootstrap.py`): nomes de tabela/coluna vêm de literais
   fixos no código (tuplas hardcoded), nunca de entrada do usuário.
2. **Cláusula `IN (...)` dinâmica**: o número de `?` é construído dinamicamente
   (`",".join("?" for _ in items)`), mas os valores em si sempre vão parametrizados
   em `params` — ex. `exam_analytics.py` (`compare_process_candidates`,
   `_upsert_category_results`).
3. **`WHERE` dinâmico a partir de `build_process_where_clause()`** (`bootstrap.py`):
   retorna a cláusula (`"id_processo = ?"` ou `"id_processo = ? AND data_criacao = ?"`)
   **e** a tupla de parâmetros correspondente — nunca formata o valor direto na
   string. Use esta função sempre que precisar localizar uma linha de
   `processos_seletivos` por id/ref.
4. **Limite/`TOP N` numérico**: sempre precedido de `int(...)` + `max()/min()`
   para clampar a um intervalo fixo antes de interpolar (nunca um valor de
   string livre). Use `BaseRepository._clamp_limit(value, default, maximum)`
   (adicionado neste refactor) em vez de repetir
   `max(1, min(int(x or default), maximum))` inline.
5. **Nome de tabela/coluna validado por regex**: quando um nome dinâmico de
   tabela/coluna é inevitável (ex. `get_next_numeric_id`), ele passa por
   `_SQL_IDENTIFIER_PATTERN.fullmatch(...)` (definido em `bootstrap.py`) antes
   de entrar na f-string.

Se você precisar de uma query onde o valor vem de fora e não se encaixa em
nenhum dos padrões acima, **não invente uma concatenação nova** — pare e peça
revisão. Nenhuma ocorrência de concatenação insegura foi encontrada durante
este refactor (ver relatório da tarefa), então esta seção documenta o padrão
seguro que já existe, não uma correção.

## Convenção de nomenclatura de método

- `list_x(...)` para retornar coleções (já é o padrão em 100% dos mixins —
  não existem hoje variações tipo `get_all_x`/`listar_x` misturadas).
- `get_x(...)` para buscar um único registro.
- `create_x` / `update_x` / `delete_x` (ou verbos de domínio equivalentes, ex.
  `close_process`, `deactivate_public_application_link`) para escrita.
- Métodos privados/utilitários (não chamados fora do próprio mixin ou de
  `base.py`) começam com `_`.

Ao adicionar um método, procure primeiro se já existe um equivalente em outro
mixin para manter o verbo consistente. **Não renomeie métodos existentes só por
consistência** — vários são chamados por routers e testes; um rename that
"parece" cosmético pode ter dezenas de call-sites. Se notar uma inconsistência
real de nome em código já existente, documente aqui em vez de mudar.

## Utilitários compartilhados (`BaseRepository`, `base.py`)

Todos os mixins ganham acesso a estes métodos via composição múltipla em
`DatabaseRepository` (não por herança direta — cada mixin é uma classe solta):

- `self._connect()` — abre uma conexão nova.
- `self._run_with_deadlock_retry(...)` — retry com backoff para deadlock do SQL Server.
- `self._clamp_limit(value, default, maximum, minimum=1)` — normaliza limite/paginação.
- Um conjunto grande de helpers de enriquecimento de candidato
  (`_enrich_candidate_records`, `_get_candidate_profile_map`, etc.) usados pelos
  mixins de processo/pipeline/histórico — ver `base.py` antes de duplicar lógica
  de mapeamento de candidato.

Funções utilitárias de schema (não ligadas a uma instância) ficam em
`bootstrap.py`: `ensure_*_table`, `ensure_*_columns`, `describe_database_error`,
`is_deadlock_error`, `build_process_where_clause`, `is_identity_column`, etc.
