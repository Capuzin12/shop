from __future__ import annotations

from datetime import datetime, timedelta
from io import BytesIO
import logging
from pathlib import Path
from typing import Any

from config import settings
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

ORDER_STATUS_LABELS = {
    "new": "Нове",
    "processing": "В обробці",
    "shipped": "Відправлено",
    "delivered": "Доставлено",
    "picked_up": "Забрано",
    "cancelled": "Скасовано",
    "refunded": "Повернено",
}


REPORT_FONT_CANDIDATES = [
    settings.report_font_path.strip(), str(Path("C:/Windows/Fonts/segoeui.ttf")),
    str(Path("C:/Windows/Fonts/arialuni.ttf")), str(Path("C:/Windows/Fonts/arial.ttf")),
    str(Path(__file__).resolve().parent / "fonts" / "DejaVuSans.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]

PDF_REQUIRED_GLYPHS = "АБВГДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгдеєжзиіїйклмнопрстуфхцчшщьюяҐґ"


def _safe_money(value) -> str:
    try:
        return f"{float(value or 0):,.2f}".replace(",", " ")
    except (TypeError, ValueError):
        return "0.00"


def _safe_int(value, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _status_label(status_value: str) -> str:
    return ORDER_STATUS_LABELS.get(str(status_value or "new"), str(status_value or "new"))


def _movement_label(movement_type: Any) -> str:
    labels = {
        "receipt": "Прийом",
        "sale": "Продаж",
        "return": "Повернення",
        "return_": "Повернення",
        "adjustment": "Коригування",
        "write_off": "Списання",
    }
    return labels.get(str(movement_type or "adjustment"), str(movement_type or "adjustment"))


def _month_window(reference: datetime, offset_months: int = 0) -> tuple[datetime, datetime]:
    year = reference.year + ((reference.month - 1 + offset_months) // 12)
    month = ((reference.month - 1 + offset_months) % 12) + 1
    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = datetime(year, month + 1, 1) - timedelta(days=1)
    return start, end


def _percent_change(current: float | int, previous: float | int) -> float:
    try:
        previous_value = float(previous or 0)
        if previous_value == 0:
            return 0.0
        return round(((float(current or 0) - previous_value) / previous_value) * 100.0, 2)
    except Exception:
        return 0.0


def _ratio(numerator: float | int, denominator: float | int) -> float:
    try:
        denominator_value = float(denominator or 0)
        if denominator_value == 0:
            return 0.0
        return round((float(numerator or 0) / denominator_value) * 100.0, 2)
    except Exception:
        return 0.0


def _month_label(dt_value: datetime) -> str:
    try:
        return dt_value.strftime("%m.%Y")
    except Exception:
        return "Період"


def _format_dt(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y %H:%M")
    text_value = str(value)
    if "T" in text_value:
        return text_value.replace("T", " ")[:16]
    return text_value[:16]


def _scalar_or_default(db: Session, statement, default=0, params: dict[str, Any] | None = None):
    try:
        return db.scalar(statement, params or {}) or default
    except SQLAlchemyError as error:
        logger.warning("report scalar query failed", extra={"error": str(error)})
        return default


def _rows_or_empty(db: Session, statement, params: dict[str, Any] | None = None):
    try:
        return db.execute(statement, params or {}).mappings().all()
    except SQLAlchemyError as error:
        logger.warning("report rows query failed", extra={"error": str(error)})
        return []


def collect_admin_report_data(db: Session) -> dict[str, Any]:
    generated_at = datetime.now()
    counts = {"categories": _scalar_or_default(db, text("SELECT COUNT(*) FROM categories"), 0), "products": _scalar_or_default(db, text("SELECT COUNT(*) FROM products"), 0), "orders": _scalar_or_default(db, text("SELECT COUNT(*) FROM orders"), 0), "users": _scalar_or_default(db, text("SELECT COUNT(*) FROM users"), 0)}
    current_start, current_end = _month_window(generated_at, 0)
    previous_start, previous_end = _month_window(generated_at, -1)
    current_start_date = current_start.date().isoformat()
    current_end_date = current_end.date().isoformat()
    previous_start_date = previous_start.date().isoformat()
    previous_end_date = previous_end.date().isoformat()
    fulfilled_where = "status IN ('delivered', 'picked_up')"

    inventory_rows = _rows_or_empty(db, text("""
        SELECT
            i.id,
            i.product_id,
            COALESCE(i.quantity, 0) AS quantity,
            COALESCE(i.min_quantity, 0) AS min_quantity,
            COALESCE(i.min_quantity_alert, i.min_quantity, 0) AS threshold,
            COALESCE(i.max_quantity, 0) AS max_quantity,
            COALESCE(i.location, '-') AS location,
            p.name AS product_name,
            p.sku AS product_sku
        FROM inventory i
        LEFT JOIN products p ON p.id = i.product_id
        ORDER BY COALESCE(i.quantity, 0) ASC, i.id ASC
    """))
    low_stock_rows = [row for row in inventory_rows if _safe_int(row["quantity"], 0) < _safe_int(row["threshold"], 0)]
    out_of_stock_rows = [row for row in inventory_rows if _safe_int(row["quantity"], 0) <= 0]
    total_stock_units = sum(max(_safe_int(row["quantity"], 0), 0) for row in inventory_rows)

    status_rows = _rows_or_empty(db, text("""
        SELECT COALESCE(status, 'new') AS status, COUNT(*) AS count
        FROM orders
        GROUP BY COALESCE(status, 'new')
        ORDER BY count DESC
    """))
    status_counts = [{"status": str(row["status"]), "label": _status_label(row["status"]), "count": _safe_int(row["count"], 0)} for row in status_rows]

    paid_revenue = _scalar_or_default(db, text("""
        SELECT COALESCE(SUM(total), 0)
        FROM orders
        WHERE status IN ('delivered', 'picked_up')
    """), 0)
    current_month_revenue = _scalar_or_default(db, text("""
        SELECT COALESCE(SUM(total), 0)
        FROM orders
        WHERE status IN ('delivered', 'picked_up') AND DATE(created_at) BETWEEN :start_date AND :end_date
    """), 0, {"start_date": current_start_date, "end_date": current_end_date})
    previous_month_revenue = _scalar_or_default(db, text("""
        SELECT COALESCE(SUM(total), 0)
        FROM orders
        WHERE status IN ('delivered', 'picked_up') AND DATE(created_at) BETWEEN :start_date AND :end_date
    """), 0, {"start_date": previous_start_date, "end_date": previous_end_date})
    current_month_orders = _scalar_or_default(db, text("""
        SELECT COUNT(*)
        FROM orders
        WHERE DATE(created_at) BETWEEN :start_date AND :end_date
    """), 0, {"start_date": current_start_date, "end_date": current_end_date})
    previous_month_orders = _scalar_or_default(db, text("""
        SELECT COUNT(*)
        FROM orders
        WHERE DATE(created_at) BETWEEN :start_date AND :end_date
    """), 0, {"start_date": previous_start_date, "end_date": previous_end_date})
    current_month_fulfilled = _scalar_or_default(db, text("""
        SELECT COUNT(*)
        FROM orders
        WHERE status IN ('delivered', 'picked_up') AND DATE(created_at) BETWEEN :start_date AND :end_date
    """), 0, {"start_date": current_start_date, "end_date": current_end_date})
    previous_month_fulfilled = _scalar_or_default(db, text("""
        SELECT COUNT(*)
        FROM orders
        WHERE status IN ('delivered', 'picked_up') AND DATE(created_at) BETWEEN :start_date AND :end_date
    """), 0, {"start_date": previous_start_date, "end_date": previous_end_date})
    current_month_users = _scalar_or_default(db, text("""
        SELECT COUNT(*)
        FROM users
        WHERE DATE(created_at) BETWEEN :start_date AND :end_date
    """), 0, {"start_date": current_start_date, "end_date": current_end_date})
    previous_month_users = _scalar_or_default(db, text("""
        SELECT COUNT(*)
        FROM users
        WHERE DATE(created_at) BETWEEN :start_date AND :end_date
    """), 0, {"start_date": previous_start_date, "end_date": previous_end_date})
    avg_order_value = float(paid_revenue or 0) / float(current_month_fulfilled or 0) if int(current_month_fulfilled or 0) > 0 else 0.0
    prev_avg_order_value = float(previous_month_revenue or 0) / float(previous_month_fulfilled or 0) if int(previous_month_fulfilled or 0) > 0 else 0.0
    conversion_rate = _percent_change(current_month_fulfilled, current_month_orders) if current_month_orders else 0.0
    prev_conversion_rate = _percent_change(previous_month_fulfilled, previous_month_orders) if previous_month_orders else 0.0
    comparison = {
        "current_month": {
            "label": _month_label(current_start),
            "revenue": float(current_month_revenue or 0),
            "orders": int(current_month_orders or 0),
            "fulfilled_orders": int(current_month_fulfilled or 0),
            "avg_order_value": float(avg_order_value),
            "conversion_rate": _ratio(current_month_fulfilled, current_month_orders),
            "new_users": int(current_month_users or 0),
        },
        "previous_month": {
            "label": _month_label(previous_start),
            "revenue": float(previous_month_revenue or 0),
            "orders": int(previous_month_orders or 0),
            "fulfilled_orders": int(previous_month_fulfilled or 0),
            "avg_order_value": float(prev_avg_order_value),
            "conversion_rate": _ratio(previous_month_fulfilled, previous_month_orders),
            "new_users": int(previous_month_users or 0),
        },
    }

    latest_orders = _rows_or_empty(db, text("""
        SELECT
            id,
            user_id,
            contact_name,
            contact_phone,
            contact_email,
            delivery_city,
            delivery_address,
            COALESCE(status, 'new') AS status,
            COALESCE(total, 0) AS total,
            created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 12
    """))

    top_products = _rows_or_empty(db, text("""
        SELECT
            id,
            name,
            sku,
            COALESCE(price, 0) AS price,
            CASE WHEN is_active IS TRUE THEN 1 ELSE 0 END AS is_active
        FROM products
        ORDER BY COALESCE(price, 0) DESC, id DESC
        LIMIT 10
    """))

    movement_since = (datetime.utcnow() - timedelta(days=30)).date().isoformat()
    inventory_movement_summary = _rows_or_empty(db, text("""
        SELECT
            COALESCE(type, 'adjustment') AS type,
            COUNT(*) AS total_movements,
            COALESCE(SUM(quantity), 0) AS net_change,
            COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS incoming_quantity,
            COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END), 0) AS outgoing_quantity
        FROM inventory_movements
        WHERE DATE(created_at) >= :since
        GROUP BY COALESCE(type, 'adjustment')
        ORDER BY total_movements DESC, type ASC
    """), {"since": movement_since})

    recent_inventory_movements = _rows_or_empty(db, text("""
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
        WHERE DATE(m.created_at) >= :since
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 12
    """), {"since": movement_since})

    def _movement_source_label(row: dict[str, Any]) -> str:
        if row.get("order_id") is not None:
            return f"Замовлення #{row['order_id']}"
        if row.get("supply_order_id") is not None:
            invoice = row.get("supply_invoice_number")
            return f"Поставка {invoice}" if invoice else f"Поставка #{row['supply_order_id']}"
        return "Ручне коригування"

    inventory_movement_rows = []
    for row in recent_inventory_movements:
        created_by_name = f"{row['created_by_first_name'] or ''} {row['created_by_last_name'] or ''}".strip() or "Система"
        inventory_movement_rows.append({
            "id": _safe_int(row.get("id"), 0),
            "type": str(row.get("type") or "adjustment"),
            "quantity": _safe_int(row.get("quantity"), 0),
            "quantity_before": _safe_int(row.get("quantity_before"), 0),
            "quantity_after": _safe_int(row.get("quantity_after"), 0),
            "note": row.get("note"),
            "created_at": row.get("created_at"),
            "product_name": row.get("product_name"),
            "product_sku": row.get("product_sku"),
            "created_by_name": created_by_name,
            "source": _movement_source_label(row),
        })

    # Revenue trend (last 30 days)
    try:
        days = 30
        start_date = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
        revenue_trend = db.execute(text("""
            SELECT DATE(created_at) as day,
                   COALESCE(SUM(total), 0) as revenue,
                   COUNT(*) as orders_count
            FROM orders
            WHERE status IN ('delivered', 'picked_up') AND DATE(created_at) >= :since
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        """), {"since": start_date}).mappings().all()
    except Exception:
        # fallback simple query
        revenue_trend = _rows_or_empty(db, text("""
            SELECT DATE(created_at) as day,
                   COALESCE(SUM(total), 0) as revenue,
                   COUNT(*) as orders_count
            FROM orders
            WHERE status IN ('delivered', 'picked_up')
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        """))

    # Top 10 products by revenue
    top_products_revenue = _rows_or_empty(db, text("""
        SELECT p.id AS product_id, p.name, p.sku,
               SUM(oi.quantity) AS total_qty,
               SUM(oi.quantity * oi.unit_price) AS total_revenue,
               COUNT(DISTINCT o.id) AS orders_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.status IN ('delivered', 'picked_up')
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_revenue DESC
        LIMIT 10
    """))

    top_customers = _rows_or_empty(db, text("""
        SELECT
            u.id AS user_id,
            COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.email) AS name,
            COUNT(o.id) AS orders_count,
            COALESCE(SUM(o.total), 0) AS total_spent,
            CASE WHEN COUNT(o.id) > 0 THEN COALESCE(SUM(o.total), 0) / COUNT(o.id) ELSE 0 END AS avg_order_value
        FROM users u
        JOIN orders o ON o.user_id = u.id
        WHERE o.status IN ('delivered', 'picked_up') AND DATE(o.created_at) >= :since
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY total_spent DESC
        LIMIT 10
    """), {"since": movement_since})

    problematic_products = _rows_or_empty(db, text("""
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
    """), {"since": movement_since})

    inventory_anomalies = _rows_or_empty(db, text("""
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
    """), {"since": movement_since})

    # Customer stats: total distinct customers who ordered (delivered/picked_up)
    customer_stats_total = _scalar_or_default(db, text("""
        SELECT COUNT(DISTINCT user_id) FROM orders
        WHERE status IN ('delivered', 'picked_up')
    """), default=0)

    data = {
        "generated_at": generated_at,
        "counts": counts,
        "comparison": comparison,
        "current_month_revenue": float(current_month_revenue or 0),
        "previous_month_revenue": float(previous_month_revenue or 0),
        "current_month_orders": int(current_month_orders or 0),
        "previous_month_orders": int(previous_month_orders or 0),
        "current_month_fulfilled": int(current_month_fulfilled or 0),
        "previous_month_fulfilled": int(previous_month_fulfilled or 0),
        "current_month_users": int(current_month_users or 0),
        "previous_month_users": int(previous_month_users or 0),
        "avg_order_value": float(avg_order_value),
        "prev_avg_order_value": float(prev_avg_order_value),
        "total_stock_units": total_stock_units,
        "low_stock_rows": low_stock_rows,
        "out_of_stock_rows": out_of_stock_rows,
        "status_counts": status_counts,
        "paid_revenue": paid_revenue,
        "latest_orders": latest_orders,
        "top_products": top_products,
        "revenue_trend": revenue_trend,
        "top_products_revenue": top_products_revenue,
        "top_customers": top_customers,
        "problematic_products": problematic_products,
        "inventory_anomalies": inventory_anomalies,
        "customer_stats_total_orders_customers": customer_stats_total,
        "inventory_movement_summary": inventory_movement_summary,
        "inventory_movement_rows": inventory_movement_rows,
    }

    return data


def _resolve_pdf_font() -> str:
    for candidate in REPORT_FONT_CANDIDATES:
        path = Path(candidate)
        if not candidate or not path.exists():
            continue
        font_name = f"BuildShop-{path.stem}"
        try:
            font_obj = TTFont(font_name, str(path))
        except Exception as error:
            logger.warning("PDF font candidate failed to load", extra={"font_path": str(path), "error": str(error)})
            continue

        missing_chars = [ch for ch in PDF_REQUIRED_GLYPHS if ord(ch) not in font_obj.face.charToGlyph]
        if missing_chars:
            logger.warning("PDF font candidate skipped due to missing glyphs", extra={"font_path": str(path), "missing_count": len(missing_chars)})
            continue

        if font_name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(font_obj)
            try:
                registerFontFamily(font_name, normal=font_name, bold=font_name, italic=font_name, boldItalic=font_name)
            except Exception:  #nosec B110
                pass
        logger.info("PDF report font selected", extra={"font_name": font_name, "font_path": str(path)})
        return font_name
    raise RuntimeError("Unicode PDF font not found. Configure REPORT_FONT_PATH or install DejaVu fonts (e.g., apt-get install fonts-dejavu-core).")


def _make_paragraph_style(font_name: str, size: int = 9, bold: bool = False, alignment: int | None = None):
    return ParagraphStyle(
        name=f"Report-{font_name}-{size}-{int(bold)}-{alignment or 0}",
        fontName=font_name,
        fontSize=size,
        leading=size + 2,
        textColor=colors.HexColor("#0f172a"),
        alignment=alignment if alignment is not None else 0,
    )


def _paragraph(value: Any, style: ParagraphStyle) -> Paragraph:
    text_value = "-" if value is None else str(value)
    text_value = text_value.replace("\n", "<br/>")
    return Paragraph(text_value, style)


def _styled_table(rows: list[list[Any]], font_name: str, col_widths: list[float] | None = None) -> Table:
    body = _make_paragraph_style(font_name, 8)
    header = ParagraphStyle(
        name=f"Report-{font_name}-header",
        parent=_make_paragraph_style(font_name, 8, bold=True, alignment=TA_CENTER),
        textColor=colors.white,
    )
    table_data = []
    for row_index, row in enumerate(rows):
        style = header if row_index == 0 else body
        table_data.append([_paragraph(cell, style) for cell in row])

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("LEADING", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def build_admin_report_pdf(data: dict[str, Any]) -> bytes:
    font_name = _resolve_pdf_font()
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title="BuildShop адміністративний звіт",
        author="BuildShop",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("BuildShopTitle", parent=styles["Title"], fontName=font_name, fontSize=22, leading=26, alignment=TA_CENTER, textColor=colors.HexColor("#0f172a"))
    subtitle_style = ParagraphStyle("BuildShopSubtitle", parent=styles["BodyText"], fontName=font_name, fontSize=10, leading=13, alignment=TA_CENTER, textColor=colors.HexColor("#475569"))
    section_style = ParagraphStyle("BuildShopSection", parent=styles["Heading2"], fontName=font_name, fontSize=14, leading=16, spaceBefore=6, spaceAfter=6, textColor=colors.HexColor("#111827"))
    note_style = ParagraphStyle("BuildShopNote", parent=styles["BodyText"], fontName=font_name, fontSize=9, leading=12, textColor=colors.HexColor("#475569"))
    story = [Paragraph("BuildShop — Адміністративний звіт", title_style), Spacer(1, 4 * mm), Paragraph(f"Дата формування: {data['generated_at'].strftime('%d.%m.%Y %H:%M')}", subtitle_style), Paragraph("Звіт містить ключові показники, статуси замовлень, топ-товари та ризики по складу.", subtitle_style), Spacer(1, 6 * mm)]

    counts = data["counts"]
    story.append(Paragraph("1. Ключові показники", section_style))
    story.append(_styled_table([
        ["Показник", "Значення"],
        ["Категорії", counts["categories"]],
        ["Товари", counts["products"]],
        ["Замовлення", counts["orders"]],
        ["Користувачі", counts["users"]],
        ["Одиниць товару на складі", data["total_stock_units"]],
        ["Низький запас", len(data["low_stock_rows"])],
        ["Немає в наявності", len(data["out_of_stock_rows"])],
        ["Виторг (доставлено/забрано), грн", _safe_money(data["paid_revenue"])],
    ], font_name, [120 * mm, 65 * mm]))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("2. Порівняння з попереднім місяцем", section_style))
    comparison = data.get("comparison", {})
    current_month = comparison.get("current_month", {})
    previous_month = comparison.get("previous_month", {})
    story.append(_styled_table(
        [["Метрика", current_month.get("label") or "Поточний", previous_month.get("label") or "Попередній", "Зміна, %"],
         ["Виторг, грн", _safe_money(current_month.get("revenue")), _safe_money(previous_month.get("revenue")), f"{_percent_change(current_month.get('revenue'), previous_month.get('revenue')):+.2f}%"],
         ["Замовлення", _safe_int(current_month.get("orders"), 0), _safe_int(previous_month.get("orders"), 0), f"{_percent_change(current_month.get('orders'), previous_month.get('orders')):+.2f}%"],
         ["Виконані", _safe_int(current_month.get("fulfilled_orders"), 0), _safe_int(previous_month.get("fulfilled_orders"), 0), f"{_percent_change(current_month.get('fulfilled_orders'), previous_month.get('fulfilled_orders')):+.2f}%"],
         ["Середній чек, грн", _safe_money(current_month.get("avg_order_value")), _safe_money(previous_month.get("avg_order_value")), f"{_percent_change(current_month.get('avg_order_value'), previous_month.get('avg_order_value')):+.2f}%"],
         ["Конверсія, %", f"{float(current_month.get('conversion_rate') or 0):.2f}", f"{float(previous_month.get('conversion_rate') or 0):.2f}", f"{_percent_change(current_month.get('conversion_rate'), previous_month.get('conversion_rate')):+.2f}%"],
         ["Нові користувачі", _safe_int(current_month.get("new_users"), 0), _safe_int(previous_month.get("new_users"), 0), f"{_percent_change(current_month.get('new_users'), previous_month.get('new_users')):+.2f}%"]],
        font_name,
        [75 * mm, 35 * mm, 35 * mm, 25 * mm],
    ))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("3. Статуси замовлень", section_style))
    status_rows = data["status_counts"]
    if status_rows:
        story.append(_styled_table([["Статус", "Кількість"]] + [[row["label"], row["count"]] for row in status_rows], font_name, [130 * mm, 55 * mm]))
    else:
        story.append(Paragraph("Немає даних по замовленнях.", note_style))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("4. Останні замовлення", section_style))
    latest_orders = data["latest_orders"]
    if latest_orders:
        story.append(_styled_table([["№", "Дата", "Клієнт", "Статус", "Сума, грн"]] + [[f"#{row['id']}", _format_dt(row.get("created_at")), row.get("contact_name") or f"user #{row.get('user_id')}", _status_label(row.get("status")), _safe_money(row.get("total"))] for row in latest_orders], font_name, [20 * mm, 30 * mm, 60 * mm, 45 * mm, 30 * mm]))
    else:
        story.append(Paragraph("Останні замовлення відсутні.", note_style))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("5. Найдорожчі товари", section_style))
    top_products = data["top_products"]
    if top_products:
        story.append(_styled_table([["Товар", "SKU", "Ціна, грн", "Активний"]] + [[row.get("name") or "-", row.get("sku") or "-", _safe_money(row.get("price")), "Так" if _safe_int(row.get("is_active"), 0) else "Ні"] for row in top_products], font_name, [95 * mm, 35 * mm, 35 * mm, 25 * mm]))
    else:
        story.append(Paragraph("Товари не знайдено.", note_style))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("6. Критичні позиції складу", section_style))
    low_stock_rows = data["low_stock_rows"]
    if low_stock_rows:
        story.append(_styled_table([["Товар", "SKU", "К-сть", "Поріг", "Локація"]] + [[row.get("product_name") or "Невідомо", row.get("product_sku") or "-", _safe_int(row.get("quantity"), 0), _safe_int(row.get("threshold"), 0), row.get("location") or "-"] for row in low_stock_rows[:30]], font_name, [75 * mm, 35 * mm, 20 * mm, 25 * mm, 50 * mm]))
        if len(low_stock_rows) > 30:
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph(f"Показано перші 30 позицій із {len(low_stock_rows)}.", note_style))
    else:
        story.append(Paragraph("Критичних позицій по складу немає.", note_style))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("7. Рух складу за 30 днів", section_style))
    movement_summary = data.get("inventory_movement_summary", [])
    if movement_summary:
        story.append(_styled_table([["Тип", "К-сть рухів", "Надійшло", "Видано", "Чистий рух"]] + [[
            _movement_label(row.get("type")),
            _safe_int(row.get("total_movements"), 0),
            _safe_int(row.get("incoming_quantity"), 0),
            _safe_int(row.get("outgoing_quantity"), 0),
            _safe_int(row.get("net_change"), 0),
        ] for row in movement_summary], font_name, [55 * mm, 25 * mm, 35 * mm, 35 * mm, 35 * mm]))
    else:
        story.append(Paragraph("За останні 30 днів рухів складу не знайдено.", note_style))

    story.append(Spacer(1, 2 * mm))
    movement_rows = data.get("inventory_movement_rows", [])
    if movement_rows:
        story.append(_styled_table([["Дата", "Товар", "Джерело", "Тип", "Зміна", "Стало"]] + [[
            _format_dt(row.get("created_at")),
            f"{row.get('product_name') or '-'} ({row.get('product_sku') or '-'})",
            row.get("source") or "-",
            _movement_label(row.get("type")),
            row.get("quantity"),
            row.get("quantity_after"),
        ] for row in movement_rows], font_name, [25 * mm, 55 * mm, 45 * mm, 25 * mm, 20 * mm, 20 * mm]))
    else:
        story.append(Paragraph("Детальних рухів складу поки немає.", note_style))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("8. Топ клієнтів за виторгом", section_style))
    top_customers_rows = data.get("top_customers", [])
    if top_customers_rows:
        story.append(_styled_table([["Клієнт", "Замовлень", "Витрачено, грн", "Сер. чек, грн"]] + [[
            row.get("name") or "-",
            _safe_int(row.get("orders_count"), 0),
            _safe_money(row.get("total_spent")),
            _safe_money(row.get("avg_order_value")),
        ] for row in top_customers_rows], font_name, [75 * mm, 25 * mm, 40 * mm, 35 * mm]))
    else:
        story.append(Paragraph("Топ клієнтів не знайдено.", note_style))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("9. Проблемні товари", section_style))
    problematic_products = data.get("problematic_products", [])
    if problematic_products:
        story.append(_styled_table([["Товар", "SKU", "Спрацювань", "Найнижче", "Поточний", "Поріг"]] + [[
            row.get("name") or "-",
            row.get("sku") or "-",
            _safe_int(row.get("low_stock_hits"), 0),
            _safe_int(row.get("lowest_quantity_after"), 0),
            _safe_int(row.get("current_quantity"), 0),
            _safe_int(row.get("threshold"), 0),
        ] for row in problematic_products], font_name, [55 * mm, 30 * mm, 22 * mm, 22 * mm, 22 * mm, 22 * mm]))
    else:
        story.append(Paragraph("Проблемних товарів за період не знайдено.", note_style))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("10. Аномалії складу", section_style))
    anomalies = data.get("inventory_anomalies", [])
    if anomalies:
        story.append(_styled_table([["Товар", "SKU", "Аномалій", "Списань", "Коригувань", "Великих змін"]] + [[
            row.get("name") or "-",
            row.get("sku") or "-",
            _safe_int(row.get("anomaly_count"), 0),
            _safe_int(row.get("write_off_count"), 0),
            _safe_int(row.get("adjustment_count"), 0),
            _safe_int(row.get("large_delta_count"), 0),
        ] for row in anomalies], font_name, [55 * mm, 30 * mm, 22 * mm, 22 * mm, 22 * mm, 22 * mm]))
    else:
        story.append(Paragraph("Аномалій за період не знайдено.", note_style))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("11. Динаміка виторгу (останні 30 днів)", section_style))
    trend_rows = [["Дата", "Виторг, грн", "Замовлень"]] + [
        [row["day"].strftime("%Y-%m-%d") if hasattr(row["day"], "strftime") else str(row["day"]), _safe_money(row["revenue"]), str(_safe_int(row["orders_count"], 0))]
        for row in data.get("revenue_trend", [])
    ]
    if len(trend_rows) > 1:
        story.append(_styled_table(trend_rows, font_name, [70 * mm, 55 * mm, 35 * mm]))
    else:
        story.append(Paragraph("Дані за виторгом відсутні.", note_style))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("12. Топ-10 товарів за виторгом", section_style))
    top_rev = data.get("top_products_revenue", [])
    top_rows = [["Товар", "SKU", "Продано (шт)", "Виторг, грн", "Замовлень"]] + [
        [r.get("name") or "-", r.get("sku") or "-", int(r.get("total_qty") or 0), float(r.get("total_revenue") or 0), int(r.get("orders_count") or 0)]
        for r in top_rev
    ]
    if len(top_rows) > 1:
        story.append(_styled_table(top_rows, font_name, [65 * mm, 30 * mm, 25 * mm, 35 * mm, 25 * mm]))
    else:
        story.append(Paragraph("Топ товарів за виторгом не знайдено.", note_style))

    doc.build(story)
    return buffer.getvalue()

def _style_ws(ws, header_row: int = 1):
    header_fill = PatternFill("solid", fgColor="1F2937")
    header_font = Font(color="FFFFFF", bold=True)
    thin = Side(style="thin", color="CBD5E1")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    for cell in ws[header_row]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border
    for row in ws.iter_rows(min_row=header_row + 1):
        for cell in row:
            cell.border = border
            cell.alignment = Alignment(vertical="top", wrap_text=True)
    ws.freeze_panes = ws[2][0].coordinate if ws.max_row > header_row else "A2"
    ws.auto_filter.ref = ws.dimensions
    for column_cells in ws.columns:
        column_letter = column_cells[0].column_letter
        max_length = max(len(str(cell.value)) if cell.value is not None else 0 for cell in column_cells)
        ws.column_dimensions[column_letter].width = min(max(max_length + 2, 12), 42)

def build_admin_report_xlsx(data: dict[str, Any]) -> bytes:
    wb = Workbook()
    ws_summary = wb.active
    ws_summary.title = "Підсумок"

    ws_summary["A1"] = "BuildShop — Адміністративний звіт"
    ws_summary["A1"].font = Font(size=16, bold=True, color="0F172A")
    ws_summary["A2"] = f"Дата формування: {data['generated_at'].strftime('%d.%m.%Y %H:%M')}"
    ws_summary["A3"] = "Звіт містить ключові показники, статуси замовлень, топ-товари та ризики по складу."
    ws_summary["A5"] = "Ключові показники"
    ws_summary["A5"].font = Font(size=12, bold=True)

    summary_rows = [["Показник", "Значення"], ["Категорії", data["counts"]["categories"]], ["Товари", data["counts"]["products"]], ["Замовлення", data["counts"]["orders"]], ["Користувачі", data["counts"]["users"]], ["Одиниць товару на складі", data["total_stock_units"]], ["Низький запас", len(data["low_stock_rows"])], ["Немає в наявності", len(data["out_of_stock_rows"])], ["Виторг (доставлено/забрано), грн", _safe_money(data["paid_revenue"])]]
    for row in summary_rows:
        ws_summary.append(row)

    # status block below summary table
    start_row = len(summary_rows) + 3
    ws_summary.cell(row=start_row, column=1, value="Статуси замовлень").font = Font(size=12, bold=True)
    ws_summary.cell(row=start_row + 1, column=1, value="Статус")
    ws_summary.cell(row=start_row + 1, column=2, value="Кількість")
    for index, row in enumerate(data["status_counts"], start=start_row + 2):
        ws_summary.cell(row=index, column=1, value=row["label"])
        ws_summary.cell(row=index, column=2, value=row["count"])
    _style_ws(ws_summary)

    ws_orders = wb.create_sheet("Замовлення")
    order_rows = [["№", "Дата", "Клієнт", "Статус", "Сума, грн"]] + [[f"#{row['id']}", _format_dt(row.get("created_at")), row.get("contact_name") or f"user #{row.get('user_id')}", _status_label(row.get("status")), float(row.get("total") or 0)] for row in data["latest_orders"]]
    for row in order_rows:
        ws_orders.append(row)
    _style_ws(ws_orders)

    ws_products = wb.create_sheet("Товари")
    product_rows = [["Товар", "SKU", "Ціна, грн", "Активний"]] + [[row.get("name") or "-", row.get("sku") or "-", float(row.get("price") or 0), "Так" if _safe_int(row.get("is_active"), 0) else "Ні"] for row in data["top_products"]]
    for row in product_rows:
        ws_products.append(row)
    _style_ws(ws_products)

    ws_stock = wb.create_sheet("Склад")
    stock_rows = [["Товар", "SKU", "К-сть", "Поріг", "Локація"]] + [[row.get("product_name") or "Невідомо", row.get("product_sku") or "-", _safe_int(row.get("quantity"), 0), _safe_int(row.get("threshold"), 0), row.get("location") or "-"] for row in data["low_stock_rows"]]
    for row in stock_rows:
        ws_stock.append(row)
    _style_ws(ws_stock)

    ws_comparison = wb.create_sheet("Порівняння")
    comparison = data.get("comparison", {})
    current_month = comparison.get("current_month", {})
    previous_month = comparison.get("previous_month", {})
    comparison_rows = [
        ["Метрика", current_month.get("label") or "Поточний", previous_month.get("label") or "Попередній", "Зміна, %"],
        ["Виторг, грн", float(current_month.get("revenue") or 0), float(previous_month.get("revenue") or 0), _percent_change(current_month.get("revenue"), previous_month.get("revenue"))],
        ["Замовлення", _safe_int(current_month.get("orders"), 0), _safe_int(previous_month.get("orders"), 0), _percent_change(current_month.get("orders"), previous_month.get("orders"))],
        ["Виконані", _safe_int(current_month.get("fulfilled_orders"), 0), _safe_int(previous_month.get("fulfilled_orders"), 0), _percent_change(current_month.get("fulfilled_orders"), previous_month.get("fulfilled_orders"))],
        ["Середній чек, грн", float(current_month.get("avg_order_value") or 0), float(previous_month.get("avg_order_value") or 0), _percent_change(current_month.get("avg_order_value"), previous_month.get("avg_order_value"))],
        ["Конверсія, %", float(current_month.get("conversion_rate") or 0), float(previous_month.get("conversion_rate") or 0), _percent_change(current_month.get("conversion_rate"), previous_month.get("conversion_rate"))],
        ["Нові користувачі", _safe_int(current_month.get("new_users"), 0), _safe_int(previous_month.get("new_users"), 0), _percent_change(current_month.get("new_users"), previous_month.get("new_users"))],
    ]
    for row in comparison_rows:
        ws_comparison.append(row)
    _style_ws(ws_comparison)

    ws_movement = wb.create_sheet("Рух складу")
    movement_summary_rows = [["Тип", "К-сть рухів", "Надійшло", "Видано", "Чистий рух"]] + [[
        _movement_label(row.get("type")),
        _safe_int(row.get("total_movements"), 0),
        _safe_int(row.get("incoming_quantity"), 0),
        _safe_int(row.get("outgoing_quantity"), 0),
        _safe_int(row.get("net_change"), 0),
    ] for row in data.get("inventory_movement_summary", [])]
    for row in movement_summary_rows:
        ws_movement.append(row)
    _style_ws(ws_movement)

    try:
        from openpyxl.chart import BarChart, Reference
        if ws_movement.max_row >= 2:
            chart = BarChart()
            chart.type = "bar"
            chart.style = 10
            chart.title = "Рух складу за типами"
            chart.y_axis.title = "Тип"
            chart.x_axis.title = "К-сть рухів"
            data_ref = Reference(ws_movement, min_col=2, min_row=1, max_row=min(ws_movement.max_row, 1 + len(data.get("inventory_movement_summary", []))))
            cats_ref = Reference(ws_movement, min_col=1, min_row=2, max_row=min(ws_movement.max_row, 1 + len(data.get("inventory_movement_summary", []))))
            chart.add_data(data_ref, titles_from_data=True)
            chart.set_categories(cats_ref)
            chart.height = 7
            chart.width = 10
            ws_movement.add_chart(chart, "H2")
    except Exception:
        logger.warning("Failed to add inventory movement chart to Excel report")

    start_row = len(movement_summary_rows) + 3
    ws_movement.cell(row=start_row, column=1, value="Останні рухи").font = Font(size=12, bold=True)
    recent_headers = ["Дата", "Товар", "Джерело", "Тип", "Зміна", "Стало"]
    for idx, header in enumerate(recent_headers, start=1):
        ws_movement.cell(row=start_row + 1, column=idx, value=header)
    for row_index, row in enumerate(data.get("inventory_movement_rows", []), start=start_row + 2):
        ws_movement.cell(row=row_index, column=1, value=_format_dt(row.get("created_at")))
        ws_movement.cell(row=row_index, column=2, value=f"{row.get('product_name') or '-'} ({row.get('product_sku') or '-'})")
        ws_movement.cell(row=row_index, column=3, value=row.get("source") or "-")
        ws_movement.cell(row=row_index, column=4, value=_movement_label(row.get("type")))
        ws_movement.cell(row=row_index, column=5, value=_safe_int(row.get("quantity"), 0))
        ws_movement.cell(row=row_index, column=6, value=_safe_int(row.get("quantity_after"), 0))
    _style_ws(ws_movement, header_row=start_row + 1)

    # New sheet: Revenue trend
    ws_revenue = wb.create_sheet("Динаміка виторгу")
    revenue_rows = [["Дата", "Виторг, грн", "Замовлень"]] + [
        [row["day"].strftime("%Y-%m-%d") if hasattr(row["day"], "strftime") else str(row["day"]), float(row["revenue"] or 0), int(row["orders_count"] or 0)]
        for row in data.get("revenue_trend", [])
    ]
    for row in revenue_rows:
        ws_revenue.append(row)
    _style_ws(ws_revenue)

    # Add line chart for revenue
    try:
        from openpyxl.chart import LineChart, Reference
        chart = LineChart()
        chart.title = "Динаміка виторгу"
        chart.style = 10
        chart.y_axis.title = "Виторг, грн"
        chart.x_axis.title = "Дата"
        if ws_revenue.max_row >= 2:
            data_ref = Reference(ws_revenue, min_col=2, min_row=1, max_row=ws_revenue.max_row)
            chart.add_data(data_ref, titles_from_data=True)
            cats = Reference(ws_revenue, min_col=1, min_row=2, max_row=ws_revenue.max_row)
            chart.set_categories(cats)
            ws_revenue.add_chart(chart, "E2")
    except Exception:
        logger.warning("Failed to add revenue chart to Excel report")

    # New sheet: Top products by revenue
    ws_top = wb.create_sheet("Топ товари")
    top_rows = [["Товар", "SKU", "Продано (шт)", "Виторг, грн", "Замовлень"]] + [
        [r.get("name") or "-", r.get("sku") or "-", int(r.get("total_qty") or 0), float(r.get("total_revenue") or 0), int(r.get("orders_count") or 0)]
        for r in data.get("top_products_revenue", [])
    ]
    for row in top_rows:
        ws_top.append(row)
    _style_ws(ws_top)

    ws_customers = wb.create_sheet("Клієнти")
    customer_rows = [["Клієнт", "Замовлень", "Витрачено, грн", "Сер. чек, грн"]] + [
        [row.get("name") or "-", _safe_int(row.get("orders_count"), 0), float(row.get("total_spent") or 0), float(row.get("avg_order_value") or 0)]
        for row in data.get("top_customers", [])
    ]
    if not data.get("top_customers"):
        customer_rows.append(["Немає даних", 0, 0, 0])
    for row in customer_rows:
        ws_customers.append(row)
    _style_ws(ws_customers)

    ws_problematic = wb.create_sheet("Проблемні товари")
    problematic_rows = [["Товар", "SKU", "Спрацювань", "Найнижче", "Поточний", "Поріг"]] + [
        [row.get("name") or "-", row.get("sku") or "-", _safe_int(row.get("low_stock_hits"), 0), _safe_int(row.get("lowest_quantity_after"), 0), _safe_int(row.get("current_quantity"), 0), _safe_int(row.get("threshold"), 0)]
        for row in data.get("problematic_products", [])
    ]
    for row in problematic_rows:
        ws_problematic.append(row)
    _style_ws(ws_problematic)

    ws_anomalies = wb.create_sheet("Аномалії")
    anomaly_rows = [["Товар", "SKU", "Аномалій", "Списань", "Коригувань", "Великих змін"]] + [
        [row.get("name") or "-", row.get("sku") or "-", _safe_int(row.get("anomaly_count"), 0), _safe_int(row.get("write_off_count"), 0), _safe_int(row.get("adjustment_count"), 0), _safe_int(row.get("large_delta_count"), 0)]
        for row in data.get("inventory_anomalies", [])
    ]
    for row in anomaly_rows:
        ws_anomalies.append(row)
    _style_ws(ws_anomalies)

    for ws in wb.worksheets:
        for column in ws.columns:
            max_len = max(len(str(cell.value)) if cell.value is not None else 0 for cell in column)
            ws.column_dimensions[get_column_letter(column[0].column)].width = min(max(max_len + 2, 12), 42)
        for row in ws.iter_rows():
            for cell in row:
                if isinstance(cell.value, (int, float)) and cell.column != 1:
                    cell.alignment = Alignment(horizontal="right", vertical="top")
        if ws.title in {"Замовлення", "Товари", "Склад"}:
            for row in range(2, ws.max_row + 1):
                ws.cell(row=row, column=4 if ws.title != "Склад" else 5).alignment = Alignment(horizontal="center", vertical="top")

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
