from __future__ import annotations

import io
import json
import re

from .helpers import normalize_compare_text, normalize_text


CV_KEYWORDS = [
    "excel",
    "word",
    "power bi",
    "powerbi",
    "atendimento",
    "suporte",
    "planilha",
    "dashboards",
    "dashboard",
    "sql",
    "python",
    "javascript",
    "react",
    "talkdesk",
    "power automate",
    "sharepoint",
    "teams",
    "analise",
    "dados",
    "cliente",
    "monitoramento",
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
    "Estagiario": {
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

EMAIL_REGEX = re.compile(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", re.IGNORECASE)
PHONE_REGEX = re.compile(r"(?:(?:\+?55)\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-\s.]?\d{4}")
WHATSAPP_REGEX = re.compile(r"(?:(?:\+?55)\s*)?(?:\(?\d{2}\)?\s*)?(?:9\d{4})[-\s.]?\d{4}")


def normalize_cv_text(texto):
    bruto = str(texto or "")
    bruto = bruto.replace("\r", "\n")
    bruto = re.sub(r"\n{3,}", "\n\n", bruto)
    bruto = re.sub(r"[ \t]{2,}", " ", bruto)
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
    nome_limpo = normalize_text(nome)
    if not nome_limpo:
        return False

    partes = [parte for parte in nome_limpo.split() if parte.strip()]
    if len(partes) < 2 or len(partes) > 5:
        return False

    if len(nome_limpo) < 8 or len(nome_limpo) > 60:
        return False

    termos_invalidos = {
        "curriculo",
        "objetivo",
        "resumo",
        "perfil",
        "experiencia",
        "formacao",
        "habilidades",
        "competencias",
        "telefone",
        "email",
        "e-mail",
        "whatsapp",
        "linkedin",
        "github",
    }

    nome_normalizado = normalize_compare_text(nome_limpo)
    if any(termo in nome_normalizado for termo in termos_invalidos):
        return False

    return not any(char.isdigit() for char in nome_limpo)


def is_valid_email(email):
    email_limpo = normalize_text(email)
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


def extract_education_strength(texto):
    base = normalize_compare_text(texto)
    if any(item in base for item in ["mba", "pos-graduacao", "pos graduacao"]):
        return "forte"
    if any(item in base for item in ["graduacao", "bacharelado", "tecnologo", "faculdade", "universidade"]):
        return "media"
    if any(item in base for item in ["ensino medio", "curso tecnico", "escolaridade"]):
        return "basica"
    return "ausente"


def has_experience_content(texto):
    base = normalize_compare_text(texto)
    pistas = [
        "experiencia",
        "atuei",
        "trabalhei",
        "atuacao",
        "empresa",
        "cargo",
        "funcao",
        "responsavel por",
        "atividades desenvolvidas",
    ]
    return any(pista in base for pista in pistas)


def extract_experience_strength(texto):
    base = normalize_compare_text(texto)
    marcadores_tempo = re.findall(r"\b(19|20)\d{2}\b", base)
    tem_empresa = any(item in base for item in ["empresa", "cargo", "funcao", "responsavel por"])

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
        linha_limpa = linha.strip(" -.|")
        if is_valid_candidate_name(linha_limpa):
            candidatos.append(linha_limpa)

    if not candidatos:
        return ""

    candidatos.sort(key=lambda item: (len(item.split()), len(item)))
    return candidatos[0]


def extract_keywords(texto):
    base = normalize_compare_text(texto)
    encontrados = []
    termos_negativos = [
        "nao tenho experiencia com",
        "nao possuo experiencia com",
        "sem experiencia em",
        "nunca trabalhei com",
        "nao conheco",
        "nao domino",
    ]

    for palavra in CV_KEYWORDS:
        if palavra not in base:
            continue

        posicao = base.find(palavra)
        trecho_inicio = max(0, posicao - 60)
        trecho_fim = min(len(base), posicao + len(palavra) + 60)
        contexto = base[trecho_inicio:trecho_fim]

        if any(termo in contexto for termo in termos_negativos):
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
    normalized_role = normalize_text(role)
    if normalize_compare_text(normalized_role) == "estagiario":
        normalized_role = "Estagiario"

    role_cfg = CV_WEIGHTS_BY_ROLE.get(
        normalized_role,
        {"keywords": {}, "min_keywords": 2},
    )

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
        pontos_fortes.append("Nome do candidato identificado com consistencia.")
    else:
        score -= 2.0
        problemas.append("Nome do candidato nao foi identificado com seguranca.")

    if has_email and is_valid_email(email_value):
        score += 1.0
        pontos_fortes.append("E-mail valido identificado.")
    else:
        score -= 1.5
        problemas.append("E-mail nao encontrado ou invalido.")

    if has_phone and is_valid_phone(phone_value):
        score += 1.0
        pontos_fortes.append("Telefone ou WhatsApp valido identificado.")
    else:
        score -= 1.5
        problemas.append("Telefone/WhatsApp nao encontrado ou invalido.")

    if text_length < 80:
        score -= 3.0
        problemas.append("CV com pouco conteudo extraido.")
    elif text_length < 180:
        score -= 1.5
        problemas.append("CV com conteudo muito limitado para analise segura.")
    elif text_length >= 250:
        score += 0.5

    min_keywords = int(role_cfg.get("min_keywords", 2))
    if len(keywords_validas) >= min_keywords:
        score += 0.5
        pontos_fortes.append(
            f"Foram identificadas {len(keywords_validas)} palavra(s)-chave aderentes a vaga."
        )
    else:
        score -= 2.0
        problemas.append("Poucas palavras-chave realmente aderentes a vaga.")

    if not keywords_validas:
        score -= 2.0
        problemas.append("Nenhuma palavra-chave relevante da vaga foi validada no curriculo.")

    if education_strength == "forte":
        score += 1.5
        pontos_fortes.append("Formacao academica robusta identificada.")
    elif education_strength == "media":
        score += 0.9
        pontos_fortes.append("Formacao academica compativel identificada.")
    elif education_strength == "basica":
        score += 0.3
        pontos_fortes.append("Indicios basicos de formacao identificados.")
    else:
        score -= 1.2
        problemas.append("Formacao/educacao nao identificada no curriculo.")

    if experience_strength == "forte":
        score += 2.0
        pontos_fortes.append("Experiencia profissional consistente identificada.")
    elif experience_strength == "media":
        score += 1.0
        pontos_fortes.append("Experiencia profissional parcial identificada.")
    elif experience_strength == "basica":
        score += 0.3
        pontos_fortes.append("Ha mencoes superficiais de experiencia profissional.")
    else:
        score -= 1.8
        problemas.append("Experiencia profissional nao identificada com clareza.")

    score = max(0.0, min(10.0, round(score, 2)))

    if (
        score >= 7.0
        and len(keywords_validas) >= min_keywords
        and is_valid_candidate_name(candidate_name)
        and is_valid_email(email_value)
        and is_valid_phone(phone_value)
        and experience_strength in ("forte", "media")
    ):
        classificacao = "Qualificado"
        slug = "qualificado"
    elif (
        score >= 4.5
        and len(keywords_validas) >= max(1, min_keywords - 1)
        and experience_strength in ("forte", "media", "basica")
    ):
        classificacao = "Qualificado"
        slug = "qualificado"
    else:
        classificacao = "Nao qualificado"
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
    nome = normalize_text(filename).lower()

    if nome.endswith(".txt"):
        try:
            return content_bytes.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    if nome.endswith(".pdf"):
        try:
            from pypdf import PdfReader

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

            document = Document(io.BytesIO(content_bytes))
            partes = [paragraph.text for paragraph in document.paragraphs if normalize_text(paragraph.text)]
            return "\n".join(partes).strip()
        except Exception:
            return ""

    return ""


def serialize_cv_problems(avaliacao: dict) -> str:
    return json.dumps(
        {
            "problemas": avaliacao["problemas"],
            "pontos_fortes": avaliacao["pontos_fortes"],
            "education_strength": avaliacao["education_strength"],
            "experience_strength": avaliacao["experience_strength"],
        },
        ensure_ascii=False,
    )
