import pyodbc

DB_PATH = r"C:\Users\psilva\OneDrive - Empresa Brasileira de Soluções e Serviços em Teleatendimento Ltda\Projetos\RH\data\rh_provas.accdb"

conn_str = (
    r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    rf"DBQ={DB_PATH};"
)

conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

cursor.execute("SELECT * FROM gabaritos")
print("Colunas retornadas pelo SELECT *:")
for col in cursor.description:
    print("-", repr(col[0]))

rows = cursor.fetchall()
print("Linhas:", rows)

conn.close()