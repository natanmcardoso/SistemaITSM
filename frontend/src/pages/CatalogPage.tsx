import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, listServices } from "../api";
import { useAuth } from "../auth/AuthContext";
import { IconLayers, IconLogout } from "../components/icons";
import { CATEGORY_NAMES } from "../devData";
import type { ServiceOut } from "../types";

// Fase 12 — Catálogo de Serviços, consumido pelo usuário final. Lista os
// serviços cadastrados em Configurações (aba "Serviços", técnico/gestor);
// escolher um leva pro formulário de sempre em /novo-chamado, já com a
// categoria pré-selecionada (service_id vai no payload de POST /tickets,
// que herda a categoria do serviço — ver app/routers/tickets.py). A
// descrição do chamado continua livre — sem formulário dinâmico por serviço
// (decisão registrada em CLAUDE.md: escopo de portfólio, não o framework
// inteiro de catálogo de serviços).
export function CatalogPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    listServices(auth.token)
      .then(setServices)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar o catálogo."));
  }, [auth]);

  if (!auth) return null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-7">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                <IconLayers width={15} height={15} strokeWidth={2} className="text-white" />
              </div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Catálogo de Serviços</h1>
            </div>
            <p className="text-sm text-slate-500">Logado como {auth.user.name}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/meus-chamados"
              className="rounded-full border-[1.5px] border-primary px-4 py-2 text-[13px] font-bold text-primary hover:bg-primary-tint"
            >
              Meus chamados
            </Link>
            <Link
              to="/novo-chamado"
              className="rounded-full border-[1.5px] border-slate-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              Abrir por texto livre
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

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {services === null && !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : services && services.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]">
            <p className="mb-4 text-sm text-slate-500">Nenhum serviço cadastrado no catálogo ainda.</p>
            <Link
              to="/novo-chamado"
              className="inline-block rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark"
            >
              Abrir chamado por texto livre
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {services?.map((service) => (
              <div
                key={service.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_2px_6px_rgba(16,24,40,.06)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 text-[11.5px] font-bold tracking-wide text-primary uppercase">
                    {CATEGORY_NAMES[service.category_id] ?? "—"}
                  </div>
                  <div className="font-extrabold text-slate-900">{service.name}</div>
                  {service.description && (
                    <div className="mt-1 text-[13px] text-slate-500">{service.description}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/novo-chamado?service_id=${service.id}`)}
                  className="shrink-0 rounded-[10px] bg-primary px-4 py-2.5 text-[13px] font-bold text-white hover:bg-primary-dark"
                >
                  Abrir chamado
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
