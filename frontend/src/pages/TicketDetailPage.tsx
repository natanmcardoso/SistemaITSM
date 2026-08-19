import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addInteraction, ApiError, getTicketDetail, updateTicket } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PriorityBadge } from "../components/PriorityBadge";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge } from "../components/StatusBadge";
import { IconTicket } from "../components/icons";
import { CATEGORY_NAMES, USER_NAMES } from "../devData";
import type { TicketDetailOut, TicketPriority, TicketStatus } from "../types";

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em andamento" },
  { value: "resolved", label: "Resolvido" },
  { value: "closed", label: "Fechado" },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "critical", label: "Crítica" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Tela de detalhe do chamado (design doc §2.2: "histórico + sugestão da IA +
// campo de ação"). Único ponto do frontend que chama PATCH /tickets/{id} e
// POST /tickets/{id}/interactions — até aqui, a fila era só leitura.
export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<TicketDetailOut | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [status, setStatus] = useState<TicketStatus>("open");
  const [priority, setPriority] = useState<TicketPriority>("low");
  const [categoryId, setCategoryId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newInteraction, setNewInteraction] = useState("");
  const [addingInteraction, setAddingInteraction] = useState(false);
  const [interactionError, setInteractionError] = useState<string | null>(null);

  function loadTicket() {
    if (!auth || !ticketId) return;
    getTicketDetail(auth.token, ticketId)
      .then((t) => {
        setTicket(t);
        setStatus(t.status);
        setPriority(t.priority ?? "low");
        setCategoryId(t.category_id ?? "");
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Falha ao carregar o chamado."));
  }

  useEffect(loadTicket, [auth, ticketId]);

  if (!auth) return null;

  async function handleAssignToMe() {
    if (!auth || !ticket) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateTicket(auth.token, ticket.id, { assignee_id: auth.user.id });
      loadTicket();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Não foi possível atribuir o chamado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!auth || !ticket) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateTicket(auth.token, ticket.id, {
        status,
        priority,
        category_id: categoryId || undefined,
      });
      loadTicket();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddInteraction(e: FormEvent) {
    e.preventDefault();
    if (!auth || !ticket || !newInteraction.trim()) return;
    setAddingInteraction(true);
    setInteractionError(null);
    try {
      await addInteraction(auth.token, ticket.id, newInteraction.trim());
      setNewInteraction("");
      loadTicket();
    } catch (err) {
      setInteractionError(err instanceof ApiError ? err.message : "Não foi possível registrar a atualização.");
    } finally {
      setAddingInteraction(false);
    }
  }

  const reclassifiedPriority =
    ticket?.ai_suggested_priority !== null && ticket?.ai_suggested_priority !== ticket?.priority;
  const reclassifiedCategory =
    ticket?.ai_suggested_category_id !== null && ticket?.ai_suggested_category_id !== ticket?.category_id;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        groupLabel="Chamados"
        navItem={{ label: "Fila de chamados", icon: <IconTicket width={18} height={18} /> }}
        userName={auth.user.name}
        userRoleLabel="Técnico(a)"
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-8 py-7">
        <Link to="/fila" className="mb-4 inline-block text-sm font-bold text-slate-500 hover:text-slate-700">
          ← Voltar pra fila
        </Link>

        {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}

        {!ticket && !loadError ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : ticket ? (
          <div className="max-w-3xl">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">{ticket.title}</h1>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>

            {/* Info do chamado */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
              <p className="mb-4 text-sm whitespace-pre-line text-slate-700">{ticket.description}</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="mb-0.5 text-xs font-bold text-slate-400 uppercase">Solicitante</dt>
                  <dd className="text-slate-700">{USER_NAMES[ticket.requester_id] ?? "—"}</dd>
                </div>
                <div>
                  <dt className="mb-0.5 text-xs font-bold text-slate-400 uppercase">Categoria</dt>
                  <dd className="text-slate-700">
                    {ticket.category_id ? CATEGORY_NAMES[ticket.category_id] ?? "—" : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="mb-0.5 text-xs font-bold text-slate-400 uppercase">Atribuído a</dt>
                  <dd className="text-slate-700">
                    {ticket.assignee_id ? USER_NAMES[ticket.assignee_id] ?? "—" : "Não atribuído"}
                  </dd>
                </div>
                <div>
                  <dt className="mb-0.5 text-xs font-bold text-slate-400 uppercase">Criado em</dt>
                  <dd className="text-slate-700">{formatDate(ticket.created_at)}</dd>
                </div>
                <div>
                  <dt className="mb-0.5 text-xs font-bold text-slate-400 uppercase">Prazo de SLA</dt>
                  <dd className="text-slate-700">{ticket.sla_due_at ? formatDate(ticket.sla_due_at) : "—"}</dd>
                </div>
              </dl>
            </div>

            {/* Sugestão da IA */}
            {(ticket.ai_suggested_priority || ticket.ai_suggested_category_id) && (
              <div className="mb-4 rounded-2xl border border-[#C7D7FB] bg-primary-tint p-5">
                <div className="mb-2 text-xs font-bold text-primary uppercase">Sugestão original da IA</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
                  <span>
                    Prioridade: <PriorityBadge priority={ticket.ai_suggested_priority} />{" "}
                    {reclassifiedPriority ? "(reclassificada)" : "(mantida)"}
                  </span>
                  <span>
                    Categoria:{" "}
                    {ticket.ai_suggested_category_id ? CATEGORY_NAMES[ticket.ai_suggested_category_id] ?? "—" : "—"}{" "}
                    {reclassifiedCategory ? "(reclassificada)" : "(mantida)"}
                  </span>
                </div>
              </div>
            )}

            {/* Ações do técnico */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
              <div className="mb-4 text-xs font-bold tracking-wider text-slate-400 uppercase">
                Ações do técnico
              </div>

              {ticket.assignee_id !== auth.user.id && (
                <button
                  onClick={handleAssignToMe}
                  disabled={saving}
                  className="mb-4 rounded-[10px] border-[1.5px] border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary-tint disabled:opacity-60"
                >
                  Atribuir a mim
                </button>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-bold text-slate-600">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TicketStatus)}
                    className="w-full rounded-[10px] border-[1.5px] border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-bold text-slate-600">Prioridade</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TicketPriority)}
                    className="w-full rounded-[10px] border-[1.5px] border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-bold text-slate-600">Categoria</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-[10px] border-[1.5px] border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">Sem categoria</option>
                    {Object.entries(CATEGORY_NAMES).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-4 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>

            {/* Histórico */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
              <div className="mb-4 text-xs font-bold tracking-wider text-slate-400 uppercase">Histórico</div>

              {ticket.interactions.length === 0 ? (
                <p className="mb-4 text-sm text-slate-500">Nenhuma atualização registrada ainda.</p>
              ) : (
                <div className="mb-5 flex flex-col gap-4">
                  {ticket.interactions.map((interaction) => (
                    <div key={interaction.id} className="border-l-2 border-slate-200 pl-3.5">
                      <div className="mb-0.5 flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-700">
                          {USER_NAMES[interaction.author_id] ?? "—"}
                        </span>
                        <span className="text-slate-400">{formatDate(interaction.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-line text-slate-600">{interaction.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddInteraction}>
                <textarea
                  value={newInteraction}
                  onChange={(e) => setNewInteraction(e.target.value)}
                  placeholder="Registrar uma atualização sobre o atendimento..."
                  rows={3}
                  className="mb-3 w-full resize-none rounded-[10px] border-[1.5px] border-slate-300 px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
                {interactionError && <p className="mb-3 text-sm text-red-600">{interactionError}</p>}
                <button
                  type="submit"
                  disabled={addingInteraction || !newInteraction.trim()}
                  className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {addingInteraction ? "Registrando..." : "Registrar atualização"}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
