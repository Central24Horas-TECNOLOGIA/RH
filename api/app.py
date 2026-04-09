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
                nome_candidato,
                vaga,
                nivel,
                trilha,
                data_iso,
                data_exibicao,
                pontuacao_final,
                status,
                tempo_minutos,
                arquivo_gabarito
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
            nome_candidato,
            vaga,
            nivel,
            trilha,
            data_iso,
            data_exibicao,
            pontuacao_final,
            status,
            tempo_minutos,
            arquivo_gabarito
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        values = (
            row.get("id_teste", ""),
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
