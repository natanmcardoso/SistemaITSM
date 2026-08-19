import type { UserRole } from "../types";

// Rota inicial por persona.
export function homeRouteForRole(role: UserRole): string {
  if (role === "end_user") return "/novo-chamado";
  if (role === "manager") return "/dashboard";
  return "/fila";
}
