import enum
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IPStatus(str, enum.Enum):
    FREE = "FREE"          # Libre, sin uso detectado
    ASSIGNED = "ASSIGNED"  # Asignada administrativamente a un cliente
    ACTIVE = "ACTIVE"      # Responde en la red pero sin registro administrativo


class IPAddress(Base):
    """Una IP individual dentro de una subred."""

    __tablename__ = "ip_addresses"
    __table_args__ = (UniqueConstraint("ip_address", name="uq_ip_addresses_ip"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False, index=True)

    subnet_id: Mapped[int] = mapped_column(ForeignKey("subnets.id", ondelete="CASCADE"))
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[IPStatus] = mapped_column(
        Enum(IPStatus, name="ip_status_enum"), default=IPStatus.FREE, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    subnet: Mapped["Subnet"] = relationship(back_populates="ip_addresses")
    client: Mapped["Client | None"] = relationship(back_populates="ip_addresses")
    history: Mapped[list["IPStateHistory"]] = relationship(
        back_populates="ip", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<IPAddress {self.ip_address} [{self.status}]>"
