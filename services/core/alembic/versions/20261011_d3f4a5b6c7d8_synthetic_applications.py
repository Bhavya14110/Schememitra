"""synthetic applications for the policy dashboard

Revision ID: d3f4a5b6c7d8
Revises: c2e8f1a90b11
Create Date: 2026-10-11
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d3f4a5b6c7d8"
down_revision: str | None = "c2e8f1a90b11"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "synthetic_applications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("state_code", sa.String(2), nullable=False),
        sa.Column("district_code", sa.String(8), nullable=False),
        sa.Column("scheme_code", sa.String(48), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("gender", sa.String(12), nullable=True),
        sa.Column("social_category", sa.String(24), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("batch", sa.String(24), nullable=False, server_default="demo-v1"),
    )
    op.create_index("ix_synthetic_applications_district_code", "synthetic_applications", ["district_code"])


def downgrade() -> None:
    op.drop_index("ix_synthetic_applications_district_code", table_name="synthetic_applications")
    op.drop_table("synthetic_applications")
