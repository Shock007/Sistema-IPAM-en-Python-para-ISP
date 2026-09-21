from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Subnet(Base):
    """Representa un rango de red administrado (ej. 192.168.1.0/24)."""

    __tablename__ = "subnets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cidr: Mapped[str] = mapped_column(String(43), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    vlan_id: Mapped[int | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    ip_addresses: Mapped[list["IPAddress"]] = relationship(
        back_populates="subnet", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Subnet {self.cidr} ({self.name})>"
