from __future__ import annotations

import argparse

import uvicorn

from api.rh_api.config import get_settings


def build_parser() -> argparse.ArgumentParser:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Inicia o Conecta RH em um unico processo.")
    parser.add_argument(
        "--host",
        default=settings.server_host,
        help="Endereco de bind do servidor. Padrao: configuracao RH_SERVER_HOST ou 127.0.0.1.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=settings.server_port,
        help="Porta HTTP do servidor. Padrao: configuracao RH_API_PORT ou 8000.",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=settings.server_reload,
        help="Ativa reload automatico para desenvolvimento local.",
    )
    parser.add_argument(
        "--no-reload",
        action="store_false",
        dest="reload",
        help="Desativa reload automatico, indicado para servidor interno/producao.",
    )
    return parser


def main() -> None:
    settings = get_settings()
    args = build_parser().parse_args()
    uvicorn.run(
        "api.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
