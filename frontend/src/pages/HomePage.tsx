import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { adminNavItems } from "../components/adminNavItems";
import {
  IconBook,
  IconChart,
  IconLayers,
  IconLogout,
  IconSettings,
  IconShield,
  IconTicket,
  IconUsers,
} from "../components/icons";
import { managerNavItems } from "../components/managerNavItems";
import { Sidebar } from "../components/Sidebar";
import { technicianNavItems } from "../components/technicianNavItems";

// Fase 14 — Página inicial: hub leve pós-login, com atalhos pras telas que
// cada persona já usa. Decisão confirmada com o usuário antes de codar: não
// substitui o destino direto de login por role (`homeRouteForRole`) — é uma
// tela a mais na navegação, não obrigatória.
interface ShortcutCardProps {
  icon: ReactNode;
  label: string;
  description: string;
  href: string;
}

function ShortcutCard({ icon, label, description, href }: ShortcutCardProps) {
  return (
    <Link
      to={href}
      className="flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)] transition hover:border-slate-300 hover:shadow-[0_1px_3px_rgba(16,24,40,.08),0_4px_10px_rgba(16,24,40,.08)]"
    >
      <div className="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-extrabold text-slate-900">{label}</div>
        <div className="mt-0.5 text-[13px] text-slate-500">{description}</div>
      </div>
    </Link>
  );
}

function ShortcutGrid({ shortcuts }: { shortcuts: ShortcutCardProps[] }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {shortcuts.map((s) => (
        <ShortcutCard key={s.href} {...s} />
      ))}
    </div>
  );
}

export function HomePage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();

  if (!auth) return null;

  const iconProps = { width: 20, height: 20 };
  const greeting = (
    <div className="mb-6">
      <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">
        Olá, {auth.user.name.split(" ")[0]}
      </h1>
      <p className="mt-0.5 text-sm text-slate-500">O que você precisa hoje?</p>
    </div>
  );

  if (auth.user.role === "technician") {
    const shortcuts: ShortcutCardProps[] = [
      { icon: <IconChart {...iconProps} />, label: "Dashboard", description: "Seus números pessoais de atendimento", href: "/meu-dashboard" },
      { icon: <IconUsers {...iconProps} />, label: "Meus chamados", description: "Chamados atribuídos a você", href: "/meus-atendimentos" },
      { icon: <IconTicket {...iconProps} />, label: "Fila geral", description: "Chamados ainda não atribuídos", href: "/fila" },
      { icon: <IconBook {...iconProps} />, label: "Base de conhecimento", description: "Artigos pra resolver mais rápido", href: "/base-conhecimento" },
      { icon: <IconSettings {...iconProps} />, label: "Configurações", description: "Categorias, serviços, SLA e calendários", href: "/configuracoes" },
    ];
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
        <Sidebar
          groupLabel="Chamados"
          navItems={technicianNavItems("/inicio")}
          userName={auth.user.name}
          userRoleLabel="Técnico(a)"
          onSignOut={() => {
            signOut();
            navigate("/login");
          }}
        />
        <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {greeting}
          <ShortcutGrid shortcuts={shortcuts} />
        </div>
      </div>
    );
  }

  if (auth.user.role === "manager") {
    const shortcuts: ShortcutCardProps[] = [
      { icon: <IconChart {...iconProps} />, label: "Dashboard", description: "Métricas e produtividade da equipe", href: "/dashboard" },
      { icon: <IconSettings {...iconProps} />, label: "Configurações", description: "Categorias, serviços, SLA e calendários", href: "/configuracoes" },
    ];
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
        <Sidebar
          groupLabel="Gestão"
          navItems={managerNavItems("/inicio")}
          userName={auth.user.name}
          userRoleLabel="Gestor(a)"
          onSignOut={() => {
            signOut();
            navigate("/login");
          }}
        />
        <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {greeting}
          <ShortcutGrid shortcuts={shortcuts} />
        </div>
      </div>
    );
  }

  if (auth.user.role === "admin") {
    const shortcuts: ShortcutCardProps[] = [
      { icon: <IconShield {...iconProps} />, label: "Administração", description: "Usuários, grupos e trilha de auditoria", href: "/admin" },
    ];
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
        <Sidebar
          groupLabel="Administração"
          navItems={adminNavItems("/inicio")}
          userName={auth.user.name}
          userRoleLabel="Admin"
          onSignOut={() => {
            signOut();
            navigate("/login");
          }}
        />
        <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {greeting}
          <ShortcutGrid shortcuts={shortcuts} />
        </div>
      </div>
    );
  }

  // end_user — sem sidebar, mesmo header leve das outras telas dele.
  const shortcuts: ShortcutCardProps[] = [
    { icon: <IconTicket {...iconProps} />, label: "Novo chamado", description: "Abrir um chamado por texto livre", href: "/novo-chamado" },
    { icon: <IconLayers {...iconProps} />, label: "Catálogo de Serviços", description: "Escolher um serviço pra abrir chamado", href: "/catalogo" },
    { icon: <IconUsers {...iconProps} />, label: "Meus chamados", description: "Acompanhar seus chamados abertos", href: "/meus-chamados" },
  ];
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-7">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                <IconTicket width={15} height={15} strokeWidth={2} className="text-white" />
              </div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">
                Olá, {auth.user.name.split(" ")[0]}
              </h1>
            </div>
            <p className="text-sm text-slate-500">Logado como {auth.user.name}</p>
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
        <ShortcutGrid shortcuts={shortcuts} />
      </div>
    </div>
  );
}
