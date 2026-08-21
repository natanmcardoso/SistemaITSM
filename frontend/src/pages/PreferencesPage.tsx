import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { homeRouteForRole } from "../auth/routing";
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_OPTIONS } from "../components/TicketQueueBoard";
import { Sidebar } from "../components/Sidebar";
import { technicianNavItems } from "../components/technicianNavItems";
import {
  hasQueueFilterPreference,
  loadQueueFilterPreference,
  saveQueueFilterPreference,
  type QueueFilterPreference,
} from "../components/queuePreferences";
import { CATEGORY_NAMES } from "../devData";

// Fase 14 — "Prioridades" (preferências de visualização), item do menu do
// usuário. Interpretação registrada (o pedido original só dizia
// "preferências de visualização", sem detalhar): filtro padrão de
// status/prioridade/categoria aplicado automaticamente ao abrir a fila
// ("Fila geral"/"Meus chamados"), sem precisar reconfigurar toda vez. Só
// técnico tem fila própria pra isso valer a pena (ver Sidebar.tsx).
export function PreferencesPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [pref, setPref] = useState<QueueFilterPreference>(() => loadQueueFilterPreference());
  const [saved, setSaved] = useState(false);

  if (!auth) return null;
  if (auth.user.role !== "technician") {
    return <Navigate to={homeRouteForRole(auth.user.role)} replace />;
  }

  function handleSave() {
    saveQueueFilterPreference(pref);
    setSaved(true);
  }

  function handleClear() {
    const empty: QueueFilterPreference = { status: "", priority: "", category: "" };
    setPref(empty);
    saveQueueFilterPreference(empty);
    setSaved(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel="Chamados"
        navItems={technicianNavItems("")}
        userName={auth.user.name}
        userRoleLabel="Técnico(a)"
        userRole={auth.user.role}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-5.5">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Prioridades</h1>
          <p className="mt-0.5 text-sm text-slate-500">Filtro padrão aplicado ao abrir suas filas</p>
        </div>

        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
          <p className="mb-5 text-sm text-slate-500">
            Quando "Fila geral" ou "Meus chamados" abrirem sem nenhum filtro ativo, este filtro entra
            automaticamente. Não afeta links que já chegam filtrados (ex.: "SLA estourado" do dashboard).
          </p>

          <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="pref-status">
            Status
          </label>
          <select
            id="pref-status"
            value={pref.status}
            onChange={(e) => setPref((p) => ({ ...p, status: e.target.value }))}
            className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="pref-priority">
            Prioridade
          </label>
          <select
            id="pref-priority"
            value={pref.priority}
            onChange={(e) => setPref((p) => ({ ...p, priority: e.target.value }))}
            className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
          >
            <option value="">Todas</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>

          <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="pref-category">
            Categoria
          </label>
          <select
            id="pref-category"
            value={pref.category}
            onChange={(e) => setPref((p) => ({ ...p, category: e.target.value }))}
            className="mb-5 w-full rounded-[10px] border-[1.5px] border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
          >
            <option value="">Todas</option>
            {Object.entries(CATEGORY_NAMES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          {saved && <p className="mb-3 text-sm font-bold text-low">Preferência salva.</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark"
            >
              Salvar preferência
            </button>
            {hasQueueFilterPreference(pref) && (
              <button
                onClick={handleClear}
                className="rounded-[10px] border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
