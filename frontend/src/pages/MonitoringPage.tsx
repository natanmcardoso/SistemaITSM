import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, getMonitoringSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import { homeRouteForRole } from "../auth/routing";
import { IconActivity, IconAlertTriangle, IconClock, IconTicket } from "../components/icons";
import { managerNavItems } from "../components/managerNavItems";
import { Sidebar } from "../components/Sidebar";
import type { MonitoringSummary } from "../types";

// Fase 17 — Monitoramento: saúde do próprio sistema (uptime, taxa de
// erro), não os `assets` do CMDB nem RMM. Restrito a gestor (decisão
// confirmada com o usuário — estende a persona que já tem
// Dashboard/Relatórios/Automações). Uptime vem do processo do backend (em
// memória, reseta a cada restart); o resto vem do log persistido de
// requisições, sempre numa janela de tempo (24h por padrão).
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}min`);
  return parts.join(" ");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
      <div className={`mb-3.5 flex h-10.5 w-10.5 items-center justify-center rounded-xl ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="mb-1.5 text-xs font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <p className="text-[26px] leading-none font-extrabold text-slate-900">{value}</p>
      {hint && <p className="mt-1.5 text-[12.5px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function MonitoringPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || auth.user.role !== "manager") return;
    getMonitoringSummary(auth.token)
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar o monitoramento."));
  }, [auth]);

  if (!auth) return null;
  if (auth.user.role !== "manager") {
    return <Navigate to={homeRouteForRole(auth.user.role)} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel="Gestão"
        navItems={managerNavItems("/monitoramento")}
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
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Monitoramento</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {summary === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : summary ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<IconActivity width={20} height={20} />}
                iconBg="bg-low-tint"
                iconColor="text-low"
                label="No ar desde o último restart"
                value={formatUptime(summary.uptime_seconds)}
                hint={`Desde ${formatDateTime(summary.uptime_since)}`}
              />
              <StatCard
                icon={<IconTicket width={20} height={20} />}
                iconBg="bg-primary-tint"
                iconColor="text-primary"
                label={`Requisições (${summary.window_hours}h)`}
                value={String(summary.total_requests)}
              />
              <StatCard
                icon={<IconAlertTriangle width={20} height={20} />}
                iconBg="bg-crit-tint"
                iconColor="text-crit"
                label="Erros (5xx)"
                value={String(summary.error_requests)}
              />
              <StatCard
                icon={<IconClock width={20} height={20} />}
                iconBg={summary.error_rate_percent > 0 ? "bg-crit-tint" : "bg-low-tint"}
                iconColor={summary.error_rate_percent > 0 ? "text-crit" : "text-low"}
                label="Taxa de erro"
                value={`${summary.error_rate_percent}%`}
              />
            </div>

            <h2 className="mb-3 text-sm font-extrabold text-slate-700">Erros recentes</h2>
            {summary.recent_errors.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
                <p className="text-sm text-slate-500">Nenhum erro registrado na janela de {summary.window_hours}h.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        Método
                      </th>
                      <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        Caminho
                      </th>
                      <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        Status
                      </th>
                      <th className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        Quando
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent_errors.map((e, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-bold text-slate-700">{e.method}</td>
                        <td className="px-4 py-3 font-mono text-[12.5px] text-slate-600">{e.path}</td>
                        <td className="px-4 py-3 font-bold text-crit">{e.status_code}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(e.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
