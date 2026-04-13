"""
Створює SQLite app.db з server/schema.sql (коректний порядок FK для SQLite).
Запуск з каталогу server: python init_db.py [--force] [--seed]
"""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "app.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def main() -> None:
    parser = argparse.ArgumentParser(description="Ініціалізація БД BuildShop з schema.sql")
    parser.add_argument("--force", action="store_true", help="Видалити існуючий app.db перед створенням")
    parser.add_argument("--seed", action="store_true", help="Після схеми заповнити тестовими даними (seed.py)")
    args = parser.parse_args()

    if DB_PATH.exists():
        if not args.force:
            print(f"Файл {DB_PATH} вже існує. Додай --force або видали файл вручну.")
            raise SystemExit(1)
        DB_PATH.unlink()

    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.executescript(sql)
        conn.commit()
    finally:
        conn.close()

    print(f"OK: створено {DB_PATH}")

    if args.seed:
        from seed import run_seed

        run_seed()


if __name__ == "__main__":
    main()
