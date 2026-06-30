import type { CrawledPage, Mapping } from "./types";

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildExportCsv(oldPages: CrawledPage[], mappings: Mapping[]): string {
  const header = ["old_url", "old_title", "old_meta", "new_url", "status"];
  const rows = oldPages.map((page) => {
    const mapping = mappings.find((m) => m.oldPath === page.path);
    const status = mapping?.status ?? "unmatched";
    const newUrl = status === "matched" ? mapping?.newPath ?? "" : "";
    return [page.url, page.title ?? "", page.description ?? "", newUrl, status].map((field) =>
      escapeCsvField(String(field)),
    );
  });
  return [header, ...rows].map((row) => row.join(",")).join("\n");
}
