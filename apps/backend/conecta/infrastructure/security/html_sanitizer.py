"""Sanitização de HTML rico digitado pelo candidato (resposta dissertativa).

Allowlist estrita de tags/atributos via `html.parser.HTMLParser` da stdlib —
sem dependência nova (nem DOMPurify no frontend, nem `bleach` no backend):
só o que é explicitamente reconhecido é reemitido, então não há caminho para
um atributo (`onerror`, `onload`, `href="javascript:..."`) ou tag (`<script>`,
`<iframe>`) perigosos atravessarem o filtro — o parser nunca copia atributo
ou tag de entrada para a saída, ele reconstrói do zero só o que aprova.
"""

from __future__ import annotations

import re
from html import escape
from html.parser import HTMLParser

_ALLOWED_TAGS = {"b", "strong", "i", "em", "u", "s", "strike", "ul", "ol", "li", "br", "div", "span", "p", "font"}
_VOID_TAGS = {"br"}
# Tags cujo conteúdo interno também deve ser descartado (não só a tag em si).
_DROP_CONTENT_TAGS = {"script", "style", "iframe", "object", "embed", "noscript", "template"}
_FONT_SIZE_PATTERN = re.compile(r"^[1-7]$")
_FONT_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]{3,20}$")
_DANGEROUS_STYLE_TOKENS = ("expression", "javascript:", "url(", "@import", "behavior", "-moz-binding", "<", ">")


def _style_is_safe(value: str) -> bool:
    lowered = value.lower()
    return not any(token in lowered for token in _DANGEROUS_STYLE_TOKENS)


def _sanitize_attrs(tag: str, attrs: list[tuple[str, str | None]]) -> list[tuple[str, str]]:
    safe: list[tuple[str, str]] = []
    for raw_name, raw_value in attrs:
        name = (raw_name or "").lower()
        value = raw_value or ""
        if tag == "font" and name == "size" and _FONT_SIZE_PATTERN.fullmatch(value):
            safe.append((name, value))
        elif tag == "font" and name == "color" and _FONT_COLOR_PATTERN.fullmatch(value):
            safe.append((name, value))
        elif name == "style" and tag in {"div", "span", "p", "li"} and _style_is_safe(value):
            safe.append((name, value))
    return safe


class _RichTextSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._out: list[str] = []
        self._skip_depth = 0

    def _open(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag not in _ALLOWED_TAGS:
            if tag in _DROP_CONTENT_TAGS:
                self._skip_depth += 1
            return
        if self._skip_depth:
            return
        safe_attrs = _sanitize_attrs(tag, attrs)
        attr_text = "".join(f' {name}="{escape(value, quote=True)}"' for name, value in safe_attrs)
        self._out.append(f"<{tag}{attr_text}>")

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._open(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._open(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag not in _ALLOWED_TAGS:
            if tag in _DROP_CONTENT_TAGS and self._skip_depth:
                self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag not in _VOID_TAGS:
            self._out.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        self._out.append(escape(data))

    def get_html(self) -> str:
        return "".join(self._out)


def sanitize_rich_text_html(value: str | None) -> str:
    """Reconstrói `value` mantendo só as tags/atributos da allowlist de formatação
    de texto rico (negrito, itálico, listas, cor/tamanho de fonte, alinhamento).
    Qualquer coisa fora dessa allowlist é descartada, nunca repassada como está."""
    if not value:
        return ""
    parser = _RichTextSanitizer()
    parser.feed(value)
    parser.close()
    return parser.get_html()
