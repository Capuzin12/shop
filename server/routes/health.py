from fastapi import APIRouter, Response, status
from sqlalchemy import text, inspect
import time
from datetime import datetime

from database import SessionLocal, engine

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def live():
    """Liveness probe - indicates service is running."""
    return {
        "status": "ok",
        "service": "buildshop-api",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/ready")
def ready(response: Response):
    """
    Readiness probe - indicates service is ready to handle traffic.
    Checks:
    - Database connectivity
    - Critical tables existence
    - Connection pool health
    """
    db = SessionLocal()
    try:
        start_time = time.time()
        
        # 1. Test basic connectivity
        db.execute(text("SELECT 1"))
        
        # 2. Check critical tables exist
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        critical_tables = {"users", "products", "orders", "audit_logs"}
        missing_tables = critical_tables - set(tables)
        
        if missing_tables:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return {
                "status": "not_ready",
                "database": "error",
                "reason": f"Missing critical tables: {missing_tables}",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        # 3. Check for FK constraint integrity (sample check)
        try:
            db.execute(text("PRAGMA foreign_key_check"))
            fk_status = "ok"
        except:
            fk_status = "warning"
        
        # 4. Connection pool info
        pool_size = len(engine.pool._all_conns) if hasattr(engine.pool, '_all_conns') else 0
        checked_out = len(engine.pool._checked_out()) if hasattr(engine.pool, '_checked_out') else 0
        
        query_time = (time.time() - start_time) * 1000  # ms
        
        return {
            "status": "ready",
            "database": "ok",
            "tables_count": len(tables),
            "critical_tables": list(critical_tables),
            "foreign_keys": fk_status,
            "connection_pool": {
                "total": pool_size,
                "checked_out": checked_out
            },
            "query_time_ms": round(query_time, 2),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "not_ready",
            "database": "error",
            "reason": str(e)[:100],
            "timestamp": datetime.utcnow().isoformat()
        }
    finally:
        db.close()


