import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { adminNavItems } from "../components/adminNavItems";
import { IconLogout, IconUser } from "../components/icons";
import { managerNavItems } from "../components/managerNavItems";
import { Sidebar } from "../components/Sidebar";
import { technicianNavItems } from "../components/technicianNavItems";
import type { UserRole } from "../types";

// Fase 14 — Perfil, item do menu do usuário disponível pras 4 personas.
// Só leitura (nome, e-mail, perfil) — sem troca de senha nem edição (fora
// do escopo pedido; mesma decisão já usada em Fase 11, edição de usuário
// pelo admin também não mexe em senha).
const ROLE_LABELS: Record<UserRole, string> = {
  end_user: "Usuário final",
  technician: "Técnico(a)",
  manager: "Gestor(a)",
  admin: "Administrador(a)",
};

function ProfileCard({ name, email, role }: { name: string; email: string; role: UserRole }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
      <div className="mb-5 flex items-center gap-3.5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-lg font-bold text-primary">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-slate-900">{name}</div>
          <div className="text-sm text-slate-500">{ROLE_LABELS[role]}</div>
        </div>
      </div>
      <dl className="space-y-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <dt className="mb-0.5 text-xs font-bold text-slate-400 uppercase">Nome</dt>
          <dd className="text-slate-700">{name}</dd>
        </div>
        <div>
          <dt className="mb-0.5 text-xs font-bold text-slate-400 uppercase">E-mail</dt>
          <dd className="text-slate-700">{email}</dd>
        </div>
        <div>
          <dt className="mb-0.5 text-xs font-bold text-slate-400 uppercase">Perfil</dt>
          <dd className="text-slate-700">{ROLE_LABELS[role]}</dd>
        </div>
      </dl>
      <p className="mt-4 text-[12.5px] text-slate-400">
        Edição de dados e troca de senha não fazem parte do sistema ainda.
      </p>
    </div>
  );
}

export function ProfilePage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();

  if (!auth) return null;
  const { name, email, role } = auth.user;

  if (role === "end_user") {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto max-w-3xl">
          <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                  <IconUser width={15} height={15} strokeWidth={2} className="text-white" />
                </div>
                <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Perfil</h1>
              </div>
              <p className="text-sm text-slate-500">Logado como {name}</p>
            </div>
            <button
              onClick={() => {
                signOut();
                navigate("/login");
              }}
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-slate-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <IconLogout width={14} height={14} />
              Sair
            </button>
          </header>
          <ProfileCard name={name} email={email} role={role} />
        </div>
      </div>
    );
  }

  const navConfig: Record<Exclude<UserRole, "end_user">, { groupLabel: string; navItems: ReturnType<typeof technicianNavItems>; roleLabel: string }> = {
    technician: { groupLabel: "Chamados", navItems: technicianNavItems(""), roleLabel: "Técnico(a)" },
    manager: { groupLabel: "Gestão", navItems: managerNavItems(""), roleLabel: "Gestor(a)" },
    admin: { groupLabel: "Administração", navItems: adminNavItems(""), roleLabel: "Admin" },
  };
  const { groupLabel, navItems, roleLabel } = navConfig[role];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel={groupLabel}
        navItems={navItems}
        userName={name}
        userRoleLabel={roleLabel}
        userRole={role}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-5.5">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Perfil</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {name}</p>
        </div>
        <ProfileCard name={name} email={email} role={role} />
      </div>
    </div>
  );
}
