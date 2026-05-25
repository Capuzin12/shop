from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[Optional[int]] = mapped_column(Integer)
    changes_json: Mapped[Optional[str]] = mapped_column(Text)
    request_id: Mapped[Optional[str]] = mapped_column(String(36))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    details: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), index=True)

    user: Mapped[Optional["User"]] = relationship("User")


class ClientError(Base):
    __tablename__ = "client_errors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL")
    )
    path: Mapped[Optional[str]] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    stack: Mapped[Optional[str]] = mapped_column(Text)
    component_stack: Mapped[Optional[str]] = mapped_column(Text)
    request_id: Mapped[Optional[str]] = mapped_column(String(64))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(default=func.now(), index=True)

    user: Mapped[Optional["User"]] = relationship("User")

