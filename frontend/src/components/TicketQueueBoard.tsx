import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, listTickets } from "../api";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_NAMES, USER_NAMES } from "../devData";
import type { TicketOut, TicketPriority } from "../types";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

// Peças compartilhadas entre as duas telas de fila do técnico ("Meus
// chamados" e "Fila geral — não atribuídos", Fase 8.2) — antes viviam só
// dentro de QueuePage.tsx, quando as duas seções ficavam empilhadas numa
// única tela. Sem filtro "Técnico" aqui (existia na Fase 5): o escopo já é
// fixo por tela, então esse filtro nunca fazia sentido pra nenhuma das duas.

export const PRIORITY_ORDER: TicketPriority[] = ["critical", "high", "medium", "low"];
export const PRIORITY_LABELS: Record<TicketPriority, string> = {
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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em andamento" },
  { value: "resolved", label: "Resolvido" },
  { value: "closed", label: "Fechado" },
];

function sortByPriority(tickets: TicketOut[]): TicketOut[] {
  return [...tickets].sort((a, b) => {
    const pa = a.priority ? PRIORITY_RANK[a.priority] : 99;
    const pb = b.priority ? PRIORITY_RANK[b.priority] : 99;
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterBar({
  status,
  priority,
  category,
  searchInput,
  hasActiveFilters,
  onStatusChange,
  onPriorityChange,
  onCategoryChange,
  onSearchInputChange,
  onSearchSubmit,
  onClear,
}: {
  status: string;
  priority: string;
  category: string;
  searchInput: string;
  hasActiveFilters: boolean;
  onStatusChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onSearchInputChange: (v: string) => void;
  onSearchSubmit: (e: FormEvent) => void;
  onClear: () => void;
}) {
  const priorityOptions = [
    { value: "", label: "Todas" },
    ...PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
  ];
  const categoryOptions = [
    { value: "", label: "Todas" },
    ...Object.entries(CATEGORY_NAMES).map(([id, name]) => ({ value: id, label: name })),
  ];

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
      <form onSubmit={onSearchSubmit} className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
        Busca
        <div className="flex gap-1.5">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder="Título, descrição, solicitante ou técnico..."
            className="w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white hover:bg-primary-dark"
          >
            Buscar
          </button>
        </div>
      </form>
      <FilterSelect label="Status" value={status} options={STATUS_OPTIONS} onChange={onStatusChange} />
      <FilterSelect label="Prioridade" value={priority} options={priorityOptions} onChange={onPriorityChange} />
      <FilterSelect label="Categoria" value={category} options={categoryOptions} onChange={onCategoryChange} />
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-tint"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

export function TicketTable({ tickets, onRowClick }: { tickets: TicketOut[]; onRowClick: (id: string) => void }) {
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
              <tr
                key={ticket.id}
                onClick={() => onRowClick(ticket.id)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70"
              >
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

export interface TicketQueueBoardProps {
  // "mine" = chamados atribuídos ao técnico logado; "unassigned" = fila
  // geral (assignee_id nulo). O filtro "unassigned" não existe no backend
  // (só suporta assignee_id = UUID exato), então é aplicado no cliente,
  // igual já era feito dentro da QueuePage combinada antes da Fase 8.2.
  scope: "mine" | "unassigned";
  priorityCardsLabel: string;
}

export function TicketQueueBoard({ scope, priorityCardsLabel }: TicketQueueBoardProps) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<TicketOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = searchParams.get("status") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const category = searchParams.get("category") ?? "";
  const q = searchParams.get("q") ?? "";
  // Sem controle próprio na barra de filtros — só chega aqui via link do
  // dashboard ("SLA estourado" → ?sla=breached, Fase 5).
  const sla = searchParams.get("sla") ?? "";
  const [searchInput, setSearchInput] = useState(q);
  const hasActiveFilters = Boolean(status || priority || category || q || sla);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    if (!auth) return;
    setTickets(null);
    listTickets(auth.token, {
      status: status || undefined,
      priority: priority || undefined,
      category_id: category || undefined,
      assignee_id: scope === "mine" ? auth.user.id : undefined,
      query: q || undefined,
      sla: sla || undefined,
    })
      .then((result) => setTickets(scope === "unassigned" ? result.filter((t) => t.assignee_id === null) : result))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar os chamados."));
  }, [auth, scope, status, priority, category, q, sla]);

  if (!auth) return null;

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    updateFilter("q", searchInput.trim());
  }

  function clearFilters() {
    setSearchParams({}, { replace: true });
  }

  const openOrInProgress = (tickets ?? []).filter((t) => t.status === "open" || t.status === "in_progress");
  const defaultView = sortByPriority(openOrInProgress);
  const filteredResults = sortByPriority(tickets ?? []);

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <FilterBar
        status={status}
        priority={priority}
        category={category}
        searchInput={searchInput}
        hasActiveFilters={hasActiveFilters}
        onStatusChange={(v) => updateFilter("status", v)}
        onPriorityChange={(v) => updateFilter("priority", v)}
        onCategoryChange={(v) => updateFilter("category", v)}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={submitSearch}
        onClear={clearFilters}
      />

      {tickets === null && !error ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : hasActiveFilters ? (
        <>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
              Resultados filtrados
              {sla === "breached" && (
                <span className="rounded-full bg-crit-tint px-2 py-0.5 text-[11px] font-bold text-crit normal-case">
                  SLA estourado
                </span>
              )}
            </span>
            <span className="text-xs font-bold text-slate-400">{filteredResults.length}</span>
          </div>
          <TicketTable tickets={filteredResults} onRowClick={(id) => navigate(`/tickets/${id}`)} />
        </>
      ) : (
        <>
          <div className="mb-2.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
            {priorityCardsLabel}
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {PRIORITY_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateFilter("priority", p)}
                className="rounded-2xl border border-slate-200 bg-white p-4.5 text-left shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)] transition hover:border-slate-300 hover:shadow-[0_1px_3px_rgba(16,24,40,.08),0_4px_10px_rgba(16,24,40,.08)]"
              >
                <div className="mb-2 text-[12.5px] font-semibold text-slate-500">{PRIORITY_LABELS[p]}</div>
                <div className={`text-3xl font-extrabold ${PRIORITY_TEXT[p]}`}>
                  {openOrInProgress.filter((t) => t.priority === p).length}
                </div>
              </button>
            ))}
          </div>

          <TicketTable tickets={defaultView} onRowClick={(id) => navigate(`/tickets/${id}`)} />
        </>
      )}
    </>
  );
}
