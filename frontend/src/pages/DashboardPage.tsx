import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, getDashboardSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../components/StatusBadge";
import type { AIAccuracyMetric, DashboardSummary, TicketStatus } from "../types";

const STATUS_ORDER: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

function AccuracyCard({ title, metric }: { title: string; metric: AIAccuracyMetric }) {
  const pct = metric.suggested_total > 0 ? Math.round((metric.matched / metric.suggested_total) * 100) : null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {metric.suggested_total === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nenhum chamado com sugestão da IA ainda.</p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{pct}%</p>
          <p className="mt-1 text-sm text-slate-500">
            mantida pelo técnico — {metric.matched} de {metric.suggested_total} chamado(s) com sugestão da IA
            ({metric.changed} reclassificado(s))
          </p>
        </>
      )}
    </div>
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

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard do gestor</h1>
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

        {summary === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : summary ? (
          <>
            <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Volume de chamados
                </h3>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{summary.total_tickets}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {STATUS_ORDER.map((status) => (
                    <span key={status} className="flex items-center gap-1.5 text-sm text-slate-600">
                      <StatusBadge status={status} />
                      {summary.by_status[status] ?? 0}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Top categorias
                </h3>
                {summary.top_categories.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Nenhum chamado categorizado ainda.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {summary.top_categories.map((cat) => (
                      <li key={cat.name} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{cat.name}</span>
                        <span className="font-medium text-slate-900">{cat.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              SLA e acerto da IA na triagem
            </h2>
            <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  SLA estourado
                </h3>
                {summary.sla.tracked_total === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Nenhum chamado com SLA calculado ainda.</p>
                ) : (
                  <>
                    <p
                      className={`mt-3 text-3xl font-semibold ${
                        summary.sla.breached > 0 ? "text-red-600" : "text-slate-900"
                      }`}
                    >
                      {summary.sla.breached}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      de {summary.sla.tracked_total} chamado(s) com prazo calculado, ainda abertos e já
                      passado do prazo
                    </p>
                  </>
                )}
              </div>
              <AccuracyCard title="Prioridade" metric={summary.ai_accuracy_priority} />
              <AccuracyCard title="Categoria" metric={summary.ai_accuracy_category} />
            </section>

            <p className="text-xs text-slate-400">
              % de chamados resolvidos sem intervenção humana ainda não aparece aqui — depende de um fluxo
              que o backend ainda não implementa (usuário fechar o próprio chamado a partir da sugestão da
              IA).
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
