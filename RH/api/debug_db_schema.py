from __future__ import annotations

import json
import sys
from pathlib import Path


API_DIR = Path(__file__).resolve().parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from rh_api.config import get_settings
from rh_api.repositories import DatabaseRepository


def main() -> int:
    settings = get_settings()
    repository = DatabaseRepository(settings)
    payload = repository.get_history_columns()
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
