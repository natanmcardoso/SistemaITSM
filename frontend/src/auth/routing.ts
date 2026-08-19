import type { UserRole } from "../types";

// Rota inicial por persona. "manager" ainda não tem tela própria nesta fase
// (dashboard do gestor é a próxima tela, 3/3) — cai na fila como fallback.
export function homeRouteForRole(role: UserRole): string {
  return role === "end_user" ? "/novo-chamado" : "/fila";
}
