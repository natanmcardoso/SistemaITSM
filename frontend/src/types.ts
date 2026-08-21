// Espelha app/schemas.py do backend (Fase 2/3/4.0).

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type UserRole = "end_user" | "technician" | "manager" | "admin";

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
  category_id?: string;
  // Fase 12 (Catálogo de Serviços) — se informado sem category_id explícito,
  // o backend herda a categoria do serviço.
  service_id?: string;
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
  service_id: string | null;
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
  // Fase 14 (Dashboard expandido) — resolved/closed agrupados por técnico
  productivity_by_technician: CategoryCount[];
}

// Fase 14 (Dashboard expandido) — dashboard pessoal do técnico
export interface TechnicianDashboardSummary {
  meus_chamados: number;
  pendencias: number;
  criticos: number;
  aguardando_resposta: number;
}

export interface KBArticleOut {
  id: string;
  title: string;
  content: string;
  category_id: string | null;
  times_suggested: number;
}

export interface KBArticleCreate {
  title: string;
  content: string;
  category_id?: string;
}

export interface KBArticleUpdate {
  title?: string;
  content?: string;
  category_id?: string;
}

// Fase 10 (Configurações — categorias + SLA)
export interface CategoryOut {
  id: string;
  name: string;
  default_sla_hours: number;
}

export interface CategoryCreate {
  name: string;
  default_sla_hours: number;
}

export interface CategoryUpdate {
  name?: string;
  default_sla_hours?: number;
}

// Fase 12 (Catálogo de Serviços)
export interface ServiceOut {
  id: string;
  name: string;
  category_id: string;
  description: string | null;
  created_at: string;
}

export interface ServiceCreate {
  name: string;
  category_id: string;
  description?: string;
}

export interface ServiceUpdate {
  name?: string;
  category_id?: string;
  description?: string;
}

export interface SLARuleOut {
  id: string;
  priority: TicketPriority;
  response_time_hours: number;
  resolution_time_hours: number;
}

export interface SLARuleUpdate {
  response_time_hours?: number;
  resolution_time_hours?: number;
}

// Fase 13 (Calendário de horário comercial) — weekday segue a convenção de
// datetime.weekday() no backend: 0=segunda...6=domingo. start_time/end_time
// no formato "HH:MM:SS".
export interface BusinessHoursOut {
  id: string;
  weekday: number;
  is_open: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface BusinessHoursUpdate {
  is_open?: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

export interface HolidayOut {
  id: string;
  date: string;
  name: string;
}

export interface HolidayCreate {
  date: string;
  name: string;
}

// Fase 11 (Administração — usuários, grupos, auditoria)
export interface UserCreate {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

export interface UserUpdate {
  name?: string;
  role?: UserRole;
}

export interface GroupOut {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_ids: string[];
}

export interface GroupCreate {
  name: string;
  description?: string;
}

export interface GroupMembersUpdate {
  member_ids: string[];
}

export interface AuditLogOut {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

// Fase 16 (Automações) — 1 regra fixa, só o limiar editável.
export interface AutomationRuleOut {
  id: string;
  key: string;
  threshold_percent: number;
  enabled: boolean;
}

export interface AutomationRuleUpdate {
  threshold_percent?: number;
  enabled?: boolean;
}

export interface AutomationNotification {
  ticket_id: string;
  title: string;
  priority: TicketPriority | null;
  sla_due_at: string;
  elapsed_percent: number;
  breached: boolean;
}
