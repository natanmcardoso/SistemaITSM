"""catalogo de servicos (fase 12): tabela services + tickets.service_id

Revision ID: 06ab724bd0f3
Revises: accae2088952
Create Date: 2026-08-21 14:25:07.009334

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '06ab724bd0f3'
down_revision: Union[str, Sequence[str], None] = 'accae2088952'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'services',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('category_id', sa.UUID(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], name='services_category_id_fkey'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('tickets', sa.Column('service_id', sa.UUID(), nullable=True))
    op.create_foreign_key('tickets_service_id_fkey', 'tickets', 'services', ['service_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('tickets_service_id_fkey', 'tickets', type_='foreignkey')
    op.drop_column('tickets', 'service_id')
    op.drop_table('services')
