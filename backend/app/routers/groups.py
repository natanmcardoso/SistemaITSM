"""Administração (Fase 11, sub-fase 11.3) — GET/POST /groups,
PATCH /groups/{id}/members, restritos a role=admin. Grupo é só
organização/roteamento de usuários, **não** controla permissão (Opção A
confirmada em CLAUDE.md).

`PATCH /groups/{id}/members` substitui o conjunto de membros por completo —
a lista enviada vira a lista final — em vez de endpoints separados de
adicionar/remover membro, único endpoint de membership previsto no escopo
original da fase.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Group, User, UserGroup
from app.schemas import GroupCreate, GroupMembersUpdate, GroupOut
from app.security import require_role
from app.services.audit import log_action

router = APIRouter(prefix="/groups", tags=["groups"], dependencies=[Depends(require_role("admin"))])


def _group_out(db: Session, group: Group) -> GroupOut:
    member_ids = [ug.user_id for ug in db.query(UserGroup).filter(UserGroup.group_id == group.id).all()]
    return GroupOut(
        id=group.id,
        name=group.name,
        description=group.description,
        created_at=group.created_at,
        member_ids=member_ids,
    )


@router.get("", response_model=list[GroupOut])
def list_groups(db: Session = Depends(get_db)):
    groups = db.query(Group).order_by(Group.name).all()
    return [_group_out(db, g) for g in groups]


@router.post("", response_model=GroupOut, status_code=201)
def create_group(
    payload: GroupCreate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    group = Group(name=payload.name, description=payload.description)
    db.add(group)
    db.flush()

    log_action(db, admin, "create_group", "group", entity_id=group.id, details=f"name={group.name}")
    db.commit()
    db.refresh(group)
    return _group_out(db, group)


@router.patch("/{group_id}/members", response_model=GroupOut)
def update_group_members(
    group_id: uuid.UUID,
    payload: GroupMembersUpdate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if group is None:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    new_ids = set(payload.member_ids)
    if new_ids:
        found_ids = {u.id for u in db.query(User).filter(User.id.in_(new_ids)).all()}
        missing = new_ids - found_ids
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Usuário(s) inexistente(s): {', '.join(str(m) for m in missing)}",
            )

    current_ids = {ug.user_id for ug in db.query(UserGroup).filter(UserGroup.group_id == group.id).all()}
    to_add = new_ids - current_ids
    to_remove = current_ids - new_ids

    if to_remove:
        db.query(UserGroup).filter(
            UserGroup.group_id == group.id, UserGroup.user_id.in_(to_remove)
        ).delete(synchronize_session=False)
    for user_id in to_add:
        db.add(UserGroup(group_id=group.id, user_id=user_id))

    log_action(
        db,
        admin,
        "update_group_members",
        "group",
        entity_id=group.id,
        details=f"added={sorted(str(i) for i in to_add)} removed={sorted(str(i) for i in to_remove)}",
    )
    db.commit()
    db.refresh(group)
    return _group_out(db, group)
