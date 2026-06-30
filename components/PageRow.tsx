"use client";

import { useState } from "react";
import type { CrawledPage, MappingStatus } from "@/lib/types";

type Props = {
  page: CrawledPage;
  side: "old" | "new";
  status?: MappingStatus;
  armed?: boolean;
  onClick: () => void;
  onMarkDropped?: () => void;
};

const statusStyles: Record<MappingStatus, string> = {
  matched: "border-green-300 bg-green-50",
  dropped: "border-neutral-300 bg-neutral-100 opacity-60",
  unmatched: "border-neutral-200 bg-white",
};

export default function PageRow({ page, side, status = "unmatched", armed, onClick, onMarkDropped }: Props) {
  const [expanded, setExpanded] = useState(false);

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
      className={`group relative cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors ${
        armed ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300" : statusStyles[side === "old" ? status : "unmatched"]
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs text-neutral-800">{page.path}</div>
          {page.title && <div className="truncate text-xs text-neutral-500">{page.title}</div>}
          {page.description && (
            <div
              className={`text-xs text-neutral-400 ${expanded ? "" : "truncate"}`}
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
            <div className="text-[10px] font-medium text-red-500">HTTP {page.statusCode}</div>
          )}
        </div>
        {side === "old" && status === "dropped" && (
          <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
            dropped
          </span>
        )}
        {side === "old" && status === "matched" && (
          <span className="shrink-0 rounded bg-green-200 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
            matched
          </span>
        )}
      </div>
      {side === "old" && status === "unmatched" && onMarkDropped && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMarkDropped();
          }}
          className="absolute right-2 top-2 hidden rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-300 group-hover:block"
        >
          drop
        </button>
      )}
    </div>
  );
}
