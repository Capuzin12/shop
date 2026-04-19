#!/usr/bin/env python
"""
BuildShop Database Initialization Script for Supabase
Creates all tables in the Supabase PostgreSQL database.

Usage:
    cd server && python ../scripts/init_supabase.py

Requirements:
    - DATABASE_URL у змінних оточення або у файлі server/.env (рядок DATABASE_URL=...)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add server directory to path
server_dir = Path(__file__).resolve().parent.parent / "server"
sys.path.insert(0, str(server_dir))


def _load_server_dotenv() -> None:
    """Підхопити server/.env, якщо змінна ще не задана в оболонці (не перезаписуємо існуюче os.environ)."""
    path = server_dir / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, rest = line.partition("=")
        key = key.strip()
        if not key:
            continue
        val = rest.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        if key not in os.environ:
            os.environ[key] = val


_load_server_dotenv()

from urllib.parse import urlparse

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

# Get database URL from environment (після підвантаження server/.env)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL is not set")
    print("Додайте рядок DATABASE_URL=... у server/.env або виконайте:")
    print('  $env:DATABASE_URL = "postgresql+psycopg://..."')
    print("Приклад: postgresql+psycopg://postgres.xxx:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require")
    sys.exit(1)


def create_tables():
    """Create all database tables using SQLAlchemy models."""
    from models import Base

    import models  # noqa: F401 — реєструє всі таблиці на Base.metadata

    host = urlparse(DATABASE_URL.replace("postgresql+psycopg", "postgresql", 1)).hostname
    print(f"Connecting to database host: {host or '(unknown)'}")
    
    engine = create_engine(DATABASE_URL, echo=True)
    
    try:
        with engine.connect() as conn:
            # Test connection
            conn.execute(text("SELECT 1"))
            print("OK: database connection successful")
    except OperationalError as e:
        print(f"ERROR: Could not connect to database: {e}")
        sys.exit(1)
    
    print("Creating tables...")
    
    # Create all tables
    Base.metadata.create_all(engine)
    
    print("OK: all tables created successfully")
    
    # Verify tables
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """))
        tables = [row[0] for row in result]
        
        print(f"\nTables created: {len(tables)}")
        for table in tables:
            print(f"  - {table}")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Initialize BuildShop database on Supabase"
    )
    parser.add_argument(
        "--drop",
        action="store_true",
        help="Drop all tables before creating (WARNING: loses all data)"
    )
    args = parser.parse_args()
    
    if args.drop:
        confirm = input("WARNING: This will delete all data. Type 'yes' to confirm: ")
        if confirm.lower() != "yes":
            print("Cancelled")
            sys.exit(0)
        
        print("Dropping tables...")
        from models import Base

        import models  # noqa: F401

        engine = create_engine(DATABASE_URL)
        Base.metadata.drop_all(engine)
        print("OK: tables dropped")
    
    create_tables()
    
    print("\nOK: database initialization complete!")
    print("\nNext steps:")
    print("1. Run: alembic upgrade head  (to apply migrations)")
    print("2. Run: python seed.py (to add sample data)")


if __name__ == "__main__":
    main()