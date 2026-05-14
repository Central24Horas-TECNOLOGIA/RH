# 12 — Testes e qualidade

## Testes existentes

Foram encontrados testes em `api/tests/`:

| Arquivo | Cobertura aparente |
| --- | --- |
| `test_auth_and_pipeline.py` | Autenticação e pipeline |
| `test_cv_extraction.py` | Extração de texto de CV |
| `test_history_and_process_rules.py` | Histórico e regras de processo |
| `test_interview_schema.py` | Validação de schemas de entrevista |
| `test_public_candidacy.py` | Candidatura pública |

## Tentativa de execução

Comando executado:

```powershell
python -m pytest -q
```

Resultado neste ambiente:

```text
ModuleNotFoundError: No module named 'pyodbc'
```

Interpretação: os testes não puderam nem ser coletados porque o pacote `pyodbc` não está instalado no ambiente de análise. Isso não significa que os testes do projeto estejam quebrados; significa que o ambiente não tem uma dependência obrigatória.

## Como executar corretamente

```powershell
cd C:\Caminho\RH
.\.venv\Scripts\Activate.ps1
pip install -r apiequirements.txt
python -m pytest
```

Além do pacote Python `pyodbc`, o servidor precisa ter o driver ODBC do SQL Server instalado.

## Checklist manual de regressão

Antes de entregar qualquer alteração, testar:

### Login

- Login correto.
- Senha errada.
- Sessão expirada.
- Acesso a resultado exigindo autenticação.

### Caixa de e-mail

- Listagem de e-mails.
- Paginação 5/10/15.
- E-mail sem anexo.
- E-mail com PDF.
- E-mail com DOCX.
- Analisar CV.
- Vincular a processo.
- Enviar para banco de talentos.
- Excluir e-mail.

### Processo

- Criar processo.
- Editar processo.
- Abrir detalhes.
- Ver candidatos ativos.
- Encerrar processo.
- Confirmar bloqueio de ações após encerrado.

### Candidato

- Vincular ao processo.
- Atualizar status.
- Aprovar.
- Eliminar com motivo.
- Mover para banco de talentos.

### Entrevistas

- Criar slot.
- Editar slot.
- Excluir slot.
- Agendar candidato usando slot.
- Verificar capacidade ocupada.
- Atualizar status da entrevista.

### Prova

- Criar nova prova.
- Executar prova completa.
- Finalizar.
- Ver histórico.
- Abrir resultado.
- Imprimir/exportar resultado, se aplicável.

## Riscos técnicos principais

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Divergência de schema SQL | Erros em produção | Bootstrap + scripts revisados + backup |
| Alteração visual quebrar ação JS | Tela bonita mas sem função | Teste funcional depois de CSS/HTML |
| CORS incorreto | Front não chama API | Configurar origem real |
| `pyodbc`/driver ausente | API não conecta | Instalar pacote e ODBC Driver |
| Segredo em arquivo | Risco de segurança | Usar variável de ambiente |
| Pasta `data/private` exposta | Vazamento de CVs | Permissões e `.gitignore` |
