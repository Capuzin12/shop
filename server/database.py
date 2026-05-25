from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from config import settings

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SQLITE_URL = f"sqlite:///{BASE_DIR / 'app.db'}"
DATABASE_URL = settings.database_url or DEFAULT_SQLITE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL, 
    connect_args=connect_args,
    echo=False
)

# Ensure UTF-8 encoding for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    if not DATABASE_URL.startswith("sqlite"):
        return
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA encoding='UTF-8'")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
