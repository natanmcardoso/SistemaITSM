import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, listTickets } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PriorityBadge } from "../components/PriorityBadge";
import { StatusBadge } from "../components/StatusBadge";
import { IconLogout, IconTicket } from "../components/icons";
import { CATEGORY_NAMES } from "../devData";
import type { TicketOut } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Acompanhamento do chamado pelo usuário final (design doc §2.1: "status,
// histórico"). Reaproveita GET /tickets?requester_id= — o mesmo endpoint que
// a fila do técnico usa, só filtrado pro próprio usuário — e a mesma tela de
// detalhe do técnico (TicketDetailPage.tsx já se adapta pra esconder as
// ações quando quem está logado não é técnico).
export function MeusChamadosPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    listTickets(auth.token, { requester_id: auth.user.id })
      .then(setTickets)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar seus chamados."));
  }, [auth]);

  if (!auth) return null;

  return (
    <div className="min-h-screen bg-slate-50 px-8 py-7">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                <IconTicket width={15} height={15} strokeWidth={2} className="text-white" />
              </div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Meus chamados</h1>
            </div>
            <p className="text-sm text-slate-500">Logado como {auth.user.name}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/novo-chamado"
              className="rounded-full border-[1.5px] border-primary px-4 py-2 text-[13px] font-bold text-primary hover:bg-primary-tint"
            >
              Novo chamado
            </Link>
            <button
              onClick={() => {
                signOut();
                navigate("/login");
              }}
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-slate-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <IconLogout width={14} height={14} />
              Sair
            </button>
          </div>
        </header>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {tickets === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : tickets && tickets.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
            <p className="mb-4 text-sm text-slate-500">Você ainda não abriu nenhum chamado.</p>
            <Link
              to="/novo-chamado"
              className="inline-block rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark"
            >
              Abrir chamado
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Título
                  </th>
                  <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Categoria
                  </th>
                  <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Prioridade
                  </th>
                  <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Aberto em
                  </th>
                </tr>
              </thead>
              <tbody>
                {tickets?.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3.5 font-bold text-slate-900">{ticket.title}</td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {ticket.category_id ? CATEGORY_NAMES[ticket.category_id] ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">{formatDate(ticket.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
