import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, listAutomationRules, listNotifications, updateAutomationRule } from "../api";
import { useAuth } from "../auth/AuthContext";
import { homeRouteForRole } from "../auth/routing";
import { PriorityBadge } from "../components/PriorityBadge";
import { managerNavItems } from "../components/managerNavItems";
import { Sidebar } from "../components/Sidebar";
import type { AutomationNotification, AutomationRuleOut } from "../types";

// Fase 16 — Automações. 1 regra fixa ("chamado perto de estourar o SLA"),
// só o limiar editável — sem CRUD de regras novas (decisão confirmada com o
// usuário, mesmo padrão de SLARule/BusinessHours). Sem e-mail/SMS: a
// "notificação" é essa própria tela, consultada sob demanda (sem tabela de
// notificação persistida, sem scheduler em background).
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function RuleForm({ rule, token, onSaved }: { rule: AutomationRuleOut; token: string; onSaved: () => void }) {
  const [threshold, setThreshold] = useState(String(rule.threshold_percent));
  const [enabled, setEnabled] = useState(rule.enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateAutomationRule(token, rule.id, { threshold_percent: Number(threshold), enabled });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
    >
      <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-slate-600">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Regra ativa
      </label>
      <p className="mb-4 text-[13px] text-slate-500">
        Chamados que já consumiram esse percentual do prazo de SLA (ou já estouraram) aparecem na lista abaixo.
      </p>

      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="threshold">
        Limiar (% do prazo de SLA)
      </label>
      <input
        id="threshold"
        type="number"
        min={1}
        max={100}
        required
        disabled={!enabled}
        value={threshold}
        onChange={(e) => setThreshold(e.target.value)}
        className="mb-4 w-32 rounded-[10px] border-[1.5px] border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
      />

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="mb-3 text-sm font-bold text-low">Salvo.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

function NotificationsList({ notifications }: { notifications: AutomationNotification[] }) {
  const navigate = useNavigate();

  if (notifications.length === 0) {
    return (
      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
        <p className="text-sm text-slate-500">Nenhum chamado disparou a regra no momento.</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-2.5">
      {notifications.map((n) => (
        <div
          key={n.ticket_id}
          onClick={() => navigate(`/tickets/${n.ticket_id}`)}
          className={`flex cursor-pointer flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border bg-white p-4.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)] hover:border-slate-300 ${
            n.breached ? "border-crit-tint" : "border-slate-200"
          }`}
        >
          <div className="min-w-0 flex-1 font-bold text-slate-900">{n.title}</div>
          <PriorityBadge priority={n.priority} />
          <div className="w-44 shrink-0 text-right">
            <span className={`text-[13px] font-bold ${n.breached ? "text-crit" : "text-high"}`}>
              {n.elapsed_percent}% do prazo{n.breached ? " (estourado)" : ""}
            </span>
            <div className="text-[12px] text-slate-400">Prazo: {formatDateTime(n.sla_due_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AutomationsPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [rules, setRules] = useState<AutomationRuleOut[] | null>(null);
  const [notifications, setNotifications] = useState<AutomationNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (!auth) return;
    listAutomationRules(auth.token)
      .then(setRules)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao buscar a regra."));
    listNotifications(auth.token)
      .then(setNotifications)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao buscar as notificações."));
  }

  useEffect(reload, [auth]);

  if (!auth) return null;
  if (auth.user.role !== "manager") {
    return <Navigate to={homeRouteForRole(auth.user.role)} replace />;
  }

  const rule = rules?.[0];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel="Gestão"
        navItems={managerNavItems("/automacoes")}
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
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Automações</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="mb-6">
          <h2 className="mb-3 text-sm font-extrabold text-slate-700">Regra: chamado perto de estourar o SLA</h2>
          {rule ? (
            <RuleForm rule={rule} token={auth.token} onSaved={reload} />
          ) : (
            <p className="text-sm text-slate-500">Carregando...</p>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-extrabold text-slate-700">
            Chamados que dispararam a regra
            {notifications && notifications.length > 0 && (
              <span className="ml-2 rounded-full bg-crit-tint px-2.5 py-0.5 text-[12px] font-bold text-crit">
                {notifications.length}
              </span>
            )}
          </h2>
          {notifications === null ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <NotificationsList notifications={notifications} />
          )}
        </div>
      </div>
    </div>
  );
}
