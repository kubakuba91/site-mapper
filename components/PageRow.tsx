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
  matched: "border-green-400 bg-green-50",
  dropped: "border-neutral-300 bg-neutral-100 opacity-70",
  unmatched: "border-neutral-300 bg-white hover:border-neutral-400 hover:shadow-sm",
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
      className={`group relative cursor-pointer rounded-lg border-2 px-4 py-3 text-sm transition-all ${
        armed ? "border-blue-600 bg-blue-50 ring-2 ring-blue-300" : statusStyles[side === "old" ? status : "unmatched"]
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-semibold text-neutral-900">{page.path}</div>
          {page.title && <div className="truncate text-sm text-neutral-700">{page.title}</div>}
          {page.description && (
            <div
              className={`text-sm text-neutral-500 ${expanded ? "" : "truncate"}`}
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
        </div>
        {side === "old" && status === "dropped" && (
          <span className="shrink-0 rounded-full bg-neutral-300 px-2.5 py-1 text-xs font-bold text-neutral-700">
            dropped
          </span>
        )}
        {side === "old" && status === "matched" && (
          <span className="shrink-0 rounded-full bg-green-200 px-2.5 py-1 text-xs font-bold text-green-800">
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
          className="absolute right-2 top-2 hidden rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-300 group-hover:block"
        >
          drop
        </button>
      )}
    </div>
  );
}
