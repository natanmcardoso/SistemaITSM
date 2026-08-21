import { IconActivity, IconAlertTriangle, IconChart, IconDownload, IconHome, IconSettings } from "./icons";

// Navegação da sidebar compartilhada pelas telas do gestor (Fase 10 acrescentou
// "Configurações" ao lado do "Dashboard", que era o único item até aqui —
// mesmo padrão de technicianNavItems.tsx; Fase 14 acrescentou "Início"; Fase
// 15 acrescentou "Relatórios"; Fase 16 acrescentou "Automações"; Fase 17
// acrescentou "Monitoramento").
export function managerNavItems(activeHref: string) {
  return [
    {
      label: "Início",
      icon: <IconHome width={18} height={18} />,
      href: "/inicio",
      active: activeHref === "/inicio",
    },
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
    {
      label: "Relatórios",
      icon: <IconDownload width={18} height={18} />,
      href: "/relatorios",
      active: activeHref === "/relatorios",
    },
    {
      label: "Automações",
      icon: <IconAlertTriangle width={18} height={18} />,
      href: "/automacoes",
      active: activeHref === "/automacoes",
    },
    {
      label: "Monitoramento",
      icon: <IconActivity width={18} height={18} />,
      href: "/monitoramento",
      active: activeHref === "/monitoramento",
    },
  ];
}
