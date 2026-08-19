import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, listTickets } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PriorityBadge } from "../components/PriorityBadge";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge } from "../components/StatusBadge";
import { IconBook, IconTicket } from "../components/icons";
import { CATEGORY_NAMES, TECHNICIANS, USER_NAMES } from "../devData";
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
  assignee,
  searchInput,
  hasActiveFilters,
  onStatusChange,
  onPriorityChange,
  onCategoryChange,
  onAssigneeChange,
  onSearchInputChange,
  onSearchSubmit,
  onClear,
}: {
  status: string;
  priority: string;
  category: string;
  assignee: string;
  searchInput: string;
  hasActiveFilters: boolean;
  onStatusChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onAssigneeChange: (v: string) => void;
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
  const assigneeOptions = [
    { value: "", label: "Todos" },
    ...TECHNICIANS.map((t) => ({ value: t.id, label: t.name })),
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
            placeholder="Título ou descrição..."
            className="w-48 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700"
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
      <FilterSelect label="Técnico" value={assignee} options={assigneeOptions} onChange={onAssigneeChange} />
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

function TicketTable({ tickets, onRowClick }: { tickets: TicketOut[]; onRowClick: (id: string) => void }) {
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

export function QueuePage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<TicketOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = searchParams.get("status") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const category = searchParams.get("category") ?? "";
  const assignee = searchParams.get("assignee") ?? "";
  const q = searchParams.get("q") ?? "";
  // Sem controle próprio na barra de filtros — só chega aqui via link do
  // dashboard ("SLA estourado" → /fila?sla=breached, Fase 5).
  const sla = searchParams.get("sla") ?? "";
  const [searchInput, setSearchInput] = useState(q);
  const hasActiveFilters = Boolean(status || priority || category || assignee || q || sla);

  // Mantém o campo de busca em sincronia se a URL mudar por fora (ex.: botão
  // "Limpar filtros", navegação de volta pelo browser).
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
      assignee_id: assignee || undefined,
      query: q || undefined,
      sla: sla || undefined,
    })
      .then(setTickets)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar a fila."));
  }, [auth, status, priority, category, assignee, q, sla]);

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

  // Sem filtro ativo: comportamento original — só chamados abertos/em
  // andamento, divididos em "meus" vs. "fila geral". Com filtro ativo: lista
  // única (o filtro pode cruzar as duas divisões, ex. status=resolved).
  const openOrInProgress = (tickets ?? []).filter((t) => t.status === "open" || t.status === "in_progress");
  const mine = sortByPriority(openOrInProgress.filter((t) => t.assignee_id === auth.user.id));
  const unassigned = sortByPriority(openOrInProgress.filter((t) => t.assignee_id === null));
  const filteredResults = sortByPriority(tickets ?? []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        groupLabel="Chamados"
        navItems={[
          { label: "Fila de chamados", icon: <IconTicket width={18} height={18} />, href: "/fila", active: true },
          { label: "Base de conhecimento", icon: <IconBook width={18} height={18} />, href: "/base-conhecimento" },
        ]}
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

        <FilterBar
          status={status}
          priority={priority}
          category={category}
          assignee={assignee}
          searchInput={searchInput}
          hasActiveFilters={hasActiveFilters}
          onStatusChange={(v) => updateFilter("status", v)}
          onPriorityChange={(v) => updateFilter("priority", v)}
          onCategoryChange={(v) => updateFilter("category", v)}
          onAssigneeChange={(v) => updateFilter("assignee", v)}
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
              Chamados em aberto por prioridade
            </div>
            <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              {PRIORITY_ORDER.map((p) => (
                <div
                  key={p}
                  className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
                >
                  <div className="mb-2 text-[12.5px] font-semibold text-slate-500">{PRIORITY_LABELS[p]}</div>
                  <div className={`text-3xl font-extrabold ${PRIORITY_TEXT[p]}`}>
                    {openOrInProgress.filter((t) => t.priority === p).length}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Meus chamados</span>
              <span className="text-xs font-bold text-slate-400">{mine.length}</span>
            </div>
            <div className="mb-6">
              <TicketTable tickets={mine} onRowClick={(id) => navigate(`/tickets/${id}`)} />
            </div>

            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                Fila geral — não atribuídos
              </span>
              <span className="text-xs font-bold text-slate-400">{unassigned.length}</span>
            </div>
            <TicketTable tickets={unassigned} onRowClick={(id) => navigate(`/tickets/${id}`)} />
          </>
        )}
      </div>
    </div>
  );
}
