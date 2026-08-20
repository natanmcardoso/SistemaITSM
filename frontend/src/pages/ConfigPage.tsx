import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ApiError,
  createCategory,
  listCategories,
  listSlaRules,
  updateCategory,
  updateSlaRule,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { homeRouteForRole } from "../auth/routing";
import { IconEdit, IconPlus } from "../components/icons";
import { managerNavItems } from "../components/managerNavItems";
import { Sidebar } from "../components/Sidebar";
import { technicianNavItems } from "../components/technicianNavItems";
import type { CategoryOut, SLARuleOut, TicketPriority } from "../types";

// Fase 10 — Configurações restantes: CRUD de categorias e edição de regras
// de SLA, restritos a technician/manager no backend (require_role). O CRUD
// de KB já tinha saído na Fase 8; esta fase fecha as duas peças que
// faltavam nas configurações do sistema.
//
// Acessível pelas duas personas que gerenciam o sistema (mesma tela, sidebar
// diferente conforme o role — mesmo padrão de TicketDetailPage). Usuário
// final não tem link pra cá; se acessar a URL direto, é redirecionado pra
// casa (o backend também barraria as chamadas com 403).

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

type Tab = "categorias" | "sla";

interface CategoryFormValues {
  name: string;
  defaultSlaHours: string;
}

function CategoryForm({
  initial,
  submitLabel,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  initial: CategoryFormValues;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  onSubmit: (values: CategoryFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [defaultSlaHours, setDefaultSlaHours] = useState(initial.defaultSlaHours);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), defaultSlaHours });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#C7D7FB] bg-primary-tint p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
    >
      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="category-name">
        Nome
      </label>
      <input
        id="category-name"
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="category-sla">
        SLA padrão (horas)
      </label>
      <input
        id="category-sla"
        type="number"
        min={1}
        required
        value={defaultSlaHours}
        onChange={(e) => setDefaultSlaHours(e.target.value)}
        className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Salvando..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-[10px] border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CategoriesSection({ token }: { token: string }) {
  const [categories, setCategories] = useState<CategoryOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    listCategories(token)
      .then(setCategories)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao buscar as categorias."));
  }

  useEffect(reload, [token]);

  async function handleCreate(values: CategoryFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      await createCategory(token, { name: values.name, default_sla_hours: Number(values.defaultSlaHours) });
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível criar a categoria.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(categoryId: string, values: CategoryFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      await updateCategory(token, categoryId, {
        name: values.name,
        default_sla_hours: Number(values.defaultSlaHours),
      });
      setEditingId(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Categorias usadas na triagem e no roteamento dos chamados.</p>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setFormError(null);
              setCreating(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-dark"
          >
            <IconPlus width={14} height={14} strokeWidth={2.3} />
            Nova categoria
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-4">
          <CategoryForm
            initial={{ name: "", defaultSlaHours: "24" }}
            submitLabel="Criar categoria"
            saving={saving}
            error={formError}
            onSubmit={handleCreate}
            onCancel={() => {
              setCreating(false);
              setFormError(null);
            }}
          />
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {categories === null && !error ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {categories?.map((category) =>
            editingId === category.id ? (
              <CategoryForm
                key={category.id}
                initial={{ name: category.name, defaultSlaHours: String(category.default_sla_hours) }}
                submitLabel="Salvar alterações"
                saving={saving}
                error={formError}
                onSubmit={(values) => handleUpdate(category.id, values)}
                onCancel={() => {
                  setEditingId(null);
                  setFormError(null);
                }}
              />
            ) : (
              <div
                key={category.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-slate-900">{category.name}</div>
                  <div className="text-[12.5px] text-slate-500">SLA padrão: {category.default_sla_hours}h</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setFormError(null);
                    setEditingId(category.id);
                  }}
                  aria-label="Editar categoria"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary"
                >
                  <IconEdit width={15} height={15} />
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function SlaRuleRow({ rule, token, onSaved }: { rule: SLARuleOut; token: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [responseHours, setResponseHours] = useState(String(rule.response_time_hours));
  const [resolutionHours, setResolutionHours] = useState(String(rule.resolution_time_hours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateSlaRule(token, rule.id, {
        response_time_hours: Number(responseHours),
        resolution_time_hours: Number(resolutionHours),
      });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#C7D7FB] bg-primary-tint p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
      >
        <div className="mb-3.5 font-extrabold text-slate-900">{PRIORITY_LABELS[rule.priority]}</div>

        <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor={`sla-response-${rule.id}`}>
          Tempo de resposta (horas)
        </label>
        <input
          id={`sla-response-${rule.id}`}
          type="number"
          min={1}
          required
          value={responseHours}
          onChange={(e) => setResponseHours(e.target.value)}
          className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
        />

        <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor={`sla-resolution-${rule.id}`}>
          Tempo de resolução (horas)
        </label>
        <input
          id={`sla-resolution-${rule.id}`}
          type="number"
          min={1}
          required
          value={resolutionHours}
          onChange={(e) => setResolutionHours(e.target.value)}
          className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
          <button
            type="button"
            onClick={() => {
              setResponseHours(String(rule.response_time_hours));
              setResolutionHours(String(rule.resolution_time_hours));
              setError(null);
              setEditing(false);
            }}
            disabled={saving}
            className="rounded-[10px] border-[1.5px] border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
      <div className="min-w-0 flex-1">
        <div className="font-extrabold text-slate-900">{PRIORITY_LABELS[rule.priority]}</div>
        <div className="text-[12.5px] text-slate-500">
          Resposta: {rule.response_time_hours}h · Resolução: {rule.resolution_time_hours}h
        </div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Editar regra de SLA"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary"
      >
        <IconEdit width={15} height={15} />
      </button>
    </div>
  );
}

function SlaRulesSection({ token }: { token: string }) {
  const [rules, setRules] = useState<SLARuleOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    listSlaRules(token)
      .then(setRules)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao buscar as regras de SLA."));
  }

  useEffect(reload, [token]);

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        As 4 prioridades já são fixas — aqui só se ajustam os prazos de cada uma.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {rules === null && !error ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rules?.map((rule) => (
            <SlaRuleRow key={rule.id} rule={rule} token={token} onSaved={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ConfigPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("categorias");

  if (!auth) return null;
  if (auth.user.role === "end_user") return <Navigate to={homeRouteForRole(auth.user.role)} replace />;

  const isTechnician = auth.user.role === "technician";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel={isTechnician ? "Chamados" : "Gestão"}
        navItems={isTechnician ? technicianNavItems("/configuracoes") : managerNavItems("/configuracoes")}
        userName={auth.user.name}
        userRoleLabel={isTechnician ? "Técnico(a)" : "Gestor(a)"}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-6">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Configurações</h1>
          <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
        </div>

        <div className="mb-6 flex gap-1.5 border-b border-slate-200">
          {(
            [
              ["categorias", "Categorias"],
              ["sla", "Regras de SLA"],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-bold ${
                tab === value
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "categorias" ? <CategoriesSection token={auth.token} /> : <SlaRulesSection token={auth.token} />}
      </div>
    </div>
  );
}
