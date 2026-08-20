"""
Teste da Fase 11, sub-fase 11.1: modelo de dados de Administração —
role `admin` no enum `user_role`, tabelas `groups`/`user_groups`/`audit_log`.

Sem endpoints ainda nesta sub-fase (fica pra 11.2+) — o teste só confirma que
o schema existe de verdade (migration já aplicada) e que os relacionamentos
funcionam: criar um usuário admin, um grupo, vincular os dois via
`user_groups`, registrar uma entrada de auditoria, e reler.

Roda contra o banco real (Neon) e limpa os dados de teste ao final.
"""
from app.database import SessionLocal
from app.models import AuditLog, Group, User, UserGroup


def run():
    db = SessionLocal()
    admin_id = member_id = group_id = audit_id = None
    try:
        # --- role="admin" é aceita pelo enum (era só 3 valores até a Fase 10) ---
        admin = User(
            name="Admin Teste", email="teste.fase11.admin@example.com",
            role="admin", password_hash="x",
        )
        member = User(
            name="Membro de Grupo Teste", email="teste.fase11.membro@example.com",
            role="technician", password_hash="x",
        )
        db.add_all([admin, member])
        db.flush()
        admin_id, member_id = admin.id, member.id
        assert admin.role == "admin"
        print(f"[OK] users: admin={admin.id} (role=admin) member={member.id}")

        # --- groups ---
        group = Group(name="Equipe de Redes (teste fase 11)", description="Grupo de teste")
        db.add(group)
        db.flush()
        group_id = group.id
        print(f"[OK] groups: criado group={group.id}")

        # --- user_groups (PK composta, sem coluna id própria) ---
        db.add(UserGroup(user_id=member.id, group_id=group.id))
        db.commit()
        print(f"[OK] user_groups: vinculado user={member.id} <-> group={group.id}")

        db.expire_all()
        membership = db.query(UserGroup).filter(
            UserGroup.user_id == member.id, UserGroup.group_id == group.id
        ).first()
        assert membership is not None
        print("[OK] releitura: vínculo user_groups persistido corretamente")

        # --- audit_log ---
        entry = AuditLog(
            user_id=admin.id,
            action="create_group",
            entity_type="group",
            entity_id=group.id,
            details="criado via teste automatizado da fase 11",
        )
        db.add(entry)
        db.commit()
        audit_id = entry.id
        print(f"[OK] audit_log: criado audit_log={entry.id} (action=create_group)")

        db.expire_all()
        reloaded = db.get(AuditLog, audit_id)
        assert reloaded is not None
        assert reloaded.user_id == admin.id
        assert reloaded.entity_type == "group"
        assert reloaded.entity_id == group.id
        assert reloaded.created_at is not None
        print("[OK] releitura: audit_log persistido corretamente, com created_at automático")

        print("\nTODOS OS TESTES DA FASE 11 (MODELO DE DADOS DE ADMINISTRAÇÃO) PASSARAM")
    finally:
        db.rollback()
        if audit_id:
            db.query(AuditLog).filter(AuditLog.id == audit_id).delete()
        if group_id and member_id:
            db.query(UserGroup).filter(UserGroup.user_id == member_id, UserGroup.group_id == group_id).delete()
        if group_id:
            db.query(Group).filter(Group.id == group_id).delete()
        user_ids = [i for i in (admin_id, member_id) if i]
        if user_ids:
            db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
