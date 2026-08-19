import type {
  DashboardSummary,
  InteractionOut,
  KBArticleOut,
  TicketCreate,
  TicketDetailOut,
  TicketOut,
  TicketUpdate,
  TokenResponse,
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

export { ApiError };
