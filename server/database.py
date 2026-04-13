from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'app.db'}"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=False
)

# Ensure UTF-8 encoding for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA encoding='UTF-8'")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
