"""administracao (fase 11): admin role, groups, user_groups, audit_log

Revision ID: accae2088952
Revises: 8a5196020c8d
Create Date: 2026-08-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'accae2088952'
down_revision: Union[str, Sequence[str], None] = '8a5196020c8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Postgres 12+ permite ADD VALUE dentro de uma transação, desde que o
    # valor novo não seja usado na mesma transação (não é — só é adicionado
    # ao enum aqui, nenhuma linha grava role='admin' nesta migration).
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'")

    op.create_table(
        'groups',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'user_groups',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('group_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='user_groups_user_id_fkey'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], name='user_groups_group_id_fkey'),
        sa.PrimaryKeyConstraint('user_id', 'group_id'),
    )
    op.create_table(
        'audit_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='audit_log_user_id_fkey'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    """Downgrade schema.

    Remover um valor de enum não é suportado direto pelo Postgres — recria o
    tipo sem 'admin' (mesma técnica de sempre: renomear, criar o novo,
    trocar a coluna, derrubar o velho). Isso é destrutivo pra qualquer
    usuário com role='admin' na hora do downgrade (mesmo padrão de perda de
    dado que já existe no downgrade de tabelas inteiras, ex. Fase 6) — apaga
    esses usuários antes de trocar o tipo, senão o cast falha.
    """
    op.drop_table('audit_log')
    op.drop_table('user_groups')
    op.drop_table('groups')

    op.execute("DELETE FROM users WHERE role = 'admin'")
    op.execute("ALTER TYPE user_role RENAME TO user_role_old")
    new_enum = postgresql.ENUM('end_user', 'technician', 'manager', name='user_role')
    new_enum.create(op.get_bind(), checkfirst=False)
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role")
    op.execute("DROP TYPE user_role_old")
