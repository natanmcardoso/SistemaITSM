// Fase 14 (Prioridades — preferências de visualização) — filtro padrão que o
// técnico quer ver ao abrir a fila, sem precisar reaplicar toda vez. Mesmo
// padrão de persistência local já usado no seletor de colunas (Fase 9,
// itsm.queueVisibleColumns) — client-side, por navegador, sem endpoint novo.
const STORAGE_KEY = "itsm.defaultQueueFilters";

export interface QueueFilterPreference {
  status: string;
  priority: string;
  category: string;
}

const EMPTY: QueueFilterPreference = { status: "", priority: "", category: "" };

export function loadQueueFilterPreference(): QueueFilterPreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      status: typeof parsed.status === "string" ? parsed.status : "",
      priority: typeof parsed.priority === "string" ? parsed.priority : "",
      category: typeof parsed.category === "string" ? parsed.category : "",
    };
  } catch {
    return EMPTY;
  }
}

export function saveQueueFilterPreference(pref: QueueFilterPreference): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}

export function hasQueueFilterPreference(pref: QueueFilterPreference): boolean {
  return Boolean(pref.status || pref.priority || pref.category);
}
