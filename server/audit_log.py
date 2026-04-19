"""
Audit logging utilities for tracking critical changes
"""

import json
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models import AuditLog, User
from logging_config import get_logger, get_request_id
from fastapi import Request

logger = get_logger(__name__)


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    """Extract client IP from request."""
    if not request:
        return None
    
    # Check for forwarded IP (behind proxy)
    if request.headers.get('x-forwarded-for'):
        return request.headers['x-forwarded-for'].split(',')[0].strip()
    
    # Fall back to direct connection
    if request.client:
        return request.client.host
    
    return None


def create_audit_log(
    db: Session,
    user_id: Optional[int],
    action: str,
    resource_type: str,
    resource_id: Optional[int] = None,
    changes: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
    details: Optional[str] = None
) -> AuditLog:
    """
    Create an audit log entry for a critical action.
    
    Args:
        db: Database session
        user_id: ID of user performing the action
        action: Action type (create, update, delete, status_change, etc.)
        resource_type: Type of resource (product, order, user, inventory, etc.)
        resource_id: ID of the resource being modified
        changes: Dictionary with before/after changes
        request: FastAPI request object for IP extraction
        details: Additional context
    
    Returns:
        Created AuditLog entry
    """
    audit_entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        changes_json=json.dumps(changes) if changes else None,
        request_id=get_request_id(),
        ip_address=get_client_ip(request),
        details=details,
    )
    
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    
    logger.info(
        f'Audit: {action} on {resource_type}#{resource_id}',
        extra={
            'audit_id': audit_entry.id,
            'user_id': user_id,
            'action': action,
            'resource_type': resource_type,
            'resource_id': resource_id,
        }
    )
    
    return audit_entry


def create_order_status_change_audit(
    db: Session,
    user_id: Optional[int],
    order_id: int,
    old_status: str,
    new_status: str,
    request: Optional[Request] = None
) -> AuditLog:
    """
    Create an audit log for order status changes.
    """
    return create_audit_log(
        db=db,
        user_id=user_id,
        action='status_change',
        resource_type='order',
        resource_id=order_id,
        changes={'from': old_status, 'to': new_status},
        request=request,
        details=f'Order status changed from {old_status} to {new_status}'
    )


def create_product_modification_audit(
    db: Session,
    user_id: Optional[int],
    product_id: int,
    action: str,  # create, update, delete
    changes: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> AuditLog:
    """
    Create an audit log for product modifications.
    """
    return create_audit_log(
        db=db,
        user_id=user_id,
        action=action,
        resource_type='product',
        resource_id=product_id,
        changes=changes,
        request=request,
    )


def create_inventory_change_audit(
    db: Session,
    user_id: Optional[int],
    product_id: int,
    old_quantity: int,
    new_quantity: int,
    request: Optional[Request] = None
) -> AuditLog:
    """
    Create an audit log for inventory quantity changes.
    """
    return create_audit_log(
        db=db,
        user_id=user_id,
        action='update',
        resource_type='inventory',
        resource_id=product_id,
        changes={'quantity_from': old_quantity, 'quantity_to': new_quantity},
        request=request,
        details=f'Inventory quantity changed from {old_quantity} to {new_quantity}'
    )


def create_user_modification_audit(
    db: Session,
    admin_user_id: Optional[int],
    modified_user_id: int,
    action: str,  # create, update, delete, role_change
    changes: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> AuditLog:
    """
    Create an audit log for user modifications (admin actions).
    """
    return create_audit_log(
        db=db,
        user_id=admin_user_id,
        action=action,
        resource_type='user',
        resource_id=modified_user_id,
        changes=changes,
        request=request,
    )


def get_audit_logs(
    db: Session,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    limit: int = 100
) -> list[AuditLog]:
    """
    Retrieve audit logs with optional filtering.
    """
    query = db.query(AuditLog)
    
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.filter(AuditLog.resource_id == resource_id)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    
    return query.order_by(AuditLog.created_at.desc()).limit(limit).all()

