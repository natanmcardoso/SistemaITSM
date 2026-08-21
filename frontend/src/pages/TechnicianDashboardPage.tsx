import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError, getMyDashboardSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import { homeRouteForRole } from "../auth/routing";
import { Sidebar } from "../components/Sidebar";
import { technicianNavItems } from "../components/technicianNavItems";
import { IconAlertTriangle, IconClock, IconTicket, IconUsers } from "../components/icons";
import type { TechnicianDashboardSummary } from "../types";

// Fase 14 (Dashboard expandido) — dashboard pessoal do técnico. Hoje só o
// gestor tinha dashboard; "meus chamados/pendências/aguardando resposta"
// são pessoais por natureza (decisão confirmada com o usuário), então
// viraram uma tela nova em vez de entrar no dashboard do gestor.
//
// Sem clique-pra-filtrar como o dashboard do gestor (Fase 5.3) — os 4
// números já são o próprio recorte "meus chamados ativos", então o destino
// óbvio de todos seria a mesma tela (/meus-atendimentos); não adiciona valor
// real ter 4 links pro mesmo lugar.
function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
      <div className={`mb-3.5 flex h-10.5 w-10.5 items-center justify-center rounded-xl ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="mb-1.5 text-xs font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <p className="text-[28px] leading-none font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

export function TechnicianDashboardPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TechnicianDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    getMyDashboardSummary(auth.token)
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar o dashboard."));
  }, [auth]);

  if (!auth) return null;
  // Dashboard pessoal — sem sentido pra outro role acessar (diferente de
  // /fila, que o gestor alcança de propósito via links do dashboard dele).
  if (auth.user.role !== "technician") {
    return <Navigate to={homeRouteForRole(auth.user.role)} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel="Chamados"
        navItems={technicianNavItems("/meu-dashboard")}
        userName={auth.user.name}
        userRoleLabel="Técnico(a)"
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-5.5">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Meu dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {summary === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : summary ? (
          <>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<IconTicket width={20} height={20} />}
                iconBg="bg-primary-tint"
                iconColor="text-primary"
                label="Meus chamados"
                value={summary.meus_chamados}
              />
              <StatCard
                icon={<IconUsers width={20} height={20} />}
                iconBg="bg-med-tint"
                iconColor="text-med"
                label="Pendências"
                value={summary.pendencias}
              />
              <StatCard
                icon={<IconAlertTriangle width={20} height={20} />}
                iconBg="bg-crit-tint"
                iconColor="text-crit"
                label="Chamados críticos"
                value={summary.criticos}
              />
              <StatCard
                icon={<IconClock width={20} height={20} />}
                iconBg="bg-high-tint"
                iconColor="text-high"
                label="Aguardando resposta"
                value={summary.aguardando_resposta}
              />
            </div>

            <Link
              to="/meus-atendimentos"
              className="mt-5 inline-block rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark"
            >
              Ver meus chamados
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
