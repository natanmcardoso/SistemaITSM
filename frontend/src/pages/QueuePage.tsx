import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, listTickets } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PriorityBadge } from "../components/PriorityBadge";
import { StatusBadge } from "../components/StatusBadge";
import { CATEGORY_NAMES, USER_NAMES } from "../devData";
import type { TicketOut } from "../types";

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function sortByPriority(tickets: TicketOut[]): TicketOut[] {
  return [...tickets].sort((a, b) => {
    const pa = a.priority ? PRIORITY_ORDER[a.priority] : 99;
    const pb = b.priority ? PRIORITY_ORDER[b.priority] : 99;
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function TicketTable({ tickets }: { tickets: TicketOut[] }) {
  if (tickets.length === 0) {
    return <p className="py-6 text-sm text-slate-500">Nenhum chamado aqui no momento.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Título</th>
            <th className="px-4 py-3 font-medium">Categoria</th>
            <th className="px-4 py-3 font-medium">Solicitante</th>
            <th className="px-4 py-3 font-medium">Prioridade</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Sugestão da IA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tickets.map((ticket) => {
            const reclassified =
              ticket.ai_suggested_priority !== null && ticket.ai_suggested_priority !== ticket.priority;
            return (
              <tr key={ticket.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{ticket.title}</td>
                <td className="px-4 py-3 text-slate-600">
                  {ticket.category_id ? CATEGORY_NAMES[ticket.category_id] ?? "—" : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{USER_NAMES[ticket.requester_id] ?? "—"}</td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-4 py-3 text-slate-500">
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

  // RequireAuth (App.tsx) só renderiza esta página com auth presente; este
  // guard cobre só o instante entre "Sair" e a navegação para /login.
  if (!auth) return null;

  const openOrInProgress = (tickets ?? []).filter((t) => t.status === "open" || t.status === "in_progress");
  const mine = sortByPriority(openOrInProgress.filter((t) => t.assignee_id === auth.user.id));
  const unassigned = sortByPriority(openOrInProgress.filter((t) => t.assignee_id === null));

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Fila do técnico</h1>
            <p className="text-sm text-slate-500">Logado como {auth.user.name}</p>
          </div>
          <button
            onClick={() => {
              signOut();
              navigate("/login");
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
          >
            Sair
          </button>
        </header>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {tickets === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Meus chamados ({mine.length})
              </h2>
              <TicketTable tickets={mine} />
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Fila geral — não atribuídos ({unassigned.length})
              </h2>
              <TicketTable tickets={unassigned} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
