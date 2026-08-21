import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, createKbArticle, listKbArticles, updateKbArticle } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { technicianNavItems } from "../components/technicianNavItems";
import { IconEdit, IconPlus, IconSearch } from "../components/icons";
import { CATEGORY_NAMES } from "../devData";
import type { KBArticleOut } from "../types";

// Base de conhecimento (design doc §2.2: "Base de conhecimento — busca/consulta"),
// tela do técnico. Só existe agora porque o backend passou a suportar busca
// por texto (GET /kb-articles?query=) — antes só tinha o filtro por
// categoria, usado internamente pela sugestão automática do usuário final.
//
// Fase 8.4: ganhou criação e edição de artigo (sem exclusão — fora do
// pedido que originou esta sub-fase), restritas a técnico no backend
// (require_role("technician")).

interface ArticleFormValues {
  title: string;
  content: string;
  categoryId: string;
}

function ArticleForm({
  initial,
  submitLabel,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  initial: ArticleFormValues;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  onSubmit: (values: ArticleFormValues) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [categoryId, setCategoryId] = useState(initial.categoryId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ title: title.trim(), content: content.trim(), categoryId });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#C7D7FB] bg-primary-tint p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
    >
      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="article-title">
        Título
      </label>
      <input
        id="article-title"
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="article-content">
        Conteúdo
      </label>
      <textarea
        id="article-content"
        required
        rows={5}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="mb-3.5 w-full resize-none rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
      />

      <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="article-category">
        Categoria
      </label>
      <select
        id="article-category"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
      >
        <option value="">Sem categoria</option>
        {Object.entries(CATEGORY_NAMES).map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>

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

export function KnowledgeBasePage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [articles, setArticles] = useState<KBArticleOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    if (!auth) return;
    listKbArticles(auth.token, { query: searchTerm || undefined, category_id: categoryId || undefined })
      .then(setArticles)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao buscar a base de conhecimento."));
  }

  useEffect(() => {
    const timeout = setTimeout(reload, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, searchTerm, categoryId]);

  if (!auth) return null;

  async function handleCreate(values: ArticleFormValues) {
    if (!auth) return;
    setSaving(true);
    setFormError(null);
    try {
      await createKbArticle(auth.token, {
        title: values.title,
        content: values.content,
        category_id: values.categoryId || undefined,
      });
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível criar o artigo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(articleId: string, values: ArticleFormValues) {
    if (!auth) return;
    setSaving(true);
    setFormError(null);
    try {
      await updateKbArticle(auth.token, articleId, {
        title: values.title,
        content: values.content,
        category_id: values.categoryId || undefined,
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
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        groupLabel="Chamados"
        navItems={technicianNavItems("/base-conhecimento")}
        userName={auth.user.name}
        userRoleLabel="Técnico(a)"
        userRole={auth.user.role}
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Base de conhecimento</h1>
            <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
          </div>
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
              Novo artigo
            </button>
          )}
        </div>

        {creating && (
          <div className="mb-6">
            <ArticleForm
              initial={{ title: "", content: "", categoryId: "" }}
              submitLabel="Criar artigo"
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

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="relative min-w-[260px] flex-1">
            <IconSearch
              width={16}
              height={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título ou conteúdo"
              className="w-full rounded-full border-[1.5px] border-slate-300 bg-white py-2.5 pr-4 pl-9 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Todas as categorias</option>
            {Object.entries(CATEGORY_NAMES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {articles === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : articles && articles.length === 0 && !creating ? (
          <p className="text-sm text-slate-500">Nenhum artigo encontrado.</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {articles?.map((article) =>
              editingId === article.id ? (
                <ArticleForm
                  key={article.id}
                  initial={{
                    title: article.title,
                    content: article.content,
                    categoryId: article.category_id ?? "",
                  }}
                  submitLabel="Salvar alterações"
                  saving={saving}
                  error={formError}
                  onSubmit={(values) => handleUpdate(article.id, values)}
                  onCancel={() => {
                    setEditingId(null);
                    setFormError(null);
                  }}
                />
              ) : (
                <div
                  key={article.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
                >
                  <div className="mb-2 flex items-center gap-2.5">
                    <h2 className="text-base font-extrabold text-slate-900">{article.title}</h2>
                    {article.category_id && (
                      <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-bold text-primary">
                        {CATEGORY_NAMES[article.category_id] ?? "—"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setFormError(null);
                        setEditingId(article.id);
                      }}
                      aria-label="Editar artigo"
                      className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary"
                    >
                      <IconEdit width={15} height={15} />
                    </button>
                  </div>
                  <p className="text-sm whitespace-pre-line text-slate-600">{article.content}</p>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
