import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, createTicket, getKbArticlesByCategory, listServices, resolveByUser } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PriorityBadge } from "../components/PriorityBadge";
import { IconCheck, IconHome, IconLayers, IconLogout, IconSparkle, IconTicket } from "../components/icons";
import { CATEGORY_NAMES } from "../devData";
import type { KBArticleOut, ServiceOut, TicketOut } from "../types";

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
  const [searchParams] = useSearchParams();
  const serviceIdFromCatalog = searchParams.get("service_id");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<TicketOut | null>(null);

  // Fase 12 (Catálogo de Serviços) — chegando de /catalogo?service_id=, busca
  // o serviço pra mostrar o nome/categoria no formulário e mandar service_id
  // junto na criação (o backend herda a categoria dele). Sem GET /services/{id}
  // dedicado (mesma decisão de "sem GET por id" já usada em categories) —
  // busca a lista toda e filtra, igual o resto do frontend faz com devData.
  const [catalogService, setCatalogService] = useState<ServiceOut | null | undefined>(
    serviceIdFromCatalog ? undefined : null,
  );

  useEffect(() => {
    if (!auth || !serviceIdFromCatalog) return;
    listServices(auth.token)
      .then((services) => setCatalogService(services.find((s) => s.id === serviceIdFromCatalog) ?? null))
      .catch(() => setCatalogService(null));
  }, [auth, serviceIdFromCatalog]);

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
        ...(catalogService
          ? { service_id: catalogService.id, category_id: catalogService.category_id }
          : {}),
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
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-7">
      <div className="mx-auto max-w-xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                <IconTicket width={15} height={15} strokeWidth={2} className="text-white" />
              </div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Novo chamado</h1>
            </div>
            <p className="text-sm text-slate-500">Logado como {auth.user.name}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/inicio"
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-slate-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <IconHome width={14} height={14} />
              Início
            </Link>
            <Link
              to="/catalogo"
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-slate-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <IconLayers width={14} height={14} />
              Catálogo
            </Link>
            <Link
              to="/meus-chamados"
              className="rounded-full border-[1.5px] border-primary px-4 py-2 text-[13px] font-bold text-primary hover:bg-primary-tint"
            >
              Meus chamados
            </Link>
            <button
              onClick={() => {
                signOut();
                navigate("/login");
              }}
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-slate-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <IconLogout width={14} height={14} />
              Sair
            </button>
          </div>
        </header>

        {!created ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
          >
            {catalogService && (
              <div className="mb-5 flex items-center gap-2 rounded-[10px] border border-[#C7D7FB] bg-primary-tint px-3.5 py-2.5">
                <IconLayers width={14} height={14} className="shrink-0 text-primary" />
                <p className="text-[13px] text-slate-700">
                  Abrindo chamado a partir do serviço <span className="font-bold">{catalogService.name}</span> —
                  categoria <span className="font-bold">{CATEGORY_NAMES[catalogService.category_id] ?? "—"}</span>{" "}
                  já selecionada.
                </p>
              </div>
            )}

            <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="title">
              Título
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumo curto do problema"
              className="mb-4.5 w-full rounded-[10px] border-[1.5px] border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
            />

            <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="description">
              Descrição
            </label>
            <textarea
              id="description"
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema com o máximo de detalhes possível"
              className="mb-6 w-full resize-none rounded-[10px] border-[1.5px] border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
            />

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-[10px] bg-primary py-3 text-sm font-bold text-white shadow-[0_1px_2px_rgba(29,79,216,.16)] transition hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Abrir chamado"}
            </button>
          </form>
        ) : resolved ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
            <p className="text-sm font-bold text-low">Chamado resolvido — obrigado!</p>
            <h2 className="mt-3 text-lg font-extrabold text-slate-900">{created.title}</h2>
            <p className="mt-3 text-sm text-slate-600">
              Como o artigo sugerido resolveu o seu problema, o chamado foi fechado sem precisar de um
              técnico. Isso ajuda o time a focar nos casos que realmente precisam de atendimento.
            </p>
            <button
              onClick={handleNewTicket}
              className="mt-6 w-full rounded-[10px] bg-primary py-3 text-sm font-bold text-white transition hover:bg-primary-dark"
            >
              Abrir outro chamado
            </button>
          </div>
        ) : kbArticle === undefined && created.status === "open" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
            <p className="text-sm text-slate-500">Verificando se há um artigo que resolva na hora...</p>
          </div>
        ) : showingSuggestion && kbArticle ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-low" />
              <span className="text-[13px] font-bold text-low">Chamado aberto</span>
            </div>
            <h2 className="mb-5 text-lg font-extrabold tracking-tight text-slate-900">{created.title}</h2>

            <div className="mb-5.5 rounded-2xl border border-[#C7D7FB] bg-primary-tint p-5">
              <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-white py-1 pr-3 pl-2">
                <IconSparkle width={13} height={13} className="text-primary" />
                <span className="text-[11.5px] font-extrabold tracking-wide text-primary uppercase">
                  Talvez isto resolva agora
                </span>
              </div>
              <div className="mb-2.5 text-base font-extrabold text-slate-900">{kbArticle.title}</div>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-slate-600">{kbArticle.content}</p>
            </div>

            {resolveError && <p className="mb-3 text-sm text-red-600">{resolveError}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-low py-3 text-sm font-bold text-white shadow-[0_1px_2px_rgba(22,163,74,.18)] transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <IconCheck width={16} height={16} strokeWidth={2.3} />
                {resolving ? "Marcando..." : "Resolveu, pode fechar"}
              </button>
              <button
                onClick={() => setDeclinedSuggestion(true)}
                disabled={resolving}
                className="flex-1 rounded-[10px] border-[1.5px] border-slate-300 bg-white text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Não resolveu
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
            <p className="text-sm font-bold text-low">Chamado aberto com sucesso.</p>
            <h2 className="mt-3 text-lg font-extrabold text-slate-900">{created.title}</h2>

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
              className="mt-6 w-full rounded-[10px] bg-primary py-3 text-sm font-bold text-white transition hover:bg-primary-dark"
            >
              Abrir outro chamado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
