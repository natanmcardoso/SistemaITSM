import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, listTickets } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PriorityBadge } from "../components/PriorityBadge";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge } from "../components/StatusBadge";
import { IconTicket } from "../components/icons";
import { CATEGORY_NAMES, USER_NAMES } from "../devData";
import type { TicketOut, TicketPriority } from "../types";

const PRIORITY_ORDER: TicketPriority[] = ["critical", "high", "medium", "low"];
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
const PRIORITY_TEXT: Record<TicketPriority, string> = {
  critical: "text-crit",
  high: "text-high",
  medium: "text-med",
  low: "text-low",
};
const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function sortByPriority(tickets: TicketOut[]): TicketOut[] {
  return [...tickets].sort((a, b) => {
    const pa = a.priority ? PRIORITY_RANK[a.priority] : 99;
    const pb = b.priority ? PRIORITY_RANK[b.priority] : 99;
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function TicketTable({ tickets }: { tickets: TicketOut[] }) {
  if (tickets.length === 0) {
    return <p className="py-6 text-sm text-slate-500">Nenhum chamado aqui no momento.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Título</th>
            <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Categoria</th>
            <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Solicitante</th>
            <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Prioridade</th>
            <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Status</th>
            <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Sugestão da IA</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const reclassified =
              ticket.ai_suggested_priority !== null && ticket.ai_suggested_priority !== ticket.priority;
            return (
              <tr key={ticket.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                <td className="px-4 py-3.5 font-bold text-slate-900">{ticket.title}</td>
                <td className="px-4 py-3.5 text-slate-600">
                  {ticket.category_id ? CATEGORY_NAMES[ticket.category_id] ?? "—" : "—"}
                </td>
                <td className="px-4 py-3.5 text-slate-600">{USER_NAMES[ticket.requester_id] ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-4 py-3.5 text-slate-400">
                  {ticket.ai_suggested_priority ? (
                    reclassified ? (
                      <span title="Técnico reclassificou a prioridade sugerida pela IA">
                        alterada (IA sugeriu <PriorityBadge priority={ticket.ai_suggested_priority} />)
                      </span>
                    ) : (
                      "mantida"
                    )
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function QueuePage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    listTickets(auth.token)
      .then(setTickets)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar a fila."));
  }, [auth]);

  if (!auth) return null;

  const openOrInProgress = (tickets ?? []).filter((t) => t.status === "open" || t.status === "in_progress");
  const mine = sortByPriority(openOrInProgress.filter((t) => t.assignee_id === auth.user.id));
  const unassigned = sortByPriority(openOrInProgress.filter((t) => t.assignee_id === null));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        groupLabel="Chamados"
        navItem={{ label: "Fila de chamados", icon: <IconTicket width={18} height={18} /> }}
        userName={auth.user.name}
        userRoleLabel="Técnico(a)"
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-8 py-7">
        <div className="mb-6">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Fila do técnico</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {tickets === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <>
            <div className="mb-2.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
              Chamados em aberto por prioridade
            </div>
            <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              {PRIORITY_ORDER.map((priority) => (
                <div
                  key={priority}
                  className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
                >
                  <div className="mb-2 text-[12.5px] font-semibold text-slate-500">{PRIORITY_LABELS[priority]}</div>
                  <div className={`text-3xl font-extrabold ${PRIORITY_TEXT[priority]}`}>
                    {openOrInProgress.filter((t) => t.priority === priority).length}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Meus chamados</span>
              <span className="text-xs font-bold text-slate-400">{mine.length}</span>
            </div>
            <div className="mb-6">
              <TicketTable tickets={mine} />
            </div>

            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                Fila geral — não atribuídos
              </span>
              <span className="text-xs font-bold text-slate-400">{unassigned.length}</span>
            </div>
            <TicketTable tickets={unassigned} />
          </>
        )}
      </div>
    </div>
  );
}
