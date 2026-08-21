"""calendario de horario comercial (fase 13): business_hours + holidays

Revision ID: 6058c2ebe318
Revises: 06ab724bd0f3
Create Date: 2026-08-21 14:53:36.085892

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6058c2ebe318'
down_revision: Union[str, Sequence[str], None] = '06ab724bd0f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'business_hours',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('weekday', sa.Integer(), nullable=False),
        sa.Column('is_open', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('weekday'),
    )
    op.create_table(
        'holidays',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('date'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('holidays')
    op.drop_table('business_hours')
