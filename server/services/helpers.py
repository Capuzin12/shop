from __future__ import annotations

from datetime import datetime
import hashlib
import re
import time
import uuid

from fastapi import HTTPException, Request

from config import settings

MAX_CART_ITEM_QUANTITY = 999


def _to_iso_or_none(value):
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else value


def _extract_token_from_request(request: Request, token_from_header: str | None) -> str | None:
    if token_from_header:
        return token_from_header
    cookie_token = request.cookies.get(settings.auth_cookie_name)
    if not cookie_token:
        return None
    if cookie_token.lower().startswith("bearer "):
        return cookie_token[7:].strip()
    return cookie_token.strip()


def parse_positive_quantity(
    value,
    *,
    field: str = "quantity",
    allow_zero: bool = False,
    max_value: int = MAX_CART_ITEM_QUANTITY,
) -> int:
    try:
        quantity = int(value)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_QUANTITY", "field": field, "message": f"Поле {field} має бути цілим числом"},
        )

    minimum = 0 if allow_zero else 1
    if quantity < minimum:
        comparator = "не може бути від'ємним" if allow_zero else "має бути більше 0"
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_QUANTITY", "field": field, "message": f"Поле {field} {comparator}"},
        )
    if quantity > max_value:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_QUANTITY", "field": field, "message": f"Поле {field} не може перевищувати {max_value}"},
        )
    return quantity


def normalize_order_items_payload(items_raw: list[dict]) -> list[dict]:
    if not isinstance(items_raw, list) or not items_raw:
        raise HTTPException(status_code=400, detail={"code": "EMPTY_ITEMS", "message": "Замовлення має містити хоча б один товар"})

    merged_items: dict[int, int] = {}
    for idx, item in enumerate(items_raw):
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail={"code": "INVALID_ITEM", "index": idx, "message": "Некоректний формат позиції замовлення"})

        try:
            product_id = int(item.get("product_id", 0))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail={"code": "INVALID_ITEM", "index": idx, "message": "product_id має бути цілим числом"})

        quantity = parse_positive_quantity(item.get("quantity"), field=f"items[{idx}].quantity")
        if product_id <= 0:
            raise HTTPException(status_code=400, detail={"code": "INVALID_ITEM", "index": idx, "message": "Кожна позиція має містити коректний product_id"})

        merged_items[product_id] = merged_items.get(product_id, 0) + quantity
        if merged_items[product_id] > MAX_CART_ITEM_QUANTITY:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_ITEM_QUANTITY", "index": idx, "message": f"Кількість для товару #{product_id} не може перевищувати {MAX_CART_ITEM_QUANTITY}"},
            )

    return [{"product_id": product_id, "quantity": quantity} for product_id, quantity in merged_items.items()]


def _parse_optional_datetime(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": "INVALID_DATETIME_FIELD", "message": "Некоректний формат дати/часу"})


def _parse_optional_int_field(value, field_name: str, *, allow_none: bool = True):
    if value in (None, ""):
        return None if allow_none else 0
    try:
        return int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"code": "INVALID_NUMERIC_FIELD", "field": field_name, "message": "Поле має бути числом"})


def _parse_optional_float_field(value, field_name: str, *, allow_none: bool = True):
    if value in (None, ""):
        return None if allow_none else 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"code": "INVALID_NUMERIC_FIELD", "field": field_name, "message": "Поле має бути числом"})


def generate_slug_from_name(name: str) -> str:
    if not name:
        return f"product-{int(time.time())}"

    transliterate_map = {
        "а": "a", "б": "b", "в": "v", "г": "h", "д": "d", "е": "e", "ё": "yo", "ж": "zh",
        "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
        "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
        "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e",
        "ю": "yu", "я": "ya", "є": "ye", "і": "i", "ї": "yi", "ґ": "g",
    }

    slug = name.lower()
    for cyrillic, latin in transliterate_map.items():
        slug = slug.replace(cyrillic, latin)

    slug = re.sub(r"[^\w\-]", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")

    if not slug:
        slug = f"product-{int(time.time())}"

    return slug


def generate_tracking_number() -> str:
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    md5 = hashlib.md5(usedforsecurity=False)
    md5.update(f"{uuid.uuid4()}{time.time()}".encode())
    random_part = md5.hexdigest()[:8].upper()
    return f"NP{date_str}-{random_part}"


def generate_invoice_number(supplier_id: int) -> str:
    now = datetime.now()
    year_month = now.strftime("%Y-%m%d")
    seq = int(time.time()) % 9999
    return f"INV-{year_month}-{seq:04d}"

