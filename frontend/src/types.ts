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

export interface TicketCreate {
  title: string;
  description: string;
  requester_id: string;
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

export interface InteractionOut {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface TicketDetailOut extends TicketOut {
  interactions: InteractionOut[];
}

export interface TicketUpdate {
  status?: TicketStatus;
  priority?: TicketPriority;
  category_id?: string;
  assignee_id?: string;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface AIAccuracyMetric {
  suggested_total: number;
  matched: number;
  changed: number;
}

export interface SLAMetric {
  tracked_total: number;
  breached: number;
}

export interface AIResolutionMetric {
  total_tickets: number;
  resolved_by_ai: number;
}

export interface DashboardSummary {
  total_tickets: number;
  by_status: Record<TicketStatus, number>;
  top_categories: CategoryCount[];
  ai_accuracy_priority: AIAccuracyMetric;
  ai_accuracy_category: AIAccuracyMetric;
  sla: SLAMetric;
  ai_resolution: AIResolutionMetric;
  // Fase 6 (CMDB + Problem Management) — mesmo shape de CategoryCount
  top_assets: CategoryCount[];
  top_problems: CategoryCount[];
}

export interface KBArticleOut {
  id: string;
  title: string;
  content: string;
  category_id: string | null;
  times_suggested: number;
}
