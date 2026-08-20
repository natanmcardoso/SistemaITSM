import { IconBook, IconSettings, IconTicket, IconUsers } from "./icons";

// Navegação da sidebar compartilhada pelas telas do técnico (Fase 8.2:
// "Meus chamados" e "Fila geral" viraram abas próprias, antes eram duas
// seções empilhadas numa única tela "Fila de chamados"; Fase 10 acrescentou
// "Configurações").
export function technicianNavItems(activeHref: string) {
  return [
    {
      label: "Meus chamados",
      icon: <IconUsers width={18} height={18} />,
      href: "/meus-atendimentos",
      active: activeHref === "/meus-atendimentos",
    },
    {
      label: "Fila geral",
      icon: <IconTicket width={18} height={18} />,
      href: "/fila",
      active: activeHref === "/fila",
    },
    {
      label: "Base de conhecimento",
      icon: <IconBook width={18} height={18} />,
      href: "/base-conhecimento",
      active: activeHref === "/base-conhecimento",
    },
    {
      label: "Configurações",
      icon: <IconSettings width={18} height={18} />,
      href: "/configuracoes",
      active: activeHref === "/configuracoes",
    },
  ];
}
