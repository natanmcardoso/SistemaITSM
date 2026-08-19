import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, listKbArticles } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { IconBook, IconSearch, IconTicket } from "../components/icons";
import { CATEGORY_NAMES } from "../devData";
import type { KBArticleOut } from "../types";

// Base de conhecimento (design doc §2.2: "Base de conhecimento — busca/consulta"),
// tela do técnico. Só existe agora porque o backend passou a suportar busca
// por texto (GET /kb-articles?query=) — antes só tinha o filtro por
// categoria, usado internamente pela sugestão automática do usuário final.
export function KnowledgeBasePage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [articles, setArticles] = useState<KBArticleOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    const timeout = setTimeout(() => {
      listKbArticles(auth.token, { query: searchTerm || undefined, category_id: categoryId || undefined })
        .then(setArticles)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao buscar a base de conhecimento."));
    }, 250);
    return () => clearTimeout(timeout);
  }, [auth, searchTerm, categoryId]);

  if (!auth) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        groupLabel="Chamados"
        navItems={[
          { label: "Fila de chamados", icon: <IconTicket width={18} height={18} />, href: "/fila" },
          {
            label: "Base de conhecimento",
            icon: <IconBook width={18} height={18} />,
            href: "/base-conhecimento",
            active: true,
          },
        ]}
        userName={auth.user.name}
        userRoleLabel="Técnico(a)"
        onSignOut={() => {
          signOut();
          navigate("/login");
        }}
      />

      <div className="min-w-0 flex-1 px-8 py-7">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Base de conhecimento</h1>
            <p className="mt-0.5 text-sm text-slate-500">Logado como {auth.user.name}</p>
          </div>
        </div>

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
        ) : articles && articles.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum artigo encontrado.</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {articles?.map((article) => (
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
                </div>
                <p className="text-sm whitespace-pre-line text-slate-600">{article.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
