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
      className="inline-flex items-center gap-2 rounded-[10px] bg-blue-600 px-4 py-2 font-sans text-[13px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.5)] transition-[filter] hover:brightness-95"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      Export CSV
    </button>
  );
}
