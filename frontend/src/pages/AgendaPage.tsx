import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, listTickets } from "../api";
import { useAuth } from "../auth/AuthContext";
import { homeRouteForRole } from "../auth/routing";
import { PriorityBadge } from "../components/PriorityBadge";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge } from "../components/StatusBadge";
import { technicianNavItems } from "../components/technicianNavItems";
import { CATEGORY_NAMES } from "../devData";
import type { TicketOut } from "../types";

// Fase 14 — "Agendas", item do menu do usuário. Interpretação confirmada
// com o usuário antes de codar: calendário pessoal dos próprios chamados
// (ativos) ordenados por vencimento de SLA — não é agendamento de
// horário/compromisso de verdade (não existe esse conceito no sistema),
// reaproveita sla_due_at que já existe. Só técnico tem carga própria de
// chamados pra isso valer a pena (ver Sidebar.tsx).
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function isBreached(t: TicketOut): boolean {
  if (!t.sla_due_at) return false;
  return new Date(t.sla_due_at).getTime() < Date.now();
}

export function AgendaPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || auth.user.role !== "technician") return;
    listTickets(auth.token, { assignee_id: auth.user.id })
      .then((result) => {
        const active = result.filter((t) => t.status === "open" || t.status === "in_progress");
        const sorted = [...active].sort((a, b) => {
          if (!a.sla_due_at && !b.sla_due_at) return 0;
          if (!a.sla_due_at) return 1;
          if (!b.sla_due_at) return -1;
          return new Date(a.sla_due_at).getTime() - new Date(b.sla_due_at).getTime();
        });
        setTickets(sorted);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar sua agenda."));
  }, [auth]);

  if (!auth) return null;
  if (auth.user.role !== "technician") {
    return <Navigate to={homeRouteForRole(auth.user.role)} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel="Chamados"
        navItems={technicianNavItems("")}
        userName={auth.user.name}
        userRoleLabel="Técnico(a)"
        userRole={auth.user.role}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-5.5">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Agenda</h1>
          <p className="mt-0.5 text-sm text-slate-500">Seus chamados ativos, ordenados por vencimento de SLA</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {tickets === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : tickets && tickets.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
            <p className="text-sm text-slate-500">Nenhum chamado ativo atribuído a você no momento.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tickets?.map((ticket) => {
              const breached = isBreached(ticket);
              return (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className={`flex cursor-pointer flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border bg-white p-4.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)] hover:border-slate-300 ${
                    breached ? "border-crit-tint" : "border-slate-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900">{ticket.title}</div>
                    <div className="text-[12.5px] text-slate-500">
                      {ticket.category_id ? CATEGORY_NAMES[ticket.category_id] ?? "—" : "—"}
                    </div>
                  </div>
                  <PriorityBadge priority={ticket.priority} />
                  <StatusBadge status={ticket.status} />
                  <div className="w-40 shrink-0 text-right">
                    {ticket.sla_due_at ? (
                      <span className={`text-[13px] font-bold ${breached ? "text-crit" : "text-slate-600"}`}>
                        {formatDateTime(ticket.sla_due_at)}
                        {breached && " (estourado)"}
                      </span>
                    ) : (
                      <span className="text-[13px] text-slate-400">Sem SLA</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
