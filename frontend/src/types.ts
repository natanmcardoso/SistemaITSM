// Espelha app/schemas.py do backend (Fase 2/3/4.0).

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type UserRole = "end_user" | "technician" | "manager";

export interface UserOut {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserOut;
}

export interface TicketOut {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority | null;
  category_id: string | null;
  requester_id: string;
  assignee_id: string | null;
  ai_suggested_priority: TicketPriority | null;
  ai_suggested_category_id: string | null;
  resolved_by_ai: boolean;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
}
