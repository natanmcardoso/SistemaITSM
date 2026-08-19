import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { TicketQueueBoard } from "../components/TicketQueueBoard";
import { technicianNavItems } from "../components/technicianNavItems";

// "Meus chamados" do técnico (Fase 8.2) — chamados atribuídos a quem está
// logado. Rota separada de /meus-chamados (essa é do usuário final, lista
// os chamados que ELE abriu — conceito diferente, por isso o nome de rota
// próprio pra não colidir).
export function MeusAtendimentosPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();

  if (!auth) return null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel="Chamados"
        navItems={technicianNavItems("/meus-atendimentos")}
        userName={auth.user.name}
        userRoleLabel="Técnico(a)"
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-6">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Meus chamados</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
        </div>

        <TicketQueueBoard scope="mine" priorityCardsLabel="Meus chamados em aberto por prioridade" />
      </div>
    </div>
  );
}
