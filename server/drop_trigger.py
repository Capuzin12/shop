from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    db.execute(text("DROP TRIGGER IF EXISTS trg_sale_movement;"))
    db.commit()
    print("Trigger trg_sale_movement dropped successfully")
    
    # Check remaining triggers
    result = db.execute(text("SELECT name FROM sqlite_master WHERE type='trigger';")).fetchall()
    print('Remaining triggers:', [r[0] for r in result])
finally:
    db.close()
