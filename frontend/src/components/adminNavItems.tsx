import { IconShield } from "./icons";

// Navegação da sidebar do admin (Fase 11) — persona nova, escopo desta fase
// é só a tela de Administração (usuários, grupos, auditoria). Mesmo padrão
// de helper compartilhado de technicianNavItems.tsx/managerNavItems.tsx,
// mas com 1 item só (mesmo ponto de partida que o gestor teve até a Fase 10).
export function adminNavItems(activeHref: string) {
  return [
    {
      label: "Administração",
      icon: <IconShield width={18} height={18} />,
      href: "/admin",
      active: activeHref === "/admin",
    },
  ];
}
