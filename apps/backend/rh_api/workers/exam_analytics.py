from __future__ import annotations

import argparse
import logging
import socket
import time

from ..config import get_settings
from ..repositories import DatabaseRepository


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Worker persistente do modulo analitico do Conecta Provas.")
    parser.add_argument("--once", action="store_true", help="Processa no maximo um job e encerra.")
    parser.add_argument("--poll-seconds", type=float, default=5.0, help="Intervalo quando a fila estiver vazia.")
    parser.add_argument("--backfill", action="store_true", help="Enfileira resultados oficiais existentes antes de processar.")
    parser.add_argument("--process-id", default="", help="Restringe o backfill a um processo/ref.")
    parser.add_argument("--batch-size", type=int, default=500, help="Limite do backfill por execucao.")
    parser.add_argument("--retry-failed", action="store_true", help="Reabre, em lote, jobs falhos/cancelados para nova tentativa operacional.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    repository = DatabaseRepository(get_settings())
    worker_id = f"{socket.gethostname()}:exam-analytics"
    if args.backfill:
        created = repository.backfill_exam_analytics(process_id=args.process_id, batch_size=args.batch_size)
        logging.info("Backfill enfileirou %s job(s).", created)
    if args.retry_failed:
        retried = repository.retry_failed_exam_analytics(process_id=args.process_id, batch_size=args.batch_size)
        logging.info("Reprocessamento reabriu %s job(s).", retried)
    while True:
        job = repository.reserve_exam_analytics_job(worker_id=worker_id)
        if not job:
            if args.once:
                return 0
            time.sleep(max(0.5, min(args.poll_seconds, 60.0)))
            continue
        try:
            repository.process_exam_analytics_job(job)
            logging.info("Job %s concluido para a prova %s.", job["id_job"], job["id_prova"])
        except Exception:
            logging.exception("Job %s falhou; backoff persistido.", job["id_job"])
        if args.once:
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
