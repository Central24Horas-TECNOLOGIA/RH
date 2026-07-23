from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "apps" / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from rh_api.workers.exam_analytics import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main())
