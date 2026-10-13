#!/usr/bin/env python3
"""下載一份 PDF，用 fetch-trustee-fact-sheets.py 同一套瀏覽器指紋（chrome124，403 再試 chrome150）。

用法：python3 scripts/download-pdf-impersonated.py <https-url> <output-path>
成功印出「bytes sha256」；失敗以非零退出碼結束（唔留低殘檔）。
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "fetch_trustee_fact_sheets", Path(__file__).with_name("fetch-trustee-fact-sheets.py")
)
assert SPEC and SPEC.loader
fetcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetcher)


def main() -> int:
    if len(sys.argv) != 3 or not sys.argv[1].startswith("https://"):
        print("用法：download-pdf-impersonated.py <https-url> <output-path>", file=sys.stderr)
        return 2
    try:
        size, sha256 = fetcher.download_pdf(sys.argv[1], Path(sys.argv[2]))
    except Exception as error:  # noqa: BLE001 — 失敗原因交由呼叫者記錄
        print(fetcher._safe_error(error), file=sys.stderr)
        return 1
    print(size, sha256)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
