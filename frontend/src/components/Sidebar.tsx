import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconClock, IconFlag, IconLogout, IconMenu, IconTicket, IconUser, IconUsers, IconX } from "./icons";

interface SidebarNavItem {
  label: string;
  icon: ReactNode;
  href: string;
  active?: boolean;
}

// Fase 14 — menu do usuário (dropdown no bloco de identidade, rodapé da
// sidebar). Calculado aqui dentro a partir do `userRole`, em vez de cada
// tela montar a própria lista — evita repetir a mesma lógica de role nos ~9
// lugares que usam <Sidebar>. Escopo por persona (decisão confirmada com o
// usuário antes de codar): "Perfil" pra todo mundo; "Minha fila",
// "Prioridades" (preferências de filtro da fila) e "Agendas" (chamados por
// vencimento de SLA) só fazem sentido pro técnico — gestor/admin não têm
// fila pessoal, então só ganham "Perfil".
type UserRole = "end_user" | "technician" | "manager" | "admin";

function userMenuItemsForRole(role: UserRole): SidebarNavItem[] {
  const perfil: SidebarNavItem = { label: "Perfil", icon: <IconUser width={16} height={16} />, href: "/perfil" };
  if (role !== "technician") return [perfil];
  return [
    perfil,
    { label: "Minha fila", icon: <IconUsers width={16} height={16} />, href: "/meus-atendimentos" },
    { label: "Prioridades", icon: <IconFlag width={16} height={16} />, href: "/preferencias" },
    { label: "Agendas", icon: <IconClock width={16} height={16} />, href: "/agenda" },
  ];
}

interface SidebarProps {
  groupLabel: string;
  navItems: SidebarNavItem[];
  userName: string;
  userRoleLabel: string;
  userRole: UserRole;
  onSignOut: () => void;
}

function SidebarBody({
  groupLabel,
  navItems,
  userName,
  userRoleLabel,
  userRole,
  onSignOut,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const userMenuItems = userMenuItemsForRole(userRole);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col bg-primary px-4 py-5 text-white">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <IconTicket width={18} height={18} className="text-white" />
        </div>
        <div className="text-base font-extrabold tracking-tight">Sistema ITSM</div>
      </div>

      <div className="mb-2 px-2 text-[11px] font-bold tracking-wider text-white/55 uppercase">{groupLabel}</div>
      <div className="mb-5 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold ${
              item.active ? "bg-white/15" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex-1" />

      {/* Menu do usuário (Fase 14) — clique no bloco de identidade abre um
          dropdown pra cima (o bloco fica no rodapé) com Perfil + itens por
          role. Backdrop full-screen fecha ao clicar fora, mesmo padrão já
          usado no drawer mobile. */}
      <div className="relative border-t border-white/15 pt-4">
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_4px_16px_rgba(16,24,40,.16)]">
              {userMenuItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => {
                    setUserMenuOpen(false);
                    onNavigate?.();
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-left hover:bg-white/10"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{userName}</div>
              <div className="text-[11.5px] text-white/60">{userRoleLabel}</div>
            </div>
          </button>
          <button
            onClick={onSignOut}
            aria-label="Sair"
            className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white"
          >
            <IconLogout width={16} height={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Sidebar compartilhada entre as telas do técnico e o dashboard do gestor
// (design canvas aprovado — Prototipos do sistema/). Cada persona só vê os
// itens que já existem de verdade como tela — ver CLAUDE.md.
//
// Fase 5 (responsivo): a barra de 256px fixa só faz sentido em telas largas.
// Abaixo do breakpoint `lg`, vira uma topbar compacta com um botão de menu
// que abre a mesma navegação como um drawer sobreposto (overlay + painel
// deslizante) — sem duplicar o componente, só o container muda.
export function Sidebar(props: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Topbar mobile — some em telas largas, onde a sidebar fixa assume. */}
      <div className="flex items-center justify-between bg-primary px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <IconTicket width={16} height={16} className="text-white" />
          </div>
          <div className="text-[15px] font-extrabold tracking-tight">Sistema ITSM</div>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="flex h-8.5 w-8.5 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <IconMenu width={20} height={20} />
        </button>
      </div>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative flex h-full">
            <SidebarBody {...props} onNavigate={() => setMobileOpen(false)} />
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
              className="absolute top-4 -right-11 flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-black/25 text-white hover:bg-black/35"
            >
              <IconX width={18} height={18} />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar fixa — telas largas */}
      <div className="hidden lg:flex">
        <SidebarBody {...props} />
      </div>
    </>
  );
}
