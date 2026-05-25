from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from models import (
    Inventory,
    InventoryMovement,
    MovementType,
    Notification,
    NotificationType,
    Order,
    User,
    UserRole,
)


def create_low_stock_notifications(
    db: Session,
    inventory_items: list[Inventory],
    recipient_roles: list[UserRole] | None = None,
) -> int:
    if recipient_roles is None:
        recipient_roles = [UserRole.admin]

    valid_items = [item for item in (inventory_items or []) if item and item.product]
    low_stock_items: list[Inventory] = []
    for item in valid_items:
        min_alert = item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity
        if int(item.quantity or 0) < int(min_alert or 0):
            low_stock_items.append(item)

    if not low_stock_items:
        return 0

    recipients = db.scalars(
        select(User).where(User.role.in_(recipient_roles), User.is_active == True)
    ).all()
    if not recipients:
        return 0

    created = 0
    for recipient in recipients:
        for item in low_stock_items:
            min_alert = item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity
            db.execute(
                delete(Notification).where(
                    Notification.user_id == recipient.id,
                    Notification.type == NotificationType.low_stock,
                    Notification.target_product_id == item.product_id,
                    Notification.is_read == False,
                )
            )
            db.add(Notification(
                user_id=recipient.id,
                type=NotificationType.low_stock,
                title="Низький запас товару",
                message=f"Товар '{item.product.name}' має низький запас: {item.quantity} од. (мін. {min_alert}, макс. {item.max_quantity})",
                target_path="/admin/inventory",
                target_product_id=item.product_id,
                target_inventory_id=item.id,
            ))
            created += 1
    return created


def restock_order_items(db: Session, order: Order, note_prefix: str = "Повернення на склад"):
    for item in order.items or []:
        if not item.product_id:
            continue
        inventory = db.scalar(select(Inventory).where(Inventory.product_id == item.product_id))
        if not inventory:
            inventory = Inventory(product_id=item.product_id, quantity=0, min_quantity=0, max_quantity=9999)
            db.add(inventory)
            db.flush()

        quantity_before = int(inventory.quantity or 0)
        inventory.quantity = quantity_before + int(item.quantity or 0)
        quantity_after = inventory.quantity
        db.add(inventory)
        db.add(
            InventoryMovement(
                product_id=item.product_id,
                order_id=order.id,
                type=MovementType.return_,
                quantity=int(item.quantity or 0),
                quantity_before=quantity_before,
                quantity_after=quantity_after,
                note=f"{note_prefix}: замовлення #{order.id}",
            )
        )

