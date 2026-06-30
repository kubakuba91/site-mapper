"use client";

import { useState } from "react";
import type { CrawledPage, MappingStatus } from "@/lib/types";

type Props = {
  page: CrawledPage;
  side: "old" | "new";
  status?: MappingStatus;
  armed?: boolean;
  mappedOldPaths?: string[];
  onClick: () => void;
  onMarkDropped?: () => void;
};

const cardStatusStyles: Record<MappingStatus, string> = {
  matched: "border-green-300 bg-green-50/40",
  dropped: "border-neutral-300 bg-neutral-100 opacity-70",
  unmatched: "border-[#E4E7EC] bg-white hover:border-blue-300 hover:shadow-[0_8px_22px_-14px_rgba(16,18,22,0.30)] hover:-translate-y-px",
};

const targetStatusStyles: Record<MappingStatus, string> = {
  matched: "bg-green-100 text-green-700",
  dropped: "bg-neutral-200 text-neutral-500",
  unmatched: "bg-[#FBFBFC] text-[#C2C7CF] group-hover:bg-blue-600 group-hover:text-white",
};

export default function PageRow({
  page,
  side,
  status = "unmatched",
  armed,
  mappedOldPaths = [],
  onClick,
  onMarkDropped,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const effectiveStatus = side === "old" ? status : "unmatched";

  const target = (
    <div
      title={side === "old" ? "Map to a new-site page" : "Receive a mapping from an old-site page"}
      className={`flex items-center justify-center font-mono text-[11px] transition-colors ${
        side === "old" ? "border-l border-[#EDEFF2]" : "border-r border-[#EDEFF2]"
      } ${targetStatusStyles[effectiveStatus]}`}
    >
      ■
    </div>
  );

  return (
    <div
      data-row-id={`${side}:${page.path}`}
      onClick={onClick}
      onContextMenu={(e) => {
        if (side === "old" && onMarkDropped) {
          e.preventDefault();
          onMarkDropped();
        }
      }}
      className={`group relative grid shrink-0 cursor-pointer overflow-hidden rounded-xl border transition-all ${
        side === "old" ? "grid-cols-[minmax(0,1fr)_42px]" : "grid-cols-[42px_minmax(0,1fr)]"
      } ${
        armed ? "border-blue-600 ring-2 ring-blue-200" : cardStatusStyles[effectiveStatus]
      }`}
    >
      {side === "new" && target}
      <div className="relative z-10 min-w-0 flex-1 px-4 py-3.5">
        <div className="mb-1 flex min-w-0 items-center gap-1.5">
          <div className="truncate font-mono text-[13px] font-semibold text-[#14161A]">{page.path}</div>
          <PageOpenLink url={page.url} />
        </div>
        {page.title && <div className="mb-0.5 truncate text-[13.5px] font-medium text-[#2B2F36]">{page.title}</div>}
        {page.description && (
          <div
            className={`text-[12.5px] text-[#9298A2] ${expanded ? "" : "truncate"}`}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            title={page.description}
          >
            {page.description}
          </div>
        )}
        {page.statusCode >= 400 && (
          <div className="mt-0.5 text-xs font-bold text-red-600">HTTP {page.statusCode}</div>
        )}
        {side === "new" && mappedOldPaths.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mappedOldPaths.map((oldPath) => (
              <span
                key={oldPath}
                title={oldPath}
                className="max-w-full truncate rounded-full border border-green-200 bg-green-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-green-700"
              >
                {oldPath}
              </span>
            ))}
          </div>
        )}
        {side === "old" && status === "dropped" && (
          <span className="mt-1 inline-block rounded-full bg-neutral-300 px-2 py-0.5 text-[11px] font-bold text-neutral-700">
            dropped
          </span>
        )}
        {side === "old" && status === "matched" && (
          <span className="mt-1 inline-block rounded-full bg-green-200 px-2 py-0.5 text-[11px] font-bold text-green-800">
            matched
          </span>
        )}
      </div>
      {side === "old" && target}
      {side === "old" && status === "unmatched" && onMarkDropped && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMarkDropped();
          }}
          className="absolute right-[48px] top-2 hidden rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-300 group-hover:block"
        >
          drop
        </button>
      )}
    </div>
  );
}

function PageOpenLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open page: ${url}`}
      title={`Open page: ${url}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-transparent text-[#A4A9B4] transition hover:border-[#DDE1E7] hover:bg-[#F7F8FA] hover:text-blue-600"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </a>
  );
}
