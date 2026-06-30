import type { CrawledPage, Mapping } from "./types";

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildExportCsv(oldPages: CrawledPage[], newPages: CrawledPage[], mappings: Mapping[]): string {
  const header = [
    "old_url",
    "old_title",
    "old_meta",
    "new_url",
    "new_current_title",
    "new_current_meta",
    "metadata_title_to_apply",
    "metadata_meta_to_apply",
    "status",
  ];
  const newPageByPath = new Map(newPages.map((page) => [page.path, page]));
  const rows = oldPages.map((page) => {
    const mapping = mappings.find((m) => m.oldPath === page.path);
    const status = mapping?.status ?? "unmatched";
    const newPage = status === "matched" && mapping?.newPath ? newPageByPath.get(mapping.newPath) : null;
    const metadataTitle = status === "matched" ? mapping?.metadataTitle ?? page.title ?? "" : "";
    const metadataDescription = status === "matched" ? mapping?.metadataDescription ?? page.description ?? "" : "";
    return [
      page.url,
      page.title ?? "",
      page.description ?? "",
      newPage?.url ?? mapping?.newPath ?? "",
      newPage?.title ?? "",
      newPage?.description ?? "",
      metadataTitle,
      metadataDescription,
      status,
    ].map((field) => escapeCsvField(String(field)));
  });
  return [header, ...rows].map((row) => row.join(",")).join("\n");
}
