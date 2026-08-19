import type { ReactNode } from "react";
import { IconLogout, IconTicket } from "./icons";

interface SidebarNavItem {
  label: string;
  icon: ReactNode;
}

interface SidebarProps {
  groupLabel: string;
  navItem: SidebarNavItem;
  userName: string;
  userRoleLabel: string;
  onSignOut: () => void;
}

// Sidebar compartilhada entre fila do técnico e dashboard do gestor (design
// canvas aprovado — Prototipos do sistema/). Só 1 item de navegação por
// persona hoje, de propósito: não lista telas que ainda não existem (ex.:
// "base de conhecimento" do mockup) — ver CLAUDE.md.
export function Sidebar({ groupLabel, navItem, userName, userRoleLabel, onSignOut }: SidebarProps) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex w-64 shrink-0 flex-col bg-primary px-4 py-5 text-white">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <IconTicket width={18} height={18} className="text-white" />
        </div>
        <div className="text-base font-extrabold tracking-tight">Sistema ITSM</div>
      </div>

      <div className="mb-2 px-2 text-[11px] font-bold tracking-wider text-white/55 uppercase">{groupLabel}</div>
      <div className="mb-5 flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 rounded-lg bg-white/15 px-3 py-2.5 text-sm font-semibold">
          {navItem.icon}
          {navItem.label}
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 border-t border-white/15 pt-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{userName}</div>
          <div className="text-[11.5px] text-white/60">{userRoleLabel}</div>
        </div>
        <button
          onClick={onSignOut}
          aria-label="Sair"
          className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white"
        >
          <IconLogout width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
