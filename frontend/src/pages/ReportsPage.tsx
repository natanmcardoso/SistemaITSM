import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getDashboardSummary, getMyDashboardSummary, listTickets } from "../api";
import { useAuth } from "../auth/AuthContext";
import { homeRouteForRole } from "../auth/routing";
import { downloadCsv } from "../components/csvExport";
import { IconDownload, IconPrinter } from "../components/icons";
import { managerNavItems } from "../components/managerNavItems";
import { Sidebar } from "../components/Sidebar";
import { technicianNavItems } from "../components/technicianNavItems";
import { PRIORITY_LABELS } from "../components/TicketQueueBoard";
import { CATEGORY_NAMES, USER_NAMES } from "../devData";
import type { DashboardSummary, TechnicianDashboardSummary, TicketOut } from "../types";

// Fase 15 — Relatórios: exportação (CSV/PDF) do que já existe no dashboard,
// sem endpoint novo (reaproveita GET /dashboard/summary, GET
// /dashboard/my-summary e GET /tickets, todos já existentes). Escopo
// confirmado com o usuário antes de codar: gestor E técnico têm acesso
// (cada um exporta o próprio resumo — Fase 14); PDF é impressão do
// navegador (window.print(), sem lib nova) — os botões/sidebar somem na
// impressão via `print:hidden`, só o conteúdo do relatório fica visível.

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function ticketsToCsvRows(tickets: TicketOut[]): (string | number)[][] {
  const header = [
    "Título",
    "Categoria",
    "Prioridade",
    "Status",
    "Solicitante",
    "Atribuído a",
    "Criado em",
    "Prazo de SLA",
  ];
  const rows = tickets.map((t) => [
    t.title,
    t.category_id ? CATEGORY_NAMES[t.category_id] ?? "" : "",
    t.priority ? PRIORITY_LABELS[t.priority] ?? t.priority : "",
    STATUS_LABELS[t.status] ?? t.status,
    USER_NAMES[t.requester_id] ?? "",
    t.assignee_id ? USER_NAMES[t.assignee_id] ?? "" : "",
    formatDate(t.created_at),
    t.sla_due_at ? formatDate(t.sla_due_at) : "",
  ]);
  return [header, ...rows];
}

function ManagerSummarySection({ summary }: { summary: DashboardSummary }) {
  const csvRows: (string | number)[][] = [
    ["Métrica", "Valor"],
    ["Total de chamados", summary.total_tickets],
    ...Object.entries(summary.by_status).map(([status, count]) => [
      `Status: ${STATUS_LABELS[status] ?? status}`,
      count,
    ]),
    ...summary.top_categories.map((c) => [`Categoria: ${c.name}`, c.count]),
    ["SLA — com prazo calculado", summary.sla.tracked_total],
    ["SLA — estourado", summary.sla.breached],
    ["Acerto da IA (prioridade) — sugeridos", summary.ai_accuracy_priority.suggested_total],
    ["Acerto da IA (prioridade) — mantidos", summary.ai_accuracy_priority.matched],
    ["Acerto da IA (categoria) — sugeridos", summary.ai_accuracy_category.suggested_total],
    ["Acerto da IA (categoria) — mantidos", summary.ai_accuracy_category.matched],
    ["Resolvido pela IA sem técnico", summary.ai_resolution.resolved_by_ai],
    ...summary.productivity_by_technician.map((p) => [`Produtividade: ${p.name}`, p.count]),
  ];

  return (
    <ReportCard
      title="Resumo do dashboard"
      onExportCsv={() => downloadCsv("resumo-dashboard.csv", csvRows)}
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Metric label="Total de chamados" value={summary.total_tickets} />
        <Metric label="SLA estourado" value={`${summary.sla.breached} de ${summary.sla.tracked_total}`} />
        <Metric
          label="Acerto da IA — prioridade"
          value={`${summary.ai_accuracy_priority.matched} de ${summary.ai_accuracy_priority.suggested_total}`}
        />
        <Metric
          label="Acerto da IA — categoria"
          value={`${summary.ai_accuracy_category.matched} de ${summary.ai_accuracy_category.suggested_total}`}
        />
        <Metric
          label="Resolvido pela IA sem técnico"
          value={`${summary.ai_resolution.resolved_by_ai} de ${summary.ai_resolution.total_tickets}`}
        />
      </dl>

      <SubTable title="Por status" rows={Object.entries(summary.by_status).map(([s, c]) => [STATUS_LABELS[s] ?? s, c])} />
      <SubTable title="Top categorias" rows={summary.top_categories.map((c) => [c.name, c.count])} />
      <SubTable
        title="Produtividade por técnico"
        rows={summary.productivity_by_technician.map((p) => [p.name, p.count])}
        emptyLabel="Nenhum chamado resolvido/fechado ainda."
      />
    </ReportCard>
  );
}

function TechnicianSummarySection({ summary }: { summary: TechnicianDashboardSummary }) {
  const csvRows: (string | number)[][] = [
    ["Métrica", "Valor"],
    ["Meus chamados", summary.meus_chamados],
    ["Pendências", summary.pendencias],
    ["Chamados críticos", summary.criticos],
    ["Aguardando resposta", summary.aguardando_resposta],
  ];

  return (
    <ReportCard title="Meu resumo" onExportCsv={() => downloadCsv("meu-resumo.csv", csvRows)}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Metric label="Meus chamados" value={summary.meus_chamados} />
        <Metric label="Pendências" value={summary.pendencias} />
        <Metric label="Chamados críticos" value={summary.criticos} />
        <Metric label="Aguardando resposta" value={summary.aguardando_resposta} />
      </dl>
    </ReportCard>
  );
}

function TicketsSection({
  title,
  filename,
  tickets,
}: {
  title: string;
  filename: string;
  tickets: TicketOut[];
}) {
  const csvRows = ticketsToCsvRows(tickets);

  return (
    <ReportCard title={title} onExportCsv={() => downloadCsv(filename, csvRows)}>
      {tickets.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum chamado encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                <th className="py-1.5 pr-4">Título</th>
                <th className="py-1.5 pr-4">Categoria</th>
                <th className="py-1.5 pr-4">Prioridade</th>
                <th className="py-1.5 pr-4">Status</th>
                <th className="py-1.5 pr-4">Aberto em</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-4 font-semibold text-slate-800">{t.title}</td>
                  <td className="py-1.5 pr-4 text-slate-600">
                    {t.category_id ? CATEGORY_NAMES[t.category_id] ?? "—" : "—"}
                  </td>
                  <td className="py-1.5 pr-4 text-slate-600">{t.priority ? PRIORITY_LABELS[t.priority] : "—"}</td>
                  <td className="py-1.5 pr-4 text-slate-600">{STATUS_LABELS[t.status] ?? t.status}</td>
                  <td className="py-1.5 pr-4 text-slate-600">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportCard>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="mb-0.5 text-xs font-bold text-slate-400 uppercase">{label}</dt>
      <dd className="text-lg font-extrabold text-slate-900">{value}</dd>
    </div>
  );
}

function SubTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: [string, number][];
  emptyLabel?: string;
}) {
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="mb-2 text-xs font-bold tracking-wide text-slate-400 uppercase">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel ?? "Sem dados ainda."}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between text-[13.5px]">
              <span className="text-slate-600">{name}</span>
              <span className="font-extrabold text-slate-900">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  title,
  onExportCsv,
  children,
}: {
  title: string;
  onExportCsv: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)] print:break-inside-avoid print:border-0 print:shadow-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:mb-3">
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 rounded-full border-[1.5px] border-slate-300 bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-slate-600 hover:bg-slate-50"
          >
            <IconDownload width={13} height={13} />
            Exportar CSV
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

export function ReportsPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [managerSummary, setManagerSummary] = useState<DashboardSummary | null>(null);
  const [techSummary, setTechSummary] = useState<TechnicianDashboardSummary | null>(null);
  const [tickets, setTickets] = useState<TicketOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isManager = auth?.user.role === "manager";
  const isTechnician = auth?.user.role === "technician";

  useEffect(() => {
    if (!auth) return;
    if (isManager) {
      getDashboardSummary(auth.token).then(setManagerSummary).catch(() => setError("Falha ao carregar o resumo."));
      listTickets(auth.token, {}).then(setTickets).catch(() => setError("Falha ao carregar os chamados."));
    } else if (isTechnician) {
      getMyDashboardSummary(auth.token).then(setTechSummary).catch(() => setError("Falha ao carregar o resumo."));
      listTickets(auth.token, { assignee_id: auth.user.id }).then(setTickets).catch(() => setError("Falha ao carregar os chamados."));
    }
  }, [auth, isManager, isTechnician]);

  if (!auth) return null;
  // Só gestor/técnico têm relatório pra exportar (Fase 15) — usuário final e
  // admin não têm dashboard próprio ainda.
  if (!isManager && !isTechnician) {
    return <Navigate to={homeRouteForRole(auth.user.role)} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <div className="print:hidden">
        <Sidebar
          groupLabel={isManager ? "Gestão" : "Chamados"}
          navItems={isManager ? managerNavItems("/relatorios") : technicianNavItems("/relatorios")}
          userName={auth.user.name}
          userRoleLabel={isManager ? "Gestor(a)" : "Técnico(a)"}
          userRole={auth.user.role}
          onSignOut={() => {
            signOut();
            navigate("/login");
          }}
        />
      </div>

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 print:p-0">
        <div className="mb-5.5 flex flex-wrap items-center justify-between gap-3 print:mb-4">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Relatórios</h1>
            <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-dark print:hidden"
          >
            <IconPrinter width={14} height={14} />
            Exportar PDF (imprimir)
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-600 print:hidden">{error}</p>}

        {isManager &&
          (managerSummary === null ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <ManagerSummarySection summary={managerSummary} />
          ))}

        {isTechnician &&
          (techSummary === null ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <TechnicianSummarySection summary={techSummary} />
          ))}

        {tickets === null ? (
          <p className="text-sm text-slate-500">Carregando chamados...</p>
        ) : (
          <TicketsSection
            title={isManager ? "Todos os chamados" : "Meus chamados"}
            filename={isManager ? "todos-os-chamados.csv" : "meus-chamados.csv"}
            tickets={tickets}
          />
        )}
      </div>
    </div>
  );
}
