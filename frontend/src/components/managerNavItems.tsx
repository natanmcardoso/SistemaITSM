import { IconChart, IconSettings } from "./icons";

// Navegação da sidebar compartilhada pelas telas do gestor (Fase 10 acrescentou
// "Configurações" ao lado do "Dashboard", que era o único item até aqui —
// mesmo padrão de technicianNavItems.tsx).
export function managerNavItems(activeHref: string) {
  return [
    {
      label: "Dashboard",
      icon: <IconChart width={18} height={18} />,
      href: "/dashboard",
      active: activeHref === "/dashboard",
    },
    {
      label: "Configurações",
      icon: <IconSettings width={18} height={18} />,
      href: "/configuracoes",
      active: activeHref === "/configuracoes",
    },
  ];
}
