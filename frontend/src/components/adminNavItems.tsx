import { IconHome, IconShield } from "./icons";

// Navegação da sidebar do admin (Fase 11) — persona nova, escopo daquela
// fase era só a tela de Administração (usuários, grupos, auditoria). Mesmo
// padrão de helper compartilhado de technicianNavItems.tsx/managerNavItems.tsx.
// Fase 14 acrescentou "Início".
export function adminNavItems(activeHref: string) {
  return [
    {
      label: "Início",
      icon: <IconHome width={18} height={18} />,
      href: "/inicio",
      active: activeHref === "/inicio",
    },
    {
      label: "Administração",
      icon: <IconShield width={18} height={18} />,
      href: "/admin",
      active: activeHref === "/admin",
    },
  ];
}
