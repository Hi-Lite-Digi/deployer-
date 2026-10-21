"""Durable GitHub webhook delivery receipts.

Revision ID: 0015
Revises: 0014
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

TABLE_OPTS = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mariadb_engine": "InnoDB",
    "mariadb_charset": "utf8mb4",
}


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("github_deliveries"):
        return
    op.create_table(
        "github_deliveries",
        sa.Column("app_id", sa.String(36), sa.ForeignKey("apps.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("delivery_id", sa.String(128), primary_key=True),
        sa.Column("received_at", sa.DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql", "mariadb"), nullable=False),
        **TABLE_OPTS,
    )


def downgrade() -> None:
    op.drop_table("github_deliveries")
