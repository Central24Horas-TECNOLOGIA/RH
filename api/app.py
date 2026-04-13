from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pyodbc
import json

app = FastAPI(title="API RH Provas")

# LIBERA CORS PARA TESTE LOCAL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = r"C:\Users\psilva\OneDrive - Empresa Brasileira de Soluções e Serviços em Teleatendimento Ltda\Projetos\RH\data\rh_provas.accdb"


CONN_STR = (
    r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    rf"DBQ={DB_PATH};"
)


def get_connection():
    return pyodbc.connect(CONN_STR)


def rows_to_dicts(cursor, rows):
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in rows]


def process_auto_close_if_full(cursor, id_processo: str):
    cursor.execute(
        """
        SELECT quantidade_vagas, vagas_preenchidas, status
        FROM processos_seletivos
        WHERE id_processo = ?
        """,
        (id_processo,),
    )
    row = cursor.fetchone()
    if not row:
        return

    quantidade_vagas = int(row[0] or 0)
    vagas_preenchidas = int(row[1] or 0)
    status = str(row[2] or '').strip()

    if status != 'Encerrado' and quantidade_vagas > 0 and vagas_preenchidas >= quantidade_vagas:
        cursor.execute(
            """
            UPDATE processos_seletivos
            SET status = ?
            WHERE id_processo = ?
            """,
            ('Encerrado', id_processo),
        )


def get_gabaritos_payload_column(cursor):
    columns = [col.column_name for col in cursor.columns(table='gabaritos')]
    for name in ('payload_json', 'playlaod_json'):
        if name in columns:
            return name
    raise HTTPException(
        status_code=500,
        detail=f"Coluna de payload não encontrada na tabela gabaritos. Colunas disponíveis: {columns}",
    )


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "API RH Provas online",
        "db_path": DB_PATH
    }
    '''return {"status": "ok", "message": "API RH Provas online"}'''

@app.get("/debug/gabaritos-columns")
def debug_gabaritos_columns():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cols = [col.column_name for col in cursor.columns(table='gabaritos')]

        conn.close()
        return {"columns": cols}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
def get_history():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
                    SELECT
                        id_teste,
                        id_processo,
                        nome_candidato,
                        vaga,
                        nivel,
                        trilha,
                        data_iso,
                        data_exibicao,
                        pontuacao_final,
                        status,
                        tempo_minutos,
                        arquivo_gabarito,
                        etapas_json
                    FROM historico_provas
                """)

        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()

        result = []
        for row in rows:
            result.append(dict(zip(columns, row)))

        conn.close()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/answer-files")
def get_answer_files():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        payload_column = get_gabaritos_payload_column(cursor)

        cursor.execute(f"SELECT record_id, {payload_column} FROM gabaritos")
        rows = cursor.fetchall()

        result = {}
        for row in rows:
            result[str(row[0])] = {
                "content": row[1]
            }

        conn.close()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/history")
def save_history(row: dict):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        sql = """
               INSERT INTO historico_provas
               (
                   id_teste,
                   id_processo,
                   nome_candidato,
                   vaga,
                   nivel,
                   trilha,
                   data_iso,
                   data_exibicao,
                   pontuacao_final,
                   status,
                   tempo_minutos,
                   arquivo_gabarito,
                   etapas_json
               )
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               """

        values = (
            row.get("id_teste", ""),
            row.get("id_processo", ""),
            row.get("nome_candidato", ""),
            row.get("vaga", ""),
            row.get("nivel", ""),
            row.get("trilha", ""),
            row.get("data_iso", ""),
            row.get("data_exibicao", ""),
            row.get("pontuacao_final", 0),
            row.get("status", ""),
            row.get("tempo_minutos", 0),
            row.get("arquivo_gabarito", ""),
            row.get("etapas_json", ""),
        )

        cursor.execute(sql, values)
        conn.commit()
        conn.close()

        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/answer-files")
def save_answer_file(data: dict):
    try:
        record_id = data.get("recordId")
        payload = data.get("payload")

        if not record_id:
            raise HTTPException(status_code=400, detail="recordId é obrigatório.")

        payload_text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)

        conn = get_connection()
        cursor = conn.cursor()
        payload_column = get_gabaritos_payload_column(cursor)

        cursor.execute("SELECT COUNT(*) FROM gabaritos WHERE record_id = ?", (record_id,))
        exists = cursor.fetchone()[0]

        if exists:
            cursor.execute(
                f"UPDATE gabaritos SET {payload_column} = ? WHERE record_id = ?",
                (payload_text, record_id)
            )
        else:
            cursor.execute(
                f"INSERT INTO gabaritos (record_id, {payload_column}) VALUES (?, ?)",
                (record_id, payload_text)
            )

        conn.commit()
        conn.close()

        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/processes")
def get_processes():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id_processo,
                vaga,
                quantidade_vagas,
                vagas_preenchidas,
                data_encerramento,
                operacao,
                trilha,
                status,
                data_criacao
            FROM processos_seletivos
        """)
        rows = cursor.fetchall()
        result = rows_to_dicts(cursor, rows)

        conn.close()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/processes")
def create_process(data: dict):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO processos_seletivos
            (
                id_processo,
                vaga,
                quantidade_vagas,
                vagas_preenchidas,
                data_encerramento,
                operacao,
                trilha,
                status,
                data_criacao
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("id_processo", ""),
            data.get("vaga", ""),
            int(data.get("quantidade_vagas", 0) or 0),
            int(data.get("vagas_preenchidas", 0) or 0),
            data.get("data_encerramento", ""),
            data.get("operacao", ""),
            data.get("trilha", ""),
            data.get("status", "Aberto"),
            data.get("data_criacao", ""),
        ))

        conn.commit()
        conn.close()
        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/processes/{id_processo}")
def update_process(id_processo: str, data: dict):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE processos_seletivos
            SET
                quantidade_vagas = ?,
                data_encerramento = ?,
                operacao = ?,
                trilha = ?,
                status = ?
            WHERE id_processo = ?
        """, (
            int(data.get("quantidade_vagas", 0) or 0),
            data.get("data_encerramento", ""),
            data.get("operacao", ""),
            data.get("trilha", ""),
            data.get("status", "Aberto"),
            id_processo,
        ))

        process_auto_close_if_full(cursor, id_processo)

        conn.commit()
        conn.close()
        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/processes/{id_processo}/close")
def close_process(id_processo: str):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE processos_seletivos
            SET status = ?
            WHERE id_processo = ?
        """, ("Encerrado", id_processo))

        conn.commit()
        conn.close()
        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/process-candidates")
def get_process_candidates():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id_registro,
                id_processo,
                id_teste,
                nome_candidato,
                vaga,
                status_candidato,
                pontuacao_final,
                data_prova,
                origem
            FROM candidatos_processos
        """)
        rows = cursor.fetchall()
        result = rows_to_dicts(cursor, rows)

        conn.close()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process-candidates")
def create_process_candidate(data: dict):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO candidatos_processos
            (
                id_processo,
                id_teste,
                nome_candidato,
                vaga,
                status_candidato,
                pontuacao_final,
                data_prova,
                origem
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("id_processo", ""),
            data.get("id_teste", ""),
            data.get("nome_candidato", ""),
            data.get("vaga", ""),
            data.get("status_candidato", "Em análise"),
            data.get("pontuacao_final", ""),
            data.get("data_prova", ""),
            data.get("origem", "Prova"),
        ))

        conn.commit()
        conn.close()
        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/process-candidates/{id_registro}/status")
def update_process_candidate_status(id_registro: int, data: dict):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id_processo, id_teste, nome_candidato, vaga, status_candidato, pontuacao_final, origem
            FROM candidatos_processos
            WHERE id_registro = ?
        """, (id_registro,))
        current = cursor.fetchone()

        if not current:
            raise HTTPException(status_code=404, detail="Candidato do processo não encontrado.")

        id_processo = str(current[0] or "").strip()
        id_teste = str(current[1] or "").strip()
        nome_candidato = str(current[2] or "").strip()
        vaga = str(current[3] or "").strip()
        old_status = str(current[4] or "").strip()
        pontuacao_final = current[5]
        origem = str(current[6] or "").strip()

        new_status = str(data.get("status_candidato", "")).strip()

        if not id_processo:
            raise HTTPException(status_code=400, detail="Processo do candidato não encontrado.")

        # Atualiza status do candidato
        cursor.execute("""
            UPDATE candidatos_processos
            SET status_candidato = ?
            WHERE id_registro = ?
        """, (new_status, id_registro))

        # Busca dados atuais do processo
        cursor.execute("""
            SELECT quantidade_vagas, vagas_preenchidas, status
            FROM processos_seletivos
            WHERE id_processo = ?
        """, (id_processo,))
        process_row = cursor.fetchone()

        if not process_row:
            raise HTTPException(status_code=404, detail="Processo seletivo não encontrado.")

        quantidade_vagas = int(process_row[0] or 0)
        vagas_preenchidas = int(process_row[1] or 0)
        status_processo = str(process_row[2] or "").strip()

        # Ajusta vagas preenchidas
        if old_status != 'Aprovado' and new_status == 'Aprovado':
            vagas_preenchidas += 1
        elif old_status == 'Aprovado' and new_status != 'Aprovado':
            vagas_preenchidas = max(0, vagas_preenchidas - 1)

        cursor.execute("""
            UPDATE processos_seletivos
            SET vagas_preenchidas = ?
            WHERE id_processo = ?
        """, (vagas_preenchidas, id_processo))

        # Fecha o processo automaticamente se lotou
        if status_processo != 'Encerrado' and quantidade_vagas > 0 and vagas_preenchidas >= quantidade_vagas:
            cursor.execute("""
                UPDATE processos_seletivos
                SET status = ?
                WHERE id_processo = ?
            """, ('Encerrado', id_processo))

        if new_status != 'Banco de talentos':
            cursor.execute("""
                DELETE FROM banco_talentos
                WHERE id_teste = ?
            """, (id_teste,))

        # Envia para banco de talentos sem duplicar
        if new_status == 'Banco de talentos':
            cursor.execute("""
                SELECT COUNT(*)
                FROM banco_talentos
                WHERE id_teste = ?
            """, (id_teste,))
            already_exists = cursor.fetchone()[0]

            if not already_exists:
                cursor.execute("""
                    INSERT INTO banco_talentos
                    (
                        id_processo,
                        id_teste,
                        nome_candidato,
                        vaga,
                        pontuacao_final,
                        data_movimentacao,
                        origem
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    id_processo,
                    id_teste,
                    nome_candidato,
                    vaga,
                    pontuacao_final,
                    data.get("data_movimentacao", ""),
                    origem or "Prova",
                ))

        conn.commit()
        conn.close()
        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/talent-bank")
def get_talent_bank():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id_banco,
                id_processo,
                id_teste,
                nome_candidato,
                vaga,
                pontuacao_final,
                data_movimentacao,
                origem
            FROM banco_talentos
        """)
        rows = cursor.fetchall()
        result = rows_to_dicts(cursor, rows)

        conn.close()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/talent-bank/{id_banco}")
def delete_talent_bank_candidate(id_banco: int):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
             DELETE FROM banco_talentos
             WHERE id_banco = ?
         """, (id_banco,))

        conn.commit()
        conn.close()
        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/talent-bank/{id_banco}/use")
def use_talent_bank_candidate(id_banco: int, data: dict):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
             SELECT
                 id_teste,
                 nome_candidato,
                 vaga,
                 pontuacao_final,
                 origem
             FROM banco_talentos
             WHERE id_banco = ?
         """, (id_banco,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Candidato do banco de talentos não encontrado.")

        id_processo = str(data.get("id_processo", "")).strip()
        if not id_processo:
            raise HTTPException(status_code=400, detail="Processo de destino não informado.")

        cursor.execute("""
             INSERT INTO candidatos_processos
             (
                 id_processo,
                 id_teste,
                 nome_candidato,
                 vaga,
                 status_candidato,
                 pontuacao_final,
                 data_prova,
                 origem
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         """, (
            id_processo,
            row[0],
            row[1],
            row[2],
            'Em análise',
            row[3],
            '',
            row[4] or 'Banco de talentos',
        ))

        cursor.execute("""
             DELETE FROM banco_talentos
             WHERE id_banco = ?
         """, (id_banco,))

        conn.commit()
        conn.close()
        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))