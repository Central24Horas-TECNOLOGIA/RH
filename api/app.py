from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import pyodbc
import json
import math
import re
import base64
from datetime import datetime
from collections import Counter

app = FastAPI(title="API RH Provas")

# LIBERA CORS PARA TESTE LOCAL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SQL_SERVER = r"PAULO_TI\SQLEXPRESS"
SQL_DATABASE = "RH_Provas"

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    f"SERVER={SQL_SERVER};"
    f"DATABASE={SQL_DATABASE};"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
)

def get_connection():
    return pyodbc.connect(CONN_STR)


def rows_to_dicts(cursor, rows):
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in rows]

def get_next_id_registro(cursor):
    cursor.execute("SELECT ISNULL(MAX(id_registro), 0) + 1 FROM candidatos_processos")
    row = cursor.fetchone()
    return int(row[0] or 1)

CV_KEYWORDS = [
    "excel", "word", "power bi", "powerbi", "atendimento", "suporte",
    "planilha", "dashboards", "dashboard", "sql", "python", "javascript",
    "react", "talkdesk", "power automate", "sharepoint", "teams",
    "analise", "análise", "dados", "cliente", "monitoramento"
]

CV_WEIGHTS_BY_ROLE = {
    "Jovem Aprendiz": {
        "keywords": {
            "excel": 1.5,
            "word": 1.0,
            "atendimento": 2.0,
            "cliente": 1.5,
            "dados": 1.0,
        },
        "min_keywords": 2,
    },
    "Operador": {
        "keywords": {
            "atendimento": 2.5,
            "cliente": 2.0,
            "suporte": 1.5,
            "talkdesk": 2.0,
            "monitoramento": 1.0,
            "excel": 1.0,
        },
        "min_keywords": 2,
    },
    "Supervisor": {
        "keywords": {
            "excel": 2.0,
            "atendimento": 2.0,
            "cliente": 1.5,
            "monitoramento": 1.5,
            "dados": 1.5,
            "power bi": 2.0,
        },
        "min_keywords": 3,
    },
    "Estagiário": {
        "keywords": {
            "excel": 1.5,
            "python": 2.0,
            "sql": 2.0,
            "dados": 1.5,
            "javascript": 1.5,
            "react": 1.5,
        },
        "min_keywords": 2,
    },
    "Analista": {
        "keywords": {
            "excel": 1.5,
            "power bi": 2.5,
            "sql": 2.0,
            "python": 2.0,
            "dados": 2.0,
            "analise": 1.5,
            "análise": 1.5,
        },
        "min_keywords": 3,
    },
    "TI": {
        "keywords": {
            "python": 2.5,
            "javascript": 2.0,
            "react": 2.0,
            "sql": 2.0,
            "sharepoint": 1.5,
            "power automate": 1.5,
            "teams": 1.0,
            "suporte": 1.5,
        },
        "min_keywords": 3,
    },
}

EMAIL_REGEX = re.compile(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', re.IGNORECASE)
PHONE_REGEX = re.compile(r'(?:(?:\+?55)\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-\s.]?\d{4}')
WHATSAPP_REGEX = re.compile(r'(?:(?:\+?55)\s*)?(?:\(?\d{2}\)?\s*)?(?:9\d{4})[-\s.]?\d{4}')

def ensure_cv_pre_analises_table(cursor):
    cursor.execute("""
    IF OBJECT_ID('dbo.cv_pre_analises', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.cv_pre_analises (
            id_pre_analise INT IDENTITY(1,1) PRIMARY KEY,
            id_processo NVARCHAR(60) NOT NULL,
            nome_candidato NVARCHAR(255) NULL,
            email NVARCHAR(255) NULL,
            telefone NVARCHAR(50) NULL,
            whatsapp NVARCHAR(50) NULL,
            palavras_chave NVARCHAR(MAX) NULL,
            score_final DECIMAL(5,2) NULL,
            classificacao NVARCHAR(50) NULL,
            classificacao_slug NVARCHAR(50) NULL,
            problemas NVARCHAR(MAX) NULL,
            texto_extraido NVARCHAR(MAX) NULL,
            nome_arquivo NVARCHAR(255) NULL,
            mime_type NVARCHAR(120) NULL,
            arquivo_original_base64 NVARCHAR(MAX) NULL,
            ja_adicionado_ao_processo BIT NOT NULL DEFAULT 0,
            criado_em DATETIME NOT NULL DEFAULT GETDATE()
        )
    END
    """)

def normalize_cv_text(texto):
    bruto = str(texto or "")
    bruto = bruto.replace("\r", "\n")
    bruto = re.sub(r'\n{3,}', '\n\n', bruto)
    bruto = re.sub(r'[ \t]{2,}', ' ', bruto)
    return bruto.strip()

def extract_email(texto):
    match = EMAIL_REGEX.search(texto or "")
    return match.group(1).strip() if match else ""

def extract_phone(texto):
    match = PHONE_REGEX.search(texto or "")
    return match.group(0).strip() if match else ""

def extract_whatsapp(texto):
    match = WHATSAPP_REGEX.search(texto or "")
    return match.group(0).strip() if match else ""

def is_valid_candidate_name(nome):
    nome_limpo = str(nome or "").strip()
    if not nome_limpo:
        return False

    partes = [p for p in nome_limpo.split() if p.strip()]
    if len(partes) < 2 or len(partes) > 5:
        return False

    if len(nome_limpo) < 8 or len(nome_limpo) > 60:
        return False

    termos_invalidos = {
        "curriculo", "currículo", "objetivo", "resumo", "perfil",
        "experiencia", "experiência", "formacao", "formação",
        "habilidades", "competencias", "competências",
        "telefone", "email", "e-mail", "whatsapp", "linkedin", "github"
    }

    nome_lower = nome_limpo.lower()
    if any(termo in nome_lower for termo in termos_invalidos):
        return False

    if any(ch.isdigit() for ch in nome_limpo):
        return False

    return True


def is_valid_email(email):
    email_limpo = str(email or "").strip()
    if not email_limpo:
        return False
    return bool(EMAIL_REGEX.fullmatch(email_limpo))


def sanitize_phone(valor):
    return re.sub(r"\D", "", str(valor or ""))


def is_valid_phone(telefone):
    numero = sanitize_phone(telefone)
    if numero.startswith("55") and len(numero) in (12, 13):
        numero = numero[2:]

    return len(numero) in (10, 11)


def has_education_content(texto):
    base = str(texto or "").lower()
    pistas = [
        "formação", "formacao", "escolaridade", "ensino médio", "ensino medio",
        "graduação", "graduacao", "tecnólogo", "tecnologo", "curso técnico",
        "curso tecnico", "faculdade", "universidade", "bacharelado",
        "licenciatura", "pós-graduação", "pos-graduacao", "mba"
    ]
    return any(pista in base for pista in pistas)


def has_experience_content(texto):
    base = str(texto or "").lower()
    pistas = [
        "experiência", "experiencia", "experiências", "experiencias",
        "atuei", "trabalhei", "atuação", "atuacao", "empresa",
        "cargo", "função", "funcao", "responsável por", "responsavel por",
        "atividades desenvolvidas"
    ]
    return any(pista in base for pista in pistas)


def extract_education_strength(texto):
    base = str(texto or "").lower()

    if any(p in base for p in ["mba", "pós-graduação", "pos-graduacao"]):
        return "forte"
    if any(p in base for p in ["graduação", "graduacao", "bacharelado", "tecnólogo", "tecnologo", "faculdade", "universidade"]):
        return "media"
    if any(p in base for p in ["ensino médio", "ensino medio", "curso técnico", "curso tecnico", "escolaridade"]):
        return "basica"
    return "ausente"


def extract_experience_strength(texto):
    base = str(texto or "").lower()

    marcadores_tempo = re.findall(r"\b(19|20)\d{2}\b", base)
    tem_empresa = any(p in base for p in ["empresa", "cargo", "função", "funcao", "responsável por", "responsavel por"])

    if len(marcadores_tempo) >= 2 and tem_empresa:
        return "forte"
    if len(marcadores_tempo) >= 1 or tem_empresa:
        return "media"
    if has_experience_content(texto):
        return "basica"
    return "ausente"

def extract_candidate_name(texto):
    linhas = [linha.strip() for linha in str(texto or "").splitlines() if linha.strip()]
    if not linhas:
        return ""

    candidatos = []

    for linha in linhas[:15]:
        linha_limpa = linha.strip(" -•|")
        if is_valid_candidate_name(linha_limpa):
            candidatos.append(linha_limpa)

    if candidatos:
        candidatos.sort(key=lambda item: (len(item.split()), len(item)))
        return candidatos[0]

    return ""

def extract_keywords(texto):
    base = str(texto or "").lower()
    encontrados = []

    termos_negativos = [
        "não tenho experiência com",
        "nao tenho experiencia com",
        "não possuo experiência com",
        "nao possuo experiencia com",
        "sem experiência em",
        "sem experiencia em",
        "nunca trabalhei com",
        "não conheço",
        "nao conheco",
        "não domino",
        "nao domino",
    ]

    for palavra in CV_KEYWORDS:
        if palavra not in base:
            continue

        trecho_inicio = max(0, base.find(palavra) - 60)
        trecho_fim = min(len(base), base.find(palavra) + len(palavra) + 60)
        contexto = base[trecho_inicio:trecho_fim]

        if any(neg in contexto for neg in termos_negativos):
            continue

        encontrados.append(palavra)

    return sorted(set(encontrados))

def score_cv_for_role(
    role,
    keywords_found,
    has_email,
    has_phone,
    text_length,
    candidate_name="",
    email_value="",
    phone_value="",
    education_strength="ausente",
    experience_strength="ausente",
):
    role_cfg = CV_WEIGHTS_BY_ROLE.get(str(role or "").strip(), {
        "keywords": {},
        "min_keywords": 2,
    })

    score = 0.0
    problemas = []
    pontos_fortes = []

    keyword_weights = role_cfg.get("keywords", {})
    keywords_validas = []

    for keyword in keywords_found:
        peso = float(keyword_weights.get(keyword, 0.0))
        if peso > 0:
            keywords_validas.append(keyword)
            score += peso

    if is_valid_candidate_name(candidate_name):
        score += 0.75
        pontos_fortes.append("Nome do candidato identificado com consistência.")
    else:
        score -= 2.0
        problemas.append("Nome do candidato não foi identificado com segurança.")

    if has_email and is_valid_email(email_value):
        score += 1.0
        pontos_fortes.append("E-mail válido identificado.")
    else:
        score -= 1.5
        problemas.append("E-mail não encontrado ou inválido.")

    if has_phone and is_valid_phone(phone_value):
        score += 1.0
        pontos_fortes.append("Telefone ou WhatsApp válido identificado.")
    else:
        score -= 1.5
        problemas.append("Telefone/WhatsApp não encontrado ou inválido.")

    if text_length < 80:
        score -= 3.0
        problemas.append("CV com pouco conteúdo extraído.")
    elif text_length < 180:
        score -= 1.5
        problemas.append("CV com conteúdo muito limitado para análise segura.")
    elif text_length >= 250:
        score += 0.5

    min_keywords = int(role_cfg.get("min_keywords", 2))

    if len(keywords_validas) >= min_keywords:
        score += 0.5
        pontos_fortes.append(
            f"Foram identificadas {len(keywords_validas)} palavra(s)-chave aderentes à vaga."
        )
    else:
        score -= 2.0
        problemas.append("Poucas palavras-chave realmente aderentes à vaga.")

    if not keywords_validas:
        score -= 2.0
        problemas.append("Nenhuma palavra-chave relevante da vaga foi validada no currículo.")

    if education_strength == "forte":
        score += 1.5
        pontos_fortes.append("Formação acadêmica robusta identificada.")
    elif education_strength == "media":
        score += 0.9
        pontos_fortes.append("Formação acadêmica compatível identificada.")
    elif education_strength == "basica":
        score += 0.3
        pontos_fortes.append("Indícios básicos de formação identificados.")
    else:
        score -= 1.2
        problemas.append("Formação/educação não identificada no currículo.")

    if experience_strength == "forte":
        score += 2.0
        pontos_fortes.append("Experiência profissional consistente identificada.")
    elif experience_strength == "media":
        score += 1.0
        pontos_fortes.append("Experiência profissional parcial identificada.")
    elif experience_strength == "basica":
        score += 0.3
        pontos_fortes.append("Há menções superficiais de experiência profissional.")
    else:
        score -= 1.8
        problemas.append("Experiência profissional não identificada com clareza.")

    score = max(0.0, min(10.0, round(score, 2)))

    if (
        score >= 7.0
        and len(keywords_validas) >= min_keywords
        and is_valid_candidate_name(candidate_name)
        and is_valid_email(email_value)
        and is_valid_phone(phone_value)
        and experience_strength in ("forte", "media")
    ):
        classificacao = "Ótimo candidato"
        slug = "otimo-candidato"
    elif (
        score >= 4.5
        and len(keywords_validas) >= max(1, min_keywords - 1)
        and experience_strength in ("forte", "media", "basica")
    ):
        classificacao = "Bom candidato"
        slug = "bom-candidato"
    else:
        classificacao = "Não qualificado"
        slug = "nao-qualificado"

    return {
        "score": score,
        "classificacao": classificacao,
        "slug": slug,
        "problemas": problemas,
        "pontos_fortes": pontos_fortes,
        "keywords_validas": keywords_validas,
        "education_strength": education_strength,
        "experience_strength": experience_strength,
    }

def extract_text_from_uploaded_file(filename, content_bytes):
    nome = str(filename or "").lower()

    if nome.endswith(".txt"):
        try:
            return content_bytes.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    if nome.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content_bytes))
            partes = []
            for page in reader.pages:
                texto_pagina = page.extract_text() or ""
                if texto_pagina.strip():
                    partes.append(texto_pagina)
            return "\n".join(partes).strip()
        except Exception:
            return ""

    if nome.endswith(".docx"):
        try:
            from docx import Document
            import io
            document = Document(io.BytesIO(content_bytes))
            partes = [p.text for p in document.paragraphs if str(p.text or "").strip()]
            return "\n".join(partes).strip()
        except Exception:
            return ""

    return ""

def get_process_row(cursor, id_processo):
    cursor.execute("""
        SELECT
            id_processo,
            vaga,
            quantidade_vagas,
            vagas_preenchidas,
            data_encerramento,
            operacao,
            trilha,
            usa_nota_corte,
            nota_corte,
            status,
            data_criacao
        FROM processos_seletivos
        WHERE id_processo = ?
    """, (id_processo,))
    row = cursor.fetchone()
    if not row:
        return None

    columns = [column[0] for column in cursor.description]
    return dict(zip(columns, row))

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
    columns = [col.column_name for col in cursor.columns(table='gabaritos', schema='dbo')]
    for name in ('payload_json', 'playlaod_json'):
        if name in columns:
            return name

    raise HTTPException(
        status_code=500,
        detail=f"Coluna de payload não encontrada na tabela dbo.gabaritos. Colunas disponíveis: {columns}",
    )

STAGE_IMPORTANCE_BY_ROLE = {
    "Jovem Aprendiz": {
        "word_basic": 7.0,
        "excel_basic": 5.0,
        "general_knowledge": 6.0,
        "logic": 6.0,
    },
    "Operador": {
        "word_basic": 6.0,
        "customer_service": 7.5,
        "logic": 6.5,
        "general_knowledge": 5.5,
    },
    "Estagiário": {
        "word_basic": 6.5,
        "excel_intermediate": 6.5,
        "logic": 6.5,
        "technical_support": 6.0,
    },
    "Supervisor": {
        "word_intermediate": 7.0,
        "excel_operational": 7.0,
        "logic": 7.0,
        "customer_service": 7.0,
    },
    "Control Desk": {
        "word_intermediate": 6.5,
        "excel_quality": 7.5,
        "logic": 7.0,
        "adm": 7.0,
    },
    "Planejamento": {
        "word_intermediate": 6.0,
        "excel_planning": 8.0,
        "logic": 7.5,
        "adm": 7.0,
    },
    "TI": {
        "word_advanced": 6.0,
        "technical_support": 7.0,
        "logic": 7.5,
        "excel_advanced": 8.0,
    },
    "Analista": {
        "word_advanced": 7.0,
        "excel_advanced": 8.0,
        "logic": 7.5,
        "technical_support": 7.5,
        "adm": 6.5,
    },
    "Outros": {
        "word_intermediate": 6.5,
        "excel_intermediate": 6.5,
        "logic": 6.5,
        "general_knowledge": 6.0,
    },
}

STAGE_LABEL_FALLBACK = {
    "word_basic": "Word Básico",
    "word_intermediate": "Word Intermediário",
    "word_advanced": "Word Avançado",
    "excel_basic": "Excel Básico",
    "excel_intermediate": "Excel Intermediário",
    "excel_advanced": "Excel Avançado",
    "excel_operational": "Excel Operacional",
    "excel_planning": "Excel Planejamento",
    "excel_quality": "Excel Qualidade",
    "logic": "Lógica",
    "technical_support": "Conhecimentos Técnicos",
    "customer_service": "Atendimento",
    "general_knowledge": "Conhecimentos Gerais",
    "adm": "Administrativo",
    "rh": "RH",
}


def normalize_text(value):
    return str(value or "").strip()


import re

def parse_float_br(value):
    if value is None:
        return 0.0

    text = str(value).strip()

    if not text:
        return 0.0

    # remove espaços
    text = text.replace(" ", "")

    # Caso venha no formato brasileiro normal: 7,0 / 2,1 / 10,0
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    # Caso venha com milhar + decimal: 1.234,5
    elif "." in text and "," in text:
        text = text.replace(".", "").replace(",", ".")

    # Mantém apenas dígitos, sinal e ponto decimal
    text = re.sub(r"[^0-9\.\-]", "", text)

    # Se houver mais de um ponto, mantém só o primeiro como decimal
    if text.count(".") > 1:
        parts = text.split(".")
        text = parts[0] + "." + "".join(parts[1:])

    try:
        number = float(text)
    except Exception:
        return 0.0

    # Segurança extra: notas da prova devem ficar entre 0 e 10
    if number < 0:
        return 0.0
    if number > 10:
        return 10.0

    return round(number, 1)


def safe_json_loads(value, default):
    try:
        return json.loads(value) if value else default
    except Exception:
        return default


def clean_analysis_text(text):
    raw = normalize_text(text)
    if not raw:
        return ""

    lines = [line.strip() for line in raw.splitlines() if line.strip()]

    ignored_prefixes = (
        "candidato:",
        "perfil:",
        "nível:",
        "nivel:",
        "nota final:",
        "data:",
        "observações do rh:",
        "observacoes do rh:",
        "questão ",
        "questao ",
        "etapa:",
        "título:",
        "titulo:",
        "enunciado:",
        "gabarito / critério:",
        "gabarito / criterio:",
        "pontuação obtida:",
        "pontuacao obtida:",
        "=== gabarito completo ===",
    )

    ignored_exact = {
        "sem resposta.",
        "arquivo não enviado.",
        "nenhuma observação registrada.",
        "nenhuma observacao registrada.",
    }

    useful_lines = []

    for line in lines:
        lower = line.lower()

        if lower in ignored_exact:
            continue

        if lower.startswith(ignored_prefixes):
            if lower.startswith("resposta do candidato:"):
                content = line.split(":", 1)[1].strip() if ":" in line else ""
                if content and content.lower() not in ignored_exact:
                    useful_lines.append(content)
            continue

        useful_lines.append(line)

    return "\n".join(useful_lines).strip()


def extract_analysis_text(payload, history_row):
    payload = payload if isinstance(payload, dict) else {}

    text_candidates = [
        payload.get("textContent"),
        payload.get("texto"),
        payload.get("analysisText"),
        payload.get("content"),
        history_row.get("arquivo_gabarito"),
    ]

    for candidate_text in text_candidates:
        cleaned = clean_analysis_text(candidate_text)
        if cleaned:
            return cleaned

    stage_summary = payload.get("stageSummary")
    if not isinstance(stage_summary, list):
        stage_summary = safe_json_loads(history_row.get("etapas_json"), [])

    fallback_lines = []
    for stage in stage_summary or []:
        if not isinstance(stage, dict):
            continue

        label = normalize_text(stage.get("label") or stage.get("key") or "Etapa")
        raw_score = parse_float_br(stage.get("rawScore"))
        raw_max = parse_float_br(stage.get("rawMax"))

        if raw_max > 0:
            fallback_lines.append(
                f"{label} com desempenho de {raw_score} em {raw_max} pontos."
            )

    return "\n".join(fallback_lines).strip()

def get_process_map(cursor):
    cursor.execute("""
        SELECT
            id_processo,
            vaga,
            quantidade_vagas,
            vagas_preenchidas,
            data_encerramento,
            operacao,
            trilha,
            usa_nota_corte,
            nota_corte,
            status
        FROM processos_seletivos
    """)
    rows = cursor.fetchall()
    columns = [column[0] for column in cursor.description]
    return {
        str(row[0]): dict(zip(columns, row))
        for row in rows
    }


def get_process_candidate_map(cursor):
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
    columns = [column[0] for column in cursor.description]
    result = {}
    for row in rows:
        item = dict(zip(columns, row))
        id_teste = str(item.get("id_teste") or "").strip()
        if id_teste:
            result[id_teste] = item
    return result

def get_answer_files_map(cursor):
    payload_column = get_gabaritos_payload_column(cursor)
    cursor.execute(f"SELECT record_id, {payload_column} FROM gabaritos")
    rows = cursor.fetchall()
    result = {}
    for row in rows:
        record_id = str(row[0] or "").strip()
        content = row[1]
        if record_id:
            result[record_id] = safe_json_loads(content, {})
    return result

def score_text_quality(text):
    clean = clean_analysis_text(text)

    if not clean:
        return {
            "length_score": 0.0,
            "clarity_score": 0.0,
            "keyword_score": 0.0,
            "overall": 0.0,
        }

    words = re.findall(r"\b[\wÀ-ÿ\-]+\b", clean.lower())
    word_count = len(words)

    if word_count == 0:
        return {
            "length_score": 0.0,
            "clarity_score": 0.0,
            "keyword_score": 0.0,
            "overall": 0.0,
        }

    unique_ratio = len(set(words)) / max(word_count, 1)
    sentence_count = max(1, len(re.findall(r"[.!?]+", clean)))
    avg_sentence_len = word_count / sentence_count

    if word_count >= 80:
        length_score = 10.0
    else:
        length_score = min((word_count / 80.0) * 10.0, 10.0)

    clarity_base = unique_ratio * 10.0
    structure_bonus = 0.0

    if sentence_count >= 2:
        structure_bonus += 1.0
    if 6 <= avg_sentence_len <= 30:
        structure_bonus += 1.0
    if any(p in clean for p in [".", ";", ":", "!", "?"]):
        structure_bonus += 0.5

    clarity_score = min(clarity_base + structure_bonus, 10.0)

    common_business_terms = [
        "processo", "análise", "analise", "solução", "solucao", "cliente",
        "indicador", "resultado", "atendimento", "suporte", "planilha",
        "dados", "controle", "qualidade", "prazo", "demanda", "problema",
        "excel", "word", "fórmula", "formula", "procv", "relatório",
        "relatorio", "atividade", "tabela", "coluna", "linha", "arquivo",
        "sistema", "monitoramento", "chamado", "operação", "operacao"
    ]

    term_hits = sum(1 for term in common_business_terms if term in clean.lower())
    keyword_score = min((term_hits / 4.0) * 10.0, 10.0)

    if keyword_score == 0 and word_count >= 12:
        keyword_score = 4.0

    overall = round(
        (length_score * 0.30) +
        (clarity_score * 0.40) +
        (keyword_score * 0.30),
        2
    )

    return {
        "length_score": round(length_score, 2),
        "clarity_score": round(clarity_score, 2),
        "keyword_score": round(keyword_score, 2),
        "overall": overall,
    }

def build_stage_expectation(role):
    return STAGE_IMPORTANCE_BY_ROLE.get(normalize_text(role), {})

def build_analysis_from_payload(history_row, process_row, process_candidate_row, payload):
    payload = payload if isinstance(payload, dict) else {}

    raw_stage_summary = payload.get("stageSummary")
    if not isinstance(raw_stage_summary, list):
        raw_stage_summary = safe_json_loads(history_row.get("etapas_json"), [])

    stage_summary = raw_stage_summary if isinstance(raw_stage_summary, list) else []
    candidate = payload.get("candidate") if isinstance(payload.get("candidate"), dict) else {}

    weighted_final_score = payload.get("weightedFinalScore")
    weighted_final_score = parse_float_br(weighted_final_score)

    if weighted_final_score <= 0:
        weighted_final_score = parse_float_br(history_row.get("pontuacao_final"))

    role = normalize_text(candidate.get("role") or history_row.get("vaga"))
    expectation = build_stage_expectation(role)

    normalized_stages = []
    deficits = []
    strengths = []

    for stage in stage_summary:
        if not isinstance(stage, dict):
            continue

        stage_key = normalize_text(stage.get("key"))
        stage_label = normalize_text(stage.get("label")) or STAGE_LABEL_FALLBACK.get(stage_key, stage_key or "Etapa")
        raw_score = parse_float_br(stage.get("rawScore"))
        raw_max = parse_float_br(stage.get("rawMax"))
        obtained = round((raw_score / raw_max) * 10, 2) if raw_max else 0.0
        expected = parse_float_br(expectation.get(stage_key, 6.0))
        gap = round(obtained - expected, 2)

        item = {
            "key": stage_key,
            "label": stage_label,
            "obtained": obtained,
            "expected": expected,
            "gap": gap,
            "weight": parse_float_br(stage.get("weight")),
            "question_count": int(parse_float_br(stage.get("questionCount"))),
        }
        normalized_stages.append(item)

        if obtained <= 4:
            deficits.append(f"{stage_label} abaixo do esperado para a vaga.")
        elif 5 <= obtained <= 7:
            strengths.append(f"{stage_label} na média do esperado para a vaga.")
        elif 7 < obtained <= 8:
            strengths.append(f"{stage_label} com bom resultado para a vaga.")
        elif obtained >= 9:
            strengths.append(f"{stage_label} com resultado desejado para a vaga.")

    text_content = extract_analysis_text(payload, history_row)
    text_quality = score_text_quality(text_content)

    process_name = normalize_text(history_row.get("id_processo"))
    process_status = normalize_text(process_candidate_row.get("status_candidato")) or "Em análise"

    cutoff_enabled = int(parse_float_br(process_row.get("usa_nota_corte"))) if process_row else 0
    cutoff_value = None
    if process_row and process_row.get("nota_corte") not in (None, ""):
        cutoff_value = parse_float_br(process_row.get("nota_corte"))

    weighted_fit_sum = 0.0
    total_weight = 0.0
    low_stage_count = 0
    zero_stage_count = 0
    highest_weight_stage = None

    for item in normalized_stages:
        obtained = float(item.get("obtained") or 0)
        expected = float(item.get("expected") or 0)
        weight = float(item.get("expected") or 0)

        if obtained == 0:
            zero_stage_count += 1
        if obtained < 3:
            low_stage_count += 1

        if highest_weight_stage is None or weight > float(highest_weight_stage.get("expected") or 0):
            highest_weight_stage = item

        if expected <= 0:
            continue

        stage_fit = (obtained / expected) * 100.0
        stage_fit = max(0.0, min(stage_fit, 100.0))

        weighted_fit_sum += stage_fit * weight
        total_weight += weight

    affinity = round((weighted_fit_sum / total_weight), 1) if total_weight > 0 else 0.0
    affinity = max(0.0, min(affinity, 100.0))

    zerou_etapa_mais_critica = False
    if highest_weight_stage:
        zerou_etapa_mais_critica = float(highest_weight_stage.get("obtained") or 0) == 0.0

    recommendation = "Baixa aderência"
    if affinity > 75:
        recommendation = "Forte aderência"
    elif affinity > 60:
        recommendation = "Boa aderência"

    final_consideration = "Apto à vaga"

    if zerou_etapa_mais_critica:
        final_consideration = "Inapto à vaga"
    elif affinity <= 60:
        final_consideration = "Inapto à vaga"

    if cutoff_enabled and cutoff_value is not None and weighted_final_score < cutoff_value:
        final_consideration = "Eliminado pela nota de corte"

    remarks = []
    remarks.extend(strengths[:3])
    remarks.extend(deficits[:3])

    if not remarks:
        remarks.append("Desempenho equilibrado, sem desvios críticos relevantes.")

    return {
        "id_teste": history_row.get("id_teste"),
        "id_processo": process_name,
        "nome_candidato": history_row.get("nome_candidato"),
        "vaga": role,
        "nota_final": round(float(weighted_final_score or 0), 1),
        "afinidade_percentual": affinity,
        "recomendacao": recommendation,
        "parecer_final": final_consideration,
        "status_candidato": process_status,
        "nota_corte_ativa": bool(cutoff_enabled),
        "nota_corte_valor": cutoff_value,
        "analise_texto": text_quality,
        "grafico": normalized_stages,
        "ressalvas": remarks,
        "etapa_critica": highest_weight_stage.get("label") if highest_weight_stage else "",
        "zerou_etapa_critica": zerou_etapa_mais_critica,
    }

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "API RH Provas online",
        "server": SQL_SERVER,
        "database": SQL_DATABASE
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
                usa_nota_corte,
                nota_corte,
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
                usa_nota_corte,
                nota_corte,
                status,
                data_criacao
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,        (
            data.get("id_processo", ""),
            data.get("vaga", ""),
            int(data.get("quantidade_vagas", 0) or 0),
            int(data.get("vagas_preenchidas", 0) or 0),
            data.get("data_encerramento", ""),
            data.get("operacao", ""),
            data.get("trilha", ""),
            int(data.get("usa_nota_corte", 0) or 0),
            data.get("nota_corte", None),
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
                usa_nota_corte = ?,
                nota_corte = ?,
                status = ?
            WHERE id_processo = ?
        """, (
            int(data.get("quantidade_vagas", 0) or 0),
            data.get("data_encerramento", ""),
            data.get("operacao", ""),
            data.get("trilha", ""),
            int(data.get("usa_nota_corte", 0) or 0),
            data.get("nota_corte", None),
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
@app.post("/process-candidates")
def create_process_candidate(data: dict):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        id_registro = get_next_id_registro(cursor)

        cursor.execute("""
            INSERT INTO candidatos_processos
            (
                id_registro,
                id_processo,
                id_teste,
                nome_candidato,
                vaga,
                status_candidato,
                pontuacao_final,
                data_prova,
                origem
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            id_registro,
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
        id_registro = get_next_id_registro(cursor)
        cursor.execute("""
            INSERT INTO candidatos_processos
(
    id_registro,
    id_processo,
    id_teste,
    nome_candidato,
    vaga,
    status_candidato,
    pontuacao_final,
    data_prova,
    origem
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         """, (
    id_registro,
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

@app.get("/processes/{id_processo}/details")
def get_process_details(id_processo: str):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        ensure_cv_pre_analises_table(cursor)

        processo = get_process_row(cursor, id_processo)
        if not processo:
            raise HTTPException(status_code=404, detail="Processo não encontrado.")

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
            WHERE id_processo = ?
            ORDER BY id_registro DESC
        """, (id_processo,))
        candidatos = rows_to_dicts(cursor, cursor.fetchall())

        resumo = {
            "total": len(candidatos),
            "aprovados": sum(1 for c in candidatos if str(c.get("status_candidato") or "").strip() == "Aprovado"),
            "eliminados": sum(1 for c in candidatos if "Eliminado" in str(c.get("status_candidato") or "").strip()),
            "banco": sum(1 for c in candidatos if str(c.get("status_candidato") or "").strip() == "Banco de talentos"),
            "analise": sum(1 for c in candidatos if str(c.get("status_candidato") or "").strip() == "Em análise"),
        }

        conn.close()
        return {
            "processo": processo,
            "resumo": resumo,
            "candidatos": candidatos,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/processes/{id_processo}/cv-pre-analyses")
def list_cv_pre_analyses(id_processo: str, page: int = 1, page_size: int = 5):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        ensure_cv_pre_analises_table(cursor)

        cursor.execute("""
            SELECT COUNT(*)
            FROM cv_pre_analises
            WHERE id_processo = ?
        """, (id_processo,))
        total_items = int(cursor.fetchone()[0] or 0)

        offset = max(0, (page - 1) * page_size)

        cursor.execute("""
            SELECT
                id_pre_analise,
                id_processo,
                nome_candidato,
                email,
                telefone,
                whatsapp,
                palavras_chave,
                score_final,
                classificacao,
                classificacao_slug,
                problemas,
                texto_extraido,
                nome_arquivo,
                mime_type,
                arquivo_original_base64,
                ja_adicionado_ao_processo,
                criado_em
            FROM cv_pre_analises
            WHERE id_processo = ?
            ORDER BY id_pre_analise DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """, (id_processo, offset, page_size))

        items = rows_to_dicts(cursor, cursor.fetchall())
        total_pages = max(1, math.ceil(total_items / max(page_size, 1)))

        conn.close()
        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/processes/{id_processo}/cv-pre-analyses")
async def create_cv_pre_analysis(
    id_processo: str,
    arquivo: UploadFile = File(...),
    guardar_cv_original: str = Form("0"),
):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        ensure_cv_pre_analises_table(cursor)

        processo = get_process_row(cursor, id_processo)
        if not processo:
            raise HTTPException(status_code=404, detail="Processo não encontrado.")

        content = await arquivo.read()
        texto_extraido = extract_text_from_uploaded_file(arquivo.filename, content)
        texto_normalizado = normalize_cv_text(texto_extraido)

        if not texto_normalizado:
            raise HTTPException(
                status_code=400,
                detail="Não foi possível extrair texto do CV. Para PDF, verifique se o arquivo possui texto selecionável. Para DOCX, confirme se a biblioteca python-docx está instalada."
            )

        nome_candidato = extract_candidate_name(texto_normalizado)
        email = extract_email(texto_normalizado)
        telefone = extract_phone(texto_normalizado)
        whatsapp = extract_whatsapp(texto_normalizado)
        palavras = extract_keywords(texto_normalizado)

        telefone_base = whatsapp or telefone
        education_strength = extract_education_strength(texto_normalizado)
        experience_strength = extract_experience_strength(texto_normalizado)

        if email:
            cursor.execute("""
                SELECT COUNT(*)
                FROM cv_pre_analises
                WHERE id_processo = ? AND email = ?
            """, (id_processo, email))
            ja_existe = int(cursor.fetchone()[0] or 0)
            if ja_existe:
                raise HTTPException(status_code=400, detail="Já existe uma pré-análise com este e-mail neste processo.")

        avaliacao = score_cv_for_role(
            processo.get("vaga"),
            palavras,
            bool(email),
            bool(telefone_base),
            len(texto_normalizado),
            nome_candidato,
            email,
            telefone_base,
            education_strength,
            experience_strength,
        )

        arquivo_original_base64 = None
        if str(guardar_cv_original).strip() in ("1", "true", "True"):
            arquivo_original_base64 = base64.b64encode(content).decode("utf-8")

        cursor.execute("""
            INSERT INTO cv_pre_analises
            (
                id_processo,
                nome_candidato,
                email,
                telefone,
                whatsapp,
                palavras_chave,
                score_final,
                classificacao,
                classificacao_slug,
                problemas,
                texto_extraido,
                nome_arquivo,
                mime_type,
                arquivo_original_base64,
                ja_adicionado_ao_processo
            )
            OUTPUT INSERTED.id_pre_analise
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """, (
            id_processo,
            nome_candidato,
            email,
            telefone,
            whatsapp,
            json.dumps(avaliacao["keywords_validas"], ensure_ascii=False),
            avaliacao["score"],
            avaliacao["classificacao"],
            avaliacao["slug"],
            json.dumps({
                "problemas": avaliacao["problemas"],
                "pontos_fortes": avaliacao["pontos_fortes"],
                "education_strength": avaliacao["education_strength"],
                "experience_strength": avaliacao["experience_strength"],
            }, ensure_ascii=False),
            texto_normalizado,
            arquivo.filename,
            arquivo.content_type or "application/octet-stream",
            arquivo_original_base64,
        ))

        id_pre_analise = cursor.fetchone()[0]

        if avaliacao["classificacao"] in ("Bom candidato", "Ótimo candidato"):
            id_registro = get_next_id_registro(cursor)

            cursor.execute("""
                INSERT INTO candidatos_processos
                (
                    id_registro,
                    id_processo,
                    id_teste,
                    nome_candidato,
                    vaga,
                    status_candidato,
                    pontuacao_final,
                    data_prova,
                    origem
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                id_registro,
                id_processo,
                f"CV-{id_pre_analise}",
                nome_candidato,
                processo.get("vaga") or "",
                "Em análise",
                str(avaliacao["score"]).replace(".", ","),
                datetime.now().isoformat(),
                "Pré-análise de CV",
            ))

            cursor.execute("""
                UPDATE cv_pre_analises
                SET ja_adicionado_ao_processo = 1
                WHERE id_pre_analise = ?
            """, (id_pre_analise,))

        conn.commit()
        conn.close()

        return {"success": True, "id_pre_analise": id_pre_analise}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/cv-pre-analyses/{id_pre_analise}")
def update_cv_pre_analysis(id_pre_analise: int, data: dict):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        ensure_cv_pre_analises_table(cursor)

        cursor.execute("""
            SELECT id_processo, email
            FROM cv_pre_analises
            WHERE id_pre_analise = ?
        """, (id_pre_analise,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Pré-análise não encontrada.")

        id_processo = str(row[0] or "").strip()
        novo_email = str(data.get("email") or "").strip()

        if novo_email:
            cursor.execute("""
                SELECT COUNT(*)
                FROM cv_pre_analises
                WHERE id_processo = ? AND email = ? AND id_pre_analise <> ?
            """, (id_processo, novo_email, id_pre_analise))
            duplicado = int(cursor.fetchone()[0] or 0)
            if duplicado:
                raise HTTPException(status_code=400, detail="Já existe outra pré-análise com este e-mail neste processo.")

        cursor.execute("""
            UPDATE cv_pre_analises
            SET
                nome_candidato = ?,
                email = ?,
                telefone = ?,
                whatsapp = ?
            WHERE id_pre_analise = ?
        """, (
            data.get("nome_candidato", ""),
            novo_email,
            data.get("telefone", ""),
            data.get("whatsapp", ""),
            id_pre_analise,
        ))

        conn.commit()
        conn.close()
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/cv-pre-analyses/{id_pre_analise}")
def delete_cv_pre_analysis(id_pre_analise: int):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        ensure_cv_pre_analises_table(cursor)

        cursor.execute("""
            DELETE FROM cv_pre_analises
            WHERE id_pre_analise = ?
        """, (id_pre_analise,))

        conn.commit()
        conn.close()
        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cv-pre-analyses/{id_pre_analise}/add-to-process")
def add_cv_pre_analysis_to_process(id_pre_analise: int):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        ensure_cv_pre_analises_table(cursor)

        cursor.execute("""
            SELECT
                id_pre_analise,
                id_processo,
                nome_candidato,
                email,
                score_final,
                classificacao,
                ja_adicionado_ao_processo
            FROM cv_pre_analises
            WHERE id_pre_analise = ?
        """, (id_pre_analise,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Pré-análise não encontrada.")

        if int(row[6] or 0) == 1:
            raise HTTPException(status_code=400, detail="Este CV já foi adicionado ao processo.")

        processo = get_process_row(cursor, row[1])
        if not processo:
            raise HTTPException(status_code=404, detail="Processo não encontrado.")
        id_registro = get_next_id_registro(cursor)
        cursor.execute("""
           INSERT INTO candidatos_processos
(
    id_registro,
    id_processo,
    id_teste,
    nome_candidato,
    vaga,
    status_candidato,
    pontuacao_final,
    data_prova,
    origem
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
    id_registro,
    row[1],
    f"CV-{row[0]}",
    row[2],
    processo.get("vaga") or "",
    "Em análise",
    str(row[4] or "").replace(".", ","),
    datetime.now().isoformat(),
    "Pré-análise de CV",
))

        cursor.execute("""
            UPDATE cv_pre_analises
            SET ja_adicionado_ao_processo = 1
            WHERE id_pre_analise = ?
        """, (id_pre_analise,))

        conn.commit()
        conn.close()
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/candidate-analytics")
def get_candidate_analytics():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        process_map = get_process_map(cursor)
        process_candidate_map = get_process_candidate_map(cursor)
        answer_files_map = get_answer_files_map(cursor)

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

        rows = rows_to_dicts(cursor, cursor.fetchall())
        result = []

        for row in rows:
            id_processo = normalize_text(row.get("id_processo"))
            id_teste = normalize_text(row.get("id_teste"))

            if not id_processo or id_processo.upper() == "PROCESSO_UNICO":
                continue

            try:
                payload = answer_files_map.get(id_teste, {})
                process_candidate_row = process_candidate_map.get(id_teste, {})
                process_row = process_map.get(id_processo, {})

                analysis = build_analysis_from_payload(
                    row,
                    process_row,
                    process_candidate_row,
                    payload,
                )
                status_candidato = str(analysis.get("status_candidato") or "").strip()

                if status_candidato not in ["Em análise", "Banco de talentos", "Aprovado"]:
                    continue

                result.append({
                    "id_teste": analysis.get("id_teste", ""),
                    "id_processo": analysis.get("id_processo", ""),
                    "nome_candidato": analysis.get("nome_candidato", ""),
                    "vaga": analysis.get("vaga", ""),
                    "nota_final": round(parse_float_br(analysis.get("nota_final", 0)), 1),
                    "afinidade_percentual": round(float(analysis.get("afinidade_percentual", 0) or 0), 1),
                    "recomendacao": analysis.get("recomendacao", ""),
                    "parecer_final": analysis.get("parecer_final", ""),
                    "status_candidato": status_candidato,
                })

            except Exception as row_error:
                print(f"[candidate-analytics] Erro ao analisar prova {id_teste}: {row_error}")
                continue

        conn.close()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/candidate-analytics/{id_teste}")
def get_candidate_analytics_detail(id_teste: str):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        process_map = get_process_map(cursor)
        process_candidate_map = get_process_candidate_map(cursor)
        answer_files_map = get_answer_files_map(cursor)

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
            WHERE id_teste = ?
        """, (id_teste,))

        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Prova não encontrada.")

        history_row = rows_to_dicts(cursor, [row])[0]
        payload = answer_files_map.get(id_teste, {})
        process_candidate_row = process_candidate_map.get(id_teste, {})
        process_row = process_map.get(normalize_text(history_row.get("id_processo")), {})

        analysis = build_analysis_from_payload(
            history_row,
            process_row,
            process_candidate_row,
            payload,
        )

        conn.close()
        return analysis

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao montar análise do candidato: {str(e)}")