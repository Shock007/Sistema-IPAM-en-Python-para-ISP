"""esquema inicial: subnets, clients, ip_addresses, ip_state_history

Revision ID: 0001
Revises:
Create Date: 2026-09-21

"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

ip_status_enum = sa.Enum("FREE", "ASSIGNED", "ACTIVE", name="ip_status_enum")
check_method_enum = sa.Enum("PING", "TCP", "WISPHUB", "MANUAL", name="check_method_enum")


def upgrade() -> None:
    op.create_table(
        "subnets",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("cidr", sa.String(43), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("vlan_id", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("cidr", name="uq_subnets_cidr"),
    )

    op.create_table(
        "clients",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("full_name", sa.String(150), nullable=False),
        sa.Column("document_id", sa.String(30), nullable=True),
        sa.Column("email", sa.String(120), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("address", sa.String(255), nullable=True),
        sa.Column("wisphub_client_id", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("document_id", name="uq_clients_document_id"),
    )
    op.create_index("ix_clients_wisphub_client_id", "clients", ["wisphub_client_id"])

    op.create_table(
        "ip_addresses",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ip_address", sa.String(45), nullable=False),
        sa.Column("subnet_id", sa.Integer, sa.ForeignKey("subnets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", ip_status_enum, nullable=False, server_default="FREE"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("ip_address", name="uq_ip_addresses_ip"),
    )
    op.create_index("ix_ip_addresses_ip_address", "ip_addresses", ["ip_address"])

    op.create_table(
        "ip_state_history",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ip_id", sa.Integer, sa.ForeignKey("ip_addresses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("previous_status", sa.Text, nullable=True),
        sa.Column("new_status", sa.Text, nullable=False),
        sa.Column("method", check_method_enum, nullable=False),
        sa.Column("details", sa.Text, nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ip_state_history")
    op.drop_table("ip_addresses")
    op.drop_table("clients")
    op.drop_table("subnets")
    ip_status_enum.drop(op.get_bind(), checkfirst=True)
    check_method_enum.drop(op.get_bind(), checkfirst=True)
