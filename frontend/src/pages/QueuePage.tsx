import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { managerNavItems } from "../components/managerNavItems";
import { Sidebar } from "../components/Sidebar";
import { TicketQueueBoard } from "../components/TicketQueueBoard";
import { technicianNavItems } from "../components/technicianNavItems";

// Fila geral — não atribuídos (Fase 8.2: virou aba própria na sidebar,
// separada de "Meus chamados"/MeusAtendimentosPage.tsx; antes as duas
// ficavam empilhadas nesta mesma tela). Segue sendo a rota padrão de
// login do técnico (`homeRouteForRole`).
//
// Também alcançável pelo gestor via os links do dashboard ("SLA estourado",
// categoria, status — Fase 5.3) — achado durante teste manual do usuário na
// Fase 13: a sidebar mostrava "Técnico(a)" pra qualquer um que chegasse
// aqui, inclusive gestor. Agora reflete o role de quem está logado de
// verdade (mesmo padrão condicional já usado em ConfigPage.tsx).
export function QueuePage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();

  if (!auth) return null;
  const isManager = auth.user.role === "manager";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel={isManager ? "Gestão" : "Chamados"}
        navItems={isManager ? managerNavItems("/fila") : technicianNavItems("/fila")}
        userName={auth.user.name}
        userRoleLabel={isManager ? "Gestor(a)" : "Técnico(a)"}
        userRole={auth.user.role}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-6">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Fila geral — não atribuídos</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
        </div>

        <TicketQueueBoard scope="unassigned" priorityCardsLabel="Chamados em aberto por prioridade" />
      </div>
    </div>
  );
}
