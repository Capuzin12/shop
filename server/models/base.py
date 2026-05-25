from sqlalchemy.orm import DeclarativeBase
import enum
from sqlalchemy import Enum as SAEnum


class Base(DeclarativeBase):
    pass


def _py_enum(enum_cls, **kwargs):
    return SAEnum(
        enum_cls,
        native_enum=False,
        validate_strings=True,
        values_callable=lambda x: [m.value for m in x],
        **kwargs,
    )

