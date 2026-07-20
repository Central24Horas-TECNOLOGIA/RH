import argparse
import hashlib
import io
import json
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET


W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

CLIENTES = {
    "crf": "CRF",
    "davita": "Davita",
    "endoview": "Endoview",
    "brava": "Brava",
    "newe": "Newe",
}

AREAS_ESTAGIARIO = {
    "ti": "TI",
    "comercial": "Comercial",
    "financeiro": "Financeiro",
    "rh": "RH",
}

NIVEL_POR_CARGO = {
    "jovem_aprendiz": "basico",
    "operador": "basico",
    "estagiario": "basico",
    "supervisor": "intermediario",
    "planejamento": "avancado",
}

GABARITO_PALAVRAS_CORRETAS_20 = {
    str(index + 1): letra
    for index, letra in enumerate(
        ["C", "B", "A", "B", "B", "A", "B", "A", "A", "B", "B", "A", "B", "B", "A", "B", "A", "B", "A", "B"]
    )
}


@dataclass
class Paragraph:
    text: str
    bold: list


def normalizar_espacos(texto):
    return re.sub(r"[ \t]+", " ", str(texto or "")).strip()


def chave_texto(texto):
    import unicodedata

    base = unicodedata.normalize("NFD", str(texto or ""))
    base = "".join(ch for ch in base if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", base).strip().lower()


def slug(texto):
    return re.sub(r"[^a-z0-9]+", "_", chave_texto(texto)).strip("_")


def docx_paragraphs(data):
    docx = zipfile.ZipFile(io.BytesIO(data))
    root = ET.fromstring(docx.read("word/document.xml"))
    paragraphs = []

    for paragraph in root.iter(W + "p"):
        text_parts = []
        bold_flags = []
        for run in paragraph.iter(W + "r"):
            text = "".join(node.text or "" for node in run.iter(W + "t"))
            if not text:
                continue
            is_bold = run.find(W + "rPr/" + W + "b") is not None
            text_parts.append(text)
            bold_flags.extend([is_bold] * len(text))
        text = "".join(text_parts)
        if text.strip():
            paragraphs.append(Paragraph(text=normalizar_espacos(text), bold=bold_flags))

    return paragraphs


def combine_paragraphs(paragraphs):
    text_parts = []
    bold = []
    for paragraph in paragraphs:
        if text_parts:
            text_parts.append("\n")
            bold.append(False)
        text_parts.append(paragraph.text)
        bold.extend(paragraph.bold[: len(paragraph.text)])
    return Paragraph(text="".join(text_parts), bold=bold)


def remover_rotulo_questao(texto):
    return re.sub(
        r"^\s*Quest[aã]o\s+\d+\s*(?:[:\-–—]\s*)?",
        "",
        str(texto or ""),
        flags=re.I,
    ).strip()


def numero_questao(texto):
    match = re.search(r"Quest[aã]o\s+(\d+)", str(texto or ""), flags=re.I)
    return int(match.group(1)) if match else None


def localizar_alternativas(paragraph, letras="ABCD"):
    pattern = re.compile(rf"([{re.escape(letras)}])\)")
    matches = []
    for match in pattern.finditer(paragraph.text):
        if matches and match.group(1) == matches[-1].group(1):
            matches[-1] = match
        else:
            matches.append(match)
    if len(matches) < 2:
        return None

    stem = paragraph.text[: matches[0].start()].strip()
    alternativas = []
    correta = None
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(paragraph.text)
        option_text = paragraph.text[match.end() : end].strip()
        option_text = re.sub(r"\s+", " ", option_text).strip()
        option_bold = any(paragraph.bold[match.start() : end])
        option_id = match.group(1)
        alternativas.append({"id": option_id, "texto": option_text})
        if option_bold:
            correta = option_id

    return {
        "stem": stem,
        "alternativas": alternativas,
        "gabarito": correta,
    }


def parse_gabarito_linha(texto):
    match = re.search(r"Gabarito\s*:?\s*(.+)$", str(texto or ""), flags=re.I)
    if not match:
        return None
    return match.group(1).strip().strip(".")


def parse_gabarito_grupo(texto):
    bruto = parse_gabarito_linha(texto) or texto
    pares = re.findall(r"(\d+)\s*[-–—:]?\s*([A-D])", bruto, flags=re.I)
    return {str(int(numero)): letra.upper() for numero, letra in pares}


def extrair_gabarito_documento(paragraphs):
    start = next(
        (
            index
            for index, paragraph in enumerate(paragraphs)
            if chave_texto(paragraph.text).startswith("gabarito")
        ),
        None,
    )
    if start is None:
        return {}, len(paragraphs)

    respostas = parse_gabarito_grupo(" ".join(p.text for p in paragraphs[start:]))
    for index in range(start + 1, len(paragraphs) - 1):
        numero = paragraphs[index].text.strip()
        letra = paragraphs[index + 1].text.strip().upper()
        if re.fullmatch(r"\d+", numero) and re.fullmatch(r"[A-D]", letra):
            respostas[str(int(numero))] = letra
    return respostas, start


def split_rubrica(paragraphs):
    """Separa dados internos sem incorporá-los ao enunciado do candidato."""
    visiveis = []
    rubricas = []
    itens_avaliacao = []
    bloco_interno = None

    for paragraph in paragraphs:
        texto = paragraph.text
        match = re.search(
            r"(O que\s+deve\s+ser\s+avaliado|Observa[cç][aã]o)\s*:?\s*(.*)$",
            texto,
            flags=re.I,
        )
        if match:
            antes = texto[: match.start()].strip()
            if antes:
                visiveis.append(Paragraph(antes, paragraph.bold[: len(antes)]))
            bloco_interno = (
                "avaliacao"
                if chave_texto(match.group(1)).startswith("o que deve ser avaliado")
                else "rubrica"
            )
            conteudo = match.group(2).strip()
            if conteudo:
                (itens_avaliacao if bloco_interno == "avaliacao" else rubricas).append(conteudo)
            continue

        # O bloco interno ocupa o restante da questão. Gabaritos continuam sendo
        # tratados pelo parser específico para não alterar questões objetivas.
        if bloco_interno and not re.match(r"^\s*Gabarito\s*:?", texto, flags=re.I):
            (itens_avaliacao if bloco_interno == "avaliacao" else rubricas).append(texto)
            continue

        visiveis.append(paragraph)

    return (
        visiveis,
        normalizar_espacos(" ".join(rubricas)),
        normalizar_espacos(" ".join(itens_avaliacao)),
    )


def split_gabarito(paragraphs):
    visiveis = []
    gabarito = None
    for paragraph in paragraphs:
        valor = parse_gabarito_linha(paragraph.text)
        if valor is not None:
            gabarito = valor
        else:
            visiveis.append(paragraph)
    return visiveis, gabarito


def detectar_alternativas_sem_rotulo(paragraphs):
    start = None
    for index, paragraph in enumerate(paragraphs):
        if "assinale" in chave_texto(paragraph.text):
            start = index + 1
    if start is None:
        return None

    alternativas = []
    for paragraph in paragraphs[start:]:
        texto = paragraph.text.strip()
        if re.match(r"^\(\s*1\s*\)", texto):
            alternativas.append(texto)

    if len(alternativas) < 4:
        return None

    stem = "\n\n".join(p.text for p in paragraphs[:start]).strip()
    return {
        "stem": stem,
        "alternativas": [
            {"id": chr(65 + index), "texto": texto}
            for index, texto in enumerate(alternativas[:4])
        ],
    }


def blocos_questoes(paragraphs, inicio=0, fim=None):
    fim = len(paragraphs) if fim is None else fim
    starts = [
        index
        for index in range(inicio, fim)
        if re.match(r"^\s*Quest[aã]o\s+\d+", paragraphs[index].text, flags=re.I)
    ]
    blocos = []
    for pos, start in enumerate(starts):
        end = starts[pos + 1] if pos + 1 < len(starts) else fim
        blocos.append(paragraphs[start:end])
    return blocos


def detectar_itens_compactos(paragraphs, gabarito_texto=None):
    if not paragraphs:
        return None

    itens = []
    intro = []
    index = 0
    while index < len(paragraphs):
        parsed = localizar_alternativas(paragraphs[index], "ABC")
        if parsed and len(parsed["alternativas"]) in (2, 3):
            stem = remover_rotulo_questao(parsed["stem"])
            if stem:
                item_id = str(len(itens) + 1)
                itens.append(
                    {
                        "id": item_id,
                        "enunciado": stem,
                        "alternativas": parsed["alternativas"],
                        "gabarito": parsed["gabarito"],
                    }
                )
            index += 1
            continue

        proximas_opcoes = []
        lookahead = index + 1
        while lookahead < len(paragraphs):
            texto_opcao = paragraphs[lookahead].text.strip()
            if re.fullmatch(r"Op[cç][aã]o\s+[A-C]", texto_opcao, flags=re.I):
                letra = texto_opcao[-1].upper()
                proximas_opcoes.append({"id": letra, "texto": texto_opcao})
                lookahead += 1
                continue
            if re.fullmatch(r"[A-C]\)?\s*.+", texto_opcao, flags=re.I):
                break
            break

        if len(proximas_opcoes) >= 2:
            stem = remover_rotulo_questao(paragraphs[index].text)
            item_id = str(len(itens) + 1)
            itens.append(
                {
                    "id": item_id,
                    "enunciado": stem,
                    "alternativas": proximas_opcoes,
                    "gabarito": None,
                }
            )
            index = lookahead
            continue

        opcoes_livres = []
        lookahead = index + 1
        while lookahead < len(paragraphs) and len(opcoes_livres) < 3:
            texto_opcao = paragraphs[lookahead].text.strip()
            if (
                not texto_opcao
                or re.match(r"^\s*Quest[aã]o\s+\d+", texto_opcao, flags=re.I)
                or "____" in texto_opcao
                or localizar_alternativas(paragraphs[lookahead], "ABC")
            ):
                break
            if len(texto_opcao) <= 80:
                letra = chr(65 + len(opcoes_livres))
                opcoes_livres.append({"id": letra, "texto": texto_opcao})
                lookahead += 1
                continue
            break

        if len(opcoes_livres) >= 2 and ("____" in paragraphs[index].text or "________" in paragraphs[index].text):
            stem = remover_rotulo_questao(paragraphs[index].text)
            item_id = str(len(itens) + 1)
            itens.append(
                {
                    "id": item_id,
                    "enunciado": stem,
                    "alternativas": opcoes_livres,
                    "gabarito": None,
                }
            )
            index = lookahead
            continue

        if not itens:
            intro.append(remover_rotulo_questao(paragraphs[index].text))
        index += 1

    if len(itens) < 3:
        return None

    respostas = parse_gabarito_grupo(gabarito_texto or "")
    if not respostas and len(itens) == 20:
        respostas = dict(GABARITO_PALAVRAS_CORRETAS_20)
    for item in itens:
        if respostas.get(item["id"]):
            item["gabarito"] = respostas[item["id"]]

    return {
        "enunciado": "\n\n".join(texto for texto in intro if texto).strip(),
        "itens": itens,
        "gabarito": respostas or {
            item["id"]: item["gabarito"] for item in itens if item.get("gabarito")
        },
    }


def criar_questao(
    *,
    cargo,
    etapa,
    tipo,
    origem,
    origem_arquivo,
    numero,
    enunciado,
    alternativas=None,
    itens=None,
    gabarito=None,
    rubrica=None,
    o_que_deve_ser_avaliado=None,
    tema_redacao=None,
    instrucoes_redacao=None,
    cliente=None,
    area=None,
    base_neutra_id=None,
    aliases_base=None,
    fontes_origem=None,
):
    partes_id = [
        cargo,
        origem,
        etapa,
        cliente or area or "geral",
        f"q{int(numero or 0):02d}",
        tipo,
    ]
    item_id = slug("_".join(partes_id))
    return {
        "id": item_id,
        "base_neutra_id": base_neutra_id,
        "aliases_base_neutra": aliases_base or [],
        "ativo": True,
        "cargo": cargo,
        "etapa": etapa,
        "tipo": tipo,
        "origem": origem,
        "cliente_id": slug(cliente) if cliente else None,
        "cliente": cliente,
        "area": area,
        "nivel": NIVEL_POR_CARGO.get(cargo, "basico"),
        "numero": numero,
        "titulo": "Redação" if tipo == "essay" else f"Questão {numero}",
        "enunciado": normalizar_espacos(enunciado).replace("\n ", "\n"),
        "alternativas": alternativas or [],
        "itens": itens or [],
        "gabarito": gabarito,
        "rubricaInterna": normalizar_espacos(rubrica or ""),
        "oQueDeveSerAvaliado": normalizar_espacos(o_que_deve_ser_avaliado or ""),
        "temaRedacao": normalizar_espacos(tema_redacao or ""),
        "instrucoesRedacao": normalizar_espacos(instrucoes_redacao or ""),
        "exibirParaCandidato": True,
        "origemArquivo": origem_arquivo,
        "fontesOrigem": fontes_origem or [origem_arquivo],
    }


def parse_question_block(block, meta):
    numero = numero_questao(block[0].text)
    visiveis, rubrica, o_que_deve_ser_avaliado = split_rubrica(block)
    visiveis, gabarito_texto = split_gabarito(visiveis)
    combinado = combine_paragraphs(visiveis)
    opcoes = localizar_alternativas(combinado, "ABCD")

    compacto = detectar_itens_compactos(visiveis[1:] if len(visiveis) > 1 else visiveis, gabarito_texto)
    if compacto:
        enunciado = compacto["enunciado"] or remover_rotulo_questao(visiveis[0].text)
        tipo = "compact_choice_group"
        gabarito = compacto["gabarito"] or None
        return criar_questao(
            **meta,
            tipo=tipo,
            numero=numero,
            enunciado=enunciado,
            itens=compacto["itens"],
            gabarito=gabarito,
            rubrica=rubrica,
            o_que_deve_ser_avaliado=o_que_deve_ser_avaliado,
        )

    if opcoes and len(opcoes["alternativas"]) == 4:
        enunciado = remover_rotulo_questao(opcoes["stem"])
        gabarito = (gabarito_texto or opcoes["gabarito"] or "").strip().upper() or None
        tipo = {
            "conhecimentos_gerais": "general_multiple_choice",
            "conhecimentos_tecnicos": "technical_multiple_choice",
        }.get(meta["etapa"], "multiple_choice")
        return criar_questao(
            **meta,
            tipo=tipo,
            numero=numero,
            enunciado=enunciado,
            alternativas=opcoes["alternativas"],
            gabarito=gabarito[:1] if gabarito else None,
            rubrica=rubrica,
            o_que_deve_ser_avaliado=o_que_deve_ser_avaliado,
        )

    opcoes_sem_rotulo = detectar_alternativas_sem_rotulo(visiveis)
    if opcoes_sem_rotulo:
        enunciado = remover_rotulo_questao(opcoes_sem_rotulo["stem"])
        tipo = {
            "conhecimentos_gerais": "general_multiple_choice",
            "conhecimentos_tecnicos": "technical_multiple_choice",
        }.get(meta["etapa"], "multiple_choice")
        return criar_questao(
            **meta,
            tipo=tipo,
            numero=numero,
            enunciado=enunciado,
            alternativas=opcoes_sem_rotulo["alternativas"],
            gabarito=(gabarito_texto or "").strip().upper()[:1] or None,
            rubrica=rubrica,
            o_que_deve_ser_avaliado=o_que_deve_ser_avaliado,
        )

    texto = "\n\n".join(remover_rotulo_questao(p.text) for p in visiveis).strip()
    return criar_questao(
        **meta,
        tipo="word_discursive",
        numero=numero,
        enunciado=texto,
        gabarito=None,
        rubrica=rubrica,
        o_que_deve_ser_avaliado=o_que_deve_ser_avaliado,
    )


def criar_redacao(paragraphs, meta, numero=1):
    visiveis, rubrica, o_que_deve_ser_avaliado = split_rubrica(paragraphs)
    textos = [p.text for p in visiveis if p.text.strip()]
    texto = "\n\n".join(textos).strip()
    texto = re.sub(
        r"^\s*(?:Parte\s+\d+\s*[—-]\s*)?Reda[cç][aã]o\s*:?\s*",
        "",
        texto,
        flags=re.I,
    ).strip()

    tema = ""
    instrucoes = ""
    for index, item in enumerate(textos):
        match_tema = re.match(r"^\s*Tema\s*:?\s*(.*)$", item, flags=re.I)
        if match_tema:
            tema = match_tema.group(1).strip(" \"'“”")
            if not tema and index + 1 < len(textos):
                tema = textos[index + 1].strip(" \"'“”")
            break
    if not tema and "tema livre" in chave_texto(texto):
        tema = "Tema livre"
    if not tema:
        primeiro_conteudo = next(
            (
                item.strip(" \"'“”")
                for item in textos
                if chave_texto(item) not in ("redacao", "tema", "instrucoes")
                and not chave_texto(item).startswith("redacao:")
                and not chave_texto(item).startswith("instrucoes:")
            ),
            "",
        )
        if primeiro_conteudo and len(primeiro_conteudo) <= 280:
            tema = primeiro_conteudo
    if not tema and all(
        termo in chave_texto(texto)
        for termo in ("trajetoria", "interesses", "expectativas", "motiva")
    ):
        tema = "Trajetória, interesses, expectativas para o futuro e motivação profissional"

    for item in textos:
        match_instrucoes = re.match(r"^\s*Instru[cç][oõ]es\s*:?\s*(.*)$", item, flags=re.I)
        if match_instrucoes:
            instrucoes = match_instrucoes.group(1).strip()
            break

    return criar_questao(
        **meta,
        tipo="essay",
        numero=numero,
        enunciado=texto,
        gabarito=None,
        rubrica=rubrica,
        o_que_deve_ser_avaliado=o_que_deve_ser_avaliado,
        tema_redacao=tema,
        instrucoes_redacao=instrucoes,
    )


def intervalo_redacao_apos(paragraphs, start_index):
    end = len(paragraphs)
    for index in range(start_index + 1, len(paragraphs)):
        texto = paragraphs[index].text
        chave = chave_texto(texto)
        if (
            re.match(r"^\s*(Quest[aã]o\s+\d+|Cliente:|CLIENTE:|PROVA PERSONALIZADA|SUPERVISOR\s+[—-])", texto, flags=re.I)
            or chave.startswith("questoes multipla")
            or chave.startswith("parte 2")
            or chave == "gabarito"
        ):
            end = index
            break
    return paragraphs[start_index:end]


def parse_word_neutro(paragraphs, cargo, origem_arquivo):
    questoes = []
    meta = {
        "cargo": cargo,
        "etapa": "word",
        "origem": "neutra",
        "origem_arquivo": origem_arquivo,
    }
    redacao_index = next(
        (i for i, p in enumerate(paragraphs) if re.match(r"^\s*Reda[cç][aã]o\s*:?", p.text, re.I)),
        len(paragraphs),
    )
    for block in blocos_questoes(paragraphs, 0, redacao_index):
        questoes.append(parse_question_block(block, meta))
    if redacao_index < len(paragraphs):
        questoes.append(
            criar_redacao(
                intervalo_redacao_apos(paragraphs, redacao_index),
                {
                    "cargo": cargo,
                    "etapa": "redacao",
                    "origem": "neutra",
                    "origem_arquivo": origem_arquivo,
                },
            )
        )
    return questoes


def detectar_cliente(texto):
    chave = chave_texto(texto)
    for cliente_id, nome in CLIENTES.items():
        if cliente_id in chave:
            return nome
    return None


def detectar_area_estagiario(texto):
    chave = chave_texto(texto)
    for area_id, nome in AREAS_ESTAGIARIO.items():
        if area_id in chave:
            return nome
    return None


def parse_word_personalizado(paragraphs, cargo, origem_arquivo):
    questoes = []
    section_starts = []
    for index, paragraph in enumerate(paragraphs):
        texto = paragraph.text
        cliente = detectar_cliente(texto)
        area = detectar_area_estagiario(texto)
        if cargo in ("jovem_aprendiz", "operador", "supervisor") and cliente and re.search(r"(Cliente|CLIENTE|SUPERVISOR)", texto, re.I):
            section_starts.append((index, cliente, None))
        elif cargo == "estagiario" and area and re.search(r"PROVA PERSONALIZADA|ESTAGI", texto, re.I):
            section_starts.append((index, None, area))

    for pos, (start, cliente, area) in enumerate(section_starts):
        end = section_starts[pos + 1][0] if pos + 1 < len(section_starts) else len(paragraphs)
        redacao_index = next(
            (
                i
                for i in range(start + 1, end)
                if re.match(r"^\s*Reda[cç][aã]o\s*:?", paragraphs[i].text, re.I)
            ),
            end,
        )
        meta = {
            "cargo": cargo,
            "etapa": "word",
            "origem": "personalizada",
            "origem_arquivo": origem_arquivo,
            "cliente": cliente,
            "area": area,
        }
        for block in blocos_questoes(paragraphs, start + 1, redacao_index):
            questoes.append(parse_question_block(block, meta))
        if cargo not in ("jovem_aprendiz", "supervisor") and redacao_index < end:
            questoes.append(
                criar_redacao(
                    intervalo_redacao_apos(paragraphs, redacao_index),
                    {
                        "cargo": cargo,
                        "etapa": "redacao",
                        "origem": "personalizada",
                        "origem_arquivo": origem_arquivo,
                        "cliente": cliente,
                        "area": area,
                    },
                )
            )

    return questoes


def parse_conhecimentos_estagiario(paragraphs, origem_arquivo, etapa, area=None):
    questoes = []
    meta = {
        "cargo": "estagiario",
        "etapa": etapa,
        "origem": "neutra",
        "origem_arquivo": origem_arquivo,
        "area": area,
    }
    for block in blocos_questoes(paragraphs):
        questoes.append(parse_question_block(block, meta))
    return questoes


def parse_supervisor(paragraphs, origem, origem_arquivo, cliente=None):
    questoes = []
    redacao_index = next(
        (i for i, p in enumerate(paragraphs) if re.match(r"^\s*Reda[cç][aã]o\s*:?", p.text, re.I)),
        None,
    )
    if redacao_index is not None:
        questoes.append(
            criar_redacao(
                intervalo_redacao_apos(paragraphs, redacao_index),
                {
                    "cargo": "supervisor",
                    "etapa": "redacao",
                    "origem": "neutra",
                    "origem_arquivo": origem_arquivo,
                },
            )
        )

    meta = {
        "cargo": "supervisor",
        "etapa": "word",
        "origem": origem,
        "origem_arquivo": origem_arquivo,
        "cliente": cliente,
    }
    for block in blocos_questoes(paragraphs, 0, len(paragraphs)):
        q = parse_question_block(block, meta)
        if (q["numero"] and q["numero"] >= 8) or "preenche corretamente" in chave_texto(q["enunciado"]):
            q["etapa"] = "conhecimentos_gerais"
            q["id"] = q["id"].replace("_word_", "_conhecimentos_gerais_")
            if q["tipo"] == "multiple_choice":
                q["tipo"] = "general_multiple_choice"
            if "preenche corretamente" in chave_texto(q["enunciado"]) and not q.get("gabarito"):
                q["gabarito"] = "B"
        questoes.append(q)
    return questoes


def parse_supervisor_personalizado(paragraphs, origem_arquivo):
    questoes = []
    section_starts = []
    for index, paragraph in enumerate(paragraphs):
        cliente = detectar_cliente(paragraph.text)
        if cliente and re.search(r"SUPERVISOR\s+[—-]", paragraph.text, re.I):
            section_starts.append((index, cliente))

    for pos, (start, cliente) in enumerate(section_starts):
        end = section_starts[pos + 1][0] if pos + 1 < len(section_starts) else len(paragraphs)
        meta = {
            "cargo": "supervisor",
            "etapa": "word",
            "origem": "personalizada",
            "origem_arquivo": origem_arquivo,
            "cliente": cliente,
        }
        for block in blocos_questoes(paragraphs, start + 1, end):
            q = parse_question_block(block, meta)
            if (q["numero"] and q["numero"] >= 8) or "preenche corretamente" in chave_texto(q["enunciado"]):
                q["etapa"] = "conhecimentos_gerais"
                q["id"] = q["id"].replace("_word_", "_conhecimentos_gerais_")
                if q["tipo"] == "multiple_choice":
                    q["tipo"] = "general_multiple_choice"
            questoes.append(q)
    return questoes


def parse_word_com_redacao_inicial(paragraphs, cargo, origem_arquivo):
    questoes = []
    gabarito, fim_questoes = extrair_gabarito_documento(paragraphs)
    redacao_index = next(
        (
            i
            for i, paragraph in enumerate(paragraphs)
            if "redacao" in chave_texto(paragraph.text)
        ),
        None,
    )
    if redacao_index is not None:
        questoes.append(
            criar_redacao(
                intervalo_redacao_apos(paragraphs, redacao_index),
                {
                    "cargo": cargo,
                    "etapa": "redacao",
                    "origem": "neutra",
                    "origem_arquivo": origem_arquivo,
                },
            )
        )

    meta = {
        "cargo": cargo,
        "etapa": "word",
        "origem": "neutra",
        "origem_arquivo": origem_arquivo,
    }
    questoes.extend(
        parse_question_block(block, meta)
        for block in blocos_questoes(paragraphs, 0, fim_questoes)
    )
    for questao in questoes:
        if questao["tipo"] == "multiple_choice" and gabarito.get(str(questao["numero"])):
            questao["gabarito"] = gabarito[str(questao["numero"])]
    return questoes


def parse_word_versoes_personalizadas(paragraphs, cargo, origem_arquivo):
    questoes = []
    gabarito, fim_questoes = extrair_gabarito_documento(paragraphs)
    section_starts = [
        index
        for index, paragraph in enumerate(paragraphs)
        if chave_texto(paragraph.text).startswith("versao ")
    ]

    for pos, start in enumerate(section_starts):
        end = section_starts[pos + 1] if pos + 1 < len(section_starts) else fim_questoes
        cliente = next(
            (
                detectar_cliente(paragraphs[index].text)
                for index in range(start, min(start + 3, end))
                if detectar_cliente(paragraphs[index].text)
            ),
            None,
        )
        if not cliente:
            continue

        redacao_index = next(
            (
                index
                for index in range(start, end)
                if "redacao" in chave_texto(paragraphs[index].text)
            ),
            None,
        )
        if redacao_index is not None:
            questoes.append(
                criar_redacao(
                    intervalo_redacao_apos(paragraphs, redacao_index),
                    {
                        "cargo": cargo,
                        "etapa": "redacao",
                        "origem": "personalizada",
                        "origem_arquivo": origem_arquivo,
                        "cliente": cliente,
                    },
                )
            )

        meta = {
            "cargo": cargo,
            "etapa": "word",
            "origem": "personalizada",
            "origem_arquivo": origem_arquivo,
            "cliente": cliente,
        }
        questoes.extend(
            parse_question_block(block, meta)
            for block in blocos_questoes(paragraphs, start + 1, end)
        )

    for questao in questoes:
        if questao["tipo"] == "multiple_choice" and gabarito.get(str(questao["numero"])):
            questao["gabarito"] = gabarito[str(questao["numero"])]

    return questoes


def aplicar_bases_neutras(questoes):
    neutras = {}
    for questao in questoes:
        if questao["origem"] != "neutra":
            continue
        chave = (
            questao["cargo"],
            questao["etapa"],
            questao["numero"],
            questao["tipo"],
        )
        neutras.setdefault(chave, questao["id"])

    for questao in questoes:
        if questao["origem"] != "personalizada":
            continue
        chave = (
            questao["cargo"],
            questao["etapa"],
            questao["numero"],
            questao["tipo"],
        )
        questao["base_neutra_id"] = neutras.get(chave)
        aliases = []
        if questao["cargo"] == "estagiario" and questao["etapa"] == "word":
            aliases.append(neutras.get(("operador", "word", questao["numero"], questao["tipo"])))
        questao["aliases_base_neutra"] = [item for item in aliases if item]


def localizar_arquivo_zip(archive, caminho_esperado):
    """Aceita o ZIP com ou sem uma pasta contêiner na raiz."""
    esperado = caminho_esperado.replace("\\", "/").strip("/")
    candidatos = [
        nome
        for nome in archive.namelist()
        if nome.replace("\\", "/").strip("/") == esperado
        or nome.replace("\\", "/").strip("/").endswith("/" + esperado)
    ]
    if len(candidatos) != 1:
        raise KeyError(
            f"Arquivo esperado não encontrado de forma única no ZIP: {caminho_esperado}"
        )
    return candidatos[0]


def importar(zip_path):
    specs = {
        "Provas - Word e Redacao/Jovem Aprendiz/JP - NEUTRAS.docx": lambda p, n: parse_word_neutro(p, "jovem_aprendiz", n),
        "Provas - Word e Redacao/Jovem Aprendiz/JP - PERSONALIZADAS POR CLIENTES.docx": lambda p, n: parse_word_personalizado(p, "jovem_aprendiz", n),
        "Provas - Word e Redacao/Estagiário/ESTAGIARIO - NEUTRAS.docx": lambda p, n: parse_word_neutro(p, "estagiario", n),
        "Provas - Word e Redacao/Estagiário/ESTAGIARIO - PERSONALIZADAS.docx": lambda p, n: parse_word_personalizado(p, "estagiario", n),
        "Provas - Word e Redacao/Operador/OPERADOR - NEUTRAS.docx": lambda p, n: parse_word_neutro(p, "operador", n),
        "Provas - Word e Redacao/Operador/OPERADOR - PERSONALIZADAS POR CLIENTES.docx": lambda p, n: parse_word_personalizado(p, "operador", n),
        "Provas - Word e Redacao/Supervidor/SUPERVISOR - NEUTRAS.docx": lambda p, n: parse_supervisor(p, "neutra", n),
        "Provas - Word e Redacao/Supervidor/SUPERVISOR - PERSONALIZADAS POR CLIENTES.docx": lambda p, n: parse_supervisor_personalizado(p, n),
        "Provas - Word e Redacao/Planejamento/PLANEJAMENTO - NEUTRAS.docx": lambda p, n: parse_word_com_redacao_inicial(p, "planejamento", n),
        "Provas - Word e Redacao/Planejamento/PLANEJAMENTO - PERSONALIZADAS.docx": lambda p, n: parse_word_versoes_personalizadas(p, "planejamento", n),
        "Provas - Conhecimentos/Estagiário/CONHECIMENTOS GERAIS- ESTAGIARIOS (TI, RH, COMERCIAL).docx": lambda p, n: parse_conhecimentos_estagiario(p, n, "conhecimentos_gerais"),
        "Provas - Conhecimentos/Estagiário/CONHECIMENTO TECNICO - ESTAGIARIO TI.docx": lambda p, n: parse_conhecimentos_estagiario(p, n, "conhecimentos_tecnicos", "TI"),
        "Provas - Conhecimentos/Estagiário/CONHECIMENTO TECNICO - ESTAGIARIO COMERCIAL .docx": lambda p, n: parse_conhecimentos_estagiario(p, n, "conhecimentos_tecnicos", "Comercial"),
    }

    questoes = []
    arquivos = []
    with zipfile.ZipFile(zip_path) as archive:
        for name, parser in specs.items():
            archive_name = localizar_arquivo_zip(archive, name)
            data = archive.read(archive_name)
            arquivos.append(
                {
                    "arquivo": name,
                    "sha256": hashlib.sha256(data).hexdigest(),
                }
            )
            questoes.extend(parser(docx_paragraphs(data), name))

    aplicar_bases_neutras(questoes)

    personalizadas = [q for q in questoes if q["origem"] == "personalizada"]
    neutras = [q for q in questoes if q["origem"] == "neutra"]
    return {
        "versao": 1,
        "ultima_atualizacao": "2026-07-17",
        "descricao": "Banco reformulado importado dos DOCX enviados. Excel permanece fora deste arquivo.",
        "arquivos_origem": arquivos,
        "questoes": neutras,
        "questoes_personalizadas": personalizadas,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("zip", help="Caminho do arquivo Provas Reformuladas.zip")
    parser.add_argument(
        "--out",
        default="apps/frontend/data/bancoQuestoesReformuladas.json",
        help="Arquivo JSON de saída",
    )
    args = parser.parse_args()

    banco = importar(Path(args.zip))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(banco, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Importadas {len(banco['questoes'])} neutras e "
        f"{len(banco['questoes_personalizadas'])} personalizadas em {out}."
    )


if __name__ == "__main__":
    main()
