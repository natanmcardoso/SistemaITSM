import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, createTicket } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PriorityBadge } from "../components/PriorityBadge";
import { CATEGORY_NAMES } from "../devData";
import type { TicketOut } from "../types";

// Tela 2/3 da fase 4 — abertura de chamado pelo usuário final (design doc §2.1).
// Ainda não existem endpoints de KB/resolve-by-user no backend, então a etapa
// "sugestão de artigo + resolveu/não resolveu" fica para uma fase futura; por
// ora, a confirmação mostra a categoria/prioridade que a IA já classificou
// automaticamente na criação (POST /tickets dispara a triagem).
export function NewTicketPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<TicketOut | null>(null);

  if (!auth) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await createTicket(auth.token, {
        title,
        description,
        requester_id: auth.user.id,
      });
      setCreated(ticket);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível abrir o chamado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewTicket() {
    setTitle("");
    setDescription("");
    setCreated(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Novo chamado</h1>
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

        {created ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">Chamado aberto com sucesso.</p>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{created.title}</h2>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Categoria sugerida pela IA:</dt>
                <dd className="text-slate-800">
                  {created.ai_suggested_category_id
                    ? CATEGORY_NAMES[created.ai_suggested_category_id] ?? "—"
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Prioridade sugerida pela IA:</dt>
                <dd>
                  <PriorityBadge priority={created.ai_suggested_priority} />
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-sm text-slate-500">
              Um técnico vai atender seu chamado em breve. Você pode acompanhar o status pelo histórico
              (em uma fase futura desta tela).
            </p>

            <button
              onClick={handleNewTicket}
              className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Abrir outro chamado
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <label className="block text-sm font-medium text-slate-700" htmlFor="title">
              Título
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumo curto do problema"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />

            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="description">
              Descrição
            </label>
            <textarea
              id="description"
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema com o máximo de detalhes possível"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Abrir chamado"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
