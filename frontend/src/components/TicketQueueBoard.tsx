import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, listTickets } from "../api";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_NAMES, USER_NAMES } from "../devData";
import type { TicketOut, TicketPriority } from "../types";
import { IconColumns } from "./icons";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

// Peças compartilhadas entre as duas telas de fila do técnico ("Meus
// chamados" e "Fila geral — não atribuídos", Fase 8.2) — antes viviam só
// dentro de QueuePage.tsx, quando as duas seções ficavam empilhadas numa
// única tela. Sem filtro "Técnico" aqui (existia na Fase 5): o escopo já é
// fixo por tela, então esse filtro nunca fazia sentido pra nenhuma das duas.
//
// Fase 9: tabela ganhou colunas de data de abertura e SLA, cabeçalhos
// clicáveis pra ordenar, e um seletor de colunas visíveis (persistido em
// localStorage) — pedido do usuário depois da Fase 8.

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
const STATUS_RANK: Record<string, number> = { open: 0, in_progress: 1, resolved: 2, closed: 3 };

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isBreached(t: TicketOut): boolean {
  if (!t.sla_due_at) return false;
  if (t.status === "resolved" || t.status === "closed") return false;
  return new Date(t.sla_due_at).getTime() < Date.now();
}

// --- Colunas da tabela: registro único usado pro cabeçalho, pra célula e
// pro seletor de colunas visíveis (Fase 9). ---
export type ColumnKey =
  | "title"
  | "category"
  | "requester"
  | "priority"
  | "status"
  | "aiSuggestion"
  | "createdAt"
  | "sla";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  sortValue: (t: TicketOut) => number | string;
  render: (t: TicketOut) => ReactNode;
}

const COLUMNS: ColumnDef[] = [
  {
    key: "title",
    label: "Título",
    sortValue: (t) => t.title.toLowerCase(),
    render: (t) => <span className="font-bold text-slate-900">{t.title}</span>,
  },
  {
    key: "category",
    label: "Categoria",
    sortValue: (t) => (t.category_id ? CATEGORY_NAMES[t.category_id] ?? "" : ""),
    render: (t) => (
      <span className="text-slate-600">{t.category_id ? CATEGORY_NAMES[t.category_id] ?? "—" : "—"}</span>
    ),
  },
  {
    key: "requester",
    label: "Solicitante",
    sortValue: (t) => USER_NAMES[t.requester_id] ?? "",
    render: (t) => <span className="text-slate-600">{USER_NAMES[t.requester_id] ?? "—"}</span>,
  },
  {
    key: "priority",
    label: "Prioridade",
    sortValue: (t) => (t.priority ? PRIORITY_RANK[t.priority] : 99),
    render: (t) => <PriorityBadge priority={t.priority} />,
  },
  {
    key: "status",
    label: "Status",
    sortValue: (t) => STATUS_RANK[t.status] ?? 99,
    render: (t) => <StatusBadge status={t.status} />,
  },
  {
    key: "aiSuggestion",
    label: "Sugestão da IA",
    sortValue: (t) => (t.ai_suggested_priority ? (t.ai_suggested_priority !== t.priority ? "alterada" : "mantida") : ""),
    render: (t) => {
      const reclassified = t.ai_suggested_priority !== null && t.ai_suggested_priority !== t.priority;
      return (
        <span className="text-slate-400">
          {t.ai_suggested_priority ? (
            reclassified ? (
              <span title="Técnico reclassificou a prioridade sugerida pela IA">
                alterada (IA sugeriu <PriorityBadge priority={t.ai_suggested_priority} />)
              </span>
            ) : (
              "mantida"
            )
          ) : (
            "—"
          )}
        </span>
      );
    },
  },
  {
    key: "createdAt",
    label: "Aberto em",
    sortValue: (t) => new Date(t.created_at).getTime(),
    render: (t) => <span className="text-slate-500">{formatDate(t.created_at)}</span>,
  },
  {
    key: "sla",
    label: "SLA",
    sortValue: (t) => (t.sla_due_at ? new Date(t.sla_due_at).getTime() : Number.POSITIVE_INFINITY),
    render: (t) =>
      t.sla_due_at ? (
        <span className={isBreached(t) ? "font-bold text-crit" : "text-slate-500"}>
          {formatDate(t.sla_due_at)}
          {isBreached(t) && " (estourado)"}
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
  },
];

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = COLUMNS.map((c) => c.key);
const VISIBLE_COLUMNS_STORAGE_KEY = "itsm.queueVisibleColumns";

function loadVisibleColumns(): ColumnKey[] {
  try {
    const raw = localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE_COLUMNS;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((k): k is ColumnKey => COLUMNS.some((c) => c.key === k));
    return valid.length > 0 ? valid : DEFAULT_VISIBLE_COLUMNS;
  } catch {
    return DEFAULT_VISIBLE_COLUMNS;
  }
}

// Seletor de colunas visíveis — cada técnico escolhe o que quer ver (ex.:
// só SLA e Título), a escolha fica salva no navegador (localStorage,
// compartilhado entre "Meus chamados" e "Fila geral").
function ColumnPicker({
  visible,
  onToggle,
}: {
  visible: Set<ColumnKey>;
  onToggle: (key: ColumnKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
      >
        <IconColumns width={14} height={14} />
        Colunas
      </button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_16px_rgba(16,24,40,.12)]">
          <div className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Colunas visíveis
          </div>
          <div className="flex flex-col gap-1.5">
            {COLUMNS.map((col) => {
              const checked = visible.has(col.key);
              const isLastOne = checked && visible.size === 1;
              return (
                <label
                  key={col.key}
                  className={`flex items-center gap-2 text-sm text-slate-700 ${isLastOne ? "opacity-50" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLastOne}
                    onChange={() => onToggle(col.key)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {col.label}
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-lg bg-slate-100 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
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

export interface SortState {
  key: ColumnKey | null;
  direction: "asc" | "desc";
}

export function TicketTable({
  tickets,
  onRowClick,
  visibleColumns,
  sort,
  onSortChange,
}: {
  tickets: TicketOut[];
  onRowClick: (id: string) => void;
  visibleColumns: Set<ColumnKey>;
  sort: SortState;
  onSortChange: (key: ColumnKey) => void;
}) {
  const columns = COLUMNS.filter((c) => visibleColumns.has(c.key));

  if (tickets.length === 0) {
    return <p className="py-6 text-sm text-slate-500">Nenhum chamado aqui no momento.</p>;
  }
  if (columns.length === 0) {
    return <p className="py-6 text-sm text-slate-500">Nenhuma coluna selecionada — ajuste em "Colunas".</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sort.key === col.key;
              return (
                <th key={col.key} className="px-4 pt-3.5 pb-2.5">
                  <button
                    type="button"
                    onClick={() => onSortChange(col.key)}
                    className={`flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase hover:text-slate-600 ${
                      active ? "text-primary" : "text-slate-400"
                    }`}
                  >
                    {col.label}
                    <span className="text-[9px]">{active ? (sort.direction === "asc" ? "▲" : "▼") : ""}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              onClick={() => onRowClick(ticket.id)}
              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3.5">
                  {col.render(ticket)}
                </td>
              ))}
            </tr>
          ))}
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
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(loadVisibleColumns()));
  const [sort, setSort] = useState<SortState>({ key: null, direction: "asc" });

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

  useEffect(() => {
    localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

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

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // sempre pelo menos 1 coluna visível
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleSortChange(key: ColumnKey) {
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" },
    );
  }

  const openOrInProgress = (tickets ?? []).filter((t) => t.status === "open" || t.status === "in_progress");
  const baseDefaultView = sortByPriority(openOrInProgress);
  const baseFilteredResults = sortByPriority(tickets ?? []);

  // Ordenação por coluna (clique no cabeçalho) sobrepõe a ordenação padrão
  // por prioridade — só entra em ação depois que o usuário clica em algum
  // cabeçalho; sem clique nenhum, mantém o comportamento de sempre.
  function applySort(list: TicketOut[]): TicketOut[] {
    if (!sort.key) return list;
    const col = COLUMNS.find((c) => c.key === sort.key);
    if (!col) return list;
    const sorted = [...list].sort((a, b) => {
      const va = col.sortValue(a);
      const vb = col.sortValue(b);
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    });
    return sort.direction === "desc" ? sorted.reverse() : sorted;
  }

  const defaultView = useMemo(() => applySort(baseDefaultView), [baseDefaultView, sort]);
  const filteredResults = useMemo(() => applySort(baseFilteredResults), [baseFilteredResults, sort]);

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
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400">{filteredResults.length}</span>
              <ColumnPicker visible={visibleColumns} onToggle={toggleColumn} />
            </div>
          </div>
          <TicketTable
            tickets={filteredResults}
            onRowClick={(id) => navigate(`/tickets/${id}`)}
            visibleColumns={visibleColumns}
            sort={sort}
            onSortChange={handleSortChange}
          />
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

          <div className="mb-2.5 flex justify-end">
            <ColumnPicker visible={visibleColumns} onToggle={toggleColumn} />
          </div>
          <TicketTable
            tickets={defaultView}
            onRowClick={(id) => navigate(`/tickets/${id}`)}
            visibleColumns={visibleColumns}
            sort={sort}
            onSortChange={handleSortChange}
          />
        </>
      )}
    </>
  );
}
