import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, createTicket, getKbArticlesByCategory, resolveByUser } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PriorityBadge } from "../components/PriorityBadge";
import { CATEGORY_NAMES } from "../devData";
import type { KBArticleOut, TicketOut } from "../types";

// Tela 2/3 da fase 4 — abertura de chamado pelo usuário final (design doc §2.1).
// Fluxo completo desde a sub-fase resolve-by-user: cria o chamado (IA já
// triando) -> se a categoria final bate com algum artigo da KB, mostra a
// sugestão com "resolveu"/"não resolveu" -> "resolveu" fecha o chamado via
// POST /tickets/{id}/resolve-by-user (resolved_by_ai=true, alimenta a
// métrica central do dashboard); "não resolveu" (ou sem artigo) segue pro
// fluxo de sempre: chamado vai pra fila do técnico.
export function NewTicketPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<TicketOut | null>(null);

  // undefined = ainda verificando; null = verificado, sem artigo pra essa categoria
  const [kbArticle, setKbArticle] = useState<KBArticleOut | null | undefined>(undefined);
  const [declinedSuggestion, setDeclinedSuggestion] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    // Só busca uma vez por chamado criado — evita refetch quando `created`
    // muda de novo após o resolve-by-user (status/resolved_by_ai mudam).
    if (!created || !auth || kbArticle !== undefined) return;
    const categoryId = created.category_id;
    if (!categoryId) {
      setKbArticle(null);
      return;
    }
    getKbArticlesByCategory(auth.token, categoryId)
      .then((articles) => setKbArticle(articles[0] ?? null))
      .catch(() => setKbArticle(null));
  }, [created, auth, kbArticle]);

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

  async function handleResolve() {
    if (!auth || !created) return;
    setResolving(true);
    setResolveError(null);
    try {
      const updated = await resolveByUser(auth.token, created.id);
      setCreated(updated);
    } catch (err) {
      setResolveError(
        err instanceof ApiError ? err.message : "Não foi possível marcar como resolvido. Tente novamente.",
      );
    } finally {
      setResolving(false);
    }
  }

  function handleNewTicket() {
    setTitle("");
    setDescription("");
    setCreated(null);
    setKbArticle(undefined);
    setDeclinedSuggestion(false);
    setResolveError(null);
  }

  const showingSuggestion = created && created.status === "open" && kbArticle && !declinedSuggestion;
  const resolved = created && created.resolved_by_ai;

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

        {!created ? (
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
        ) : resolved ? (
          <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">Chamado resolvido — obrigado!</p>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{created.title}</h2>
            <p className="mt-3 text-sm text-slate-600">
              Como o artigo sugerido resolveu o seu problema, o chamado foi fechado sem precisar de um
              técnico. Isso ajuda o time a focar nos casos que realmente precisam de atendimento.
            </p>
            <button
              onClick={handleNewTicket}
              className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Abrir outro chamado
            </button>
          </div>
        ) : kbArticle === undefined && created.status === "open" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Verificando se há um artigo que resolva na hora...</p>
          </div>
        ) : showingSuggestion && kbArticle ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">Chamado aberto — talvez isto resolva agora:</p>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{kbArticle.title}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{kbArticle.content}</p>

            {resolveError && <p className="mt-3 text-sm text-red-600">{resolveError}</p>}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {resolving ? "Marcando..." : "Resolveu, pode fechar"}
              </button>
              <button
                onClick={() => setDeclinedSuggestion(true)}
                disabled={resolving}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Não resolveu
              </button>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
