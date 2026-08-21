import type {
  AuditLogOut,
  CategoryCreate,
  CategoryOut,
  CategoryUpdate,
  DashboardSummary,
  GroupCreate,
  GroupMembersUpdate,
  GroupOut,
  InteractionOut,
  KBArticleCreate,
  KBArticleOut,
  KBArticleUpdate,
  ServiceCreate,
  ServiceOut,
  ServiceUpdate,
  SLARuleOut,
  SLARuleUpdate,
  TicketCreate,
  TicketDetailOut,
  TicketOut,
  TicketUpdate,
  TokenResponse,
  UserCreate,
  UserOut,
  UserUpdate,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? "Erro ao chamar a API");
  }
  return res.json();
}

export function login(email: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function listTickets(
  token: string,
  filters: {
    status?: string;
    priority?: string;
    category_id?: string;
    assignee_id?: string;
    requester_id?: string;
    query?: string;
    sla?: string;
  } = {},
): Promise<TicketOut[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<TicketOut[]>(`/tickets${query}`, { method: "GET" }, token);
}

export function createTicket(token: string, payload: TicketCreate): Promise<TicketOut> {
  return request<TicketOut>("/tickets", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function getDashboardSummary(token: string): Promise<DashboardSummary> {
  return request<DashboardSummary>("/dashboard/summary", { method: "GET" }, token);
}

export function getKbArticlesByCategory(token: string, categoryId: string): Promise<KBArticleOut[]> {
  const params = new URLSearchParams({ category_id: categoryId });
  return request<KBArticleOut[]>(`/kb-articles?${params.toString()}`, { method: "GET" }, token);
}

export function listKbArticles(
  token: string,
  filters: { category_id?: string; query?: string } = {},
): Promise<KBArticleOut[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  return request<KBArticleOut[]>(`/kb-articles${qs}`, { method: "GET" }, token);
}

export function createKbArticle(token: string, payload: KBArticleCreate): Promise<KBArticleOut> {
  return request<KBArticleOut>("/kb-articles", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateKbArticle(token: string, articleId: string, payload: KBArticleUpdate): Promise<KBArticleOut> {
  return request<KBArticleOut>(
    `/kb-articles/${articleId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    token,
  );
}

export function resolveByUser(token: string, ticketId: string): Promise<TicketOut> {
  return request<TicketOut>(`/tickets/${ticketId}/resolve-by-user`, { method: "POST" }, token);
}

export function getTicketDetail(token: string, ticketId: string): Promise<TicketDetailOut> {
  return request<TicketDetailOut>(`/tickets/${ticketId}`, { method: "GET" }, token);
}

export function updateTicket(token: string, ticketId: string, payload: TicketUpdate): Promise<TicketOut> {
  return request<TicketOut>(`/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
}

export function addInteraction(token: string, ticketId: string, content: string): Promise<InteractionOut> {
  return request<InteractionOut>(
    `/tickets/${ticketId}/interactions`,
    { method: "POST", body: JSON.stringify({ content }) },
    token,
  );
}

// Fase 10 (Configurações — categorias + SLA), restrito a technician/manager no backend.
export function listCategories(token: string): Promise<CategoryOut[]> {
  return request<CategoryOut[]>("/categories", { method: "GET" }, token);
}

export function createCategory(token: string, payload: CategoryCreate): Promise<CategoryOut> {
  return request<CategoryOut>("/categories", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateCategory(token: string, categoryId: string, payload: CategoryUpdate): Promise<CategoryOut> {
  return request<CategoryOut>(
    `/categories/${categoryId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    token,
  );
}

// Fase 12 (Catálogo de Serviços) — GET aberto a qualquer usuário autenticado,
// POST/PATCH restritos a technician/manager no backend.
export function listServices(token: string): Promise<ServiceOut[]> {
  return request<ServiceOut[]>("/services", { method: "GET" }, token);
}

export function createService(token: string, payload: ServiceCreate): Promise<ServiceOut> {
  return request<ServiceOut>("/services", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateService(token: string, serviceId: string, payload: ServiceUpdate): Promise<ServiceOut> {
  return request<ServiceOut>(`/services/${serviceId}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
}

export function listSlaRules(token: string): Promise<SLARuleOut[]> {
  return request<SLARuleOut[]>("/sla-rules", { method: "GET" }, token);
}

export function updateSlaRule(token: string, ruleId: string, payload: SLARuleUpdate): Promise<SLARuleOut> {
  return request<SLARuleOut>(`/sla-rules/${ruleId}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
}

// Fase 11 (Administração — usuários, grupos, auditoria), restrito a role=admin no backend.
export function listUsers(token: string): Promise<UserOut[]> {
  return request<UserOut[]>("/users", { method: "GET" }, token);
}

export function createUser(token: string, payload: UserCreate): Promise<UserOut> {
  return request<UserOut>("/users", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateUser(token: string, userId: string, payload: UserUpdate): Promise<UserOut> {
  return request<UserOut>(`/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
}

export function listGroups(token: string): Promise<GroupOut[]> {
  return request<GroupOut[]>("/groups", { method: "GET" }, token);
}

export function createGroup(token: string, payload: GroupCreate): Promise<GroupOut> {
  return request<GroupOut>("/groups", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateGroupMembers(token: string, groupId: string, payload: GroupMembersUpdate): Promise<GroupOut> {
  return request<GroupOut>(
    `/groups/${groupId}/members`,
    { method: "PATCH", body: JSON.stringify(payload) },
    token,
  );
}

export function listAuditLog(token: string): Promise<AuditLogOut[]> {
  return request<AuditLogOut[]>("/audit-log", { method: "GET" }, token);
}

export { ApiError };
