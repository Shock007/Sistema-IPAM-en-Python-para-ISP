import enum
from datetime import datetime, timezone

from sqlalchemy import Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CheckMethod(str, enum.Enum):
    PING = "PING"
    TCP = "TCP"
    WISPHUB = "WISPHUB"
    MANUAL = "MANUAL"


class IPStateHistory(Base):
    """Bitácora de cambios de estado detectados por el motor de verificación
    (Fase 2). Se define ahora para dejar el esquema completo desde el inicio."""

    __tablename__ = "ip_state_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ip_id: Mapped[int] = mapped_column(ForeignKey("ip_addresses.id", ondelete="CASCADE"))

    previous_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_status: Mapped[str] = mapped_column(Text, nullable=False)
    method: Mapped[CheckMethod] = mapped_column(
        Enum(CheckMethod, name="check_method_enum"), nullable=False
    )
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    ip: Mapped["IPAddress"] = relationship(back_populates="history")

    def __repr__(self) -> str:
        return f"<IPStateHistory ip_id={self.ip_id} {self.previous_status}->{self.new_status}>"
