from fastapi import APIRouter, Response, status
from sqlalchemy import text

from database import SessionLocal

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def live():
    return {"status": "ok", "service": "buildshop-api"}


@router.get("/ready")
def ready(response: Response):
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "database": "error"}
    finally:
        db.close()


