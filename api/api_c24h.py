import pyodbc

DB_PATH = r"C:\Users\psilva\OneDrive - Empresa Brasileira de Soluções e Serviços em Teleatendimento Ltda\Projetos\RH\data\rh_provas.accdb"

conn_str = (
    r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    rf"DBQ={DB_PATH};"
)

try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()

    print("Campos da tabela gabaritos:")
    for col in cursor.columns(table='gabaritos'):
        print("-", col.column_name)

    conn.close()

except Exception as e:
    print("Erro:")
    print(e)