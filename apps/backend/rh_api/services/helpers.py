from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime


def calculate_age_from_birth_date(data_nascimento) -> int | None:
    """Calcula a idade a partir da data de nascimento, considerando ano, mês e dia
    (não apenas a diferença de anos), evitando idade incorreta antes do aniversário."""
    safe_value = normalize_text(data_nascimento)
    if not safe_value:
        return None
    try:
        birth_date = datetime.strptime(safe_value[:10], "%Y-%m-%d").date()
    except ValueError:
        return None
    today = datetime.now().date()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age if age >= 0 else None


def rows_to_dicts(cursor, rows):
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in rows]


def normalize_text(value) -> str:
    return str(value or "").strip()


def normalize_compare_text(value) -> str:
    normalized = unicodedata.normalize("NFD", normalize_text(value))
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return normalized.lower()


def parse_float_br(value) -> float:
    if value is None:
        return 0.0

    text = normalize_text(value).replace(" ", "")
    if not text:
        return 0.0

    if "," in text and "." not in text:
        text = text.replace(",", ".")
    elif "." in text and "," in text:
        text = text.replace(".", "").replace(",", ".")

    text = re.sub(r"[^0-9\.\-]", "", text)
    if text.count(".") > 1:
        parts = text.split(".")
        text = parts[0] + "." + "".join(parts[1:])

    try:
        number = float(text)
    except Exception:
        return 0.0

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


def normalize_string_list(value) -> list[str]:
    if isinstance(value, list):
        raw_items = value
    elif isinstance(value, str):
        raw_items = re.split(r"[,;\n]+", value)
    else:
        raw_items = []

    normalized = []
    seen = set()

    for item in raw_items:
        safe_item = normalize_text(item)
        if not safe_item:
            continue

        compare_key = normalize_compare_text(safe_item)
        if compare_key in seen:
            continue

        seen.add(compare_key)
        normalized.append(safe_item)

    return normalized


INDICATION_TYPE_LABELS = {
    "indicado": "Indicado",
    "indicado com restricao": "Indicado com restrição",
    "indicado com restricoes": "Indicado com restrição",
    "contraindicado": "Contraindicado",
}


def normalize_indication_type(value) -> str:
    safe_value = normalize_text(value)
    if not safe_value:
        return ""

    return INDICATION_TYPE_LABELS.get(normalize_compare_text(safe_value), "")
