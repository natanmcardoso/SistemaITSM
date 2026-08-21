// Fase 15 (Relatórios) — exportação client-side, sem dependência nova: CSV é
// só formatar texto e disparar um download via Blob; PDF usa impressão do
// navegador (window.print(), CSS de impressão na própria ReportsPage.tsx) —
// nenhuma lib nova no projeto pra isso.

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: (string | number)[][]): string {
  // ﻿ (BOM) na frente ajuda o Excel a reconhecer UTF-8 de acentuação
  // (nomes/categorias em português) sem precisar de import manual.
  return "﻿" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
