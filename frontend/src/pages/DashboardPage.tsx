import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, getDashboardSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import { managerNavItems } from "../components/managerNavItems";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge } from "../components/StatusBadge";
import {
  IconAlertTriangle,
  IconFlag,
  IconLayers,
  IconServer,
  IconSparkle,
  IconTarget,
  IconTicket,
  IconUsers,
} from "../components/icons";
import { CATEGORY_NAMES } from "../devData";
import type { AIAccuracyMetric, DashboardSummary, TicketStatus } from "../types";

const STATUS_ORDER: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

// Fase 5 (dashboard clicável): cada métrica vira link pra fila já filtrada.
// Categoria é filtrada por category_id no backend, mas o dashboard só devolve
// o nome (GET /dashboard/summary não expõe category_id) — reaproveita o
// espelho manual de devData.ts pra achar o id a partir do nome.
const CATEGORY_ID_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_NAMES).map(([id, name]) => [name, id]),
);

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  linkTo,
  children,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  linkTo?: string;
  children: ReactNode;
}) {
  const className =
    "block rounded-2xl border border-slate-200 bg-white p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]" +
    (linkTo ? " hover:border-slate-300 hover:shadow-[0_1px_3px_rgba(16,24,40,.08),0_4px_10px_rgba(16,24,40,.08)]" : "");
  const content = (
    <>
      <div className={`mb-3.5 flex h-10.5 w-10.5 items-center justify-center rounded-xl ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="mb-1.5 text-xs font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      {children}
    </>
  );
  return linkTo ? (
    <Link to={linkTo} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function AccuracyCard({ title, metric, icon }: { title: string; metric: AIAccuracyMetric; icon: ReactNode }) {
  const pct = metric.suggested_total > 0 ? Math.round((metric.matched / metric.suggested_total) * 100) : null;
  return (
    <StatCard icon={icon} iconBg="bg-primary-tint" iconColor="text-primary" label={title}>
      {metric.suggested_total === 0 ? (
        <p className="text-sm text-slate-500">Nenhum chamado com sugestão da IA ainda.</p>
      ) : (
        <>
          <p className="mb-1 text-[28px] leading-none font-extrabold text-slate-900">{pct}%</p>
          <p className="text-[12.5px] text-slate-400">
            mantida — {metric.matched} de {metric.suggested_total} com sugestão da IA
          </p>
        </>
      )}
    </StatCard>
  );
}

export function DashboardPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    getDashboardSummary(auth.token)
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar o dashboard."));
  }, [auth]);

  if (!auth) return null;

  const pctResolved =
    summary && summary.ai_resolution.total_tickets > 0
      ? Math.round((summary.ai_resolution.resolved_by_ai / summary.ai_resolution.total_tickets) * 100)
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel="Gestão"
        navItems={managerNavItems("/dashboard")}
        userName={auth.user.name}
        userRoleLabel="Gestor(a)"
        userRole={auth.user.role}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-5.5">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Dashboard do gestor</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {summary === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : summary ? (
          <>
            {/* Hero: % resolvido pela IA */}
            <div className="mb-5.5 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-[#0F3FC4] to-primary p-6.5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                  <IconSparkle width={13} height={13} className="text-white" />
                  <span className="text-[11px] font-extrabold tracking-wide uppercase">
                    Métrica central do projeto
                  </span>
                </div>
                <div className="mb-0.5 text-sm font-semibold text-white/85">% resolvido pela IA, sem técnico</div>
                <div className="text-[13px] text-white/65">
                  {summary.ai_resolution.resolved_by_ai} de {summary.ai_resolution.total_tickets} chamado(s)
                  fechados pelo próprio usuário a partir da sugestão da IA
                </div>
              </div>
              {pctResolved !== null && (
                <div className="text-[56px] leading-none font-extrabold tracking-tight">{pctResolved}%</div>
              )}
            </div>

            {/* Volume + top categorias */}
            <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10.5 w-10.5 items-center justify-center rounded-xl bg-primary-tint">
                    <IconTicket width={20} height={20} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                      Volume de chamados
                    </div>
                    <div className="text-[26px] leading-none font-extrabold text-slate-900">
                      {summary.total_tickets}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDER.map((status) => (
                    <Link
                      key={status}
                      to={`/fila?status=${status}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 py-1.5 pr-3 pl-1 hover:bg-slate-100"
                    >
                      <StatusBadge status={status} />
                      <span className="text-[12.5px] font-bold text-slate-700">
                        {summary.by_status[status] ?? 0}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10.5 w-10.5 items-center justify-center rounded-xl bg-high-tint">
                    <IconLayers width={20} height={20} className="text-high" />
                  </div>
                  <div className="text-xs font-bold tracking-wide text-slate-400 uppercase">Top categorias</div>
                </div>
                {summary.top_categories.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum chamado categorizado ainda.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {summary.top_categories.map((cat) => {
                      const categoryId = CATEGORY_ID_BY_NAME[cat.name];
                      const row = (
                        <>
                          <span className="text-slate-600">{cat.name}</span>
                          <span className="font-extrabold text-slate-900">{cat.count}</span>
                        </>
                      );
                      return categoryId ? (
                        <Link
                          key={cat.name}
                          to={`/fila?category=${categoryId}`}
                          className="flex items-center justify-between rounded-lg px-1 py-0.5 text-[13.5px] hover:bg-slate-50"
                        >
                          {row}
                        </Link>
                      ) : (
                        <div key={cat.name} className="flex items-center justify-between px-1 py-0.5 text-[13.5px]">
                          {row}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SLA + acerto da IA */}
            <div className="mb-2.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
              SLA e acerto da IA na triagem
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <StatCard
                icon={<IconAlertTriangle width={20} height={20} />}
                iconBg="bg-crit-tint"
                iconColor="text-crit"
                label="SLA estourado"
                linkTo={summary.sla.breached > 0 ? "/fila?sla=breached" : undefined}
              >
                {summary.sla.tracked_total === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum chamado com SLA calculado ainda.</p>
                ) : (
                  <>
                    <p
                      className={`mb-1 text-[28px] leading-none font-extrabold ${
                        summary.sla.breached > 0 ? "text-crit" : "text-slate-900"
                      }`}
                    >
                      {summary.sla.breached}
                    </p>
                    <p className="text-[12.5px] text-slate-400">de {summary.sla.tracked_total} com prazo calculado</p>
                  </>
                )}
              </StatCard>

              <AccuracyCard
                title="Prioridade"
                metric={summary.ai_accuracy_priority}
                icon={<IconTarget width={20} height={20} />}
              />
              <AccuracyCard
                title="Categoria"
                metric={summary.ai_accuracy_category}
                icon={<IconTarget width={20} height={20} />}
              />
            </div>

            {/* Produtividade por técnico (Fase 14 — Dashboard expandido) */}
            <div className="mt-6 mb-2.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
              Produtividade da equipe
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10.5 w-10.5 items-center justify-center rounded-xl bg-primary-tint">
                  <IconUsers width={20} height={20} className="text-primary" />
                </div>
                <div className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                  Chamados resolvidos por técnico
                </div>
              </div>
              {summary.productivity_by_technician.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum chamado resolvido/fechado ainda.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {summary.productivity_by_technician.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-[13.5px]">
                      <span className="text-slate-600">{p.name}</span>
                      <span className="font-extrabold text-slate-900">{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CMDB + Problem Management (Fase 6) — sem tela de CRUD
                dedicada nesta fase; só o vínculo com chamados, aqui. */}
            <div className="mt-6 mb-2.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
              CMDB e Problem Management
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10.5 w-10.5 items-center justify-center rounded-xl bg-primary-tint">
                    <IconServer width={20} height={20} className="text-primary" />
                  </div>
                  <div className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                    Ativos com mais chamados
                  </div>
                </div>
                {summary.top_assets.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum chamado vinculado a um ativo ainda.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {summary.top_assets.map((a) => (
                      <div key={a.name} className="flex items-center justify-between text-[13.5px]">
                        <span className="text-slate-600">{a.name}</span>
                        <span className="font-extrabold text-slate-900">{a.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10.5 w-10.5 items-center justify-center rounded-xl bg-high-tint">
                    <IconFlag width={20} height={20} className="text-high" />
                  </div>
                  <div className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                    Problemas com mais chamados
                  </div>
                </div>
                {summary.top_problems.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum chamado vinculado a um problema ainda.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {summary.top_problems.map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-[13.5px]">
                        <span className="text-slate-600">{p.name}</span>
                        <span className="font-extrabold text-slate-900">{p.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
