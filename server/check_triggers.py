from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    result = db.execute(text("SELECT name FROM sqlite_master WHERE type='trigger';")).fetchall()
    print('Triggers:', [r[0] for r in result])
finally:
    db.close()
