import type { TicketStatus } from "../types";

const BG: Record<TicketStatus, string> = {
  open: "bg-st-open-tint",
  in_progress: "bg-st-progress-tint",
  resolved: "bg-st-resolved-tint",
  closed: "bg-st-closed-tint",
};

const TEXT: Record<TicketStatus, string> = {
  open: "text-st-open",
  in_progress: "text-st-progress",
  resolved: "text-st-resolved",
  closed: "text-st-closed",
};

const LABELS: Record<TicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${BG[status]} ${TEXT[status]}`}>
      {LABELS[status]}
    </span>
  );
}
