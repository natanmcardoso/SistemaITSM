import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ApiError,
  createGroup,
  createUser,
  listAuditLog,
  listGroups,
  listUsers,
  updateGroupMembers,
  updateUser,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { homeRouteForRole } from "../auth/routing";
import { adminNavItems } from "../components/adminNavItems";
import { IconEdit, IconPlus } from "../components/icons";
import { Sidebar } from "../components/Sidebar";
import type { AuditLogOut, GroupOut, UserOut, UserRole } from "../types";

// Fase 11 — Administração: usuários, grupos e trilha de auditoria, tudo
// restrito a role=admin no backend (require_role). "Perfil" continua sendo
// o role fixo (Opção A confirmada em CLAUDE.md) — não há sistema de
// permissões granular aqui, só CRUD de usuários/grupos + log de leitura.

const ROLE_LABELS: Record<UserRole, string> = {
  end_user: "Usuário final",
  technician: "Técnico(a)",
  manager: "Gestor(a)",
  admin: "Admin",
};

const ROLE_OPTIONS: UserRole[] = ["end_user", "technician", "manager", "admin"];

type Tab = "usuarios" | "grupos" | "auditoria";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

// --- Usuários ---------------------------------------------------------

interface UserCreateFormValues {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

function UserCreateForm({
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  saving: boolean;
  error: string | null;
  onSubmit: (values: UserCreateFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("end_user");
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), email: email.trim(), role, password });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#C7D7FB] bg-primary-tint p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
    >
      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="user-name">
        Nome
      </label>
      <input
        id="user-name"
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="user-email">
        E-mail
      </label>
      <input
        id="user-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="user-role">
        Perfil
      </label>
      <select
        id="user-role"
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>

      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="user-password">
        Senha inicial
      </label>
      <input
        id="user-password"
        type="text"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Criar usuário"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-[10px] border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function UserEditForm({
  user,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  user: UserOut;
  saving: boolean;
  error: string | null;
  onSubmit: (values: { name: string; role: UserRole }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRole>(user.role);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), role });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#C7D7FB] bg-primary-tint p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
    >
      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor={`user-edit-name-${user.id}`}>
        Nome
      </label>
      <input
        id={`user-edit-name-${user.id}`}
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor={`user-edit-role-${user.id}`}>
        Perfil
      </label>
      <select
        id={`user-edit-role-${user.id}`}
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-[10px] border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function UsersSection({
  token,
  users,
  reloadUsers,
}: {
  token: string;
  users: UserOut[] | null;
  reloadUsers: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate(values: UserCreateFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      await createUser(token, values);
      setCreating(false);
      reloadUsers();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível criar o usuário.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(userId: string, values: { name: string; role: UserRole }) {
    setSaving(true);
    setFormError(null);
    try {
      await updateUser(token, userId, values);
      setEditingId(null);
      reloadUsers();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Usuários do sistema — criar conta e trocar o perfil (role).</p>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setFormError(null);
              setCreating(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-dark"
          >
            <IconPlus width={14} height={14} strokeWidth={2.3} />
            Novo usuário
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-4">
          <UserCreateForm
            saving={saving}
            error={formError}
            onSubmit={handleCreate}
            onCancel={() => {
              setCreating(false);
              setFormError(null);
            }}
          />
        </div>
      )}

      {users === null ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {users?.map((user) =>
            editingId === user.id ? (
              <UserEditForm
                key={user.id}
                user={user}
                saving={saving}
                error={formError}
                onSubmit={(values) => handleUpdate(user.id, values)}
                onCancel={() => {
                  setEditingId(null);
                  setFormError(null);
                }}
              />
            ) : (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-slate-900">{user.name}</div>
                  <div className="text-[12.5px] text-slate-500">
                    {user.email} · {ROLE_LABELS[user.role]}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setFormError(null);
                    setEditingId(user.id);
                  }}
                  aria-label="Editar usuário"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary"
                >
                  <IconEdit width={15} height={15} />
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// --- Grupos -------------------------------------------------------------

interface GroupCreateFormValues {
  name: string;
  description: string;
}

function GroupCreateForm({
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  saving: boolean;
  error: string | null;
  onSubmit: (values: GroupCreateFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), description: description.trim() });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#C7D7FB] bg-primary-tint p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
    >
      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="group-name">
        Nome
      </label>
      <input
        id="group-name"
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="group-description">
        Descrição
      </label>
      <textarea
        id="group-description"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="mb-4 w-full resize-none rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Criar grupo"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-[10px] border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function GroupMembersForm({
  group,
  users,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  group: GroupOut;
  users: UserOut[];
  saving: boolean;
  error: string | null;
  onSubmit: (memberIds: string[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(group.member_ids));

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit([...selected]);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#C7D7FB] bg-primary-tint p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
    >
      <div className="mb-3.5 font-extrabold text-slate-900">Membros de "{group.name}"</div>
      <div className="mb-4 flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-[10px] border-[1.5px] border-slate-300 bg-white p-3">
        {users.map((user) => (
          <label key={user.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggle(user.id)} />
            <span className="font-semibold text-slate-800">{user.name}</span>
            <span className="text-[12.5px] text-slate-400">{ROLE_LABELS[user.role]}</span>
          </label>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar membros"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-[10px] border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function GroupsSection({ token, users }: { token: string; users: UserOut[] | null }) {
  const [groups, setGroups] = useState<GroupOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingMembersId, setEditingMembersId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    listGroups(token)
      .then(setGroups)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao buscar os grupos."));
  }

  useEffect(reload, [token]);

  const userName = (id: string) => users?.find((u) => u.id === id)?.name ?? "—";

  async function handleCreate(values: GroupCreateFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      await createGroup(token, { name: values.name, description: values.description || undefined });
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível criar o grupo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateMembers(groupId: string, memberIds: string[]) {
    setSaving(true);
    setFormError(null);
    try {
      await updateGroupMembers(token, groupId, { member_ids: memberIds });
      setEditingMembersId(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar os membros.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Grupos são só organização/roteamento — não controlam permissão.</p>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setEditingMembersId(null);
              setFormError(null);
              setCreating(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-dark"
          >
            <IconPlus width={14} height={14} strokeWidth={2.3} />
            Novo grupo
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {creating && (
        <div className="mb-4">
          <GroupCreateForm
            saving={saving}
            error={formError}
            onSubmit={handleCreate}
            onCancel={() => {
              setCreating(false);
              setFormError(null);
            }}
          />
        </div>
      )}

      {groups === null && !error ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups?.map((group) =>
            editingMembersId === group.id && users ? (
              <GroupMembersForm
                key={group.id}
                group={group}
                users={users}
                saving={saving}
                error={formError}
                onSubmit={(memberIds) => handleUpdateMembers(group.id, memberIds)}
                onCancel={() => {
                  setEditingMembersId(null);
                  setFormError(null);
                }}
              />
            ) : (
              <div
                key={group.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-slate-900">{group.name}</div>
                  {group.description && <div className="text-[12.5px] text-slate-500">{group.description}</div>}
                  <div className="mt-1 text-[12.5px] text-slate-400">
                    {group.member_ids.length === 0
                      ? "Sem membros"
                      : group.member_ids.map(userName).join(", ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setFormError(null);
                    setEditingMembersId(group.id);
                  }}
                  aria-label="Editar membros"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary"
                >
                  <IconEdit width={15} height={15} />
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// --- Auditoria (só leitura) ----------------------------------------------

function AuditSection({ token, users }: { token: string; users: UserOut[] | null }) {
  const [entries, setEntries] = useState<AuditLogOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAuditLog(token)
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao buscar a trilha de auditoria."));
  }, [token]);

  const userName = (id: string) => users?.find((u) => u.id === id)?.name ?? id;

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">Registro das ações administrativas — só leitura.</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {entries === null && !error ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : entries && entries.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma ação registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[12.5px] font-bold tracking-wide text-slate-400 uppercase">
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Quem</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Alvo</th>
                <th className="px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {entries?.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDateTime(entry.created_at)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{userName(entry.user_id)}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.action}</td>
                  <td className="px-4 py-3 text-slate-500">{entry.entity_type}</td>
                  <td className="px-4 py-3 text-slate-500">{entry.details ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Página ---------------------------------------------------------------

export function AdminPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("usuarios");
  const [users, setUsers] = useState<UserOut[] | null>(null);

  function reloadUsers() {
    // Guard também aqui, não só no return abaixo — sem isso, o efeito
    // dispararia GET /users (403) pra qualquer persona antes do redirect
    // client-side rodar, já que hooks não podem ficar depois de um return.
    if (!auth || auth.user.role !== "admin") return;
    listUsers(auth.token).then(setUsers).catch(() => setUsers([]));
  }

  useEffect(reloadUsers, [auth]);

  if (!auth) return null;
  // Restrito a role=admin no backend (require_role) — outra persona que
  // acessar a URL direto é redirecionada pra própria casa.
  if (auth.user.role !== "admin") return <Navigate to={homeRouteForRole(auth.user.role)} replace />;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel="Administração"
        navItems={adminNavItems("/admin")}
        userName={auth.user.name}
        userRoleLabel="Admin"
        userRole={auth.user.role}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-6">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Administração</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
        </div>

        <div className="mb-6 flex gap-1.5 border-b border-slate-200">
          {(
            [
              ["usuarios", "Usuários"],
              ["grupos", "Grupos"],
              ["auditoria", "Auditoria"],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-bold ${
                tab === value
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "usuarios" && <UsersSection token={auth.token} users={users} reloadUsers={reloadUsers} />}
        {tab === "grupos" && <GroupsSection token={auth.token} users={users} />}
        {tab === "auditoria" && <AuditSection token={auth.token} users={users} />}
      </div>
    </div>
  );
}
