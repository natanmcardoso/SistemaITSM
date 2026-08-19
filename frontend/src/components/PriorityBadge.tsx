import type { TicketPriority } from "../types";

const DOT: Record<TicketPriority, string> = {
  critical: "bg-crit",
  high: "bg-high",
  medium: "bg-med",
  low: "bg-low",
};

const TEXT: Record<TicketPriority, string> = {
  critical: "text-crit",
  high: "text-high",
  medium: "text-med",
  low: "text-low",
};

const LABELS: Record<TicketPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function PriorityBadge({ priority }: { priority: TicketPriority | null }) {
  if (!priority) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${TEXT[priority]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[priority]}`} />
      {LABELS[priority]}
    </span>
  );
}
