"""Achado PERF-007 (S-21): React/ReactDOM/htm passaram a ser vendorizados
localmente em apps/frontend/vendor/ em vez de carregados de um CDN externo
(esm.sh) a cada requisição. Este teste é uma checagem estática de conteúdo
(mesmo padrão de test_performance_index_script.py) — não executa JavaScript,
só garante que a migração não regride silenciosamente para o CDN."""

from __future__ import annotations

from pathlib import Path

FRONTEND_DIR = Path(__file__).resolve().parents[3] / "apps" / "frontend"
VENDOR_DIR = FRONTEND_DIR / "vendor"

EXPECTED_VENDOR_FILES = [
    "react@18.3.1.mjs",
    "react-dom@18.3.1.mjs",
    "react-dom-client@18.3.1.mjs",
    "scheduler@0.23.2.mjs",
    "htm@3.1.1.mjs",
]


def test_all_expected_vendor_files_exist_and_are_non_empty():
    for filename in EXPECTED_VENDOR_FILES:
        path = VENDOR_DIR / filename
        assert path.is_file(), f"Arquivo vendorizado ausente: {filename}"
        assert path.stat().st_size > 100, f"Arquivo vendorizado suspeito (muito pequeno): {filename}"


def test_infraestrutura_react_no_longer_imports_from_esm_sh():
    content = (FRONTEND_DIR / "fonte" / "infraestrutura-react.js").read_text(encoding="utf-8")
    assert "https://esm.sh" not in content  # o comentário explicando a migração pode citar "esm.sh" em prosa
    assert "'../vendor/react@18.3.1.mjs'" in content
    assert "'../vendor/react-dom-client@18.3.1.mjs'" in content
    assert "'../vendor/htm@3.1.1.mjs'" in content


def test_vendored_react_dom_imports_only_local_relative_paths():
    content = (VENDOR_DIR / "react-dom@18.3.1.mjs").read_text(encoding="utf-8")
    assert 'from"./react@18.3.1.mjs"' in content
    assert 'from"./scheduler@0.23.2.mjs"' in content
    assert "esm.sh/" not in content.split("\n", 1)[-1]  # só o comentário de proveniência na 1a linha pode citar esm.sh


def test_vendored_react_dom_client_imports_only_local_relative_paths():
    content = (VENDOR_DIR / "react-dom-client@18.3.1.mjs").read_text(encoding="utf-8")
    assert 'from"./react-dom@18.3.1.mjs"' in content
    assert "esm.sh/" not in content.split("\n", 1)[-1]


def test_vendored_react_and_htm_and_scheduler_are_self_contained():
    for filename in ("react@18.3.1.mjs", "htm@3.1.1.mjs", "scheduler@0.23.2.mjs"):
        content = (VENDOR_DIR / filename).read_text(encoding="utf-8")
        body_without_header_comment = content.split("\n", 1)[-1]
        assert "import" not in body_without_header_comment.split("var", 1)[0], (
            f"{filename} deveria ser autocontido (sem import de outro módulo)"
        )


def test_caddyfile_csp_no_longer_allowlists_esm_sh():
    caddyfile = FRONTEND_DIR.parent.parent / "infra" / "caddy" / "Caddyfile"
    content = caddyfile.read_text(encoding="utf-8")
    assert "esm.sh" not in content
