"""monitoramento (fase 17): tabela request_logs

Revision ID: 9b596c93da72
Revises: 92fca9adb982
Create Date: 2026-08-21 18:31:14.246238

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b596c93da72'
down_revision: Union[str, Sequence[str], None] = '92fca9adb982'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'request_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('method', sa.String(), nullable=False),
        sa.Column('path', sa.String(), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    # Toda consulta de monitoramento filtra por janela de tempo (created_at)
    # — índice evita full scan conforme a tabela cresce (sem rotina de
    # limpeza/retenção nesta fase, ver docstring de RequestLog).
    op.create_index('ix_request_logs_created_at', 'request_logs', ['created_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_request_logs_created_at', table_name='request_logs')
    op.drop_table('request_logs')
