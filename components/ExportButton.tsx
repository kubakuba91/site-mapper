"use client";

import { buildExportCsv } from "@/lib/csv";
import type { CrawledPage, Mapping } from "@/lib/types";

type Props = {
  oldPages: CrawledPage[];
  mappings: Mapping[];
};

export default function ExportButton({ oldPages, mappings }: Props) {
  function handleExport() {
    const csv = buildExportCsv(oldPages, mappings);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "redirect-map.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-neutral-700"
    >
      Export CSV
    </button>
  );
}
