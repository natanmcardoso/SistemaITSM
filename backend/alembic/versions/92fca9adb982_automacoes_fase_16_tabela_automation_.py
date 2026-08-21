"""automacoes (fase 16): tabela automation_rules

Revision ID: 92fca9adb982
Revises: 6058c2ebe318
Create Date: 2026-08-21 17:37:16.776786

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '92fca9adb982'
down_revision: Union[str, Sequence[str], None] = '6058c2ebe318'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'automation_rules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('threshold_percent', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('automation_rules')
