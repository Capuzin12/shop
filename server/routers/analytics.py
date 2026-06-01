from datetime import datetime, timedelta, date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from config import settings
from logging_config import get_logger
from routers.deps import get_db, get_current_staff_user
from models import UserRole

router = APIRouter(prefix="/api/admin/analytics", tags=["admin", "analytics"])
logger = get_logger(__name__)


def _date_filter_sql(days: int, db_url: str) -> str:
    # Return SQL expression usable in WHERE created_at >= <expr>
    if db_url.startswith("sqlite"):
        return f"datetime('now', '-{days} days')"
    return f"NOW() - INTERVAL '{days} days'"


def _month_window(reference: datetime, offset_months: int = 0) -> tuple[date, date]:
    year = reference.year + ((reference.month - 1 + offset_months) // 12)
    month = ((reference.month - 1 + offset_months) % 12) + 1
    start = date(year, month, 1)
    if month == 12:
        next_start = date(year + 1, 1, 1)
    else:
        next_start = date(year, month + 1, 1)
    end = next_start - timedelta(days=1)
    return start, end


def _ratio(numerator: int | float, denominator: int | float) -> float:
    try:
        denominator_value = float(denominator or 0)
        if denominator_value == 0:
            return 0.0
        return round((float(numerator or 0) / denominator_value) * 100.0, 2)
    except Exception:
        return 0.0


def _resolve_period_range(period: str, date_from: str | None = None, date_to: str | None = None) -> tuple[datetime, datetime]:
    now = datetime.utcnow()
    if period == "custom" and date_from and date_to:
        try:
            start = datetime.fromisoformat(date_from)
            end = datetime.fromisoformat(date_to)
            return start, end
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid custom date_from/date_to format; use ISO format YYYY-MM-DD") from exc

    days = 30
    if period.endswith("d"):
        try:
            days = int(period[:-1])
        except Exception:
            days = 30
    elif period in {"365d", "1y", "year"}:
        days = 365
    return now - timedelta(days=days), now


def get_current_admin_or_manager(current_user=Depends(get_current_staff_user)):
    if current_user.role not in (UserRole.admin, UserRole.manager):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


@router.get("/overview")
def analytics_overview(db: Annotated[Session, Depends(get_db)], current_user=Depends(get_current_admin_or_manager)):
    now = datetime.utcnow()
    current_start, current_end = _month_window(now, 0)
    previous_start, previous_end = _month_window(now, -1)

    def month_sum(table: str, column: str, start: date, end: date, where_sql: str = "1=1") -> float:
        return float(db.scalar(text(f"SELECT COALESCE(SUM({column}),0) FROM {table} WHERE {where_sql} AND DATE(created_at) BETWEEN :start_date AND :end_date"), {"start_date": start.isoformat(), "end_date": end.isoformat()}) or 0)

    def month_count(table: str, start: date, end: date, where_sql: str = "1=1") -> int:
        return int(db.scalar(text(f"SELECT COUNT(*) FROM {table} WHERE {where_sql} AND DATE(created_at) BETWEEN :start_date AND :end_date"), {"start_date": start.isoformat(), "end_date": end.isoformat()}) or 0)

    fulfilled_where = "status IN ('delivered','picked_up')"

    # Revenue totals
    total_revenue = db.scalar(text("SELECT COALESCE(SUM(total),0) FROM orders")) or 0
    paid_revenue = db.scalar(text("SELECT COALESCE(SUM(total),0) FROM orders WHERE status IN ('delivered','picked_up')")) or 0
    current_month_revenue = month_sum("orders", "total", current_start, current_end, fulfilled_where)
    previous_month_revenue = month_sum("orders", "total", previous_start, previous_end, fulfilled_where)
    growth_percent = _ratio(current_month_revenue - previous_month_revenue, previous_month_revenue) if previous_month_revenue else 0.0

    # Orders
    orders_total = db.scalar(text("SELECT COUNT(*) FROM orders")) or 0
    orders_this_month = month_count("orders", current_start, current_end)
    orders_last_month = month_count("orders", previous_start, previous_end)
    avg_order_value = db.scalar(text("SELECT COALESCE(AVG(total),0) FROM orders")) or 0
    current_avg_order_value = current_month_revenue / orders_this_month if orders_this_month else 0.0
    previous_avg_order_value = previous_month_revenue / orders_last_month if orders_last_month else 0.0
    conversion_rate = _ratio(db.scalar(text("SELECT COUNT(*) FROM orders WHERE status IN ('delivered','picked_up')")) or 0, orders_total)
    current_conversion_rate = _ratio(month_count("orders", current_start, current_end, fulfilled_where), orders_this_month)
    previous_conversion_rate = _ratio(month_count("orders", previous_start, previous_end, fulfilled_where), orders_last_month)

    status_rows = db.execute(text("SELECT COALESCE(status,'new') as status, COUNT(*) as count FROM orders GROUP BY COALESCE(status,'new')")).mappings().all()
    by_status = {row['status']: int(row['count']) for row in status_rows}

    # Products
    products_total = db.scalar(text("SELECT COUNT(*) FROM products")) or 0
    products_active = db.scalar(text("SELECT COUNT(*) FROM products WHERE is_active IS TRUE")) or 0
    low_stock_count = db.scalar(text("SELECT COUNT(*) FROM inventory WHERE COALESCE(quantity,0) < COALESCE(min_quantity, min_quantity_alert, 0)")) or 0
    out_of_stock_count = db.scalar(text("SELECT COUNT(*) FROM inventory WHERE COALESCE(quantity,0) <= 0")) or 0

    # Users
    users_total = db.scalar(text("SELECT COUNT(*) FROM users")) or 0
    new_this_month = month_count("users", current_start, current_end)
    new_last_month = month_count("users", previous_start, previous_end)
    user_growth = _ratio(new_this_month - new_last_month, new_last_month) if new_last_month else 0.0

    comparison = {
        "current_month": {
            "label": current_start.strftime("%m.%Y"),
            "revenue": float(current_month_revenue),
            "orders": int(orders_this_month),
            "fulfilled_orders": int(month_count("orders", current_start, current_end, fulfilled_where)),
            "avg_order_value": float(current_avg_order_value),
            "conversion_rate": float(current_conversion_rate),
            "new_users": int(new_this_month),
        },
        "previous_month": {
            "label": previous_start.strftime("%m.%Y"),
            "revenue": float(previous_month_revenue),
            "orders": int(orders_last_month),
            "fulfilled_orders": int(month_count("orders", previous_start, previous_end, fulfilled_where)),
            "avg_order_value": float(previous_avg_order_value),
            "conversion_rate": float(previous_conversion_rate),
            "new_users": int(new_last_month),
        },
    }

    return {
        "revenue": {
            "total": float(total_revenue),
            "paid": float(paid_revenue),
            "this_month": float(current_month_revenue),
            "last_month": float(previous_month_revenue),
            "growth_percent": round(float(growth_percent), 2),
        },
        "orders": {
            "total": int(orders_total),
            "this_month": int(orders_this_month),
            "last_month": int(orders_last_month),
            "avg_order_value": float(avg_order_value),
            "conversion_rate_percent": float(conversion_rate),
            "current_month_conversion_rate_percent": float(current_conversion_rate),
            "previous_month_conversion_rate_percent": float(previous_conversion_rate),
            "by_status": by_status,
        },
        "products": {
            "total": int(products_total),
            "active": int(products_active),
            "low_stock_count": int(low_stock_count),
            "out_of_stock_count": int(out_of_stock_count),
        },
        "users": {
            "total": int(users_total),
            "new_this_month": int(new_this_month),
            "new_last_month": int(new_last_month),
            "growth_percent": round(float(user_growth), 2),
        },
        "comparison": comparison,
    }


@router.get("/revenue")
def revenue_trend(period: str = Query('30d'), date_from: str | None = None, date_to: str | None = None, db: Annotated[Session, Depends(get_db)] = None, current_user=Depends(get_current_admin_or_manager)):
    start, end = _resolve_period_range(period, date_from, date_to)

    # Use simple date aggregation by date (works in both SQLite and Postgres)
    stmt = text("""
        SELECT DATE(created_at) AS day, COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders_count
        FROM orders
        WHERE status IN ('delivered','picked_up') AND DATE(created_at) BETWEEN :start_date AND :end_date
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
    """)
    params = {"start_date": start.date().isoformat(), "end_date": end.date().isoformat()}
    rows = db.execute(stmt, params).mappings().all()
    labels = [row['day'].isoformat() if hasattr(row['day'], 'isoformat') else str(row['day']) for row in rows]
    revenue = [float(row['revenue']) for row in rows]
    orders_count = [int(row['orders_count']) for row in rows]
    return {"labels": labels, "revenue": revenue, "orders_count": orders_count, "period": period}


@router.get('/inventory-movements')
def inventory_movements_analytics(
    period: str = Query('30d'),
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 20,
    db: Annotated[Session, Depends(get_db)] = None,
    current_user=Depends(get_current_admin_or_manager),
):
    start, end = _resolve_period_range(period, date_from, date_to)
    params = {"start_date": start.date().isoformat(), "end_date": end.date().isoformat()}
    capped_limit = min(max(limit, 1), 100)

    totals_row = db.execute(text("""
        SELECT
            COUNT(*) AS total_movements,
            COALESCE(SUM(quantity), 0) AS net_change,
            COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS incoming_quantity,
            COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END), 0) AS outgoing_quantity
        FROM inventory_movements
        WHERE DATE(created_at) BETWEEN :start_date AND :end_date
    """), params).mappings().first() or {}

    type_rows = db.execute(text("""
        SELECT
            COALESCE(type, 'adjustment') AS type,
            COUNT(*) AS total_movements,
            COALESCE(SUM(quantity), 0) AS net_change,
            COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS incoming_quantity,
            COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END), 0) AS outgoing_quantity
        FROM inventory_movements
        WHERE DATE(created_at) BETWEEN :start_date AND :end_date
        GROUP BY COALESCE(type, 'adjustment')
        ORDER BY total_movements DESC, type ASC
    """), params).mappings().all()

    daily_rows = db.execute(text("""
        SELECT
            DATE(created_at) AS day,
            COUNT(*) AS total_movements,
            COALESCE(SUM(quantity), 0) AS net_change
        FROM inventory_movements
        WHERE DATE(created_at) BETWEEN :start_date AND :end_date
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
    """), params).mappings().all()

    recent_rows = db.execute(text("""
        SELECT
            m.id,
            m.type,
            m.quantity,
            m.quantity_before,
            m.quantity_after,
            m.note,
            m.created_at,
            p.name AS product_name,
            p.sku AS product_sku,
            u.first_name AS created_by_first_name,
            u.last_name AS created_by_last_name,
            so.invoice_number AS supply_invoice_number,
            so.id AS supply_order_id,
            o.id AS order_id
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
        LEFT JOIN users u ON u.id = m.created_by
        LEFT JOIN supply_orders so ON so.id = m.supply_order_id
        LEFT JOIN orders o ON o.id = m.order_id
        WHERE DATE(m.created_at) BETWEEN :start_date AND :end_date
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT :limit
    """), {**params, "limit": capped_limit}).mappings().all()

    def _source_label(row) -> str:
        if row.get("order_id") is not None:
            return f"Замовлення #{row['order_id']}"
        if row.get("supply_order_id") is not None:
            invoice = row.get("supply_invoice_number")
            return f"Поставка {invoice}" if invoice else f"Поставка #{row['supply_order_id']}"
        return "Ручне коригування"

    items = []
    for row in recent_rows:
        created_by_name = f"{row['created_by_first_name'] or ''} {row['created_by_last_name'] or ''}".strip() or "Система"
        items.append({
            "id": int(row["id"]),
            "type": row["type"].value if hasattr(row["type"], "value") else str(row["type"]),
            "quantity": int(row["quantity"] or 0),
            "quantity_before": int(row["quantity_before"] or 0),
            "quantity_after": int(row["quantity_after"] or 0),
            "note": row["note"],
            "product_name": row["product_name"],
            "product_sku": row["product_sku"],
            "created_by_name": created_by_name,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "source": _source_label(row),
        })

    return {
        "period": period,
        "total_movements": int(totals_row.get("total_movements") or 0),
        "net_change": int(totals_row.get("net_change") or 0),
        "incoming_quantity": int(totals_row.get("incoming_quantity") or 0),
        "outgoing_quantity": int(totals_row.get("outgoing_quantity") or 0),
        "by_type": {
            row["type"]: {
                "total_movements": int(row["total_movements"] or 0),
                "net_change": int(row["net_change"] or 0),
                "incoming_quantity": int(row["incoming_quantity"] or 0),
                "outgoing_quantity": int(row["outgoing_quantity"] or 0),
            }
            for row in type_rows
        },
        "labels": [
            row["day"].isoformat() if hasattr(row["day"], "isoformat") else str(row["day"])
            for row in daily_rows
        ],
        "net_change_series": [int(row["net_change"] or 0) for row in daily_rows],
        "movements_count": [int(row["total_movements"] or 0) for row in daily_rows],
        "items": items,
    }


@router.get('/top-products')
def top_products(limit: int = 10, period: str = '30d', db: Annotated[Session, Depends(get_db)] = None, current_user=Depends(get_current_admin_or_manager)):
    days = 30
    if period.endswith('d'):
        try:
            days = int(period[:-1])
        except Exception:
            days = 30
    date_expr = _date_filter_sql(days, settings.database_url)
    # PostgreSQL/SQLite compatible query using DATE(created_at)
    stmt = text(f"""
        SELECT p.id AS product_id, p.name AS product_name, p.sku, SUM(oi.quantity) AS total_sold_qty,
               SUM(oi.quantity * oi.unit_price) AS total_revenue, COUNT(DISTINCT o.id) AS orders_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.status IN ('delivered','picked_up') AND DATE(o.created_at) >= :since
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_revenue DESC
        LIMIT :limit
    """
    )
    since = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
    rows = db.execute(stmt, {"since": since, "limit": limit}).mappings().all()
    items = [
        {
            "product_id": int(r['product_id']),
            "product_name": r['product_name'],
            "sku": r['sku'],
            "total_sold_qty": int(r['total_sold_qty'] or 0),
            "total_revenue": float(r['total_revenue'] or 0.0),
            "orders_count": int(r['orders_count'] or 0),
        }
        for r in rows
    ]
    return {"items": items}


@router.get('/top-categories')
def top_categories(limit: int = 10, period: str = '30d', db: Annotated[Session, Depends(get_db)] = None, current_user=Depends(get_current_admin_or_manager)):
    days = 30
    if period.endswith('d'):
        try:
            days = int(period[:-1])
        except Exception:
            days = 30
    since = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
    stmt = text(f"""
        SELECT c.id AS category_id, c.name AS category_name, SUM(oi.quantity) AS total_sold_qty,
               SUM(oi.quantity * oi.unit_price) AS total_revenue, COUNT(DISTINCT o.id) AS orders_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE o.status IN ('delivered','picked_up') AND DATE(o.created_at) >= :since
        GROUP BY c.id, c.name
        ORDER BY total_revenue DESC
        LIMIT :limit
    """
    )
    rows = db.execute(stmt, {"since": since, "limit": limit}).mappings().all()
    items = [
        {
            "category_id": int(r['category_id']) if r['category_id'] is not None else None,
            "category_name": r['category_name'],
            "total_sold_qty": int(r['total_sold_qty'] or 0),
            "total_revenue": float(r['total_revenue'] or 0.0),
            "orders_count": int(r['orders_count'] or 0),
        }
        for r in rows
    ]
    return {"items": items}


@router.get('/customers')
def customers_analytics(period: str = '30d', db: Annotated[Session, Depends(get_db)] = None, current_user=Depends(get_current_admin_or_manager)):
    days = 30
    if period.endswith('d'):
        try:
            days = int(period[:-1])
        except Exception:
            days = 30
    since = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
    total_customers = db.scalar(text("SELECT COUNT(*) FROM users")) or 0
    new_this_period = db.scalar(text("SELECT COUNT(DISTINCT u.id) FROM users u WHERE DATE(u.created_at) >= :since"), {"since": since}) or 0

    # returning rate: users who placed >1 orders in period divided by users who placed any order
    returning_q = text("""
        SELECT
          SUM(CASE WHEN c.cnt > 1 THEN 1 ELSE 0 END) * 1.0 / NULLIF(SUM(CASE WHEN c.cnt >= 1 THEN 1 ELSE 0 END),0) * 100.0 as returning_rate
        FROM (
          SELECT user_id, COUNT(*) as cnt FROM orders WHERE DATE(created_at) >= :since AND status IN ('delivered','picked_up') GROUP BY user_id
        ) c
    """)
    returning_rate = db.scalar(returning_q, {"since": since}) or 0.0

    avg_orders = db.scalar(text("SELECT COALESCE(AVG(cnt),0) FROM (SELECT COUNT(*) as cnt FROM orders WHERE status IN ('delivered','picked_up') GROUP BY user_id) sub")) or 0

    top_customers_q = text("""
        SELECT u.id AS user_id,
               COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), u.email) AS name,
               COUNT(o.id) AS orders_count,
               COALESCE(SUM(o.total),0) AS total_spent
        FROM users u
        JOIN orders o ON o.user_id = u.id
        WHERE o.status IN ('delivered','picked_up') AND DATE(o.created_at) >= :since
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY total_spent DESC
        LIMIT 10
    """)
    top_rows = db.execute(top_customers_q, {"since": since}).mappings().all()
    top_customers = [{"user_id": int(r['user_id']), "name": r['name'], "orders_count": int(r['orders_count']), "total_spent": float(r['total_spent'])} for r in top_rows]

    return {
        "total": int(total_customers),
        "new_this_period": int(new_this_period),
        "returning_rate_percent": float(returning_rate) if returning_rate is not None else 0.0,
        "avg_orders_per_customer": float(avg_orders),
        "top_customers": top_customers,
    }


@router.get('/inventory-health')
def inventory_health(db: Annotated[Session, Depends(get_db)] = None, current_user=Depends(get_current_admin_or_manager)):
    rows = db.execute(text("""
        SELECT i.id, i.product_id, COALESCE(i.quantity,0) AS quantity, COALESCE(i.min_quantity_alert, i.min_quantity, 0) AS threshold,
               p.name AS name, p.sku AS sku
        FROM inventory i
        LEFT JOIN products p ON p.id = i.product_id
        ORDER BY COALESCE(i.quantity,0) ASC
    """)).mappings().all()
    total_sku = len(rows)
    in_stock = sum(1 for r in rows if int(r['quantity'] or 0) > 0)
    low_stock = sum(1 for r in rows if int(r['quantity'] or 0) < int(r['threshold'] or 0))
    out_of_stock = sum(1 for r in rows if int(r['quantity'] or 0) <= 0)
    total_units = sum(int(r['quantity'] or 0) for r in rows)
    critical_items = [
        {"product_id": int(r['product_id']) if r['product_id'] is not None else None, "name": r['name'], "sku": r['sku'], "quantity": int(r['quantity'] or 0), "threshold": int(r['threshold'] or 0)}
        for r in rows if int(r['quantity'] or 0) < int(r['threshold'] or 0)
    ]
    since = (datetime.utcnow() - timedelta(days=30)).date().isoformat()
    problematic_rows = db.execute(text("""
        SELECT
            p.id AS product_id,
            p.name,
            p.sku,
            COUNT(*) AS low_stock_hits,
            MAX(m.created_at) AS last_low_stock_at,
            MIN(m.quantity_after) AS lowest_quantity_after,
            COALESCE(i.quantity, 0) AS current_quantity,
            COALESCE(i.min_quantity_alert, i.min_quantity, 0) AS threshold
        FROM inventory_movements m
        JOIN inventory i ON i.product_id = m.product_id
        JOIN products p ON p.id = m.product_id
        WHERE DATE(m.created_at) >= :since
          AND m.quantity_after < COALESCE(i.min_quantity_alert, i.min_quantity, 0)
        GROUP BY p.id, p.name, p.sku, i.quantity, i.min_quantity_alert, i.min_quantity
        ORDER BY low_stock_hits DESC, last_low_stock_at DESC
        LIMIT 10
    """), {"since": since}).mappings().all()
    anomaly_rows = db.execute(text("""
        SELECT
            p.id AS product_id,
            p.name,
            p.sku,
            COUNT(*) AS anomaly_count,
            SUM(CASE WHEN m.type = 'write_off' THEN 1 ELSE 0 END) AS write_off_count,
            SUM(CASE WHEN m.type = 'adjustment' THEN 1 ELSE 0 END) AS adjustment_count,
            SUM(CASE WHEN ABS(m.quantity) >= 20 THEN 1 ELSE 0 END) AS large_delta_count,
            MAX(m.created_at) AS last_anomaly_at,
            MAX(ABS(m.quantity)) AS max_delta
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
        WHERE DATE(m.created_at) >= :since
          AND (m.type IN ('adjustment', 'write_off') OR ABS(m.quantity) >= 20)
        GROUP BY p.id, p.name, p.sku
        ORDER BY anomaly_count DESC, large_delta_count DESC, last_anomaly_at DESC
        LIMIT 10
    """), {"since": since}).mappings().all()
    return {
        "total_sku": int(total_sku),
        "in_stock": int(in_stock),
        "low_stock": int(low_stock),
        "out_of_stock": int(out_of_stock),
        "total_units": int(total_units),
        "critical_items": critical_items,
        "problematic_items": [
            {
                "product_id": int(r["product_id"]) if r["product_id"] is not None else None,
                "name": r["name"],
                "sku": r["sku"],
                "low_stock_hits": int(r["low_stock_hits"] or 0),
                "last_low_stock_at": r["last_low_stock_at"].isoformat() if r["last_low_stock_at"] else None,
                "lowest_quantity_after": int(r["lowest_quantity_after"] or 0),
                "current_quantity": int(r["current_quantity"] or 0),
                "threshold": int(r["threshold"] or 0),
            }
            for r in problematic_rows
        ],
        "anomaly_items": [
            {
                "product_id": int(r["product_id"]) if r["product_id"] is not None else None,
                "name": r["name"],
                "sku": r["sku"],
                "anomaly_count": int(r["anomaly_count"] or 0),
                "write_off_count": int(r["write_off_count"] or 0),
                "adjustment_count": int(r["adjustment_count"] or 0),
                "large_delta_count": int(r["large_delta_count"] or 0),
                "last_anomaly_at": r["last_anomaly_at"].isoformat() if r["last_anomaly_at"] else None,
                "max_delta": int(r["max_delta"] or 0),
            }
            for r in anomaly_rows
        ],
    }



